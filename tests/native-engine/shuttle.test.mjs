import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,prepared,moving,deploy,settled,step,ids,seek,priority,state,rules,clone,load} from './shuttle-fixture.mjs';
const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),table=load(new URL('../../lib/native-engine/table.ts',import.meta.url)),combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const shuttle=(m,id,to,role)=>priority(settled(step(m,'transport:shuttle:'+id+':'+to+(role?':'+role:''))),m.turn.side);
test('Capital ships deploy and hyperspace at systems but cannot deploy or land at sites',()=>{
 const f=fixture();assert.ok(ids(f.m).includes('vessel:deploy:'+f.carrier+':'+f.planet));assert.ok(!ids(f.m).includes('vessel:deploy:'+f.carrier+':'+f.site));let m=moving(deploy(f.m,f.carrier,f.planet));assert.equal(ids(m).some(id=>id.startsWith('voyage:land:'+f.carrier)),false);assert.equal(board.power(m,f.carrier),8);
});
test('A vehicle shuttles for one Force with its crew, who consume only the inner capacity and no movement',()=>{
 const f=fixture();let m=moving(prepared(f));const before=m.players.dark.force.length;m=shuttle(m,f.crawler,f.carrier,'vehicle');assert.equal(m.players.dark.force.length,before-1);assert.equal(m.cards[f.crawler].attachedTo,f.carrier);assert.equal(m.cards[f.driver].attachedTo,f.crawler);assert.equal(m.cards[f.driver].location,f.planet);assert.equal(ground.usage(m).moved.includes(f.driver),false);assert.equal(occ.landed(m,f.crawler),true);assert.equal(board.power(m,f.crawler),0);assert.equal(occ.occupants(m,f.carrier).length,1);rules.validate(m);
});
test('Unpiloted vehicles may shuttle and use docking transit, but not landspeed',()=>{
 const f=fixture();let m=moving(deploy(deploy(f.m,f.carrier,f.planet),f.crawler,f.site));assert.ok(ids(m).includes('transport:shuttle:'+f.crawler+':'+f.carrier+':vehicle'));assert.ok(ids(m).includes('transit:'+f.site+':'+f.hoth));assert.equal(ids(m).some(id=>id.startsWith('voyage:landspeed:'+f.crawler)),false);m=shuttle(m,f.crawler,f.carrier,'vehicle');assert.equal(m.cards[f.crawler].attachedTo,f.carrier);
});
test('Crew must leave their carried vehicle before shuttling; bridge transfers are unlimited and free',()=>{
 const f=fixture();let m=shuttle(moving(prepared(f)),f.crawler,f.carrier,'vehicle');assert.ok(!ids(m).includes('transport:shuttle:'+f.driver+':'+f.site));const force=m.players.dark.force.length;m=priority(settled(step(m,'transport:bridge:'+f.driver+':'+f.carrier+':passenger')),'dark');assert.equal(m.players.dark.force.length,force);assert.equal(m.cards[f.driver].attachedTo,f.carrier);m=shuttle(m,f.driver,f.site);assert.equal(m.cards[f.driver].attachedTo,undefined);assert.equal(m.cards[f.driver].location,f.site);assert.ok(ground.usage(m).moved.includes(f.driver));
});
test('Vehicle shuttle down restores its driver and is available only after the next regular-move allowance',()=>{
 const f=fixture();let m=shuttle(moving(prepared(f)),f.crawler,f.carrier,'vehicle');assert.ok(!ids(m).includes('transport:shuttle:'+f.crawler+':'+f.site));const turn=m.turn.number;m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.turn.number>turn&&x.stack.length===1);m=priority(m,'dark');m=shuttle(m,f.crawler,f.site);assert.equal(m.cards[f.crawler].attachedTo,undefined);assert.equal(m.cards[f.driver].location,f.site);assert.equal(board.power(m,f.crawler),3);
});
test('Carried vessels may forfeit, while their inner crew do not participate or add system ability',()=>{
 const f=fixture();let m=shuttle(moving(prepared(f)),f.crawler,f.carrier,'vehicle');assert.equal(board.abilityAt(m,'dark',f.planet),1);state.moveCard(m,f.corvette,'table');m.cards[f.corvette].location=f.planet;const turn=m.turn.number;m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.turn.number>turn&&x.stack.length===1);m=priority(m,'dark');m=step(m,'battle:'+f.planet);assert.deepEqual(new Set(combat.members(m,'dark')),new Set([f.carrier,f.crawler]));assert.equal(board.totalPower(m,'dark',f.planet),8);
});
test('TIE cargo deploys, embarks and launches without consuming regular movement; non-TIE cargo is rejected',()=>{
 const f=fixture();let m=deploy(f.m,f.carrier,f.planet);m=priority(settled(step(m,'transport:deploy:'+f.scout+':'+f.carrier+':starship')),'dark');assert.equal(m.cards[f.scout].aboardRole,'starship');assert.equal(board.power(m,f.scout),0);m=moving(m);m=priority(settled(step(m,'transport:disembark:'+f.scout+':'+f.planet)),'dark');assert.equal(board.power(m,f.scout),1);assert.equal(ground.usage(m).moved.includes(f.scout),false);m=priority(settled(step(m,'transport:embark:'+f.scout+':'+f.carrier+':starship')),'dark');assert.equal(m.cards[f.scout].attachedTo,f.carrier);assert.equal(occ.roleAvailable(m,f.carrier,f.ywing,'starship'),false);
});
test('Carrier destruction loses nested cargo, crew and equipment through saved Lost ordering',()=>{
 const f=fixture();let m=prepared(f);state.moveCard(m,f.comlink,'table');m.cards[f.comlink].attachedTo=f.driver;m.cards[f.comlink].location=f.site;m=shuttle(moving(m),f.crawler,f.carrier,'vehicle');table.loseFromTable(m,[f.carrier]);m=settled(m);for(const id of [f.carrier,f.crawler,f.driver,f.comlink])assert.equal(m.cards[id].zone,'lost');rules.validate(m);
});
test('Shuttle target departure during responses keeps the original cargo and spends its Force',()=>{
 const f=fixture();let m=step(moving(prepared(f)),'transport:shuttle:'+f.crawler+':'+f.carrier+':vehicle');const before=m.players.dark.force.length;state.moveCard(m,f.carrier,'hand');state.moveCard(m,f.carrier,'table');m.cards[f.carrier].location=f.planet;m=settled(m);assert.equal(m.cards[f.crawler].location,f.site);assert.equal(m.cards[f.crawler].attachedTo,undefined);assert.equal(m.players.dark.force.length,before);
});

