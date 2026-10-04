import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readGempMatch,replayGempMatch,shuffleEntropy,normalizedCheckpoint,assertReferenceAction,followingTarget,inspectionChoice,assertRecoverySelection} from './gemp-match-replay.mjs';
import {load} from '../native-proof/load-engine.mjs';
const {shuffled}=load(new URL('../../lib/native-engine/random.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const loadMatch=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));

for(const name of ['ground-a','ground-b','ground-weapons','ground-movement','ground-attachments','ground-mines','ground-responses','ground-devices','ground-inspections','ground-mine-pairs','ground-hand-retention','ground-recovery'])test('complete GEMP introductory match replays with exact checkpoints: '+name,()=>{
 const reference=loadMatch(name),before=JSON.stringify(reference),result=replayGempMatch(reference);
 assert.equal(JSON.stringify(reference),before,'reference fixture must stay immutable');
 assert.equal(result.state.result.winner,reference.winner);
 assert.equal(result.state.turn.number,reference.final.turn);
 assert.ok(result.checkpoints>=100);
 assert.ok(reference.trace.filter(r=>r.semantic?.kind==='battle').length>=3);
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='forfeit'&&r.state.battleLosses));
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='lose'));
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='drain'));
 assert.equal(result.state.deckSize,60);
 if(name==='ground-recovery'){
  const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/recovery-match-provenance.json',import.meta.url))).fixtures[0];
  assert.equal(result.commands,receipt.nativeCommands);assert.equal(result.checkpoints,receipt.comparedCheckpoints);
 }
 for(const deck of Object.values(reference.decks))for(const bp of deck)assert.equal(premiereRules.supports(bp),false,'a matching path must not admit a whole deck');
});
test('recorded setup permutation is replayed through the real shuffle, preserving the input',()=>{
 const before=['one','two','three','four','five'],after=['five','two','one','three','four'],values=shuffleEntropy(before,after);let i=0;
 assert.deepEqual(shuffled(before,()=>values[i++]),after);assert.equal(i,4);assert.deepEqual(before,['one','two','three','four','five']);
 assert.throws(()=>shuffleEntropy(before,[...after.slice(1),'unknown']));
});
test('checkpoint normalization preserves within-system adjacency and every ordered pile',()=>{
 const cards={a:{blueprint:'1_129'},b:{blueprint:'1_130'},c:{blueprint:'101_1'},d:{blueprint:'101_4'}};
 const source={locations:['a','b','c','d'],players:{dark:{hand:['2','1'],reserve:['4','3'],force:['6','5'],used:['8','7'],lost:['0','9']}}};
 const normalize=locations=>normalizedCheckpoint({...source,locations},cards);
 assert.deepEqual(normalize(['c','d','a','b']),normalize(['a','b','c','d']));
 assert.notDeepEqual(normalize(['b','a','c','d']),normalize(['a','b','c','d']));
 const result=normalize(source.locations);assert.deepEqual(result.players.dark.hand,['1','2']);
 for(const pile of ['reserve','force','used','lost'])assert.deepEqual(result.players.dark[pile],source.players.dark[pile]);
});
test('an incomplete or wrong-deck reference cannot count as complete-match evidence',()=>{
 const record=loadMatch('ground-a');record.finished=false;assert.throws(()=>replayGempMatch(record),/Reference match must finish/);
 record.finished=true;record.decks.dark.pop();assert.throws(()=>replayGempMatch(record));
});
test('altering a reference pile order is caught at the checkpoint, not accepted because counts match',()=>{
 const record=loadMatch('ground-a');const row=record.trace.find(r=>r.semantic?.kind==='activate');row.state.players.dark.reserve.reverse();
 assert.throws(()=>replayGempMatch(record),/Checkpoint/);
});
test('altering the final winner is rejected even after all intermediate checkpoints match',()=>{
 const record=loadMatch('ground-a');record.winner=record.winner==='dark'?'light':'dark';
 assert.throws(()=>replayGempMatch(record));
});
test('an Interrupt drawing destiny cannot be mislabeled as an ordinary draw',()=>{
 const record=loadMatch('ground-a'),row=record.trace.find(r=>r.semantic?.kind==='draw');
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Draw destiny to retrieve troopers';
 assert.throws(()=>assertReferenceAction(row),/does not match/);
});

