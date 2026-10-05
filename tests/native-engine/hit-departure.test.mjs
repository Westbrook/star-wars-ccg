import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,mod,pull,rules,step,seek,clone,state,battle,board,priority} from './prisoner-fixture.mjs';
import {fixture as ships,battleReady} from './alternatives-fixture.mjs';
const hit=mod('hit-departure'),restore=mod('restoration'),table=mod('table'),captives=mod('captives');
const pending=m=>m.stack.at(-1)?.event?.cause==='hit-outside-battle';
const finished=m=>!m.stack.some(f=>f.kind==='resolution'&&f.action.handler.startsWith('hit-departure:'))&&!m.stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order');
function marked(){const f=fixture(false,'battle-weapons');battle.battle(f.m).hits.push(f.target);return f;}
function depart(f){const bay=pull(f.m,'light','1_132');f.m.locations.push(bay);board.moveWithAttachments(f.m,f.target,bay);battle.syncBattle(f.m);return bay;}
// Controlled foundational hit/departure fixtures complement the real weapon →
// Alternatives release regression. They grant no new move or capture action.
test('A moved hit character retains hit status and loses with all attachments through a saved generic response',()=>{
 const f=marked(),bay=depart(f),m=f.m;assert.ok(battle.battle(m).hits.includes(f.target));assert.equal(hit.scheduleHitDeparture(m),true);assert.ok(pending(m));assert.equal(hit.scheduleHitDeparture(m),false);rules.validate(clone(m));
 assert.equal(m.cards[f.target].location,bay);const done=seek(clone(m),finished);for(const id of [f.target,f.gun,f.device])assert.equal(done.cards[id].zone,'lost');assert.equal(done.cards[f.second].zone,'table');assert.equal(hit.scheduleHitDeparture(done),false);
});
test('Exclusion at the same site is departure; immediate loss does not wait for battle damage',()=>{
 const f=marked();mod('ground').record(f.m).barriers[f.target]=f.m.turn.number;battle.syncBattle(f.m);assert.equal(hit.scheduleHitDeparture(f.m),true);const m=seek(clone(f.m),finished);assert.equal(m.cards[f.target].zone,'lost');assert.notEqual(battle.battle(m).stage,'damage');
});
test('Restoration before departure removes the hit obligation',()=>{
 const f=marked();restore.restoreToNormal(f.m,f.target);depart(f);assert.equal(hit.scheduleHitDeparture(f.m),false);assert.equal(f.m.cards[f.target].zone,'table');
});
test('Restoration during the saved loss response preserves the same card and equipment',()=>{
 const f=marked();depart(f);hit.scheduleHitDeparture(f.m);restore.restoreToNormal(f.m,f.target);let m=seek(clone(f.m),finished);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.gun].zone,'table');assert.equal(hit.scheduleHitDeparture(m),false);
});
test('Returning and replaying an original target while loss is pending cannot lose the new instance',()=>{
 const f=marked(),bay=depart(f);hit.scheduleHitDeparture(f.m);table.returnToHand(f.m,[f.target]);state.moveCard(f.m,f.target,'table');f.m.cards[f.target].location=bay;
 const m=seek(clone(f.m),finished);assert.equal(m.cards[f.target].zone,'table');assert.equal(hit.scheduleHitDeparture(m),false);
});
test('Ordinary forfeiture and a card already lost never create a second hit loss',()=>{
 const f=fixture();battle.battle(f.m).hits.push(f.target);let m=step(f.m,'forfeit:'+f.target);m=seek(m,x=>x.cards[f.target].zone==='lost');assert.equal(hit.scheduleHitDeparture(m),false);assert.ok(!battle.battle(m).hits.includes(f.target));
});
test('Capturing a hit character preserves its hit until loss and includes inactive personal attachments',()=>{
 const f=marked();captives.captureCharacter(f.m,f.target,{kind:'escort',id:f.escort});battle.syncBattle(f.m);assert.equal(f.m.cards[f.target].zone,'captive');assert.equal(f.m.cards[f.gun].zone,'inactive');assert.equal(hit.scheduleHitDeparture(f.m),true);rules.validate(clone(f.m));
 const m=seek(clone(f.m),finished);for(const id of [f.target,f.gun,f.device])assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[f.escort].zone,'table');assert.equal(captives.escorted(m,f.escort).length,0);
});
test('Capturing a hit ship does not restore it; hull, crew, and personal equipment are lost together',()=>{
 const f=ships({capture:false});let m=battleReady(f);battle.battle(m).hits.push(f.ship);mod('captured-ships').captureStarship(m,f.ship,f.host);battle.syncBattle(m);assert.equal(hit.scheduleHitDeparture(m),true);rules.validate(clone(m));
 m=seek(clone(m),finished);for(const id of [f.ship,...f.characters,f.gun])assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[f.host].zone,'table');assert.equal(m.cards[f.ship].capturedShip,undefined);
});
test('Explicit restoration before capture preserves captive and weapon without a hit retry',()=>{
 const f=marked();restore.restoreToNormal(f.m,f.target);captives.captureCharacter(f.m,f.target,{kind:'escort',id:f.escort});battle.syncBattle(f.m);assert.equal(hit.scheduleHitDeparture(f.m),false);rules.validate(clone(f.m));assert.equal(f.m.cards[f.target].zone,'captive');
});
test('Simultaneous departures have one serialized loss obligation across both sides',()=>{
 const f=marked(),b=battle.battle(f.m);b.hits.push(f.escort);depart(f);mod('ground').record(f.m).barriers[f.escort]=f.m.turn.number;battle.syncBattle(f.m);assert.equal(hit.scheduleHitDeparture(f.m),true);const frame=f.m.stack.at(-2);assert.deepEqual(new Set(frame.action.payload.targets.map(r=>r.id)),new Set([f.target,f.escort]));assert.equal(hit.scheduleHitDeparture(f.m),false);const m=seek(clone(f.m),finished);assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[f.escort].zone,'lost');
});
test('Saved generic hit losses reject corrupt physical targets, duplicate groups, wrong response and unknown handler',()=>{
 const f=marked();depart(f);hit.scheduleHitDeparture(f.m);
 for(const change of [m=>m.stack.at(-2).action.payload.targets.push(m.stack.at(-2).action.payload.targets[0]),m=>m.stack.at(-2).action.payload.targets[0].version=999,m=>m.stack.at(-2).action.payload.targets[0].zone='hand',m=>m.stack.at(-1).event.cause='other',m=>m.stack.at(-2).action.handler='hit-departure:forged',m=>m.stack.at(-2).cancelled=true]){const m=clone(f.m);change(m);assert.throws(()=>hit.assertHitDeparture(m));}
});