test('Recovery rejects forged cargo roles and hand-zone carriers',()=>{
 const f=fixture();const m=shuttle(moving(prepared(f)),f.crawler,f.carrier,'vehicle');
 for(const edit of [x=>x.cards[f.crawler].aboardRole='pilot',x=>{x.cards[f.driver].attachedTo=f.carrier;x.cards[f.driver].aboardRole='vehicle';},x=>x.cards[f.carrier].zone='hand']){const bad=clone(m);edit(bad);assert.throws(()=>rules.validate(bad));}
 const bad=clone(m);state.moveCard(bad,f.extraCrawler,'table');bad.cards[f.extraCrawler].location=f.planet;bad.cards[f.extraCrawler].attachedTo=f.corvette;bad.cards[f.extraCrawler].aboardRole='vehicle';assert.throws(()=>rules.validate(bad));
});
test('Shuttle continuations require original instance, selected capacity and recorded movement use',()=>{
 const f=fixture();let m=step(moving(prepared(f)),'transport:shuttle:'+f.crawler+':'+f.carrier+':vehicle');
 for(const edit of [p=>p.role='pilot-wannabe',p=>p.card.version=999,p=>p.location=p.target]){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='transport:begin').action.payload);assert.throws(()=>rules.validate(bad));}
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='transport-moving');const bad=clone(m);bad.data.ground.moved=[];assert.throws(()=>rules.validate(bad),/movement use/);
});
test('CPU launches carried fighters without embarking loops',()=>{
 const f=fixture(),runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));let m=deploy(f.m,f.carrier,f.planet);m=priority(settled(step(m,'transport:deploy:'+f.scout+':'+f.carrier+':starship')),'dark');m=moving(m);let v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(x=>x.id==='pass'||x.id.startsWith('transport:'));assert.equal(cpu.chooseComputerAction(v,'dark'),'transport:disembark:'+f.scout+':'+f.planet);m=priority(settled(step(m,'transport:disembark:'+f.scout+':'+f.planet)),'dark');v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(x=>x.id==='pass'||x.id.startsWith('transport:embark:'));assert.equal(cpu.chooseComputerAction(v,'dark'),'pass');
});

