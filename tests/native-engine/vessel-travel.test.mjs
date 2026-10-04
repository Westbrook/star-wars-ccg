import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,moving,driven,deploy,settled,step,ids,priority,seek,state,rules,clone,load,location} from './vessel-travel-fixture.mjs';
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const choices=(m,kind)=>ids(m).filter(id=>id.startsWith('voyage:'+kind+':'));
test('Sandcrawler uses printed landspeed, costs one Force and carries crew without using their move',()=>{
 const f=fixture();let m=moving(driven(f));assert.ok(choices(m,'landspeed').includes('voyage:landspeed:'+f.crawler+':'+f.camp));assert.ok(!choices(m,'landspeed').includes('voyage:landspeed:'+f.crawler+':'+f.farm));const force=m.players.dark.force.length;
 m=step(m,'voyage:landspeed:'+f.crawler+':'+f.camp);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved'&&x.stack.at(-1).event.site===f.dune);
 assert.equal(m.cards[f.crawler].location,f.dune);assert.equal(m.cards[f.driver].location,f.dune);assert.equal(m.stack.at(-1).event.complete,false);assert.equal(ground.usage(m).moved.includes(f.driver),false);
 m=settled(clone(m));assert.equal(m.cards[f.crawler].location,f.camp);assert.equal(m.cards[f.driver].location,f.camp);assert.equal(m.players.dark.force.length,force-1);m=priority(m,'dark');assert.equal(choices(m,'landspeed').length,0);
 m=settled(step(m,'vessel:exit:'+f.driver+':'+f.crawler));m=priority(m,'dark');assert.ok(ids(m).includes('move:'+f.driver+':'+f.farm));rules.validate(m);
});
test('An unpiloted transport has no route and cannot join docking transit',()=>{
 const f=fixture();const m=moving(deploy(f.m,f.crawler,f.site));assert.equal(choices(m,'landspeed').length,0);assert.ok(!ids(m).some(x=>x.startsWith('transit:')));
});
test('Intermediate loss of the driver stops travel at that site without refunding Force',()=>{
 const f=fixture();let m=step(moving(driven(f)),'voyage:landspeed:'+f.crawler+':'+f.camp);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');state.moveCard(m,f.driver,'lost');m=settled(m);assert.equal(m.cards[f.crawler].location,f.dune);assert.ok(ground.usage(m).moved.includes(f.crawler));assert.equal(m.players.dark.force.length,6);rules.validate(m);
});
test('Hyperspace pays once, carries pilot/passenger and shares the regular-move limit with landing',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');m=deploy(m,f.passenger,f.scout,'passenger');m=moving(m);const force=m.players.dark.force.length;
 m=settled(step(m,'voyage:hyperspace:'+f.scout+':'+f.yavin));for(const id of [f.scout,f.pilot,f.passenger])assert.equal(m.cards[id].location,f.yavin);assert.equal(m.players.dark.force.length,force-1);m=priority(m,'dark');assert.equal(choices(m,'hyperspace').length,0);assert.equal(choices(m,'land').length,0);assert.equal(ground.usage(m).moved.includes(f.pilot),false);
});
test('TIE landing requires a docking bay; landing and takeoff there are free',()=>{
 const f=fixture();let m=moving(deploy(f.m,f.scout,f.planet));assert.deepEqual(choices(m,'land'),['voyage:land:'+f.scout+':'+f.site]);const force=m.players.dark.force.length;
 m=settled(step(m,'voyage:land:'+f.scout+':'+f.site));assert.equal(m.cards[f.scout].location,f.site);assert.equal(m.players.dark.force.length,force);assert.equal(board.power(m,f.scout),0);m=priority(m,'dark');assert.equal(choices(m,'takeoff').length,0);
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.turn.number>1&&x.stack.length===1);m=priority(m,'dark');m=settled(step(m,'voyage:takeoff:'+f.scout+':'+f.planet));assert.equal(m.cards[f.scout].location,f.planet);assert.equal(board.power(m,f.scout),1);
});
test('Y-wing can land at exterior sites for one Force and take off without using crew movement',()=>{
 const f=fixture();let m=f.m;m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.ywing,f.planet);m=deploy(m,f.lightPilot,f.ywing,'pilot');m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='move'&&x.stack.length===1);m=priority(m,'light');const force=m.players.light.force.length;m=settled(step(m,'voyage:land:'+f.ywing+':'+f.dune));assert.equal(m.players.light.force.length,force-1);assert.equal(m.cards[f.lightPilot].location,f.dune);assert.equal(ground.usage(m).moved.includes(f.lightPilot),false);
});
test('A route cannot follow a ship that leaves and reenters play during its responses',()=>{
 const f=fixture();let m=step(moving(deploy(f.m,f.scout,f.planet)),'voyage:hyperspace:'+f.scout+':'+f.yavin);state.moveCard(m,f.scout,'hand');state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;m=settled(m);assert.equal(m.cards[f.scout].location,f.planet);assert.equal(m.players.dark.force.length,9);
});
test('Forged route indexes, repeated sites and invalid source references reject recovery',()=>{
 const f=fixture(),m=step(moving(driven(f)),'voyage:landspeed:'+f.crawler+':'+f.camp);
 for(const edit of [p=>p.index=9,p=>p.path[1]=p.path[0],p=>p.card.version=999,p=>p.method='teleport']){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='voyage:begin').action.payload);assert.throws(()=>rules.validate(bad),/vessel|reference/);}
});

