import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deployTube,movePhase,reactFixture,mod,rules,state,clone,prompt,ids,step,seek,priority,settled} from './lift-tube-fixture.mjs';
const occ=mod('occupancy'),routes=mod('vessel-travel'),vessels=mod('vessels'),gate=mod('laser-gate'),ground=mod('ground'),board=mod('board');
for(const side of ['light','dark'])test(side+' Lift Tube deploys at interior mobile sites and operates empty without ability or presence',()=>{
 const f=fixture({side}),before=f.m.players[side].force.length;
 assert.ok(ids(f.m).includes('vessel:deploy:'+f.tube+':'+f.core));
 for(const site of [f.outside,f.planet])assert.equal(vessels.vesselDeploysAt(f.m,f.tube,site),false);
 const {m}=deployTube(f);assert.equal(m.players[side].force.length,before-1);assert.equal(occ.operational(m,f.tube),true);assert.equal(occ.permanentAbility(m,f.tube),0);assert.equal(board.power(m,f.tube),0);assert.equal(occ.pilotAboard(m,f.tube),false);assert.equal(occ.vesselRule(m,f.tube).passengers,4);rules.validate(clone(m));
});
test('Lift Tube only offers passenger capacity and rejects a fifth passenger',()=>{
 const f=fixture({deployed:true}),m=f.m;
 for(const id of f.passengers.slice(0,4)){assert.equal(occ.roleAvailable(m,f.tube,id,'passenger'),true);assert.equal(occ.roleAvailable(m,f.tube,id,'driver'),false);assert.equal(occ.roleAvailable(m,f.tube,id,'pilot'),false);m.cards[id].attachedTo=f.tube;m.cards[id].aboardRole='passenger';}
 assert.equal(occ.roleAvailable(m,f.tube,f.passengers[4],'passenger'),false);assert.ok(f.passengers.slice(0,4).every(id=>occ.enclosedOccupant(m,id)&&!occ.characterPresent(m,id)));assert.equal(board.presence(m,'light',f.core),true);rules.validate(clone(m));
 const invalid=clone(m);invalid.cards[f.passengers[4]].attachedTo=f.tube;invalid.cards[f.passengers[4]].aboardRole='passenger';assert.throws(()=>rules.validate(invalid),/capacity/);
});
test('empty Lift Tube crosses Laser Gate through three sites for one Force, with recoverable intermediate arrivals',()=>{
 const f=movePhase(fixture({deployed:true})),before=f.m.players.light.force.length;
 assert.equal(gate.laserGateAllowsPassage(f.m,f.passengers[0],f.core,f.corridor),false);
 assert.ok(ids(f.m).includes('voyage:landspeed:'+f.tube+':'+f.bay));let m=step(f.m,'voyage:landspeed:'+f.tube+':'+f.bay);const arrivals=[];
 for(let n=0;n<150&&m.cards[f.tube].location!==f.bay;n++){const w=m.stack.at(-1);if(w.event?.kind==='moved'&&w.event.card===f.tube&&w.passes===0)arrivals.push(w.event.site);m=step(clone(m),'pass');}
 assert.equal(m.cards[f.tube].location,f.bay);assert.deepEqual(arrivals,[f.corridor,f.room]);m=settled(m);assert.equal(m.players.light.force.length,before-1);assert.ok(ground.usage(m).moved.includes(f.tube));assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('voyage:')&&id.includes(f.tube)));
});
test('passengers ride for free, remain enclosed and keep their own regular move after disembarking',()=>{
 let f=movePhase(fixture({deployed:true})),m=step(f.m,'vessel:embark:'+f.passengers[0]+':'+f.tube+':passenger');m=priority(settled(m),'light');const before=m.players.light.force.length;
 m=settled(step(m,'voyage:landspeed:'+f.tube+':'+f.corridor));assert.equal(m.cards[f.passengers[0]].location,f.corridor);assert.equal(m.cards[f.passengers[0]].attachedTo,f.tube);assert.equal(ground.usage(m).moved.includes(f.passengers[0]),false);
 m=priority(m,'light');m=settled(step(clone(m),'vessel:exit:'+f.passengers[0]+':'+f.tube));m=priority(m,'light');assert.ok(ids(m).includes('move:'+f.passengers[0]+':'+f.room));assert.equal(m.players.light.force.length,before-1);
});
test('Lift Tube never exits interior-mobile locations via cargo, shuttling or docking-bay transit',()=>{
 const f=movePhase(fixture({deployed:true})),m=f.m;assert.equal(mod('transport').cargoDeploysAt(m,f.tube,f.carrier,true),false);
 board.moveWithAttachments(m,f.tube,f.bay);assert.ok(!mod('transport').transportActions(m,m.stack.at(-1),'light').some(a=>a.source===f.tube));assert.ok(!mod('travel').transitEligible(m,'light',f.bay,f.outside).includes(f.tube));
 for(const to of [f.planet,f.outside]){const bad=clone(m);board.moveWithAttachments(bad,f.tube,to);assert.throws(()=>rules.validate(bad),/Lift Tube/);}
 const cargo=clone(m);cargo.cards[f.tube].attachedTo=f.carrier;cargo.cards[f.tube].aboardRole='vehicle';cargo.cards[f.tube].location=f.planet;assert.throws(()=>rules.validate(cargo),/Lift Tube/);
});
test('suppression removes react permission but not never-unpiloted rule or interior-mobile limitation',()=>{
 const f=reactFixture(),m=f.m;mod('game-text').suppressGameText(m,f.gateCard,f.tube,'turn');assert.equal(occ.operational(m,f.tube),true);assert.equal(mod('vehicle-react').vehicleReactActions(m,m.stack.at(-1),'light').length,0);assert.ok(routes.vesselRoutes(m,f.tube).length);assert.equal(routes.vehicleDestination(m,f.tube,f.outside),false);
});
for(const side of ['light','dark'])test(side+' Lift Tube react can board, cross Gate and disembark to contest drain after refresh',()=>{
 const f=reactFixture({side}),before=f.m.players[side].force.length;let m=step(f.m,'vehicle-react:'+f.tube+':'+f.bay);
 m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:board');assert.ok(ids(m).includes('board:'+f.passengers[0]+':passenger'));assert.ok(!ids(m).some(id=>id.endsWith(':driver')||id.endsWith(':pilot')));
 m=step(clone(m),'board:'+f.passengers[0]+':passenger');m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:board');m=step(m,'continue-react');m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:exit');
 assert.equal(m.cards[f.tube].location,f.bay);assert.ok(m.stack.some(r=>r.action?.handler==='ground:drain'&&r.cancelled));m=step(clone(m),'exit:'+f.passengers[0]);m=settled(m);
 assert.equal(m.cards[f.passengers[0]].attachedTo,undefined);assert.equal(m.players[side].force.length,before-1);assert.ok(ground.usage(m).reacted.includes(f.tube));assert.ok(ground.usage(m).reacted.includes(f.passengers[0]));
});
test('empty react does not provide presence or cancel an opponent drain',()=>{
 const f=reactFixture(),before=f.m.players.light.lost.length;let m=step(f.m,'vehicle-react:'+f.tube+':'+f.bay);m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:board');m=step(m,'continue-react');m=settled(m);assert.equal(m.cards[f.tube].location,f.bay);assert.ok(m.players.light.lost.length>before);assert.equal(board.presence(m,'light',f.bay),false);
});
test('reacting Lift Tube and enclosed passengers join battle, with no passenger battle power',()=>{
 const f=reactFixture({battle:true,aboard:true});let m=step(f.m,'vehicle-react:'+f.tube+':'+f.bay);m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:exit');assert.ok(ids(m).includes('exit:'+f.passengers[0]));m=step(clone(m),'exit:'+f.passengers[0]);m=seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:exit');m=step(m,'continue-react');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
 const members=mod('battle').members(m,'light');assert.ok([f.tube,...f.passengers].every(id=>members.includes(id)));assert.equal(board.totalPower(m,'light',f.bay),2);assert.equal(m.cards[f.passengers[0]].attachedTo,undefined);rules.validate(clone(m));
});
