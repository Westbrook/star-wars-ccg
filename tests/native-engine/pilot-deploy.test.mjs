import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,pair,deployedPair,step,settled,ids,seek,rules,clone,state,load,deploy,priority,pull} from './pilot-fixture.mjs';
const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),persona=load(new URL('../../lib/native-engine/persona.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
for(const side of ['light','dark'])test('Simultaneous ship and pilot deployment: '+side,()=>{
 const f=fixture(side),ship=side==='light'?f.gold:f.black,pilot=side==='light'?f.lightPilot:f.pilot,before=f.m.players[side].force.length;
 assert.ok(!ids(f.m).includes('vessel:deploy:'+ship+':'+f.planet));assert.ok(ids(f.m).includes('vessel:deploy:'+ship+':'+f.site));
 let m=pair(f.m,ship,pilot,f.planet);assert.equal(m.cards[ship].zone,'playing');assert.equal(m.cards[pilot].zone,'playing');assert.equal(persona.canPlayThisTurn(m,ship),false);assert.equal(persona.canPlayThisTurn(m,pilot),false);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed');assert.equal(m.cards[ship].zone,'table');assert.equal(m.cards[pilot].attachedTo,ship);assert.equal(m.cards[pilot].aboardRole,'pilot');assert.deepEqual(m.stack.at(-1).event.cards,[ship,pilot]);assert.equal(m.players[side].force.length,before-(side==='light'?4:5));assert.equal(occ.operational(m,ship),true);assert.equal(board.power(m,ship),side==='light'?4:3);assert.equal(m.data.deployments.length,2);rules.validate(m);
});
test('An empty starfighter deploys only to a bay or compatible cargo; paired cargo is landed',()=>{
 const f=fixture();let m=deploy(f.m,f.carrier,f.planet);assert.ok(ids(m).includes('transport:deploy:'+f.black+':'+f.carrier+':starship'));m=deployedPair(m,f.black,f.pilot,f.carrier);assert.equal(m.cards[f.black].attachedTo,f.carrier);assert.equal(m.cards[f.pilot].attachedTo,f.black);assert.equal(board.power(m,f.black),0);assert.equal(occ.operational(m,f.black),false);
});
test('Paired deployment costs both cards, rejects a non-pilot and excludes permanently piloted ships',()=>{
 const f=fixture();assert.equal(ids(f.m).some(id=>id.startsWith('pair-deploy:'+f.scout)),false);assert.equal(ids(f.m).includes('pair-deploy:'+f.black+':'+f.driver+':'+f.planet),false);while(f.m.players.dark.force.length>4)state.moveCard(f.m,f.m.players.dark.force[0],'used');assert.equal(ids(f.m).includes('pair-deploy:'+f.black+':'+f.pilot+':'+f.planet),false);
});
test('Barrier may target either simultaneously deployed card and restricts both',()=>{
 for(const targetKind of ['ship','pilot']){const f=fixture();const barrier=f.barrier;let m=seek(pair(f.m,f.black,f.pilot,f.planet),x=>x.stack.at(-1)?.event?.kind==='deployed');const target=targetKind==='ship'?f.black:f.pilot;assert.ok(ids(m).includes('barrier:'+barrier+':'+target));m=settled(step(m,'barrier:'+barrier+':'+target));assert.equal(ground.barred(m,f.black),true);assert.equal(ground.barred(m,f.pilot),true);}
});
test('Barrier on an ordinary ship also prevents its crew from joining battle, without preventing crew movement',()=>{
 const f=fixture();let m=deployedPair(f.m,f.black,f.pilot,f.planet);ground.record(m).barriers[f.black]=m.turn.number;const participation=load(new URL('../../lib/native-engine/participation.ts',import.meta.url));assert.equal(participation.battleProhibited(m,f.pilot),true);assert.equal(ground.barred(m,f.pilot),false);
});
test('Failed pair uses saved Lost ordering and retains both play allowances',()=>{
 const f=fixture();let m=pair(f.m,f.black,f.pilot,f.planet);m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='pair:deploy').cancelled=true;m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[f.black].zone,'leaving');assert.equal(m.cards[f.pilot].zone,'leaving');m=settled(step(m,'place-lost:'+f.black));assert.deepEqual(m.players.dark.lost.slice(0,2),[f.pilot,f.black]);assert.equal(persona.canPlayThisTurn(m,f.pilot),false);
});
test('A departed deployment destination cannot bind a newly deployed copy',()=>{
 const f=fixture();let m=pair(f.m,f.black,f.pilot,f.planet);const order=[...m.locations];m.locations=m.locations.filter(id=>id!==f.planet);state.moveCard(m,f.planet,'hand');state.moveCard(m,f.planet,'table');m.locations=order;m=settled(m);assert.equal(m.cards[f.black].zone,'lost');assert.equal(m.cards[f.pilot].zone,'lost');
});
test('Pending pair recovery rejects malformed pilot, target and action identity',()=>{
 const f=fixture(),m=pair(f.m,f.black,f.pilot,f.planet);for(const edit of [p=>p.pilot=p.ship,p=>p.location=p.ship,p=>p.target.version=999,p=>p.card=f.scout]){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='pair:deploy').action.payload);assert.throws(()=>rules.validate(bad));}
});
test('Paired source instances and cargo discriminator cannot be forged in a recovered command',()=>{
 const f=fixture(),m=pair(f.m,f.black,f.pilot,f.planet);for(const edit of [p=>p.ship.version--,p=>p.pilot.version--,p=>p.cargo='yes']){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='pair:deploy').action.payload);assert.throws(()=>rules.validate(bad));}
});
test('Computer chooses an offered operational pair using its private projection',()=>{
 const f=fixture();const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));const view=runtime.project(f.m,rules,'dark');assert.equal(chooseComputerAction(view,'dark'),'pair-deploy:'+f.black+':'+f.pilot+':'+f.planet);
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/pilot-deploy-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP paired deployment observation: '+expected.mode,()=>{
 const {mode}=expected,light=mode.startsWith('light'),side=light?'light':'dark',paired=!mode.startsWith('empty'),f=fixture(side),ship=light?f.gold:f.black,pilot=light?f.lightPilot:f.pilot,target=mode.endsWith('bay')?f.site:mode.endsWith('cargo')?f.carrier:f.planet;
 let m=f.m;if(mode.endsWith('cargo'))m=deploy(m,f.carrier,f.planet);const before=m.players[side].force.length;
 m=paired?pair(m,ship,pilot,target):step(m,'vessel:deploy:'+ship+':'+target);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed');const event=m.stack.at(-1).event,arrivalCount=event.cards?.length??1,sharedArrival=!!event.simultaneous&&m.cards[pilot].attachedTo===ship;
 if(mode.startsWith('barrier'))m=step(m,'barrier:'+f.barrier+':'+(mode.endsWith('ship')?ship:pilot));m=settled(m);
 assert.deepEqual({mode,cost:before-m.players[side].force.length,pilotAboard:m.cards[pilot].attachedTo===ship,pilotSlot:m.cards[pilot].aboardRole==='pilot',power:board.power(m,ship),cargo:m.cards[ship].attachedTo===f.carrier,arrivalCount,sharedArrival,barrierUsed:m.players.light.used.includes(f.barrier),shipBarred:ground.barred(m,ship),pilotBarred:ground.barred(m,pilot)},expected);
});
test('A barred ship and its crew are omitted from a battle with another friendly ship',()=>{
 const f=fixture();let m=deployedPair(f.m,f.black,f.pilot,f.planet);m=deploy(m,f.scout,f.planet);ground.record(m).barriers[f.black]=m.turn.number;state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;
 const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));m=seek(m,x=>x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'dark');m=step(m,'battle:'+f.planet);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));assert.deepEqual(combat.members(m,'dark'),[f.scout]);assert.equal(runtime.project(m,rules,'dark').rules.battle.participants.dark.includes(f.pilot),false);
});
test('Barrier can respond to the surviving ship after the paired pilot leaves table',()=>{
 const f=fixture();let m=seek(pair(f.m,f.black,f.pilot,f.planet),x=>x.stack.at(-1)?.event?.kind==='deployed');const table=load(new URL('../../lib/native-engine/table.ts',import.meta.url));table.returnToHand(m,[f.pilot]);assert.ok(ids(m).includes('barrier:'+f.barrier+':'+f.black));m=settled(step(m,'barrier:'+f.barrier+':'+f.black));assert.equal(ground.barred(m,f.black),true);assert.equal(ground.barred(m,f.pilot),false);rules.validate(m);
});
