import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,dock,docking,transfer,load,step,settled,priority,ids,clone,state,rules,seek} from './docking-fixture.mjs';
const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),api=load(new URL('../../lib/native-engine/docking.ts',import.meta.url));
test('One docking payment transfers crew, nested vehicle and starfighter in both directions',()=>{
 const f=fixture(),before=f.m.players.dark.force.length,used=[...ground.usage(f.m).moved];let m=dock(f);assert.equal(m.players.dark.force.length,before-1);
 for(const [id,role] of [[f.pilot,'pilot'],[f.crawler,'vehicle'],[f.scout,'starship']])m=transfer(m,id,f.second,role);
 assert.equal(m.cards[f.driver].attachedTo,f.crawler);assert.equal(m.cards[f.crawler].attachedTo,f.second);assert.equal(m.cards[f.pilot].attachedTo,f.second);assert.equal(api.dockingView(m).docking.transfers,3);assert.equal(m.players.dark.force.length,before-1);assert.deepEqual(ground.usage(m).moved,used);
 m=transfer(m,f.pilot,f.carrier,'passenger');assert.equal(api.dockingView(m).docking.transfers,4);m=priority(settled(step(m,'undock')),'dark');assert.equal(api.dockingView(m).docking,null);assert.ok(ids(m).includes('dock:'+f.carrier+':'+f.second));rules.validate(m);
});
test('Docking does not spend regular moves, and supports ending without transfers',()=>{
 const f=fixture();let m=dock(f);m=priority(settled(step(m,'undock')),'dark');assert.equal(ground.usage(m).moved.includes(f.carrier),false);assert.equal(ground.usage(m).moved.includes(f.second),false);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);
});
test('Only directly aboard cards transfer; crew may change seats during docking',()=>{
 const f=fixture();let m=dock(f);assert.equal(ids(m).some(id=>id.startsWith('transfer:'+f.driver+':')),false);m=docking(step(m,'seat:'+f.pilot+':passenger'));assert.equal(m.cards[f.pilot].aboardRole,'passenger');assert.equal(api.dockingView(m).docking.transfers,0);assert.ok(ids(m).includes('transfer:'+f.pilot+':'+f.second+':pilot'));
});
test('Capacity is rechecked after each transfer, including releasing a slot by transferring back',()=>{
 const f=fixture();let m=dock(f);
 for(const id of [f.extraCrawler,f.third]){state.moveCard(m,id,'table');Object.assign(m.cards[id],{attachedTo:f.second,aboardRole:'vehicle',location:f.planet});}
 assert.equal(ids(m).includes('transfer:'+f.crawler+':'+f.second+':vehicle'),false);
 m=transfer(m,f.extraCrawler,f.carrier,'vehicle');assert.ok(ids(m).includes('transfer:'+f.crawler+':'+f.second+':vehicle'));m=transfer(m,f.crawler,f.second,'vehicle');rules.validate(m);
});
test('Ship movement restrictions prevent docking but a carried character restriction does not prevent transfer',()=>{
 const f=fixture(),bad=clone(f.m);ground.record(bad).barriers[f.carrier]=bad.turn.number;assert.equal(ids(bad).some(x=>x.startsWith('dock:')),false);
 let m=dock(f);ground.record(m).barriers[f.pilot]=m.turn.number;assert.ok(ids(m).includes('transfer:'+f.pilot+':'+f.second+':pilot'));assert.equal(ids(m).includes('seat:'+f.pilot+':passenger'),false);m=transfer(m,f.pilot,f.second,'pilot');assert.equal(m.cards[f.pilot].attachedTo,f.second);
});
test('Ship departure and return during the paid response cannot bind a replacement instance',()=>{
 const f=fixture();let m=step(f.m,'dock:'+f.carrier+':'+f.second);state.moveCard(m,f.second,'hand');state.moveCard(m,f.second,'table');m.cards[f.second].location=f.planet;m=settled(m);assert.equal(api.dockingView(m).docking,null);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);
});
test('Ship loss during a transfer response closes the session after the completed transfer',()=>{
 const f=fixture();let m=step(dock(f),'transfer:'+f.pilot+':'+f.second+':pilot');load(new URL('../../lib/native-engine/table.ts',import.meta.url)).loseFromTable(m,[f.carrier]);m=settled(m);assert.equal(api.dockingView(m).docking,null);assert.equal(m.cards[f.pilot].attachedTo,f.second);
});
test('Recovery rejects duplicate sessions, foreign ships, bogus references and counts',()=>{
 const f=fixture(),m=dock(f);for(const edit of [x=>x.stack.push(clone(x.stack.at(-1))),x=>x.stack.at(-1).payload.a.version=999,x=>x.stack.at(-1).payload.transfers=-1,x=>x.stack.at(-1).payload.b=x.stack.at(-1).payload.a,x=>x.stack.at(-1).payload.site=x.stack.at(-1).payload.a]){const bad=clone(m);edit(bad);assert.throws(()=>rules.validate(bad));}
});
test('Enemy ships and ships at different systems cannot dock',()=>{
 const f=fixture(),m=f.m;state.moveCard(m,f.corvette,'table');m.cards[f.corvette].location=f.planet;assert.equal(ids(m).some(id=>id.includes(f.corvette)&&id.startsWith('dock:')),false);m.cards[f.second].location=f.yavin;assert.equal(ids(m).includes('dock:'+f.carrier+':'+f.second),false);
});
test('CPU ends a docking session without a transfer loop',()=>{const f=fixture(),m=dock(f),runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));assert.equal(cpu.chooseComputerAction(runtime.project(m,rules,'dark'),'dark'),'undock');});