test('expanded reference includes movement, conversions and firing with an empty Reserve',()=>{
 const r=loadMatch('ground-movement'),actions=r.trace.filter(x=>x.semantic);
 assert.equal(actions.filter(x=>x.semantic.kind==='move').length,170);
 assert.equal(actions.filter(x=>x.semantic.kind==='site').length,11);
 assert.ok(actions.some(x=>x.semantic.kind==='fire'&&x.state.players[x.semantic.side].reserve.length===0));
 assert.ok(r.trace.some(x=>x.state.table.some(c=>c.hit)));
 assert.ok(actions.some((x,i)=>x.semantic.kind==='site'&&actions.slice(i+1).some(y=>y.state.locations.includes(x.semantic.card)&&y.state.locations.length===x.state.locations.length)));
});
for(const field of ['attachedTo','hit'])test('expanded replay rejects altered '+field+' at a checkpoint',()=>{
 const r=loadMatch('ground-weapons');
 const row=r.trace.find(x=>['activate','draw','deploy','fire','battle','drain','forfeit','lose'].includes(x.semantic?.kind)&&x.state.table.some(c=>c.attachedTo));
 assert.ok(row);const card=row.state.table.find(c=>c.attachedTo);
 if(field==='attachedTo')card.attachedTo=card.id;else card.hit=!card.hit;
 assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});

test('attachment reference records owner-chosen simultaneous Lost Pile order',()=>{
 const r=loadMatch('ground-attachments'),rows=r.trace.filter(x=>x.semantic?.kind==='loss-order');
 assert.equal(rows.length,2);for(const row of rows){assert.equal(row.type,'ARBITRARY_CARDS');assert.ok(row.semantic.card);assert.equal(row.text,'Choose card to put on Lost Pile');}
});

test('an absent target cannot be borrowed from a later action',()=>{
 const rows=[{semantic:{kind:'fire'}},{semantic:{kind:'pass'}},{semantic:{kind:'deploy'}},{semantic:{kind:'fire-target',card:'other'}}];
 assert.throws(()=>followingTarget(rows,0,'fire-target'),/Missing target/);
 assert.equal(followingTarget([rows[0],rows[1],rows[3]],0,'fire-target').semantic.card,'other');
});


test('response match exercises actual Barrier, damage reduction and serial mine casualties',()=>{
 const r=loadMatch('ground-responses'),actions=r.trace.filter(x=>x.semantic),count=kind=>actions.filter(x=>x.semantic.kind===kind).length;
 assert.equal(count('barrier'),4);assert.equal(count('reduce'),18);assert.equal(count('mine-victims'),3);
 const mineRows=actions.filter(x=>x.semantic.kind==='mine-victims');assert.ok(mineRows.every(x=>x.state.turn===13&&x.state.phase==='between_turns'));
 assert.deepEqual(mineRows.map(x=>x.state.table.filter(c=>!c.attachedTo&&c.id.startsWith('light-')&&c.location===x.state.table.find(c=>c.id===x.semantic.cards[0]).location).length),[4,3,2]);
});
for(const kind of ['barrier','reduce'])test('reference '+kind+' tag must match its chosen action',()=>{
 const row=loadMatch('ground-responses').trace.find(x=>x.semantic?.kind===kind);assertReferenceAction(row);
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Pass';assert.throws(()=>assertReferenceAction(row),/does not match/);
});


test('device match includes paired mine ordering, both inspections and battle loss reduction',()=>{
 const r=loadMatch('ground-devices'),rows=r.trace,count=kind=>rows.filter(x=>x.semantic?.kind===kind).length;
 assert.equal(r.snapshotVersion,4);assert.equal(count('explode'),2);assert.equal(count('inspection'),63);assert.equal(count('inspection-force'),29);
 assert.ok(rows.some(x=>x.semantic?.kind==='reduce'&&x.state.battleLosses));
 const mine=rows.find(x=>x.semantic?.kind==='explode');assert.ok(mine.parameters.actionText.length>=2);
 assert.ok(rows.some(x=>x.semantic?.kind==='inspection'&&x.state.table.some(c=>!c.location)));
});
test('inspection follows its actual Yes/No answer and never borrows a later choice',()=>{
 const rows=loadMatch('ground-devices').trace,target=rows.findIndex(x=>x.semantic?.kind==='inspection-force'),index=rows.findLastIndex((x,i)=>i<target&&x.semantic?.kind==='inspection');assert.ok(index>=0);
 assert.equal(inspectionChoice(rows,index,true),'to-force');rows[target].answer='1';assert.equal(inspectionChoice(rows,index,true),'keep');
 rows[target].answer='unexpected';assert.throws(()=>inspectionChoice(rows,index,true),/Invalid inspection answer/);
 rows[target].semantic.kind='draw';assert.throws(()=>inspectionChoice(rows,index,true),/Missing target/);
});
test('private inspection rejects altered revealed blueprint evidence',()=>{
 const r=loadMatch('ground-devices'),row=r.trace.find(x=>x.semantic?.kind==='inspection');row.parameters.blueprintId[0]='1_999';
 assert.throws(()=>replayGempMatch(r),/Private inspection/);
});
test('unattached Macroscan is included in full-match table comparisons',()=>{
 const r=loadMatch('ground-devices'),row=r.trace.find(x=>x.semantic?.kind==='peek'&&x.state.table.some(c=>!c.location));
 assert.ok(row);row.state.table=row.state.table.filter(c=>c.location);assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});
