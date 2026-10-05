import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as vessels,moving,settled,step,ids,seek,priority,state,rules,clone,load,pull,location} from './shuttle-fixture.mjs';
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const occupancy=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url));
const transport=load(new URL('../../lib/native-engine/transport.ts',import.meta.url));
function fixture({aboard=false}={}){
 const f=vessels({dark:['4_167','4_161','4_165','1_300','1_310'],light:[]});
 const host=pull(f.m,'dark','4_167','table',f.planet),site=location(f.m,'dark','4_161');
 state.moveCard(f.m,f.pilot,'table');f.m.cards[f.pilot].location=aboard?f.planet:site;
 if(aboard)Object.assign(f.m.cards[f.pilot],{attachedTo:host,aboardRole:'pilot'});
 f.m=moving(f.m);return {...f,host,shipSite:site};
}
const choice=(f,to,role)=>'transport:ship-site:'+f.pilot+':'+to+(role?':'+role:'');
const finish=m=>priority(settled(m),'dark');
test('A character moves from its unique ship site to its own related ship for free and uses one regular move',()=>{
 const f=fixture(),before=f.m.players.dark.force.length;
 assert.ok(ids(f.m).includes(choice(f,f.host,'pilot')));assert.ok(ids(f.m).includes(choice(f,f.host,'passenger')));
 const m=finish(step(f.m,choice(f,f.host,'pilot')));
 assert.equal(m.cards[f.pilot].attachedTo,f.host);assert.equal(m.cards[f.pilot].aboardRole,'pilot');assert.equal(m.cards[f.pilot].location,f.planet);assert.equal(m.players.dark.force.length,before);
 assert.ok(ground.usage(m).moved.includes(f.pilot));assert.equal(ids(m).includes(choice(f,f.shipSite)),false);rules.validate(m);
});
test('Aboard pilot leaves the hull for its related unique site; equipment follows and capacity is released',()=>{
 const f=fixture({aboard:true});state.moveCard(f.m,f.comlink,'table');Object.assign(f.m.cards[f.comlink],{attachedTo:f.pilot,location:f.planet});
 const m=finish(step(f.m,choice(f,f.shipSite)));
 assert.equal(m.cards[f.pilot].attachedTo,undefined);assert.equal(m.cards[f.pilot].aboardRole,undefined);assert.equal(m.cards[f.pilot].location,f.shipSite);assert.equal(m.cards[f.comlink].location,f.shipSite);assert.equal(m.cards[f.comlink].attachedTo,f.pilot);
 assert.equal(occupancy.occupants(m,f.host).length,0);assert.ok(ground.usage(m).moved.includes(f.pilot));rules.validate(m);
});
test('Ship-site movement is unavailable without its hull, to an opponent hull, or after its regular move',()=>{
 for(const mode of ['absent','opponent','used','barrier']){
  const f=fixture();if(mode==='absent')state.moveCard(f.m,f.host,'hand');if(mode==='opponent')Object.assign(f.m.cards[f.host],{owner:'light',originalOwner:'dark'});if(mode==='used')ground.record(f.m).moved.push(f.pilot);if(mode==='barrier')ground.record(f.m).barriers[f.pilot]=f.m.turn.number;
  assert.equal(transport.transportActions(f.m,f.m.stack.at(-1),'dark').some(a=>a.id.startsWith('transport:ship-site:'+f.pilot+':')),false,mode);
 }
});
test('Holotheatre does not inherit Launch Bay planetary shuttle permission',()=>{
 const f=fixture();assert.equal(ids(f.m).some(id=>id==='transport:shuttle:'+f.pilot+':'+f.site),false);
 f.m.cards[f.pilot].location=f.site;assert.equal(ids(f.m).some(id=>id==='transport:shuttle:'+f.pilot+':'+f.shipSite),false);
 assert.ok(ids(f.m).includes('transport:shuttle:'+f.pilot+':'+f.host+':pilot'));
});
test('Related-site transfer survives serialization at both response windows and retains exact public views',()=>{
 const f=fixture();let m=step(f.m,choice(f,f.host,'passenger'));
 rules.validate(clone(m));m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='transport-moving');rules.validate(clone(m));
 m=finish(clone(m));assert.equal(m.cards[f.pilot].attachedTo,f.host);assert.equal(m.cards[f.pilot].aboardRole,'passenger');
});
test('Departed-and-returned related hull cannot revive the pending movement',()=>{
 const f=fixture();let m=step(f.m,choice(f,f.host,'passenger'));
 state.moveCard(m,f.host,'hand');state.moveCard(m,f.host,'table');m.cards[f.host].location=f.planet;
 m=finish(m);assert.equal(m.cards[f.pilot].location,f.shipSite);assert.equal(m.cards[f.pilot].attachedTo,undefined);
});
test('A hull departure after movement initiation fails the move without returning its regular-move use',()=>{
 const f=fixture();let m=seek(step(f.m,choice(f,f.host,'passenger')),x=>x.stack.at(-1)?.event?.kind==='transport-moving');
 state.moveCard(m,f.host,'hand');m=finish(m);assert.equal(m.cards[f.pilot].location,f.shipSite);assert.ok(ground.usage(m).moved.includes(f.pilot));
});
test('Ship-site continuation rejects forged relation, role, payment, movement use, and missing physical binding',()=>{
 const f=fixture(),m=step(f.m,choice(f,f.host,'passenger'));
 for(const edit of [p=>delete p.shipSite,p=>delete p.carrier,p=>delete p.fromLocation,p=>p.carrier=p.card,p=>p.role='driver']){
  const bad=clone(m),frame=bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='transport:begin');edit(frame.action.payload);assert.throws(()=>rules.validate(bad));
 }
 const paid=clone(m);paid.stack.find(x=>x.kind==='resolution'&&x.action.handler==='transport:begin').action.payment={dark:1};assert.throws(()=>rules.validate(paid));
 const advanced=seek(m,x=>x.stack.at(-1)?.event?.kind==='transport-moving');ground.record(advanced).moved=[];assert.throws(()=>rules.validate(advanced),/movement use/);
});
test('Crew in nested cargo cannot jump directly to the unique site; interior site rejects vehicle/starfighter unloading',()=>{
 const f=fixture({aboard:true});state.moveCard(f.m,f.scout,'table');Object.assign(f.m.cards[f.scout],{attachedTo:f.host,aboardRole:'starship',location:f.planet});Object.assign(f.m.cards[f.pilot],{attachedTo:f.scout,aboardRole:'pilot'});
 assert.equal(ids(f.m).includes(choice(f,f.shipSite)),false);assert.equal(ids(f.m).includes('transport:ship-site:'+f.scout+':'+f.shipSite),false);
 assert.ok(ids(f.m).includes('transport:bridge:'+f.pilot+':'+f.host+':pilot'));
});
test('Related-ship transfer checks printed capacity and rechecks an occupied slot after responses',()=>{
 const f=fixture(),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),definitions=load(new URL('../../lib/native-engine/definitions.ts',import.meta.url));
 state.moveCard(f.m,f.carrier,'table');f.m.cards[f.carrier].location=f.planet;
 const bay=location(f.m,'dark','4_165');shipSites.registerShipSite(f.m,bay,f.carrier);f.m.cards[f.pilot].location=bay;
 const passengers=Object.values(f.m.cards).filter(c=>c.owner==='dark'&&c.id!==f.pilot&&definitions.cardDefinition(f.m,c.id).type==='Character').slice(0,8);assert.equal(passengers.length,8);
 const seat=(m,id)=>{state.moveCard(m,id,'table');Object.assign(m.cards[id],{attachedTo:f.carrier,aboardRole:'passenger',location:f.planet});};
 passengers.slice(0,7).forEach(c=>seat(f.m,c.id));
 const id=choice(f,f.carrier,'passenger');assert.ok(ids(f.m).includes(id));
 let m=seek(step(f.m,id),x=>x.stack.at(-1)?.event?.kind==='transport-moving');seat(m,passengers[7].id);m=finish(m);
 assert.equal(m.cards[f.pilot].attachedTo,undefined);assert.equal(m.cards[f.pilot].location,bay);assert.ok(ground.usage(m).moved.includes(f.pilot));
 assert.equal(transport.transportActions(m,m.stack.at(-1),'dark').some(a=>a.id===id),false);
});

