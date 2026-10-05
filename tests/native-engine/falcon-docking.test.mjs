import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,mod,runtime,state,rules,clone,pull,ids,step,seek,phase,priority,settled} from './starship-effects-fixture.mjs';
const docking=mod('docking'),ground=mod('ground');
function ready(mode='han'){
 const f=fixture(mode);const partner=f.ywing;state.moveCard(f.m,partner,'table');f.m.cards[partner].location=f.planet;
 const m=priority(phase(f.m,'move'),'light');return {...f,m,partner};
}
const offer=f=>ids(f.m).find(id=>id.startsWith('dock:')&&id.includes(f.ship)&&id.includes(f.partner));
const dock=f=>seek(step(f.m,offer(f)),m=>m.stack.at(-1)?.handler==='docking:transfer');
test('Falcon docks with another starfighter, transfers pilot, and resumes saved choices without a capital ship',()=>{
 const f=ready(),before=f.m.players.light.force.length,moves=[...ground.usage(f.m).moved];assert.ok(offer(f));let m=dock(f);
 assert.equal(m.players.light.force.length,before-1);m=seek(step(clone(m),'transfer:'+f.pilot+':'+f.partner+':pilot'),m=>m.stack.at(-1)?.handler==='docking:transfer');
 assert.equal(m.cards[f.pilot].attachedTo,f.partner);assert.equal(mod('occupancy').operational(m,f.ship),false);assert.equal(mod('piloting').vesselHyperspeed(m,f.ship),0);
 m=settled(step(clone(m),'undock'));rules.validate(m);assert.deepEqual(ground.usage(m).moved,moves);assert.equal(m.players.light.force.length,before-1);
});
test('Printed Falcon docking capability remains while unpiloted or its text is canceled',()=>{
 const f=ready();mod('table').returnToHand(f.m,[f.pilot]);assert.ok(offer(f),'The other ship supplies a pilot');
 mod('game-text').suppressGameText(f.m,f.planet,f.ship);assert.equal(docking.hasShipDockingCapability(f.m,f.ship),true);assert.ok(offer(f));
 assert.equal(dock(f).players.light.force.length,f.m.players.light.force.length-1);
});
test('Two ordinary starfighters cannot dock without printed docking capability',()=>{
 const f=ready('other-fighter');assert.equal(docking.hasShipDockingCapability(f.m,f.ship),false);assert.equal(offer(f),undefined);
});
test('A paid docking action cannot bind a returned Falcon instance',()=>{
 const f=ready();let m=step(f.m,offer(f));mod('table').returnToHand(m,[f.ship]);state.moveCard(m,f.ship,'table');m.cards[f.ship].location=f.planet;
 m=settled(m);assert.equal(docking.dockingView(m).docking,null);assert.equal(m.players.light.force.length,f.m.players.light.force.length-1);rules.validate(m);
});
test('Saved docking state rejects a forged pair without any docking-capable vessel',()=>{
 const f=ready(),m=dock(f),other=pull(m,'light','1_147','table',f.planet);const bad=clone(m),p=bad.stack.at(-1).payload;
 // Use another physical ordinary starfighter, retaining valid references and
 // same-owner/location so rejection tests capability rather than identity.
 p.a=mod('identity').referenceCard(bad,other);p.b=mod('identity').referenceCard(bad,f.partner);
 assert.throws(()=>rules.validate(bad),/Invalid docking ships/);
});

import {controlFixture} from './control-station-fixture.mjs';
import {pull as controlPull} from './prisoner-fixture.mjs';
test('Control Station blocks Dark docking Executor from either end, without granting Light a foreign pair',()=>{
 for(const reverse of [false,true]){
  const f=controlFixture({extraDark:['1_302']}),other=controlPull(f.m,'dark','1_302','table',f.from);
  if(reverse)f.m.cards=Object.fromEntries(Object.entries(f.m.cards).reverse());
  const choices=side=>docking.dockingActions(f.m,{timing:'phase'},side);
  assert.equal(choices('dark').some(a=>a.id.includes(f.ship)&&a.id.includes(other)),false);
  assert.equal(choices('light').some(a=>a.id.includes(f.ship)),false);
  state.moveCard(f.m,f.rebel,'hand');assert.ok(choices('dark').some(a=>a.id.includes(f.ship)&&a.id.includes(other)));
 }
});
test('Gaining Light control during a paid docking response stops that move without refunding Force',()=>{
 const f=controlFixture({controlled:false,extraDark:['1_302']}),other=controlPull(f.m,'dark','1_302','table',f.from);
 const action=docking.dockingActions(f.m,f.m.stack.at(-1),'dark').find(a=>a.id.includes(f.ship)&&a.id.includes(other));assert.ok(action);
 // Use the same engine command helper; it discovers the offered acting side.
 let m=step(f.m,action.id);state.moveCard(m,f.rebel,'table');m.cards[f.rebel].location=f.station;m=settled(m);
 assert.equal(docking.dockingView(m).docking,null);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);rules.validate(m);
});