const observations=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/shuttle-results.json',import.meta.url)));
for(const expected of observations)test('Executed GEMP shuttle observation: '+expected.mode,()=>{
 const f=fixture(),mode=expected.mode;let m=deploy(f.m,f.carrier,f.planet),row={mode};
 if(mode.startsWith('tie')){
  const force=m.players.dark.force.length;m=priority(settled(step(m,'transport:deploy:'+f.scout+':'+f.carrier+':starship')),'dark');row.deploymentCost=force-m.players.dark.force.length;m=moving(m);const before=m.players.dark.force.length;
  if(mode==='tie-launch')m=priority(settled(step(m,'transport:disembark:'+f.scout+':'+f.planet)),'dark');
  Object.assign(row,{cost:before-m.players.dark.force.length,cargo:m.cards[f.scout].attachedTo===f.carrier,power:board.power(m,f.scout),moved:ground.usage(m).moved.includes(f.scout)});assert.deepEqual(row,expected);return;
 }
 if(mode.startsWith('character')){state.moveCard(m,f.pilot,'table');m.cards[f.pilot].location=f.site;}else{m=deploy(m,f.crawler,f.site);if(mode!=='empty-up')m=deploy(m,f.driver,f.crawler,'driver');}
 m=moving(m);let before=m.players.dark.force.length;m=shuttle(m,mode.startsWith('character')?f.pilot:f.crawler,f.carrier,mode.startsWith('character')?'pilot':'vehicle');
 if(mode.endsWith('down')){const turn=m.turn.number;m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.turn.number>turn&&x.stack.length===1);m=priority(m,'dark');before=m.players.dark.force.length;m=shuttle(m,mode.startsWith('character')?f.pilot:f.crawler,f.site);}
 if(mode==='bridge'){before=m.players.dark.force.length;m=priority(settled(step(m,'transport:bridge:'+f.driver+':'+f.carrier+':passenger')),'dark');}
 Object.assign(row,{cost:before-m.players.dark.force.length,systemAbility:board.abilityAt(m,'dark',f.planet),carrierPower:board.power(m,f.carrier)});
 if(mode.startsWith('character'))Object.assign(row,{aboard:m.cards[f.pilot].attachedTo===f.carrier,moved:ground.usage(m).moved.includes(f.pilot)});
 else Object.assign(row,{cargo:m.cards[f.crawler].attachedTo===f.carrier,vehiclePower:board.power(m,f.crawler),crewInVehicle:m.cards[f.driver].attachedTo===f.crawler,vehicleMoved:ground.usage(m).moved.includes(f.crawler),crewMoved:ground.usage(m).moved.includes(f.driver)});
 const comparison={...expected};if(mode==='cargo-battle'){
  state.moveCard(m,f.corvette,'table');m.cards[f.corvette].location=f.planet;const turn=m.turn.number;m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.turn.number>turn&&x.stack.length===1);m=priority(m,'dark');m=step(m,'battle:'+f.planet);
  const members=combat.members(m,'dark');Object.assign(row,{carrierBattles:members.includes(f.carrier),cargoBattles:members.includes(f.crawler),crewBattles:members.includes(f.driver)});
  // AR p90 Passengers expressly excludes characters inside cargo. Pinned GEMP includes Labria.
  assert.equal(expected.crewBattles,true);comparison.crewBattles=false;
 }
 assert.deepEqual(row,comparison);
});
test('Corvette vehicle capacity is enforced independently of character slots',()=>{
 const f=fixture(),m=f.m;state.moveCard(m,f.corvette,'table');m.cards[f.corvette].location=f.planet;
 for(const id of [f.crawler,f.extraCrawler]){state.moveCard(m,id,'table');Object.assign(m.cards[id],{owner:'light',location:f.planet,attachedTo:f.corvette,aboardRole:'vehicle'});}
 assert.equal(occ.capacityFits(m,f.corvette,[{id:f.crawler,role:'vehicle'}]),true);
 assert.equal(occ.capacityFits(m,f.corvette,[{id:f.crawler,role:'vehicle'},{id:f.extraCrawler,role:'vehicle'}]),false);
 assert.throws(()=>occ.assertOccupancy(m),/capacity exceeded/);
});