test('Launch Bay hull transfers are free regular moves while its Dark-side landing remains unlimited',()=>{
 const f=fixture({aboard:true}),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),voyages=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url)),bay=location(f.m,'dark','4_165');shipSites.registerShipSite(f.m,bay,f.host);
 let m=finish(step(f.m,choice(f,bay)));assert.equal(m.cards[f.pilot].location,bay);assert.ok(ground.usage(m).moved.includes(f.pilot));assert.equal(ids(m).includes(choice(f,f.host,'pilot')),false);
 state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;ground.record(m).moved.push(f.scout);
 const a=voyages.vesselTravelActions(m,m.stack.at(-1),'dark').find(a=>a.id.startsWith('voyage:land:'+f.scout+':')&&a.id.includes(bay));assert.ok(a);assert.equal(a.payment?.dark??0,0);
});
test('A cargo starfighter moves to its related Launch Bay with crew without spending their moves',()=>{
 const f=fixture(),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),bay=location(f.m,'dark','4_165');shipSites.registerShipSite(f.m,bay,f.host);
 state.moveCard(f.m,f.scout,'table');Object.assign(f.m.cards[f.scout],{attachedTo:f.host,aboardRole:'starship',location:f.planet});Object.assign(f.m.cards[f.pilot],{attachedTo:f.scout,aboardRole:'pilot',location:f.planet});
 const m=finish(step(f.m,'transport:ship-site:'+f.scout+':'+bay));
 assert.equal(m.cards[f.scout].location,bay);assert.equal(m.cards[f.scout].attachedTo,undefined);assert.equal(m.cards[f.pilot].location,bay);assert.equal(m.cards[f.pilot].attachedTo,f.scout);assert.ok(ground.usage(m).moved.includes(f.scout));assert.equal(ground.usage(m).moved.includes(f.pilot),false);rules.validate(m);
});
test('A starfighter at its own related Launch Bay can use available hull cargo capacity',()=>{
 const f=fixture(),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),bay=location(f.m,'dark','4_165');shipSites.registerShipSite(f.m,bay,f.host);
 state.moveCard(f.m,f.scout,'table');migrate(f.m,f.scout,bay);
 const m=finish(step(f.m,'transport:ship-site:'+f.scout+':'+f.host+':starship'));
 assert.equal(m.cards[f.scout].attachedTo,f.host);assert.equal(m.cards[f.scout].aboardRole,'starship');assert.equal(m.cards[f.scout].location,f.planet);assert.ok(ground.usage(m).moved.includes(f.scout));rules.validate(m);
});
function migrate(m,id,to){delete m.cards[id].attachedTo;delete m.cards[id].aboardRole;m.cards[id].location=to;}

