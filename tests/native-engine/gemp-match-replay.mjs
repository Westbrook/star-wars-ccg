import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules as starterRules, starterDecks} from './match-runner.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const publicValues=load(new URL('../../lib/native-engine/public-values.ts',import.meta.url)).publicValues;
const piloting=load(new URL('../../lib/native-engine/piloting.ts',import.meta.url));
const ability=load(new URL('../../lib/native-engine/ability.ts',import.meta.url));
const losses=load(new URL('../../lib/native-engine/loss.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereLocations}=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const identities=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/identities.json',import.meta.url)));
const isSaber=bp=>identities[bp]?.keywords.includes('LIGHTSABER');
const copy=x=>JSON.parse(JSON.stringify(x));
const phases=['activate','control','deploy','battle','move','draw'];

/** Encode a recorded lawful shuffle as Fisher-Yates choices. This supplies only
 * shuffle entropy: no direct card/pile corrections are made during replay. */
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
 for(const id of s.locations){const system=premiereLocations[cards[id].blueprint]?.system;assert.ok(system);if(!groups.has(system))groups.set(system,[]);groups.get(system).push(id);}
 return {...s,...(s.phase==='between_turns'?{phase:'activate'}:{}),locations:[...groups.keys()].sort().flatMap(group=>groups.get(group)),players:Object.fromEntries(Object.entries(s.players).map(([side,p])=>[side,{...p,hand:[...p.hand].sort()}]))};
}
function snapshot(m,expected,version){
 const values=publicValues(m);
 if(version>=5&&expected.battleLosses)assert.ok(expected.battleDestinies,'Version 5 damage checkpoints require completed destiny evidence');
 for(const card of expected.table)if(card.stats){const actual=values.characters[card.id];assert.ok(actual,'Missing public character values');assert.deepEqual({power:actual.power,ability:actual.ability,forfeit:actual.forfeit},card.stats,'Public character values must match GEMP');}
 const result={turn:m.turn.number,side:m.turn.side,phase:m.turn.phase,locations:[...m.locations],players:Object.fromEntries(['dark','light'].map(side=>[side,Object.fromEntries(['reserve','force','used','lost','hand'].map(p=>[p,[...m.players[side][p]]]))])),table:Object.values(m.cards).filter(c=>c.zone==='table'&&(c.location||version>=4&&board.cardDefinition(m,c.id).type!=='Location')).map(c=>({id:c.id,...(c.location?{location:c.location}:{}),...(version>=3?{...(c.attachedTo?{attachedTo:c.attachedTo}:{}),hit:combat.battle(m)?.hits.includes(c.id)??false}:{}),...(version>=2&&board.cardDefinition(m,c.id).type==='Character'?{stats:{power:board.power(m,c.id,combat.battle(m)?.stage!=='complete'&&combat.battle(m)?.initiator!==c.owner&&combat.members(m,c.owner).includes(c.id)),ability:ability.ability(m,c.id),forfeit:board.forfeit(m,c.id)}}:{})})).sort((a,b)=>a.id.localeCompare(b.id))};
 if(version>=6)for(const c of result.table){const card=m.cards[c.id],def=board.cardDefinition(m,c.id);if(def.type==='Vehicle'||version>=7&&def.type==='Starship')c.vesselStats={power:board.power(m,c.id),ability:ability.ability(m,c.id),forfeit:board.forfeit(m,c.id)};if(version>=8&&def.type==='Starship'){for(const [key,fn]of [['armor','vesselArmor'],['maneuver','vesselManeuver'],['hyperspeed','vesselHyperspeed']]){const value=piloting[fn](m,c.id);if(value!==null)c.vesselStats[key]=value;}}if(card.aboardRole)c.aboardRole=card.aboardRole;}
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
 if(['disarm-deploy','evazan','disarm-trigger'].includes(kind)){
  const i=row.parameters.actionId?.indexOf(row.answer);assert.ok(i>=0,'Missing disarming action answer');const label=row.parameters.actionText[i].toLowerCase();
  assert.ok(kind==='disarm-deploy'?label.startsWith('deploy')&&row.state.players[row.semantic.side].hand.includes(row.semantic.card):kind==='evazan'?label.startsWith("'operate' on "):label.startsWith('disarm '),'Incorrect disarming action label');return;
 }

 if(kind==='mentor-search'){
  const i=row.parameters.actionId?.indexOf(row.answer);assert.ok(i>=0,'Missing search action answer');assert.equal(row.parameters.actionText[i].toLowerCase(),'take lightsaber into hand from reserve deck');assert.ok(row.state.players[row.semantic.side].hand.includes(row.semantic.card));return;
 }

 if(kind==='obi-use'){
  const i=row.parameters.actionId?.indexOf(row.answer);assert.ok(i>=0,'Missing Obi-Wan action answer');
  assert.equal(row.parameters.actionText[i].toLowerCase(),'make a character move away or be lost','Wrong Obi-Wan action');
  assert.ok(row.text.startsWith('Battle just initiated at '),'Obi-Wan must respond to battle initiation');return;
 }

 if(['battle-add','named-cancel'].includes(kind)){
  const i=row.parameters.actionId?.indexOf(row.answer);assert.ok(i>=0,'Reference action answer missing');
  const label=row.parameters.actionText[i].toLowerCase();
  assert.ok(kind==='battle-add'?['add two battle destiny','add battle destiny'].includes(label):label.startsWith('cancel '),'Reference semantic action does not match the chosen command: '+label);
  if(kind==='named-cancel'){
   const bp=row.targetObservation?.blueprint;assert.ok(bp,'Cancellation target blueprint missing');
   assert.equal(label,'cancel '+board.definition(bp).name.toLowerCase(),'Cancellation label differs from the observed target');
   assert.ok(row.text.startsWith('Playing ')&&row.text.includes("value='"+bp+"'"),'Cancellation is not responding to the recorded card play');
  }
  return;
 }
 if(!['activate','draw','deploy','equip','fire','site','move','battle','drain','barrier','reduce','explode','macroscan','peek','kintan','old-ben','stun','dice','takeel','run-luke','escape','vehicle-react','hyperspace','maneuver'].includes(kind))return;
 const index=row.parameters.actionId?.indexOf(row.answer);assert.ok(index>=0,'Reference action answer missing');
 const label=row.parameters.actionText[index].toLowerCase();
 const valid=kind==='maneuver'?['add 2 to hyperspeed and maneuver','add 2 to maneuver and 1 to power'].includes(label):kind==='hyperspace'?label==='move using hyperspeed':kind==='vehicle-react'?label==="move using landspeed as a 'react'":kind==='activate'?label==='activate force':kind==='draw'?label==='draw card into hand from force pile':
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

/** GEMP omits its capacity dialog when only one role fits. Read that role
 * from this deployment's first completed state, never a later reassignment. */
export function deployedCrewRole(rows,index,card,target){
 for(const row of rows.slice(index+1)){
  const placed=row.state.table.find(c=>c.id===card);
  if(placed){assert.equal(placed.attachedTo,target,'Crew deployment host mismatch');assert.ok(['pilot','driver','passenger'].includes(placed.aboardRole),'Missing deployed crew role');return placed.aboardRole;}
  assert.ok(!row.semantic||['pass','deploy-target','crew-capacity'].includes(row.semantic.kind),'Crew role missing before the next reference action');
 }
 throw Error('Missing completed crew deployment');
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
export function assertInterruptTarget(rows,index,cards,{playing=false}={}){
 const row=rows[index],s=row.semantic,o=row.targetObservation;
 assert.ok(o&&Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Missing actual target observation');
 assert.equal(o.card,s.target);assert.equal(o.blueprint,cards[s.target]?.blueprint,'Target blueprint differs');
 if(playing){
  assert.equal(s.kind,'named-cancel');assert.equal(o.afterDecision,index,'Playing-card cancellation must observe its bound target immediately');
  const previous=rows.slice(0,index).findLast(r=>r.semantic&&!['pass','interrupt-target'].includes(r.semantic.kind));
  assert.ok(['battle-add','mentor-search'].includes(previous?.semantic.kind),'Cancellation must bind the pending Interrupt');assert.equal(previous.semantic.card,s.target,'Cancellation target differs from pending source');
  assert.ok(!row.state.table.some(c=>c.id===s.target)&&!Object.values(row.state.players).some(p=>Object.values(p).some(pile=>pile.includes(s.target))),'Cancellation target is not being played');
 }else assert.ok(row.state.table.some(c=>c.id===s.target),'Target must be on table at initiation');
 if(o.afterDecision!==index){
  const selected=followingTarget(rows,index,'interrupt-target');assert.equal(rows.indexOf(selected),o.afterDecision);
  assert.equal(selected.semantic.side,s.side);assert.equal(selected.semantic.card,s.target);
  assert.equal(selected.answer,o.referenceCardId,'Chosen target differs from the observed primary target');
  const i=selected.parameters.cardId.indexOf(selected.answer);assert.ok(i>=0,'Reference target answer missing');
  if(selected.parameters.selectable)assert.equal(selected.parameters.selectable[i],'true');
 }
 return s.target;
}

/** Each primary target is observed on the selected reference Action. A shortcut
 * may fill several groups at once; explicit dialogs must account for their own
 * answer before any later gameplay action, without borrowing future choices. */
export function assertInterruptTargets(rows,index,cards){
 const row=rows[index],s=row.semantic,observations=row.targetObservations;
 assert.equal(s.kind,'battle-add');assert.ok(Array.isArray(s.targets)&&s.targets.length===2&&new Set(s.targets).size===2,'Paired addition needs two distinct targets');
 assert.ok(Array.isArray(observations)&&observations.length===2,'Missing primary target observations');
 assert.deepEqual(observations.map(o=>o.card),s.targets,'Observed target order differs');
 assert.equal(new Set(observations.map(o=>o.group)).size,2,'Each target needs its own primary group');
 for(const o of observations){
  assert.ok(Number.isSafeInteger(o.group)&&o.group>=0,'Invalid primary target group');
  assert.equal(o.blueprint,cards[o.card]?.blueprint,'Target blueprint differs');
  assert.ok(row.state.table.some(c=>c.id===o.card),'Target must be on table at initiation');
  assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Invalid primary target observation boundary');
  assert.ok(o.afterDecision===index||rows[o.afterDecision].semantic?.kind==='interrupt-target','Target observation must follow initiation or its targeting choice');
  for(const later of rows.slice(index+1,o.afterDecision+1))assert.ok(!later.semantic||['pass','interrupt-target'].includes(later.semantic.kind),'Target observation crosses another action');
 }
 const last=Math.max(...observations.map(o=>o.afterDecision));
 for(let i=index+1;i<=last;i++)if(rows[i].semantic?.kind==='interrupt-target'){
  const target=rows[i],o=observations.find(o=>o.card===target.semantic.card&&o.afterDecision===i);
  assert.ok(o,'Explicit choice lacks its own primary target observation');assert.equal(target.semantic.side,s.side);
  assert.equal(target.type,'CARD_SELECTION');assert.equal(target.answer,o.referenceCardId,'Chosen target differs from observed target');
  const selected=target.parameters.cardId.indexOf(target.answer);assert.ok(selected>=0,'Reference target answer missing');
  if(target.parameters.selectable)assert.equal(target.parameters.selectable[selected],'true','Target is not selectable');
  assert.equal(target.parameters.blueprintId[selected],o.blueprint,'Selected target blueprint differs');
 }
 return s.targets;
}

/** Read the actual canceled flag and bound cancellation target. No private
 * search dialog or shuffle may appear after this paid play was canceled. */
export function assertCanceledSearch(rows,index,cards,final){
 const row=rows[index],s=row?.semantic,o=row?.searchOutcome;
 assert.equal(s?.kind,'mentor-search');assertReferenceAction(row);assert.equal(cards[s.card]?.blueprint,'1_82');assert.equal(cards[s.card]?.owner,s.side);
 assert.equal(o?.canceled,true);assert.equal(o.source,s.card);assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>index&&o.afterDecision<rows.length,'Invalid canceled search boundary');assert.equal(row.selection,undefined,'Canceled search must not expose a selection');
 const branch=rows.slice(index+1,o.afterDecision+1),cancels=branch.filter(r=>r.semantic?.kind==='named-cancel');
 assert.ok(branch.every(r=>!r.semantic||['pass','named-cancel'].includes(r.semantic.kind)),'Canceled search crosses another action or private inspection');assert.equal(cancels.length,1);
 const cancel=cancels[0],j=rows.indexOf(cancel);assertReferenceAction(cancel);assert.equal(cards[cancel.semantic.card]?.blueprint,'1_235');assert.notEqual(cancel.semantic.side,s.side);assert.equal(cards[cancel.semantic.card]?.owner,cancel.semantic.side);assert.equal(assertInterruptTarget(rows,j,cards,{playing:true}),s.card);
 const before=row.state.players[s.side],after=(rows[o.afterDecision+1]?.state??final).players[s.side];
 assert.deepEqual(o.reserve,before.reserve,'Canceled search must not shuffle');assert.deepEqual(after.reserve,before.reserve,'Immediate Reserve order differs');assert.deepEqual([...o.hand].sort(),before.hand.filter(id=>id!==s.card).sort());assert.deepEqual([...after.hand].sort(),[...o.hand].sort());assert.deepEqual(after.force,before.force.slice(1));assert.ok(before.force.length);assert.deepEqual(after.used,[before.force[0],...before.used]);assert.ok(after.lost.includes(s.card));
 return {source:s.card,side:s.side,canceled:true,cancellationIndex:j,afterDecision:o.afterDecision,consumed:true};
}

/** A search result and reshuffle belong to this exact paid Interrupt. The
 * observer reads physical identities from GEMP's actual private choice; pile
 * order is reproduced later with legal entropy, never by replacing state. */
export function assertSearchEvidence(rows,index,cards,final){
 const row=rows[index],s=row?.semantic,o=row?.searchOutcome;if(o?.canceled===true)return assertCanceledSearch(rows,index,cards,final);assert.equal(s?.kind,'mentor-search');assertReferenceAction(row);assert.equal(cards[s.card]?.blueprint,'1_82');assert.equal(cards[s.card]?.owner,s.side);
 assert.ok(o&&o.source===s.card,'Search completion source differs');assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Invalid search outcome boundary');
 const before=row.state.players[s.side],branch=rows.slice(index+1,o.afterDecision+1),after=rows[o.afterDecision+1]?.state??final;
 assert.ok(branch.every(r=>!r.semantic||['pass','search-selection','search-verify'].includes(r.semantic.kind)),'Search completion crosses another action');
 const selections=branch.filter(r=>r.semantic?.kind==='search-selection'),verifications=branch.filter(r=>r.semantic?.kind==='search-verify'),selected=row.selection?.card;
 const pile=before.reserve.map(id=>cards[id].blueprint).sort();
 const checkPacket=r=>{assert.equal(r.type,'ARBITRARY_CARDS');assert.deepEqual([...r.parameters.blueprintId].sort(),pile,'Private search packet differs from Reserve contents');assert.equal(r.semantic.initiation,index,'Search choice borrowed another action');assert.deepEqual(r.state.players[s.side].reserve,before.reserve,'Reserve changed before selection');};
 if(selected){
  assert.equal(selections.length,1);assert.equal(verifications.length,0);const c=selections[0],p=row.selection;checkPacket(c);assert.equal(c.semantic.card,selected);assert.equal(c.semantic.side,s.side);assert.equal(p.atDecision,rows.indexOf(c));assert.equal(c.text,'Choose card to take into hand');assert.equal(p.answer,c.answer);assert.equal(p.blueprint,cards[selected]?.blueprint);assert.ok(isSaber(p.blueprint)&&before.reserve.includes(selected),'Selected card is not a lightsaber in Reserve');
  assert.deepEqual(c.parameters.min,['1']);assert.deepEqual(c.parameters.max,['1']);const j=c.parameters.cardId.indexOf(c.answer);assert.ok(j>=0,'Search answer missing');assert.equal(c.parameters.selectable[j],'true');assert.equal(c.parameters.blueprintId[j],p.blueprint);
  for(let k=0;k<c.parameters.cardId.length;k++)assert.equal(c.parameters.selectable[k],String(!!isSaber(c.parameters.blueprintId[k])),'Incorrect selectable lightsaber');
 }else{
  assert.equal(selections.length,0);assert.equal(verifications.length,2);assert.ok(before.reserve.every(id=>!isSaber(cards[id].blueprint)),'Failed search contained an eligible lightsaber');assert.deepEqual(verifications.map(r=>r.semantic.side).sort(),['dark','light']);
  for(const c of verifications){checkPacket(c);assert.equal(c.semantic.card,s.card);assert.equal(c.text,"Verify Reserve Deck after unsuccessful attempt to 'Choose card to take into hand'");assert.equal(c.answer,'');assert.deepEqual(c.parameters.min,['0']);assert.deepEqual(c.parameters.max,['0']);assert.ok(c.parameters.selectable.every(v=>v==='false'));}
 }
 assert.ok(before.force.length>0,'Search cost requires Force');assert.deepEqual(after.players[s.side].force,before.force.slice(1),'Search must use exactly one Force');assert.deepEqual(after.players[s.side].used,[before.force[0],...before.used],'Search payment must enter Used in order');
 const remaining=before.reserve.filter(id=>id!==selected);assert.deepEqual([...o.reserve].sort(),[...remaining].sort(),'Shuffle changes card membership');assert.equal(new Set(o.reserve).size,o.reserve.length);
 const hand=[...before.hand.filter(id=>id!==s.card),...(selected?[selected]:[])].sort();assert.deepEqual([...o.hand].sort(),hand,'Search hand change differs');assert.deepEqual(after.players[s.side].reserve,o.reserve,'Shuffle not observed immediately');assert.deepEqual([...after.players[s.side].hand].sort(),hand);assert.ok(after.players[s.side].lost.includes(s.card),'Search Interrupt has not finished');
 return {source:s.card,side:s.side,selected,order:o.reserve,selectionIndex:selected?row.selection.atDecision:null,verificationIndices:verifications.map(r=>rows.indexOf(r)),afterDecision:o.afterDecision};
}

/** Bind Obi-Wan's opponent choice and immediate outcome to the selected
 * primary target. Never infer a route or casualty from a later battle. */
export function assertObiOutcome(rows,index,cards,final){
 const row=rows[index],s=row?.semantic,o=row?.obiOutcome;
 assert.equal(s?.kind,'obi-use');assertReferenceAction(row);assert.equal(cards[s.card]?.blueprint,'1_21');
 const target=assertInterruptTarget(rows,index,cards),source=row.state.table.find(c=>c.id===s.card),initial=row.state.table.find(c=>c.id===target);
 assert.ok(source&&initial);assert.equal(source.location,initial.location,'Obi-Wan target must be present');assert.equal(initial.stats.ability,1);
 assert.ok(o&&o.card===target&&o.blueprint===cards[target]?.blueprint,'Missing Obi-Wan outcome binding');assert.equal(o.from,initial.location);
 assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=index&&o.afterDecision<rows.length,'Invalid Obi-Wan outcome boundary');
 const after=rows[o.afterDecision+1]?.state??final,branch=rows.slice(index+1,o.afterDecision+1);
 assert.ok(branch.every(r=>!r.semantic||['pass','interrupt-target','obi-choice','obi-destination','loss-order'].includes(r.semantic.kind)),'Obi-Wan outcome crosses another action');
 const choices=branch.filter(r=>r.semantic?.kind==='obi-choice');assert.ok(choices.length<=1,'Repeated Obi-Wan opponent choice');
 const selected=choices[0],destinations=branch.filter(r=>r.semantic?.kind==='obi-destination');
 if(selected){
  const c=selected.semantic;assert.equal(c.initiation,index,'Obi-Wan choice borrowed another action');assert.equal(c.source,s.card);assert.equal(c.card,target);assert.notEqual(c.side,s.side);assert.equal(c.side,cards[target].owner);
  assert.equal(selected.type,'MULTIPLE_CHOICE');assert.deepEqual(selected.parameters.results,['Yes','No']);assert.ok(['0','1'].includes(selected.answer),'Invalid move-or-loss answer');
  assert.ok(selected.text.toLowerCase().startsWith('do you want to have ')&&selected.text.includes("value='"+cards[target].blueprint+"'")&&selected.text.endsWith(' move away?'),'Wrong move-or-loss prompt');
  assert.equal(o.lost,selected.answer==='1','Observed outcome differs from opponent choice');
 }else assert.equal(o.lost,true,'Movement needs an opponent choice');
 if(o.lost){assert.equal(o.to,undefined);assert.ok(after.players[cards[target].owner].lost.includes(target),'Loss not observed immediately');assert.ok(!after.table.some(c=>c.id===target));assert.equal(destinations.length,0);}
 else{
  assert.ok(row.state.locations.includes(o.to)&&o.to!==o.from,'Invalid move-away endpoint');assert.equal(after.table.find(c=>c.id===target)?.location,o.to,'Move not observed immediately');assert.ok(destinations.length<=1);
  for(const d of destinations){assert.equal(d.semantic.side,selected.semantic.side);assert.equal(d.semantic.card,o.to);assert.equal(d.type,'CARD_SELECTION');const j=d.parameters.cardId.indexOf(d.answer);assert.ok(j>=0);assert.equal(d.parameters.blueprintId[j],cards[o.to].blueprint);if(d.parameters.selectable)assert.equal(d.parameters.selectable[j],'true');}
 }
 return {target,outcome:o,choiceIndex:selected?rows.indexOf(selected):null,choice:selected?(o.lost?'obi:lose':'obi:move:'+o.to):null};
}

/** Bind actual primary targeting, trigger timing and immediate loss placement.
 * Outcome snapshots are observations, never state patches supplied to replay. */
export function assertDisarmOutcome(rows,index,cards,final){
 const row=rows[index],s=row?.semantic,o=row?.disarmOutcome;
 assert.ok(['disarm-deploy','evazan'].includes(s?.kind));assertReferenceAction(row);
 assert.equal(cards[s.card]?.owner,s.side,'Disarming source owner differs');
 const operation=s.kind==='evazan',bp=cards[s.card]?.blueprint;
 assert.ok(operation?bp==='1_172':bp===(s.side==='light'?'1_48':'1_214'),'Wrong disarming source');
 const target=assertInterruptTarget(rows,index,cards),initial=row.state.table.find(c=>c.id===target),type=id=>board.cardDefinition({cards},id).type;
 assert.equal(type(target),'Character');assert.ok(initial?.location);assert.notEqual(target,s.card);
 const attached=row.state.table.filter(c=>c.attachedTo===target).map(c=>c.id),weapons=attached.filter(id=>type(id)==='Weapon');
 if(operation){
  const source=row.state.table.find(c=>c.id===s.card);assert.ok(source);assert.equal(source.location,initial.location,'Evazan patient must be present');
  if(row.text.toLowerCase().startsWith('disarmed ')){
   const prior=rows.slice(0,index).findLast(r=>r.semantic?.kind==='disarm-deploy'&&r.semantic.target===target&&r.disarmOutcome);
   assert.ok(prior,'Missing preceding disarming result');assert.ok(prior.disarmOutcome.afterDecision<index);
   assert.ok(rows.slice(prior.disarmOutcome.afterDecision+1,index).every(r=>!r.semantic||['pass','loss-order'].includes(r.semantic.kind)),'Disarmed reaction crosses another action');
  }else {assert.ok(row.text.toLowerCase().includes('hit'),'Operation must respond to hit or disarmed');assert.equal(initial.hit,true);}
 }else{
  assert.equal(row.state.phase,'control');assert.notEqual(cards[target].owner,s.side);assert.ok(weapons.length,'Disarmed target must carry a weapon');
  assert.ok(row.state.table.some(c=>cards[c.id].owner===s.side&&type(c.id)==='Character'&&c.location===initial.location&&row.state.table.some(w=>w.attachedTo===c.id&&type(w.id)==='Weapon')),'Missing friendly armed character');
 }
 assert.ok(o&&o.card===target&&o.source===s.card,'Missing disarming outcome binding');assert.ok(Number.isSafeInteger(o.afterDecision)&&o.afterDecision>=row.targetObservation.afterDecision&&o.afterDecision<rows.length,'Invalid disarming completion boundary');
 const after=rows[o.afterDecision+1]?.state??final;assert.deepEqual(o.state,after,'Outcome differs from immediate next reference state');
 assert.deepEqual(o.attachedBefore,[...attached],'Attachment observation differs from initiation');
 const branch=rows.slice(index+1,o.afterDecision+1);assert.ok(branch.every(r=>!r.semantic||['pass','interrupt-target','loss-order','disarm-trigger'].includes(r.semantic.kind)),'Disarming outcome crosses another action');
 const lost=id=>after.players[cards[id].owner].lost.includes(id);
 if(operation){assert.equal(o.lost,true);assert.ok(lost(target));assert.ok(!after.table.some(c=>c.id===target));for(const id of attached)assert.ok(lost(id),'Patient attachment not lost');}
 else{
  assert.equal(o.lost,false);assert.equal(o.disarmed,true);assert.ok(after.table.some(c=>c.id===target&&c.location===initial.location));assert.equal(after.table.find(c=>c.id===s.card)?.attachedTo,target);
  for(const id of weapons){assert.ok(lost(id),'Carried weapon not placed on Lost Pile');assert.ok(!after.table.some(c=>c.id===id));}
  for(const id of attached.filter(id=>!weapons.includes(id)))assert.equal(after.table.find(c=>c.id===id)?.attachedTo,target,'Disarming lost a nonweapon attachment');
 }
 assert.deepEqual(after.players[s.side].force,row.state.players[s.side].force,'Disarming and operation have no Force cost');
 return {target,source:s.card,operation,weapons,attached,outcome:o};
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
 assert.equal(record.schema,1,'Unsupported reference schema');assert.ok([2,3,4,5,6,7,8].includes(record.snapshotVersion),'Reference must contain stat and loss evidence');
 assert.equal(record.finished,true,'Reference match must finish');assert.ok(['dark','light'].includes(record.winner),'Reference winner missing');
 const profiles={'disarm-battle-v1':'disarm-battle-decks.json','search-battle-v1':'search-battle-decks.json','mentor-battle-v1':'mentor-battle-decks.json','paired-battle-v1':'paired-battle-decks.json','hoth-vehicles-v1':'hoth-vehicles-decks.json','space-pilots-v1':'space-pilots-decks.json','space-crew-v1':'space-crew-decks.json','armed-space-v1':'armed-space-decks.json'};
 if(record.deckProfile!==undefined)assert.ok(Object.hasOwn(profiles,record.deckProfile),'Unknown fixed reference deck profile');
 const profile=record.deckProfile===undefined?null:JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/'+profiles[record.deckProfile],import.meta.url)));
 if(profile)assert.equal(record.deckProfile,profile.id,'Unknown fixed reference deck profile');
 const decks=profile?profile.decks.map(d=>({side:d.side,cards:d.main})):starterDecks(60);
 const auditRules=profile?{...starterRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...starterRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}}:starterRules;
 assert.deepEqual(Object.fromEntries(decks.map(d=>[d.side,d.cards])),record.decks);
 let m=runtime.createMatch('gemp-complete-match',60,decks,auditRules),commands=0,checkpoints=0;
 const transcript=[],searchPlans=new Map();
 const prompt=()=>{const p=runtime.prompt(m,auditRules,'dark');return p?.choices.length?p:runtime.prompt(m,auditRules,'light');};
 function command(choice,suppliedEntropy){
  const p=prompt(),c={revision:m.revision,choice},values=[];let shuffle=null,expected=null,used=0;
  const entropy=suppliedEntropy??(()=>{
   if(!shuffle){
    const pending=[...m.stack].reverse().find(f=>f.kind==='resolution'&&f.action.handler==='mentor:shuffle'||f.kind==='decision'&&f.handler==='mentor:verify');
    assert.ok(pending,'Unexpected runtime entropy outside a verified search');const source=pending.kind==='resolution'?pending.action.payload.card:pending.payload.card;shuffle=searchPlans.get(source);assert.ok(shuffle&&!shuffle.canceled&&!shuffle.consumed,'Unknown, canceled or repeated search shuffle');
    const before=m.players[shuffle.side].reserve;assert.ok(!shuffle.selected||!before.includes(shuffle.selected),'Shuffle began before the selected card left Reserve');expected=shuffleEntropy(before,shuffle.order);
   }
   assert.ok(used<expected.length,'Extra search entropy request');const value=expected[used++];values.push(value);return value;
  });
  m=runtime.applyCommand(copy(m),auditRules,p.side,c,entropy,1800000000000+commands++);
  if(shuffle){assert.equal(used,expected.length,'Incomplete search shuffle');assert.deepEqual(m.players[shuffle.side].reserve,shuffle.order);shuffle.consumed=true;}
  transcript.push({side:p.side,...c,...(values.length?{entropy:values}:{})});
 }
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
   const automatic=p.choices.find(c=>c.id==='mentor:not-found')??p.choices.find(c=>c.id==='pass')??p.choices.find(c=>c.id==='draw-destiny')??p.choices.find(c=>c.id==='continue-react')??(p.mandatory&&p.choices.length===1?p.choices[0]:null);
   if(!automatic)throw Error('Unmapped native decision before '+JSON.stringify({semantic:row.semantic,frame:m.stack.at(-1),prompt:p}));
   command(automatic.id);
  }
  throw Error('Native response budget exhausted');
 }
 try{
  const rows=record.trace;
  for(let index=0;index<rows.length;index++){
   const row=rows[index],s=row.semantic;if(!s||['pass','deploy-target','fire-target','move-target','site-placement','inspection-force','reduce-amount','activate-count','recovery-selection','recovery-placement','interrupt-target','escape-destination','obi-destination','crew-capacity'].includes(s.kind))continue;
   if(s.kind==='recovery-verify'){
    assert.equal(row.type,'ARBITRARY_CARDS');assert.equal(row.text,"Verify Lost Pile after unsuccessful attempt to 'Choose card to retrieve'");
    assert.deepEqual(row.parameters.min,['0']);assert.deepEqual(row.parameters.max,['0']);assert.equal(row.answer,'');
    assert.ok(row.parameters.selectable.every(v=>v==='false'));continue;
   }
   if(s.kind==='search-verify'&&s.side===m.cards[s.card]?.owner){const proof=assertSearchEvidence(rows,s.initiation,m.cards,record.final);assert.ok(proof.verificationIndices.includes(index));continue;}
   assertReferenceAction(row);
   let choices=[];
   if(['disarm-deploy','evazan'].includes(s.kind)){const proof=assertDisarmOutcome(rows,index,m.cards,record.final);choices=['disarm:'+(s.kind==='evazan'?'operate':'deploy')+':'+s.card+':'+proof.target];}
   if(s.kind==='disarm-trigger')choices=['disarm:apply:'+s.card+':'+s.target];
   if(s.kind==='mentor-search'){const proof=assertSearchEvidence(rows,index,m.cards,record.final);assert.ok(!searchPlans.has(s.card)||searchPlans.get(s.card).consumed||searchPlans.get(s.card).order.length<2,'Previous search has not shuffled');searchPlans.set(s.card,proof);choices=['mentor:play:'+s.card+':search'];}
   if(s.kind==='search-selection'){const proof=assertSearchEvidence(rows,s.initiation,m.cards,record.final);assert.equal(proof.selectionIndex,index);choices=['mentor:take:'+proof.selected];}
   if(s.kind==='search-verify'){const proof=assertSearchEvidence(rows,s.initiation,m.cards,record.final);assert.ok(proof.verificationIndices.includes(index));choices=['mentor:verified'];}

   if(s.kind==='obi-use'){
    const proof=assertObiOutcome(rows,index,m.cards,record.final);choices=['obi:use:'+s.card+':'+proof.target];
   }
   if(s.kind==='obi-choice'){
    assert.ok(Number.isSafeInteger(s.initiation)&&s.initiation>=0&&s.initiation<index);
    const proof=assertObiOutcome(rows,s.initiation,m.cards,record.final);assert.equal(proof.choiceIndex,index);choices=[proof.choice];
   }
   if(s.kind==='battle-add'){
    const targets=assertInterruptTargets(rows,index,m.cards),bp=m.cards[s.card].blueprint;
    assert.ok(['1_82','1_110','1_76','1_116'].includes(bp),'Unsupported paired addition source');
    const label=row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)].toLowerCase();
    assert.equal(label,bp==='1_116'?'add battle destiny':'add two battle destiny');
    choices=()=>auditRules.actions(m,m.stack.at(-1),s.side).filter(a=>a.handler==='battle-add:play'&&a.source===s.card&&JSON.stringify(a.payload.targets.map(t=>t.id).sort())===JSON.stringify([...targets].sort())).map(a=>a.id);
   }
   if(s.kind==='named-cancel'){
    assert.equal(m.cards[s.card].blueprint,'1_235','Unsupported named cancellation source');
    choices=['scomp:play:'+s.card+':cancel:'+assertInterruptTarget(rows,index,m.cards,{playing:true})];
   }
   if(s.kind==='activate')choices=['core:activate'];
   if(s.kind==='draw')choices=['core:draw'];
   if(s.kind==='deploy'){
    const target=followingTarget(rows,index,'deploy-target'),to=target.semantic.card,type=board.cardDefinition(m,to).type;
    if(['Vehicle','Starship'].includes(type)){
     const next=rows.slice(rows.indexOf(target)+1).find(r=>r.semantic&&r.semantic.kind!=='pass');
     const role=deployedCrewRole(rows,index,s.card,to);
     if(next?.semantic.kind==='crew-capacity'){const options=next.parameters.results;assert.ok(options&&Number.isSafeInteger(Number(next.answer)));assert.equal(role,options[Number(next.answer)].toLowerCase(),'Capacity answer must agree with deployed role');}
     choices=['vessel:aboard:'+s.card+':'+to+':'+role];
    }else choices=['deploy:'+s.card+':'+to,'vessel:deploy:'+s.card+':'+to];
   }
   if(s.kind==='equip'){const target=followingTarget(rows,index,'deploy-target');assert.ok(target);choices=['space-weapon:equip:','equip:','saber:equip:','gaffi:equip:','mine:','attach:'].map(prefix=>prefix+s.card+':'+target.semantic.card);}
   if(s.kind==='fire'){const target=followingTarget(rows,index,'fire-target');assert.ok(target);choices=['space-weapon:fire:','fire:','saber:fire:','gaffi:fire:'].map(prefix=>prefix+s.card+':'+target.semantic.card);}
   if(s.kind==='move'){const target=followingTarget(rows,index,'move-target');assert.ok(target);choices=['move:'+s.card+':'+target.semantic.card,'voyage:landspeed:'+s.card+':'+target.semantic.card];}
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
   if(s.kind==='maneuver'){const target=assertInterruptTarget(rows,index,m.cards);choices=['maneuver:'+s.card+':'+target];}
   if(s.kind==='hyperspace'){const target=followingTarget(rows,index,'move-target');choices=['voyage:hyperspace:'+s.card+':'+target.semantic.card];}
   if(s.kind==='vehicle-react'){const target=followingTarget(rows,index,'move-target');choices=['vehicle-react:'+s.card+':'+target.semantic.card];}
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
   if(['disarm-deploy','evazan','disarm-trigger','mentor-search','search-selection','search-verify','obi-use','obi-choice','battle-add','named-cancel','activate','draw','deploy','equip','fire','site','move','battle','drain','forfeit','lose','loss-order','explode','barrier','mine-victims','reduce','macroscan','peek','inspection','kintan','old-ben','stun','dice','takeel','run-luke','escape','escape-card','vehicle-react','hyperspace','maneuver'].includes(s.kind)){
    try{assert.deepEqual(normalizedCheckpoint(snapshot(m,row.state,record.snapshotVersion),m.cards),normalizedCheckpoint(row.state,m.cards));}catch(e){e.message='Checkpoint '+index+' '+JSON.stringify(s)+'\n'+e.message;throw e;}checkpoints++;
    // Browser fixtures may resume a verified checkpoint. Copies prevent the
    // observer from changing either the reference or the continuing replay.
    onCheckpoint?.({index,row:copy(row),match:copy(m)});
   }
   if(s.kind==='search-selection'){
    const source=rows[s.initiation].semantic.card,owner=s.side,frame=m.stack.at(-1);assert.equal(frame?.handler,'mentor:choose');assert.equal(frame.payload.card,source);
    assert.equal(runtime.project(m,auditRules,owner==='light'?'dark':'light').rules.mentorSearch,null,'Opponent cannot inspect a private search');
    assert.deepEqual(runtime.project(m,auditRules,owner).rules.mentorSearch.cards.map(c=>c.id).sort(),[...m.players[owner].reserve].sort());
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
  for(const plan of searchPlans.values())assert.ok(plan.consumed||plan.order.length<2,'Verified search never consumed shuffle entropy');
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
