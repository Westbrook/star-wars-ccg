import test from 'node:test';
import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch,shuffleEntropy,normalizedCheckpoint,assertReferenceAction,followingTarget} from './gemp-match-replay.mjs';
import {load} from '../native-proof/load-engine.mjs';
const {shuffled}=load(new URL('../../lib/native-engine/random.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const loadMatch=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));

for(const name of ['ground-a','ground-b','ground-weapons','ground-movement','ground-attachments','ground-mines','ground-responses'])test('complete GEMP introductory match replays with exact checkpoints: '+name,()=>{
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