test('Unpiloted starfighter cannot use free regular ship-site movement in either direction',()=>{
 for(const aboard of [false,true]){
  const f=fixture(),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),bay=location(f.m,'dark','4_165'),fighter=pull(f.m,'dark','1_300','table',aboard?f.planet:bay);shipSites.registerShipSite(f.m,bay,f.host);
  if(aboard)Object.assign(f.m.cards[fighter],{attachedTo:f.host,aboardRole:'starship'});
  const id='transport:ship-site:'+fighter+':'+(aboard?bay:f.host+':starship');assert.equal(ids(f.m).includes(id),false);
  Object.assign(f.m.cards[f.pilot],{attachedTo:fighter,aboardRole:'pilot',location:aboard?f.planet:bay});assert.ok(ids(f.m).includes(id));
  let m=seek(step(f.m,id),x=>x.stack.at(-1)?.event?.kind==='transport-moving');state.moveCard(m,f.pilot,'hand');m=finish(m);
  assert.equal(m.cards[fighter].attachedTo,aboard?f.host:undefined);assert.equal(m.cards[fighter].location,aboard?f.planet:bay);assert.ok(ground.usage(m).moved.includes(fighter));
 }
});
test('Related ship-site vehicle movement requires a driver aboard but ordinary shuttling retains its exception',()=>{
 const f=fixture(),shipSites=load(new URL('../../lib/native-engine/ship-sites.ts',import.meta.url)),bay=location(f.m,'dark','4_165'),vehicle=pull(f.m,'dark','1_310','table',bay);shipSites.registerShipSite(f.m,bay,f.host);
 const id='transport:ship-site:'+vehicle+':'+f.host+':vehicle';assert.equal(ids(f.m).includes(id),false);
 Object.assign(f.m.cards[f.pilot],{attachedTo:vehicle,aboardRole:'driver',location:bay});assert.ok(ids(f.m).includes(id));
 const m=finish(step(f.m,id));assert.equal(m.cards[vehicle].attachedTo,f.host);assert.equal(m.cards[f.pilot].attachedTo,vehicle);assert.ok(ground.usage(m).moved.includes(vehicle));
});
