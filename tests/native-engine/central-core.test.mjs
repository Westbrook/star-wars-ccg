import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,clone,pull,ids,step,seek,phase} from './prisoner-fixture.mjs';
import {coreFixture,coreChoice,takeCore} from './central-core-fixture.mjs';
const refresh=m=>{for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));};

test('Light control cancels a beam during deployment after paying its cost',()=>{
 const f=coreFixture();pull(f.m,'light','1_28','table',f.core);const before=f.m.players.dark.force.length;
 let m=step(f.m,'tractor:deploy:'+f.beam+':'+f.bay);assert.equal(m.players.dark.force.length,before-2);assert.equal(m.cards[f.beam].zone,'playing');assert.ok(coreChoice(m));refresh(m);
 m=step(m,coreChoice(m));m=seek(m,x=>x.cards[f.beam].zone==='lost');assert.equal(m.cards[f.beam].attachedTo,undefined);assert.equal(m.players.dark.force.length,before-2);refresh(m);
});
for(const destination of ['launch','escape'])test('real move gains Core control and releases captured ship via '+destination,()=>{
 const f=coreFixture();let m=takeCore(f);assert.equal(m.cards[f.ship].zone,'inactive');m=step(m,coreChoice(m));m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');assert.equal(m.cards[f.beam].zone,'lost');refresh(m);
 m=step(m,'captured-ship:'+(destination==='launch'?'launch:'+f.site:'escape'));if(destination==='escape')m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));
 assert.ok([f.ship,...f.characters,f.gun].every(id=>m.cards[id].zone===(destination==='launch'?'table':'used')));if(destination==='launch'){assert.equal(m.cards[f.ship].location,f.site);assert.equal(m.cards[f.gun].attachedTo,f.characters[0]);}refresh(m);
});
for(const situation of ['unoccupied','dark','light','contested','suppressed'])test('Core control and active text govern drain and Wrong Turn cost: '+situation,()=>{
 const f=coreFixture();if(['dark','contested'].includes(situation))pull(f.m,'dark','1_168','table',f.core);if(['light','contested','suppressed'].includes(situation))pull(f.m,'light','1_28','table',f.core);if(situation==='suppressed')mod('game-text').suppressGameText(f.m,f.host,f.core);
 assert.equal(mod('board').drainAmount(f.m,'light',f.core),situation==='light'?2:1);
 const a=mod('deploy-effects').deployEffectActions(f.m,f.m.stack.at(-1),'dark').find(a=>a.source===f.wrong);assert.equal(a.payment?.dark??0,situation==='dark'?0:3);
 const before=f.m.players.dark.force.length;let m=step(f.m,'deploy-effect:'+f.wrong);m=seek(m,x=>x.cards[f.wrong].zone==='table');assert.equal(before-m.players.dark.force.length,situation==='dark'?0:3);refresh(m);
});
test('initiated free deployment remains free after Core control is lost',()=>{
 const f=coreFixture(),guard=pull(f.m,'dark','1_168','table',f.core),before=f.m.players.dark.force.length;let m=step(f.m,'deploy-effect:'+f.wrong);mod('table').returnToHand(m,[guard]);m=seek(m,x=>x.cards[f.wrong].zone==='table');assert.equal(m.players.dark.force.length,before);refresh(m);
});
test('initiated beam cancellation survives lost control but never targets a returned beam instance',()=>{
 for(const returns of [false,true]){const f=coreFixture();let m=takeCore(f);m=step(m,coreChoice(m));const hero=Object.values(m.cards).find(c=>c.blueprint==='1_13'&&c.zone==='table');mod('table').returnToHand(m,[hero.id]);if(returns){mod('table').returnToHand(m,[f.beam]);state.moveCard(m,f.beam,'table');m.cards[f.beam].attachedTo=f.bay;m.cards[f.beam].location=f.bay;}
  m=seek(m,x=>!x.stack.some(f=>f.kind==='resolution'&&f.action.handler==='central-core:cancel'));assert.equal(m.cards[f.beam].zone,returns?'table':'lost');refresh(m);
 }
});
test('two holding beams require both mandatory cancellations before release',()=>{
 const f=coreFixture();let m=takeCore(f);const extra=pull(m,'dark','2_111','table',f.bay);m.cards[extra].attachedTo=f.bay;
 m=step(m,coreChoice(m));m=seek(m,x=>x.cards[f.beam].zone==='lost'||x.cards[extra].zone==='lost');assert.equal(m.cards[f.ship].capturedShip.pending,undefined);
 m=seek(m,x=>!!coreChoice(x));m=step(m,coreChoice(m));m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');assert.equal(m.cards[f.beam].zone,'lost');assert.equal(m.cards[extra].zone,'lost');refresh(m);
});
test('Core cancellation leaves ordinary Tractor Beam alone',()=>{
 const f=coreFixture();pull(f.m,'light','1_28','table',f.core);const other=pull(f.m,'dark','2_115','table',f.site);f.m.cards[other].attachedTo=f.host;assert.ok(!coreChoice(f.m));refresh(f.m);
});
test('Core cancellation and free-cost snapshots reject forged bindings',()=>{
 const f=coreFixture();pull(f.m,'light','1_28','table',f.core);let m=step(f.m,'tractor:deploy:'+f.beam+':'+f.bay);m=step(m,coreChoice(m));
 for(const mutate of [p=>p.source.id=f.bay,p=>p.target.zone='hand',p=>p.index=99,p=>p.window=0]){const bad=clone(m),r=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='central-core:cancel');mutate(r.action.payload);assert.throws(()=>runtime.project(bad,rules,'light'));}
 const g=coreFixture();pull(g.m,'dark','1_168','table',g.core);m=step(g.m,'deploy-effect:'+g.wrong);const bad=clone(m);bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='deploy-effect:deploy').action.payload.freeFrom.id=g.bay;assert.throws(()=>runtime.project(bad,rules,'dark'));
});