const observations=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/vessel-travel-results.json',import.meta.url)));
for(const expected of observations.filter(x=>!x.mode.endsWith('deploy-sites')))test('Executed GEMP travel observation: '+expected.mode,()=>{
 const f=fixture(),mode=expected.mode,light=mode.startsWith('ywing'),vehicle=mode.startsWith('landspeed')||mode==='unpiloted',host=light?f.ywing:vehicle?f.crawler:f.scout,crew=light?f.lightPilot:vehicle?f.driver:f.pilot,side=light?'light':'dark';
 const from=vehicle||mode==='takeoff-bay'?f.site:mode==='ywing-takeoff'?f.dune:f.planet,to=mode==='hyperspace'?f.yavin:mode==='land-bay'?f.site:mode==='ywing-land'||mode==='landspeed-one'?f.dune:mode==='landspeed-two'?f.camp:f.planet;
 let m=f.m;if(light){m.turn.side='light';m.stack[0].priority='light';}m=deploy(m,host,mode==='ywing-takeoff'?f.planet:from);if(mode!=='unpiloted')m=deploy(m,crew,host,vehicle?'driver':'pilot');m=seek(m,x=>x.turn.side===side&&x.turn.phase==='move'&&x.stack.length===1);m=priority(m,side);
 if(mode==='ywing-takeoff'){m=settled(step(m,'voyage:land:'+host+':'+f.dune));const turn=m.turn.number;m=seek(m,x=>x.turn.side===side&&x.turn.phase==='move'&&x.turn.number>turn&&x.stack.length===1);m=priority(m,side);}
 if(mode==='unpiloted'){assert.deepEqual({mode,moveAvailable:travel.vesselRoutes(m,host).length>0},expected);return;}
 const before=m.players[side].force.length,method=mode.includes('takeoff')?'takeoff':mode.includes('land')&&!vehicle?'land':vehicle?'landspeed':'hyperspace';m=step(m,'voyage:'+method+':'+host+':'+to);const steps=[],seen=new Set();
 for(let n=0;n<120&&m.stack.length>1;n++){const e=m.stack.at(-1)?.event;if(e?.kind==='moved'&&e.method==='landspeed'){const key=e.site+':'+e.initial+':'+e.complete;if(!seen.has(key)){seen.add(key);steps.push(m.cards[e.site].blueprint+':'+e.initial+':'+e.complete);}}m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);}
 assert.equal(m.cards[host].location,to);assert.equal(board.name(m,to),board.definition(expected.destination).name); // Opposite printed Tatooine faces share the movement endpoint.
 assert.deepEqual({mode,cost:before-m.players[side].force.length,destination:expected.destination,crewAboard:m.cards[crew].attachedTo===host,hostMoved:ground.usage(m).moved.includes(host),crewMoved:ground.usage(m).moved.includes(crew),power:board.power(m,host),steps},expected);
});
test('Orbit support follows the related system when multiple planets are on table',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);state.moveCard(m,f.driver,'table');m.cards[f.driver].location=f.site;state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;m.locations=[f.yavin,...m.locations.filter(id=>id!==f.yavin)];m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'dark');m=step(m,'battle:'+f.site);assert.equal(board.totalPower(m,'dark',f.site),2);board.moveWithAttachments(m,f.scout,f.yavin);assert.equal(board.totalPower(m,'dark',f.site),1);
});
test('CPU takes off but does not alternate equally valuable hyperspace routes',()=>{
 const f=fixture(),cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url)),runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));let m=moving(deploy(f.m,f.scout,f.site));let v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(x=>x.id==='pass'||x.id.startsWith('voyage:'));assert.equal(cpu.chooseComputerAction(v,'dark'),'voyage:takeoff:'+f.scout+':'+f.planet);m=settled(step(m,'voyage:takeoff:'+f.scout+':'+f.planet));m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.turn.number>1&&x.stack.length===1);m=priority(m,'dark');v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(x=>x.id==='pass'||x.id.startsWith('voyage:hyperspace:'));assert.equal(cpu.chooseComputerAction(v,'dark'),'pass');
});

test('Docking transit carries a driven vehicle to a planet bay and marks only the carrier moved',()=>{
 const f=fixture(['3_59']);let m=driven(f);const hoth=location(m,'light','3_59');m=moving(m);const before=m.players.dark.force.length;m=step(m,'transit:'+f.site+':'+hoth);assert.ok(ids(m).includes('toggle:'+f.crawler));assert.ok(!ids(m).includes('toggle:'+f.driver));m=step(m,'toggle:'+f.crawler);m=settled(step(m,'confirm'));assert.equal(m.cards[f.crawler].location,hoth);assert.equal(m.cards[f.driver].location,hoth);assert.equal(m.players.dark.force.length,before-6);assert.ok(ground.usage(m).moved.includes(f.crawler));assert.equal(ground.usage(m).moved.includes(f.driver),false);rules.validate(m);
});
test('Loss of permission before the moving window stops the move, retains its Force cost and spends the regular move',()=>{
 const f=fixture();let m=step(moving(driven(f)),'voyage:landspeed:'+f.crawler+':'+f.camp);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='vessel-moving');ground.record(m).barriers[f.crawler]=m.turn.number;m=settled(m);assert.equal(m.cards[f.crawler].location,f.site);assert.equal(m.players.dark.force.length,6);assert.ok(ground.usage(m).moved.includes(f.crawler));
});

for(const expected of observations.filter(x=>x.mode.endsWith('deploy-sites')))test('Executed GEMP starfighter deployment restriction: '+expected.mode,()=>{
 const f=fixture(),v=load(new URL('../../lib/native-engine/vessels.ts',import.meta.url)),host=expected.mode.startsWith('scout')?f.scout:f.ywing;
 assert.deepEqual({mode:expected.mode,bay:v.vesselDeploysAt(f.m,host,f.site),planet:v.vesselDeploysAt(f.m,host,f.planet),exterior:v.vesselDeploysAt(f.m,host,f.dune)},expected);
});