test('battle total comparison includes reductions without discarding the obligation',()=>{
 const r=loadMatch('ground-devices'),index=r.trace.findIndex(x=>x.semantic?.kind==='reduce'&&x.state.battleLosses),row=r.trace.slice(index+1).find(x=>x.semantic?.kind==='forfeit');
 assert.ok(index>=0&&row);assert.equal(row.state.battleLosses.light.totalDamage,5);row.state.battleLosses.light.totalDamage=7;
 assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});
for(const kind of ['macroscan','peek','explode'])test('device reference '+kind+' tag must match its chosen action',()=>{
 const row=loadMatch('ground-devices').trace.find(x=>x.semantic?.kind===kind);assertReferenceAction(row);
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Pass';assert.throws(()=>assertReferenceAction(row),/does not match/);
});

test('complete recovery match exercises both responses to the same real forfeiture',()=>{
 const record=loadMatch('ground-recovery'),rows=record.trace;
 const k=rows.findIndex(r=>r.semantic?.kind==='kintan'),b=rows.findIndex(r=>r.semantic?.kind==='old-ben');
 assert.ok(k>=0&&b>k);assert.ok(!rows.slice(k+1,b).some(r=>r.semantic?.kind==='forfeit'));
 const ben=rows[b],target=ben.semantic.target,forfeit=rows.slice(0,b).findLast(r=>r.semantic?.kind==='forfeit');
 assert.equal(forfeit.semantic.card,target);assert.ok(forfeit.state.table.some(c=>c.attachedTo===target));
 const selected=followingTarget(rows,b,'recovery-selection');assertRecoverySelection(selected,'light',record.decks.light[Number(target.split('-')[1])-1]);
 const nextForfeit=rows.slice(b+1).find(r=>r.semantic?.kind==='forfeit');
 assert.ok(nextForfeit.state.table.some(c=>c.id===target));assert.ok(!nextForfeit.state.table.some(c=>c.attachedTo===target));
 assert.equal(nextForfeit.state.battleLosses.light.damage,ben.state.battleLosses.light.damage,'Revival retains already paid forfeit credit');
 assert.notEqual(nextForfeit.semantic.card,target,'Revived character does not rejoin this battle');
});

for(const kind of ['old-ben','kintan'])test('recovery selection validates the actual selectable temporary ID: '+kind,()=>{
 const rows=loadMatch('ground-recovery').trace,index=rows.findIndex(r=>r.semantic?.kind===kind),row=followingTarget(rows,index,'recovery-selection');
 const answer=row.parameters.cardId.indexOf(row.answer),blueprint=row.parameters.blueprintId[answer];assertRecoverySelection(row,row.semantic.side,blueprint,kind);
 const changed=structuredClone(row);changed.parameters.selectable[answer]='false';assert.throws(()=>assertRecoverySelection(changed,row.semantic.side,blueprint,kind),/not selectable/);
 changed.parameters.selectable[answer]='true';changed.answer='not-a-reference-card';assert.throws(()=>assertRecoverySelection(changed,row.semantic.side,blueprint,kind),/answer missing/);
 assert.throws(()=>assertRecoverySelection(row,row.semantic.side,'unknown',kind),/wrong character/);
 const action=rows[index];assertReferenceAction(action);action.parameters.actionText[action.parameters.actionId.indexOf(action.answer)]='Pass';assert.throws(()=>assertReferenceAction(action),/does not match/);
});

test('Old Ben cannot silently return to another site in the recorded game',()=>{
 const record=loadMatch('ground-recovery'),rows=record.trace,index=rows.findIndex(r=>r.semantic?.kind==='old-ben'),target=rows[index].semantic.target;
 const returned=rows.slice(index+1).find(r=>r.state.table.some(c=>c.id===target));const card=returned.state.table.find(c=>c.id===target);
 card.location=returned.state.locations.find(id=>id!==card.location);assert.throws(()=>replayGempMatch(record),/original site/);
});

test('complete recovery evidence is bound to its exact executed source and recorded game',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/recovery-match-provenance.json',import.meta.url))),f=receipt.fixtures[0],sha=p=>createHash('sha256').update(fs.readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
 assert.equal(sha(f.fixture),f.sha256);assert.equal(sha(f.harness),f.harnessSha256);
 assert.equal(sha('tests/native-engine/gemp/NativeEngineRecoveryMatchOracleTests.java'),f.harnessSha256);
 const r=loadMatch('ground-recovery');assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.final.turn,f.turns);assert.equal(r.winner,f.winner);
 assert.equal(receipt.unchangedProductionFiles,6820);assert.equal(f.actions['old-ben'],1);assert.equal(f.actions.kintan,1);
});