test('computer uses the publicly offered free Wrong Turn without Force reserves',()=>{
 const f=coreFixture();pull(f.m,'dark','1_168','table',f.core);for(const id of [...f.m.players.dark.force])state.moveCard(f.m,id,'used');
 assert.equal(mod('computer').chooseComputerAction(runtime.project(f.m,rules,'dark'),'dark'),'deploy-effect:'+f.wrong);
});

test('on-table cancellation preserves its about-to-cancel response across refresh',()=>{
 const f=coreFixture();let m=takeCore(f);m=step(m,coreChoice(m));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-be-canceled-on-table');
 assert.equal(m.cards[f.beam].zone,'table');assert.equal(m.cards[f.ship].zone,'inactive');refresh(m);
 const bad=clone(m);bad.stack.at(-1).event.card=f.wrong;assert.throws(()=>runtime.project(bad,rules,'light'));
 m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');assert.equal(m.cards[f.beam].zone,'lost');refresh(m);
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observed=JSON.parse(fs.readFileSync(new URL('./gemp/central-core-results.json',import.meta.url)));
for(const row of observed)test('matches executed GEMP Central Core: '+row.name,()=>{
 const f=coreFixture();let m=f.m,result;
 if(['unoccupied','dark','light','contested'].includes(row.name)){
  if(['dark','contested'].includes(row.name))pull(m,'dark','1_168','table',f.core);if(['light','contested'].includes(row.name))pull(m,'light','1_13','table',f.core);
  const drain=mod('board').drainAmount(m,'light',f.core),before=m.players.dark.force.length;m=step(m,'deploy-effect:'+f.wrong);m=seek(m,x=>x.cards[f.wrong].zone==='table');result={name:row.name,drain,wrongCost:before-m.players.dark.force.length};
 }else if(row.name==='deploy-canceled'){
  pull(m,'light','1_13','table',f.core);const before=m.players.dark.force.length;m=step(m,'tractor:deploy:'+f.beam+':'+f.bay);m=step(m,coreChoice(m));m=seek(m,x=>x.cards[f.beam].zone==='lost');result={name:row.name,cost:before-m.players.dark.force.length,beamLost:true};
 }else{
  m=takeCore(f);let extra,heldAfterFirst=false;if(row.name==='two-beams'){extra=pull(m,'dark','2_111','table',f.bay);m.cards[extra].attachedTo=f.bay;}
  m=step(m,coreChoice(m));m=seek(m,x=>x.cards[f.beam].zone==='lost');
  if(extra){heldAfterFirst=!!m.cards[f.ship].capturedShip&&!m.cards[f.ship].capturedShip.pending;m=seek(m,x=>!!coreChoice(x));m=step(m,coreChoice(m));}
  m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');m=step(m,row.name==='escape'?'captured-ship:escape':'captured-ship:launch:'+f.site);if(row.name==='escape')m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));
  result={name:row.name,beamLost:m.cards[f.beam].zone==='lost',extraLost:!!extra&&m.cards[extra].zone==='lost',heldAfterFirst,captured:!!m.cards[f.ship].capturedShip,atSystem:m.cards[f.ship].location===f.site,shipUsed:m.players.light.used.includes(f.ship),gunUsed:m.players.light.used.includes(f.gun),gunAttached:m.cards[f.gun].attachedTo===f.characters[0]};
 }
 assert.deepEqual(result,row);refresh(m);
});
test('Core receipt binds all executed outcomes and unchanged production source',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/central-core-provenance.json',import.meta.url)));assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(observed.length,8);
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
});
