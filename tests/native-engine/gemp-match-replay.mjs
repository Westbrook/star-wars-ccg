import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules, starterDecks} from './match-runner.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const publicValues=load(new URL('../../lib/native-engine/public-values.ts',import.meta.url)).publicValues;
const ability=load(new URL('../../lib/native-engine/ability.ts',import.meta.url));
const losses=load(new URL('../../lib/native-engine/loss.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereSites}=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const copy=x=>JSON.parse(JSON.stringify(x));
const phases=['activate','control','deploy','battle','move','draw'];

/** Encode a recorded lawful shuffle as Fisher-Yates choices. This supplies only
 * setup entropy: no card/pile changes are made after setup or during replay. */
export function shuffleEntropy(before,after){
 assert.deepEqual([...before].sort(),[...after].sort());
 const working=[...before],values=[];
 for(let i=working.length-1;i>0;i--){const j=working.indexOf(after[i]);assert.ok(j>=0&&j<=i);values.push(j);[working[i],working[j]]=[working[j],working[i]];}
 assert.deepEqual(working,after);return values;
}
/** Separate systems may be laid out in a different screen order. Keep site
 * order within each system: sorting all locations would hide adjacency bugs. */
export function normalizedCheckpoint(s,cards){
 const groups=new Map();
 for(const id of s.locations){const system=premiereSites[cards[id].blueprint]?.system;assert.ok(system);if(!groups.has(system))groups.set(system,[]);groups.get(system).push(id);}
 return {...s,...(s.phase==='between_turns'?{phase:'activate'}:{}),locations:[...groups.keys()].sort().flatMap(group=>groups.get(group)),players:Object.fromEntries(Object.entries(s.players).map(([side,p])=>[side,{...p,hand:[...p.hand].sort()}]))};
}
function snapshot(m,expected,version){
 const values=publicValues(m);
 if(version>=5&&expected.battleLosses)assert.ok(expected.battleDestinies,'Version 5 damage checkpoints require completed destiny evidence');
 for(const card of expected.table)if(card.stats){const actual=values.characters[card.id];assert.ok(actual,'Missing public character values');assert.deepEqual({power:actual.power,ability:actual.ability,forfeit:actual.forfeit},card.stats,'Public character values must match GEMP');}
 const result={turn:m.turn.number,side:m.turn.side,phase:m.turn.phase,locations:[...m.locations],players:Object.fromEntries(['dark','light'].map(side=>[side,Object.fromEntries(['reserve','force','used','lost','hand'].map(p=>[p,[...m.players[side][p]]]))])),table:Object.values(m.cards).filter(c=>c.zone==='table'&&(c.location||version>=4&&board.cardDefinition(m,c.id).type!=='Location')).map(c=>({id:c.id,...(c.location?{location:c.location}:{}),...(version>=3?{...(c.attachedTo?{attachedTo:c.attachedTo}:{}),hit:combat.battle(m)?.hits.includes(c.id)??false}:{}),...(version>=2&&board.cardDefinition(m,c.id).type==='Character'?{stats:{power:board.power(m,c.id,combat.battle(m)?.stage!=='complete'&&combat.battle(m)?.initiator!==c.owner&&combat.members(m,c.owner).includes(c.id)),ability:ability.ability(m,c.id),forfeit:board.forfeit(m,c.id)}}:{})})).sort((a,b)=>a.id.localeCompare(b.id))};
 if(expected.battleLosses){const b=combat.battle(m);assert.ok(b);result.battleLosses=Object.fromEntries(['dark','light'].map(side=>[side,{damage:combat.battleDamage(m,side),totalDamage:b.damageLedger?losses.lossTotal(m,side,b.damageLedger[side]):b.initialDamage[side],totalAttrition:b.initialAttrition[side],...(version>=5?{attrition:b.attrition[side]}:{})}]));}
 if(expected.battleDestinies){
  const b=combat.battle(m);assert.ok(b);
  result.battleDestinies=Object.fromEntries(['dark','light'].map(side=>{
   const draws=(b.destinyResults?.[side]?.draws??[]).filter(d=>d.value!==null);
   return [side,{total:b.destiny[side]??0,cards:draws.map(d=>d.card),values:draws.map(d=>d.value)}];
  }));
 }
 return result;
}

/** Do not confuse card text such as "Draw destiny to retrieve..." with the
 * normal Draw action. The reference's chosen command must support its tag. */
export function assertReferenceAction(row){
 const kind=row.semantic?.kind;
 if(!['activate','draw','deploy','equip','fire','site','move','battle','drain','barrier','reduce','explode','macroscan','peek','kintan','old-ben','stun','dice','takeel','run-luke','escape'].includes(kind))return;
 const index=row.parameters.actionId?.indexOf(row.answer);assert.ok(index>=0,'Reference action answer missing');
 const label=row.parameters.actionText[index].toLowerCase();
 const valid=kind==='activate'?label==='activate force':kind==='draw'?label==='draw card into hand from force pile':
  kind==='move'?label==='move using landspeed':kind==='fire'?label.startsWith('fire '):['deploy','equip','site','macroscan'].includes(kind)?label.startsWith('deploy')&&row.state.players[row.semantic.side].hand.includes(row.semantic.card):
  kind==='run-luke'?label==='move luke to battle':kind==='escape'?label==='move cards with ability away':kind==='stun'?label==='return character to hand':kind==='dice'?label==='cancel and re-draw battle destiny':kind==='takeel'?label==='switch battle destiny numbers':
  kind==='kintan'?label==='regenerate top-most character':kind==='old-ben'?label.startsWith('revive '):kind==='peek'?label.startsWith('peek at top'):kind==='battle'?label.startsWith('initiate battle'):kind==='barrier'?label.startsWith('prevent '):kind==='reduce'?label==='reduce force loss':kind==='explode'?label==="'explode'":label.startsWith('force drain');
 assert.ok(valid,'Reference semantic action does not match the chosen command: '+label);
}


/** Targets belong to their initiating action; never borrow a later action's choice. */
export function followingTarget(rows,index,kind){
 for(const row of rows.slice(index+1)){
  const tag=row.semantic?.kind;if(!tag||tag==='pass')continue;
  assert.equal(tag,kind,'Missing target before the next reference action');return row;
 }
 throw Error('Reference target missing: '+kind);
}

/** Lost Pile dialogs also include cards that cannot be selected. Validate the
 * actual temporary-ID answer rather than assuming the first displayed card. */
export function assertRecoverySelection(row,side,blueprint,kind='old-ben'){
 assert.equal(row.semantic?.kind,'recovery-selection');assert.equal(row.semantic.side,side);
 assert.equal(row.type,'ARBITRARY_CARDS');assert.equal(row.text,kind==='kintan'?'Choose card to retrieve':'Choose card from Lost Pile');
 assert.deepEqual(row.parameters.min,['1']);assert.deepEqual(row.parameters.max,['1']);
 const index=row.parameters.cardId.indexOf(row.answer);assert.ok(index>=0,'Recovery answer missing');
 assert.equal(row.parameters.selectable[index],'true','Recovery card is not selectable');
 assert.equal(row.parameters.selectable.filter(v=>v==='true').length,1,'Recovery target is ambiguous');
 assert.equal(row.parameters.blueprintId[index],blueprint,'Recovery selected the wrong character');
}

/** Targets are read from the selected GEMP Action after actual targeting. This
 * also covers its single-target shortcut, without guessing from a later turn. */
export function assertInterruptTarget(rows,index,cards){
 const row=rows[index],s=row.semantic,o=row.targetObservation;
 assert.ok(o&&Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Missing actual target observation');
 assert.equal(o.card,s.target);assert.equal(o.blueprint,cards[s.target]?.blueprint,'Target blueprint differs');
 assert.ok(row.state.table.some(c=>c.id===s.target),'Target must be on table at initiation');
 if(o.afterDecision!==index){
  const selected=followingTarget(rows,index,'interrupt-target');assert.equal(rows.indexOf(selected),o.afterDecision);
  assert.equal(selected.semantic.side,s.side);assert.equal(selected.semantic.card,s.target);
  assert.equal(selected.answer,o.referenceCardId,'Chosen target differs from the observed primary target');
  const i=selected.parameters.cardId.indexOf(selected.answer);assert.ok(i>=0,'Reference target answer missing');
  if(selected.parameters.selectable)assert.equal(selected.parameters.selectable[i],'true');
 }
 return s.target;
}

/** A chosen move-away card and its observed arrival belong to one decision,
 * not an arbitrary later appearance at a convenient destination. */
export function assertReferenceMove(rows,index,cards,final){
 const row=rows[index],s=row.semantic,o=row.movementObservation;
 assert.equal(s.kind,'escape-card');assert.equal(row.type,'CARD_SELECTION');assert.equal(row.text,'Choose next card to move away');
 assert.ok(o&&o.card===s.card&&o.from===s.from,'Missing observed move away');
 assert.equal(o.blueprint,cards[s.card]?.blueprint);assert.equal(o.referenceCardId,row.answer);
 const selected=row.parameters.cardId.indexOf(row.answer);assert.ok(selected>=0,'Move-away answer missing');
 if(row.parameters.selectable)assert.equal(row.parameters.selectable[selected],'true');
 assert.equal(row.state.table.find(c=>c.id===s.card)?.location,o.from,'Move-away origin differs');
 assert.ok(row.state.locations.includes(o.to)&&o.to!==o.from,'Move-away destination missing');
 assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Invalid movement observation boundary');
 const later=rows.slice(index+1,o.afterDecision+1);
 assert.ok(later.every(r=>!r.semantic||['pass','escape-destination'].includes(r.semantic.kind)),'Move observation crosses another action');
 for(const r of later.filter(r=>r.semantic?.kind==='escape-destination')){
  assert.equal(r.semantic.card,o.to);assert.equal(r.semantic.side,s.side);assert.ok(r.parameters.cardId.includes(r.answer));
 }
 const after=rows[o.afterDecision+1]?.state??final;
 assert.equal(after?.table.find(c=>c.id===s.card)?.location,o.to,'Observed move does not match the immediate arrival');
 return o.to;
}

/** An inspection acknowledgment and the optional Force-pile choice are separate
 * reference decisions. Derive movement from the actual answer, never the tag. */
export function inspectionChoice(rows,index,canMove){
 const row=rows[index];assert.equal(row.semantic?.kind,'inspection');
 const next=rows.slice(index+1).find(r=>r.semantic&&r.semantic.kind!=='pass');
 if(!canMove){assert.notEqual(next?.semantic.kind,'inspection-force');return 'keep';}
 const target=followingTarget(rows,index,'inspection-force');
 assert.equal(target.semantic.side,row.semantic.side);assert.ok(target.text.toLowerCase().endsWith(' on your force pile?'));
 assert.ok(['0','1'].includes(target.answer),'Invalid inspection answer');return target.answer==='0'?'to-force':'keep';
}

export function replayGempMatch(record,{onCheckpoint}={}){
 assert.equal(record.schema,1,'Unsupported reference schema');assert.ok([2,3,4,5].includes(record.snapshotVersion),'Reference must contain stat and loss evidence');
 assert.equal(record.finished,true,'Reference match must finish');assert.ok(['dark','light'].includes(record.winner),'Reference winner missing');
 const decks=starterDecks(60);assert.deepEqual(Object.fromEntries(decks.map(d=>[d.side,d.cards])),record.decks);
 let m=runtime.createMatch('gemp-complete-match',60,decks,auditRules),commands=0,checkpoints=0;
 const transcript=[];
 const prompt=()=>{const p=runtime.prompt(m,auditRules,'dark');return p?.choices.length?p:runtime.prompt(m,auditRules,'light');};
 function command(choice,entropy=()=>0){const p=prompt();const c={revision:m.revision,choice};m=runtime.applyCommand(copy(m),auditRules,p.side,c,entropy,1800000000000+commands++);transcript.push({side:p.side,...c});}
 while(m.status==='setup'){
  const p=prompt();
  if(m.setup.stage==='choose')command('select:'+record.setup.locations.find(id=>id.startsWith(p.side+'-')));
  else if(m.setup.stage==='shuffle'){
   const values=['dark','light'].flatMap(side=>shuffleEntropy(m.players[side].reserve,[...record.setup.players[side].hand,...record.setup.players[side].reserve]));let used=0;
   command('begin',()=>{assert.ok(used<values.length);return values[used++];});assert.equal(used,values.length);
  }else command(p.choices[0].id);
 }
 function seek(row,choices){
  const phase=row.state.phase==='between_turns'?'activate':row.state.phase;
  for(let i=0;i<1000;i++){
   if(m.status==='finished')throw Error('Native match ended before reference action '+JSON.stringify(row.semantic));
   const p=prompt();
   if(m.turn.number===row.state.turn&&m.turn.phase===phase&&p.side===row.semantic.side){const wanted=(typeof choices==='function'?choices():choices).find(id=>p.choices.some(c=>c.id===id));if(wanted)return wanted;}
   if(m.turn.number>row.state.turn||m.turn.number===row.state.turn&&phases.indexOf(m.turn.phase)>phases.indexOf(phase))throw Error('Native passed reference action '+JSON.stringify({semantic:row.semantic,native:m.turn,prompt:p}));
   const automatic=p.choices.find(c=>c.id==='pass')??p.choices.find(c=>c.id==='draw-destiny')??(p.mandatory&&p.choices.length===1?p.choices[0]:null);
   if(!automatic)throw Error('Unmapped native decision before '+JSON.stringify({semantic:row.semantic,frame:m.stack.at(-1),prompt:p}));
   command(automatic.id);
  }
  throw Error('Native response budget exhausted');
 }
 try{
  const rows=record.trace;
  for(let index=0;index<rows.length;index++){
   const row=rows[index],s=row.semantic;if(!s||['pass','deploy-target','fire-target','move-target','site-placement','inspection-force','reduce-amount','activate-count','recovery-selection','recovery-placement','interrupt-target','escape-destination'].includes(s.kind))continue;
   if(s.kind==='recovery-verify'){
    assert.equal(row.type,'ARBITRARY_CARDS');assert.equal(row.text,"Verify Lost Pile after unsuccessful attempt to 'Choose card to retrieve'");
    assert.deepEqual(row.parameters.min,['0']);assert.deepEqual(row.parameters.max,['0']);assert.equal(row.answer,'');
    assert.ok(row.parameters.selectable.every(v=>v==='false'));continue;
   }
   assertReferenceAction(row);
   let choices=[];
   if(s.kind==='activate')choices=['core:activate'];
   if(s.kind==='draw')choices=['core:draw'];
   if(s.kind==='deploy'){const target=followingTarget(rows,index,'deploy-target');assert.ok(target);choices=['deploy:'+s.card+':'+target.semantic.card];}
   if(s.kind==='equip'){const target=followingTarget(rows,index,'deploy-target');assert.ok(target);choices=['equip:','saber:equip:','gaffi:equip:','mine:','attach:'].map(prefix=>prefix+s.card+':'+target.semantic.card);}
   if(s.kind==='fire'){const target=followingTarget(rows,index,'fire-target');assert.ok(target);choices=['fire:','saber:fire:','gaffi:fire:'].map(prefix=>prefix+s.card+':'+target.semantic.card);}
   if(s.kind==='move'){const target=followingTarget(rows,index,'move-target');assert.ok(target);choices=['move:'+s.card+':'+target.semantic.card];}
   if(s.kind==='site'){
    const deployed=rows.slice(index+1).find(r=>r.state.locations.includes(s.card))?.state??record.final;
    choices=()=>board.sitePlacements(m,s.card).filter(p=>{const locations=[...m.locations];if(p.replace)locations[locations.indexOf(p.replace)]=s.card;else locations.splice(p.index,0,s.card);return JSON.stringify(normalizedCheckpoint({...row.state,locations},m.cards).locations)===JSON.stringify(normalizedCheckpoint(deployed,m.cards).locations);}).map(p=>'site:'+s.card+':'+p.id);
   }
   if(s.kind==='kintan'){
    const target=row.state.players[s.side].lost.find(id=>board.cardDefinition(m,id).type==='Character');
    if(target)assertRecoverySelection(followingTarget(rows,index,'recovery-selection'),s.side,m.cards[target].blueprint,'kintan');
    choices=['revival:kintan:'+s.card];
   }
   if(s.kind==='stun'||s.kind==='dice'){
    const target=assertInterruptTarget(rows,index,m.cards);
    choices=[(s.kind==='stun'?'stun:play:':'dice:')+s.card+':'+target];
   }
   if(s.kind==='takeel')choices=['takeel:'+s.card];
   if(s.kind==='run-luke'||s.kind==='escape'){
    const target=assertInterruptTarget(rows,index,m.cards);
    choices=s.kind==='run-luke'?['run-luke:'+s.card+':'+target]:['escape:'+s.card+':'+target,'escape:'+s.card];
   }
   if(s.kind==='escape-card'){
    choices=['away:'+s.card+':'+assertReferenceMove(rows,index,m.cards,record.final)];
   }
   if(s.kind==='old-ben'){
    const selection=followingTarget(rows,index,'recovery-selection');
    assertRecoverySelection(selection,s.side,m.cards[s.target].blueprint);
    assert.ok(row.state.players[s.side].lost.includes(s.target),'Old Ben target must be in Lost');
    const forfeiture=rows.slice(0,index).findLast(r=>r.semantic?.kind==='forfeit'&&r.semantic.card===s.target);
    assert.ok(forfeiture,'Old Ben requires the recorded forfeiture');
    const site=forfeiture.state.table.find(c=>c.id===s.target)?.location;assert.ok(site);
    const after=rows.slice(rows.indexOf(selection)+1),placement=after.find(r=>r.semantic&&r.semantic.kind!=='pass');
    // GEMP shortcuts the single legal placement. If a dialog is emitted, its
    // answer is still checked; in either case require the observed return.
    if(placement?.semantic.kind==='recovery-placement'){
     assert.equal(placement.semantic.side,s.side);assert.ok(placement.text.toLowerCase().includes('choose where to place'));
     assert.equal(placement.parameters.cardId.length,1);assert.equal(placement.answer,placement.parameters.cardId[0]);
     assert.equal(placement.semantic.card,site,'Old Ben must return to the original site');
    }
    const returned=after.find(r=>r.state.table.some(c=>c.id===s.target));assert.ok(returned,'Old Ben return was not observed');
    assert.equal(returned.state.table.find(c=>c.id===s.target).location,site,'Old Ben must return to the original site');
    choices=['revival:old-ben:'+s.card+':'+s.target];
   }
   if(s.kind==='macroscan')choices=['macroscan:'+s.card];
   if(s.kind==='peek')choices=['peek:'+s.card];
   if(s.kind==='inspection'){
    choices=()=>{const frame=m.stack.at(-1);return frame?.handler==='equipment:peek'?[inspectionChoice(rows,index,m.cards[frame.payload.card].blueprint==='1_35')]:[];};
   }
   if(s.kind==='battle')choices=['battle:'+s.card];
   if(s.kind==='drain')choices=['drain:'+s.card];
   if(s.kind==='reduce'){const amount=followingTarget(rows,index,'reduce-amount').count;choices=['reduce:'+s.card+':'+amount,'battle-reduce:'+s.card+':'+amount];}
   if(s.kind==='barrier')choices=['barrier:'+s.card+':'+s.target];
   if(s.kind==='mine-victims')choices=['select:'+s.cards[0],'lose-mine:'+s.cards[0]];
   if(s.kind==='explode')choices=['explode:'+s.card];
   if(s.kind==='loss-order')choices=['place-lost:'+s.card];
   if(s.kind==='forfeit')choices=['forfeit:'+s.card];
   if(s.kind==='lose'){
    if(row.lossZone==='HAND')choices=['lose-hand:'+s.card,'battle-lose-hand:'+s.card];
    else {const pile=row.lossZone.includes('RESERVE')?'reserve':row.lossZone.includes('FORCE')?'force':row.lossZone.includes('USED')?'used':null;assert.ok(pile,row.lossZone);choices=['lose:'+pile,'battle-lose:'+pile];}
   }
   assert.ok(typeof choices==='function'||choices.length,s.kind);const choice=seek(row,choices);
   if(['activate','draw','deploy','equip','fire','site','move','battle','drain','forfeit','lose','loss-order','explode','barrier','mine-victims','reduce','macroscan','peek','inspection','kintan','old-ben','stun','dice','takeel','run-luke','escape','escape-card'].includes(s.kind)){
    try{assert.deepEqual(normalizedCheckpoint(snapshot(m,row.state,record.snapshotVersion),m.cards),normalizedCheckpoint(row.state,m.cards));}catch(e){e.message='Checkpoint '+index+' '+JSON.stringify(s)+'\n'+e.message;throw e;}checkpoints++;
    // Browser fixtures may resume a verified checkpoint. Copies prevent the
    // observer from changing either the reference or the continuing replay.
    onCheckpoint?.({index,row:copy(row),match:copy(m)});
   }
   if(s.kind==='inspection'){
    assert.ok(row.text.toLowerCase().startsWith('top card')&&row.text.toLowerCase().includes('reserve'));
    const frame=m.stack.at(-1);assert.equal(frame?.handler,'equipment:peek');assert.equal(frame.side,s.side);
    assert.deepEqual(runtime.project(m,auditRules,s.side==='dark'?'light':'dark').rules.peek,[],'Opponent cannot see private inspection');
    assert.deepEqual(runtime.project(m,auditRules,s.side).rules.peek.map(c=>c.id),frame.payload.cards);
    assert.deepEqual(frame.payload.cards.map(id=>m.cards[id].blueprint),row.parameters.blueprintId,'Private inspection must show the reference cards in order');
   }
   command(choice);
   if(s.kind==='mine-victims'&&choice.startsWith('lose-mine:'))assert.equal(s.cards.length,1,'Each sequential casualty requires a separate reference choice');
   if(s.kind==='mine-victims'&&choice.startsWith('select:'))for(const card of s.cards.slice(1))command('select:'+card);
   if(s.kind==='activate'){
    const count=rows[index+1];assert.equal(count.semantic?.kind,'activate-count');
    for(let n=1;n<count.count;n++)command(seek(row,['core:activate']));
   }
  }
  for(let i=0;i<1000&&m.status!=='finished';i++){
   const p=prompt(),next=p.choices.find(c=>c.id==='pass')??(p.mandatory&&p.choices.length===1?p.choices[0]:null);
   if(!next)throw Error('Unmapped final native decision '+JSON.stringify(p));command(next.id);
  }
  assert.equal(m.status,'finished');assert.equal(m.result.winner,record.winner);
  assert.deepEqual(normalizedCheckpoint(snapshot(m,record.final,record.snapshotVersion),m.cards),normalizedCheckpoint(record.final,m.cards));
  return {commands,checkpoints,state:m,transcript};
 }catch(e){e.nativeState=m;e.nativeCommands=commands;e.checkpoints=checkpoints;e.transcript=transcript;throw e;}
}

export function readGempMatch(file){const data=fs.readFileSync(file);return JSON.parse(data[0]===0x1f&&data[1]===0x8b?gunzipSync(data).toString():data.toString());}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=replayGempMatch(readGempMatch(process.argv[2]));console.log(JSON.stringify({commands:result.commands,checkpoints:result.checkpoints,result:result.state.result,turns:result.state.turn.number}));}
 catch(e){console.error(e.message);fs.writeFileSync(path.join(os.tmpdir(),'swccg-gemp-replay-failure.json'),JSON.stringify({message:e.message,commands:e.nativeCommands,checkpoints:e.checkpoints,state:e.nativeState,transcript:e.transcript},null,2));process.exitCode=1;}
}
