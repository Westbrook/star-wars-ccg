import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,rules,state,clone,pull,phase,step,seek,ids} from './prisoner-fixture.mjs';
import {launchFixture} from './launch-bay-fixture.mjs';
const bay=mod('launch-bay');
const refresh=m=>{for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));};
const move=(m,id,to,method)=>seek(step(m,'voyage:'+method+':'+id+':'+to),x=>x.cards[id].location===to);

test('Launch Bay TIE discount counts printed models and affects actual deployed Force cost',()=>{
 assert.equal(bay.launchBayTIECount(['TIE_LN','TIE_LN','TIE_ADVANCED_X1']),3);
 assert.equal(bay.launchBayTIECount(['TIE_LN','X_WING']),1);
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','hand');let m=phase(f.m,'dark','deploy');
 assert.equal(bay.launchBayDeployModifier(m,tie,f.bay),-2);assert.equal(bay.launchBayDeployModifier(m,tie,f.site),0);
 const before=m.players.dark.force.length;m=step(m,'vessel:deploy:'+tie+':'+f.bay);refresh(m);m=seek(m,x=>x.cards[tie].zone==='table');
 assert.equal(m.cards[tie].location,f.bay);assert.equal(m.players.dark.force.length,before);assert.equal(m.cards[tie].attachedTo,undefined);refresh(m);
});
test('suppression removes discount and immunity but preserves structural starfighter deployment',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','hand');let m=phase(f.m,'dark','deploy');
 assert.equal(bay.launchBayImmuneToRevolution(m,f.bay),true);mod('game-text').suppressGameText(m,f.host,f.bay);
 assert.equal(bay.launchBayImmuneToRevolution(m,f.bay),false);assert.equal(bay.launchBayDeployModifier(m,tie,f.bay),0);assert.ok(ids(m).includes('vessel:deploy:'+tie+':'+f.bay));
 const before=m.players.dark.force.length;m=step(m,'vessel:deploy:'+tie+':'+f.bay);m=seek(m,x=>x.cards[tie].zone==='table');assert.equal(m.players.dark.force.length,before-1);refresh(m);
});
test('Dark may land and take off repeatedly for free without consuming its regular move',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','table',f.site);let m=phase(f.m,'dark','move');const force=m.players.dark.force.length;
 // The allowance also applies after a regular move has already been spent.
 mod('ground').record(m).moved.push(tie);
 for(let n=0;n<2;n++){
  m=move(m,tie,f.bay,'land');refresh(m);m=phase(m,'dark','move');
  assert.ok(ids(m).includes('voyage:takeoff:'+tie+':'+f.site));m=move(m,tie,f.site,'takeoff');m=phase(m,'dark','move');
 }
 assert.equal(m.players.dark.force.length,force);assert.equal(mod('ground').usage(m).moved.filter(id=>id===tie).length,1);refresh(m);
});
test('Light landing is free but consumes its regular move and cannot reuse the Dark permission',()=>{
 const f=launchFixture(),fighter=pull(f.m,'light','1_147','table',f.site);let m=phase(f.m,'light','move');const force=m.players.light.force.length;
 m=move(m,fighter,f.bay,'land');m=phase(m,'light','move');assert.equal(m.players.light.force.length,force);assert.ok(mod('ground').usage(m).moved.includes(fighter));
 assert.ok(!ids(m).includes('voyage:takeoff:'+fighter+':'+f.site));refresh(m);
});
test('canceled text does not make Dark landing illegal, but it becomes regular movement',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','table',f.site);let m=phase(f.m,'dark','move');mod('game-text').suppressGameText(m,f.host,f.bay);
 m=move(m,tie,f.bay,'land');m=phase(m,'dark','move');assert.ok(mod('ground').usage(m).moved.includes(tie));assert.ok(!ids(m).includes('voyage:takeoff:'+tie+':'+f.site));refresh(m);
});
test('launch permissions do not permit unpiloted takeoff or capital ships to land',()=>{
 const f=launchFixture(),unpiloted=pull(f.m,'dark','1_300','table',f.bay);let m=phase(f.m,'dark','move');
 assert.deepEqual(bay.launchBayVesselRoutes(m,unpiloted),[]);assert.deepEqual(bay.launchBayVesselRoutes(m,f.host),[]);assert.ok(!ids(m).includes('voyage:takeoff:'+unpiloted+':'+f.site));refresh(m);
});
for(const direction of ['up','down'])test('Launch Bay shuttle '+direction+' is free but remains a regular move',()=>{
 const f=launchFixture(),surface=pull(f.m,'light','1_132');f.m.locations.splice(f.m.locations.indexOf(f.bay),0,surface);
 const from=direction==='up'?surface:f.bay,to=direction==='up'?f.bay:surface,card=pull(f.m,'dark','1_194','table',from);let m=phase(f.m,'dark','move');const force=m.players.dark.force.length;
 assert.ok(ids(m).includes('transport:shuttle:'+card+':'+to));m=step(m,'transport:shuttle:'+card+':'+to);refresh(m);m=seek(m,x=>x.cards[card].location===to);m=phase(m,'dark','move');
 assert.equal(m.players.dark.force.length,force);assert.equal(m.cards[card].attachedTo,undefined);assert.ok(mod('ground').usage(m).moved.includes(card));assert.ok(!ids(m).includes('transport:shuttle:'+card+':'+from));refresh(m);
});
test('shuttle permission neither crosses systems nor survives suppressed text',()=>{
 const f=launchFixture(),surface=pull(f.m,'light','1_132');f.m.locations.splice(f.m.locations.indexOf(f.bay),0,surface);const trooper=pull(f.m,'dark','1_194','table',surface);let m=phase(f.m,'dark','move');
 assert.deepEqual(bay.launchBayShuttleDestinations(m,trooper),[f.bay]);mod('game-text').suppressGameText(m,f.host,f.bay);assert.deepEqual(bay.launchBayShuttleDestinations(m,trooper),[]);
 // Host shuttling remains a distinct, ordinarily paid action.
 assert.ok(ids(m).some(id=>id.startsWith('transport:shuttle:'+trooper+':'+f.host+':')));refresh(m);
});
test('free docking transfers between a related bay and the other ship with normal capacity roles',()=>{
 const f=launchFixture(),other=pull(f.m,'dark','1_302','table',f.site),resident=pull(f.m,'dark','1_194','table',f.bay);let m=phase(f.m,'dark','move');
 const dock=ids(m).find(id=>id.startsWith('dock:')&&id.includes(other)),force=m.players.dark.force.length;assert.ok(dock);m=step(m,dock);m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');
 assert.ok(ids(m).includes('transfer:'+resident+':'+other+':passenger'));m=step(m,'transfer:'+resident+':'+other+':passenger');m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');
 assert.equal(m.cards[resident].location,f.site);assert.equal(m.cards[resident].attachedTo,other);assert.equal(m.players.dark.force.length,force);refresh(m);
 m=step(m,'transfer:'+resident+':'+f.bay+':site');m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');assert.equal(m.cards[resident].location,f.bay);assert.equal(m.cards[resident].attachedTo,undefined);assert.equal(m.cards[resident].aboardRole,undefined);refresh(m);
});
test('landing response cannot follow a bay whose related host moved to a different system',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','table',f.site),yavin=pull(f.m,'light','1_135');f.m.locations.push(yavin);let m=phase(f.m,'dark','move');m=step(m,'voyage:land:'+tie+':'+f.bay);
 mod('board').moveWithAttachments(m,f.host,yavin);m=seek(m,x=>!x.stack.some(f=>f.kind==='resolution'&&f.action.handler.startsWith('voyage:')));
 assert.equal(m.cards[tie].location,f.site);refresh(m);
});
test('paired deployment applies the TIE discount only to the starship portion',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_300','hand'),pilot=pull(f.m,'dark','1_167','hand');let m=phase(f.m,'dark','deploy');
 const before=m.players.dark.force.length,pilotCost=mod('board').deploymentPayment(m,pilot,f.bay,true).dark;
 m=step(m,'pair-deploy:'+tie+':'+pilot+':'+f.bay);m=seek(m,x=>x.cards[tie].zone==='table');
 assert.equal(m.players.dark.force.length,before-pilotCost);assert.equal(m.cards[pilot].attachedTo,tie);assert.equal(m.cards[tie].location,f.bay);refresh(m);
});
test('bay transfers honor destination capacity and barriers in both directions',()=>{
 const f=launchFixture(),other=pull(f.m,'dark','1_302','table',f.site),resident=pull(f.m,'dark','1_194','table',f.bay),passengers=[];
 for(let i=0;i<8;i++){const id=pull(f.m,'dark','1_194','table',f.site);Object.assign(f.m.cards[id],{attachedTo:other,aboardRole:'passenger'});passengers.push(id);}
 let m=phase(f.m,'dark','move');const dock=ids(m).find(id=>id.startsWith('dock:')&&id.includes(other));m=step(m,dock);m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');
 assert.ok(!ids(m).includes('transfer:'+resident+':'+other+':passenger'));
 mod('ground').record(m).barriers[passengers[0]]=m.turn.number;mod('ground').record(m).barriers[resident]=m.turn.number;
 assert.ok(!ids(m).includes('transfer:'+passengers[0]+':'+f.bay+':site'));assert.ok(!ids(m).some(id=>id.startsWith('transfer:'+resident+':')));refresh(m);
});
test('saved free docking refuses mismatched carrier grants and forged paid cost',()=>{
 const f=launchFixture(),other=pull(f.m,'dark','1_302','table',f.site);let m=phase(f.m,'dark','move');m=step(m,ids(m).find(id=>id.startsWith('dock:')&&id.includes(other)));
 const pending=x=>x.stack.find(f=>f.kind==='resolution'&&f.action.handler==='docking:begin');assert.ok(pending(m));
 for(const corrupt of [x=>pending(x).action.payload.freeHost=mod('identity').referenceCard(x,other),x=>pending(x).action.payload.bays[0].host=mod('identity').referenceCard(x,other),x=>pending(x).action.payment.dark=1]){
  const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.project(bad,rules,'dark'));
 }refresh(m);
});
test('saved unlimited routes reject wrong carrier and loss of source instance',()=>{
 const f=launchFixture(),tie=pull(f.m,'dark','1_304','table',f.site),other=pull(f.m,'dark','1_302','table',f.site);let m=phase(f.m,'dark','move');m=step(m,'voyage:land:'+tie+':'+f.bay);
 const bad=clone(m),r=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='voyage:begin');r.action.payload.carrier=mod('identity').referenceCard(bad,other);assert.throws(()=>runtime.project(bad,rules,'dark'));
 mod('table').loseFromTable(m,[f.bay]);m=seek(m,x=>!x.stack.some(f=>f.kind==='resolution'&&f.action.handler.startsWith('voyage:')));assert.equal(m.cards[tie].location,f.site);refresh(m);
});