test('A core replacement without restoration handles one departure event, survives reload, and cannot protect a later destination',()=>{
 const f=marked();depart(f);hit.scheduleHitDeparture(f.m);const window=f.m.stack.at(-1),ref=f.m.stack.at(-2).action.payload.targets[0];
 // Trusted foundation-only replacement hook; no currently implemented card
 // claims permission to prevent this loss without also restoring the target.
 mod('loss-prevention').preventLoss(f.m,window.serial,ref);rules.validate(clone(f.m));let m=seek(clone(f.m),finished);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.gun].zone,'table');assert.ok(battle.battle(m).hits.includes(f.target));assert.equal(hit.scheduleHitDeparture(m),false);rules.validate(clone(m));
 board.moveWithAttachments(m,f.target,f.site);assert.equal(hit.scheduleHitDeparture(m),true);m=seek(clone(m),finished);assert.equal(m.cards[f.target].zone,'lost');
});
test('Restoring a handled hit clears its receipt; a later hit is a new obligation',()=>{
 const f=marked();depart(f);hit.scheduleHitDeparture(f.m);mod('loss-prevention').preventLoss(f.m,f.m.stack.at(-1).serial,f.m.stack.at(-2).action.payload.targets[0]);let m=seek(clone(f.m),finished);
 restore.restoreToNormal(m,f.target);assert.equal(hit.scheduleHitDeparture(m),false);assert.deepEqual(battle.battle(m).hitDepartures[0].replacements,[]);battle.battle(m).hits.push(f.target);assert.equal(hit.scheduleHitDeparture(m),true);m=seek(m,finished);assert.equal(m.cards[f.target].zone,'lost');
});
test('Handled receipts require their processed event, original response, and original physical target',()=>{
 const f=marked();depart(f);hit.scheduleHitDeparture(f.m);mod('loss-prevention').preventLoss(f.m,f.m.stack.at(-1).serial,f.m.stack.at(-2).action.payload.targets[0]);const m=seek(f.m,finished);
 for(const edit of [e=>e.resolved=false,e=>e.replacements[0].prevention.window++,e=>e.replacements[0].target.version++,e=>e.targets=[]]){const corrupt=clone(m);edit(battle.battle(corrupt).hitDepartures[0]);assert.throws(()=>hit.assertHitDeparture(corrupt));}
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observations=JSON.parse(fs.readFileSync(new URL('./gemp/hit-departure-results.json',import.meta.url)));
for(const row of observations)test('Executed hit-departure foundation outcome: '+row.mode,()=>{
 let f,m,target,attachment;
 if(row.mode==='capture-ship'){f=ships({capture:false});m=battleReady(f);target=f.ship;attachment=f.characters[0];battle.battle(m).hits.push(target);mod('captured-ships').captureStarship(m,target,f.host);}
 else {f=marked();m=f.m;target=f.target;attachment=f.gun;
  if(row.mode==='restore-move')restore.restoreToNormal(m,target);
  if(['move','restore-move'].includes(row.mode))depart(f);
  if(row.mode==='exclude')mod('ground').record(m).barriers[target]=m.turn.number;
  if(row.mode==='capture-character')captives.captureCharacter(m,target,{kind:'escort',id:f.escort});
  if(row.mode==='return-hand'){
   // GEMP's default return effect loses attachments. Stun Blast's existing
   // explicit all-cards-to-hand permission is a different effect and unchanged.
   table.loseFromTable(m,[f.gun,f.device]);table.returnToHand(m,[target]);
  }
 }
 battle.syncBattle(m);hit.scheduleHitDeparture(m);m=seek(clone(m),finished);
 const snap=id=>({hit:battle.battle(m).hits.includes(id),participating:['light','dark'].some(s=>battle.members(m,s).includes(id)),lost:m.cards[id].zone==='lost',capturedShip:!!m.cards[id].capturedShip,attached:!!m.cards[id].attachedTo});
 const normalize=r=>({hit:r.hit,participating:r.participating,lost:r.lost,capturedShip:r.capturedShip,attached:!!r.attachedTo});
 assert.deepEqual(snap(target),normalize(row.after));assert.deepEqual(snap(attachment),normalize(row.attachmentAfter));if(row.mode==='return-hand')assert.equal(m.cards[target].zone,'hand');assert.equal(battle.battle(m).stage!=='complete',row.battleContinues);
});
test('Reference receipt binds six controlled lifecycle observations to unchanged pinned production',()=>{
 const root=new URL('./gemp/',import.meta.url),p=JSON.parse(fs.readFileSync(new URL('hit-departure-provenance.json',root)));
 for(const [file,key]of [[p.harness,'harnessSha256'],[p.results,'resultsSha256'],[p.log,'logSha256']])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),p[key]);
 assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.execution.exitCode,0);assert.equal(p.execution.observedCases,6);assert.equal(observations.length,6);
});

test('Premature end completes battle before hit loss, skips battle-ending, and cannot offer capture from battle',()=>{
 const f=marked();for(const id of battle.battle(f.m).participants.dark)state.moveCard(f.m,id,'hand');
 let m=step(f.m,'battle-premature-end');m=seek(m,pending);assert.equal(battle.battle(m).stage,'complete');assert.equal(battle.battle(m).premature,true);assert.deepEqual(battle.members(m,'light'),[]);assert.ok(!m.stack.some(x=>x.kind==='window'&&x.event?.kind==='battle-ending'));assert.ok(m.stack.some(x=>x.kind==='window'&&x.event?.kind==='battle-ended'));
 assert.deepEqual(mod('prisoner').prisonerActions(m,m.stack.at(-1),'dark'),[]);rules.validate(clone(m));m=seek(clone(m),finished);assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.stack.at(-1).event.kind,'cards-lost');
});