const observations=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/docking-results.json',import.meta.url)));
for(const expected of observations)test('Executed GEMP docking observation: '+expected.mode,()=>{
 const f=fixture(),mode=expected.mode,before=f.m.players.dark.force.length;let m=dock(f);
 if(['crew','multiple','return'].includes(mode))m=transfer(m,f.pilot,f.second,'passenger');
 if(['cargo','multiple'].includes(mode))m=transfer(m,f.crawler,f.second,'vehicle');
 if(['fighter','multiple'].includes(mode))m=transfer(m,f.scout,f.second,'starship');
 if(mode==='return')m=transfer(m,f.pilot,f.carrier,'pilot');
 m=settled(step(m,'undock'));assert.deepEqual({mode,cost:before-m.players.dark.force.length,pilotOnSecond:m.cards[f.pilot].attachedTo===f.second,pilotSlot:m.cards[f.pilot].aboardRole==='pilot',cargoOnSecond:m.cards[f.crawler].attachedTo===f.second,fighterOnSecond:m.cards[f.scout].attachedTo===f.second,driverInCargo:m.cards[f.driver].attachedTo===f.crawler,firstPower:occ.vesselPower(m,f.carrier),secondPower:occ.vesselPower(m,f.second),firstMoved:ground.usage(m).moved.includes(f.carrier),secondMoved:ground.usage(m).moved.includes(f.second),pilotMoved:ground.usage(m).moved.includes(f.pilot),cargoMoved:ground.usage(m).moved.includes(f.crawler),fighterMoved:ground.usage(m).moved.includes(f.scout)},expected);
});
test('At least one docking ship needs a pilot; an unpiloted partner is allowed',()=>{
 const f=fixture(),ref=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));let m=f.m;m.data.canceledGameText=[ref.referenceCard(m,f.carrier),ref.referenceCard(m,f.second)];
 // Controlled text cancellation tests the permission predicate; normal runtime restores
 // cancellation without an active producer before offering ordinary actions.
 const choices=()=>api.dockingActions(m,m.stack.at(-1),'dark').map(a=>a.id);assert.ok(choices().includes('dock:'+f.carrier+':'+f.second));m.cards[f.pilot].aboardRole='passenger';assert.equal(choices().includes('dock:'+f.carrier+':'+f.second),false);
});
test('Docking requires Force and does not offer landing-site or carried ships as partners',()=>{
 const f=fixture(),m=f.m;assert.equal(ids(m).some(id=>id.startsWith('dock:')&&id.includes(f.scout)),false);while(m.players.dark.force.length)state.moveCard(m,m.players.dark.force[0],'used');assert.equal(ids(m).some(id=>id.startsWith('dock:')),false);
});
test('Transfers are not movement; docking completion does not fabricate arrival at a location',()=>{
 const f=fixture();let m=step(dock(f),'transfer:'+f.pilot+':'+f.second+':passenger');assert.equal(m.stack.at(-1).event.kind,'ship-transferred');m=docking(m);m=step(m,'undock');assert.deepEqual(m.stack.at(-1).event,{kind:'moved',cards:[f.carrier,f.second],method:'ship-dock',initial:true,complete:true});
});
