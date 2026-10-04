import fs from 'node:fs';
import {fixture,place,caveFixture} from './named-sectors-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as base,pull,deploySector,seek,priority,step,ids,load} from './sectors-fixture.mjs';
import {deploy,rules,clone,state,location,force} from './vessels-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const sectors=load(new URL('../../lib/native-engine/sectors.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));
const occupancy=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url));
const piloting=load(new URL('../../lib/native-engine/piloting.ts',import.meta.url));
const setup=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const bespin=load(new URL('../../lib/native-engine/bespin.ts',import.meta.url));
const effects=load(new URL('../../lib/native-engine/sector-effects.ts',import.meta.url));
const settle=m=>seek(m,x=>x.stack.length===1);

test('Cloud City starts without Bespin; generic Clouds still need the planet',()=>{
 const f=fixture();let m=f.m;const city=pull(m,'light','5_77','hand'),cloud=pull(m,'light','5_85','hand');
 assert.equal(setup.premiereSetup.location(m,city).group,'Bespin');assert.equal(setup.premiereSetup.location(m,cloud),null);
 m=deploySector(m,city,'Bespin');assert.equal(sectors.sectorSystem(m,city),'Bespin');assert.equal(sectors.landingEndpoint(m,'Bespin'),city);
 assert.ok(!board.sitePlacements(m,cloud).some(p=>p.sector==='Bespin'));
 const planet=pull(m,'light','5_76','hand');m=place(m,planet,board.sitePlacements(m,planet)[0]);m=deploySector(m,cloud,'Bespin');
 assert.equal(sectors.landingEndpoint(m,'Bespin'),city);assert.equal(board.system(m,city),'Bespin');rules.validate(clone(m));
});

test('Cloud City stays below Clouds in either orientation and converts with occupants',()=>{
 for(const reverse of [false,true]){const f=fixture();let m=f.m;const planet=location(m,'light','5_76');const city=pull(m,'light','5_77','hand'),cloud=pull(m,'light','5_85','hand'),dark=pull(m,'dark','5_165','hand');
 m=deploySector(m,city,'Bespin',reverse?0:-1);m=deploySector(m,cloud,'Bespin');m=deploy(m,f.ywing,city);
 assert.equal(occupancy.vesselPower(m,f.ywing),2);assert.equal(piloting.vesselManeuver(m,f.ywing),3);
 const before=m.locations.filter(id=>sectors.locationGroup(m,id)==='Bespin');assert.deepEqual(before,reverse?[city,cloud,planet]:[planet,cloud,city]);
 m=place(m,dark,board.sitePlacements(m,dark)[0]);assert.equal(m.cards[city].coveredBy,dark);assert.equal(m.cards[f.ywing].location,dark);assert.equal(sectors.landingEndpoint(m,'Bespin'),dark);rules.validate(clone(m));
 }
});

test('Big One has a separate one-per-system limit, and does not inherit Field cancellation',()=>{
 const f=fixture();let m=f.m;const fields=Array.from({length:3},()=>pull(m,'light','4_81','hand')),big=pull(m,'light','4_82','hand'),dark=pull(m,'dark','4_156','hand');
 for(const id of fields)m=deploySector(m,id);m=deploySector(m,big);assert.equal(sectors.sectorsAt(m,'Tatooine','asteroid').length,4);assert.equal(board.sitePlacements(m,dark).filter(p=>!p.replace).length,0);
 m=deploy(m,f.ywing,big);assert.equal(board.drainAmount(m,'light',big),3);assert.equal(board.system(m,big),undefined);
 const yavin=location(m,'light','1_135');assert.ok(board.sitePlacements(m,dark).filter(p=>!p.replace).every(p=>p.sector==='Yavin 4'));m=deploySector(m,dark,'Yavin 4');
 const response={kind:'window',timing:'response',serial:500,priority:'light',passed:[],event:{kind:'action'}};m.stack=[{kind:'resolution',actor:'dark',cancelled:false,action:{id:'fake-drain',handler:'ground:drain',payload:{site:f.planet}}},response];
 assert.ok(!effects.sectorActions(m,response,'light').some(a=>a.source===big));assert.ok(m.locations.includes(yavin));
});

test('Cave binds to its Big One, survives refresh, cannot start, walk, hyperspace or shortcut to planet',()=>{
 let {m,big,cave,...f}=caveFixture();assert.equal(setup.premiereSetup.location(m,cave),null);assert.equal(sectors.caveSector(m,cave),big);assert.equal(board.system(m,cave),undefined);assert.equal(board.adjacent(m,cave,f.site),false);
 const another=pull(m,'dark','4_157','hand');assert.equal(board.sitePlacements(m,another).filter(p=>!p.replace).length,0);
 m=deploy(m,f.ywing,big);assert.ok(travel.vesselRoutes(m,f.ywing).some(r=>r.method==='land'&&r.path[1]===cave));assert.ok(!travel.vesselRoutes(m,f.ywing).some(r=>r.method==='land'&&r.path[1]===f.site));
 m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='move'&&x.stack.length===1),'light');m=settle(step(m,'voyage:land:'+f.ywing+':'+cave));assert.equal(m.cards[f.ywing].location,cave);
 const restored=clone(m);assert.deepEqual(travel.vesselRoutes(restored,f.ywing).map(r=>({method:r.method,path:r.path})),[{method:'takeoff',path:[cave,big]}]);rules.validate(restored);
});

test('Caves are off the movement row and remain paired when more sectors deploy',()=>{
 let {m,big,cave,...f}=caveFixture();const field=pull(m,'light','4_81','hand');
 assert.ok(board.sitePlacements(m,field).every(p=>p.index!==m.locations.indexOf(cave)));m=deploySector(m,field,'Tatooine',-1);m=deploy(m,f.ywing,big);
 assert.ok(travel.vesselRoutes(m,f.ywing).some(r=>r.method==='sector'&&r.path.at(-1)===field));rules.validate(m);
 const corrupted=clone(m);corrupted.data.caves[0].sector=clone(corrupted.data.caves[0].card);assert.throws(()=>rules.validate(corrupted),/cave/i);
 const detached=clone(m);detached.locations.splice(detached.locations.indexOf(cave),1);detached.locations.push(cave);assert.throws(()=>rules.validate(detached),/Cave|contiguous/);
});

test('A controlled cave cancels its own related system drain through response and refresh',()=>{
 let {m,big,cave,...f}=caveFixture();state.moveCard(m,f.lightPilot,'table');m.cards[f.lightPilot].location=cave;m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'dark');m=deploy(m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');
 m=priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='control'&&x.stack.length===1),'dark');m=step(m,'drain:'+f.planet);m=seek(m,x=>ids(x).some(id=>id.startsWith('sector:cancel:'+cave+':')));
 m=step(clone(m),ids(m).find(id=>id.startsWith('sector:cancel:'+cave+':')));const before=m.players.light.lost.length;m=settle(m);assert.equal(m.players.light.lost.length,before);rules.validate(m);
});

test('Bespin targets character/vehicle deployment at Cloud City, not generic Clouds or global costs',()=>{
 const f=fixture();let m=f.m;const planet=location(m,'light','5_76'),city=pull(m,'light','5_77','hand'),site=location(m,'light','5_79');m=deploySector(m,city,'Bespin');m=deploy(m,f.ywing,planet);
 assert.equal(bespin.bespinDeployModifier(m,f.pilot,site),1);assert.equal(board.deploymentPayment(m,f.pilot,site).dark,5);assert.equal(bespin.bespinDeployModifier(m,f.lightPilot,site),0);assert.equal(bespin.bespinDeployModifier(m,f.scout,city),0);
 const cloud=pull(m,'light','5_85','hand');m=deploySector(m,cloud,'Bespin');assert.equal(bespin.bespinDeployModifier(m,f.pilot,cloud),0);
 board.moveWithAttachments(m,f.ywing,city);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=planet;state.moveCard(m,f.pilot,'table');m.cards[f.pilot].location=planet;m.cards[f.pilot].attachedTo=f.scout;m.cards[f.pilot].aboardRole='pilot';
 assert.equal(bespin.bespinDeployModifier(m,f.passenger,site),-1);assert.equal(board.deploymentPayment(m,f.passenger,site).dark,0);rules.validate(m);
});

test('Cloud City contributes battle-only power at its sites and never generic Cloud text',()=>{
 const f=fixture();let m=f.m;const city=pull(m,'light','5_77','hand'),site=location(m,'light','5_79');m=deploySector(m,city,'Bespin');m=deploy(m,f.ywing,city);
 assert.equal(bespin.cloudCityBattleBonus(m,'light',site),0);m.data.battle={site,stage:'weapons'};assert.equal(bespin.cloudCityBattleBonus(m,'light',site),1);assert.equal(bespin.cloudCityBattleBonus(m,'dark',site),0);assert.equal(bespin.cloudCityBattleBonus(m,'light',f.site),0);
 assert.equal(board.drainAmount(m,'light',city),1);board.moveWithAttachments(m,f.ywing,f.planet);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=city;state.moveCard(m,f.pilot,'table');m.cards[f.pilot].attachedTo=f.scout;m.cards[f.pilot].aboardRole='pilot';m.cards[f.pilot].location=city;assert.equal(board.drainAmount(m,'dark',city),2);assert.equal(bespin.cloudCityBattleBonus(m,'dark',site),1);
});


test('Converting Big One and its cave preserves the branch and occupants across refresh',()=>{
 let {m,big,cave,...f}=caveFixture();const darkBig=pull(m,'dark','4_156','hand'),darkCave=pull(m,'dark','4_157','hand');
 state.moveCard(m,f.lightPilot,'table');m.cards[f.lightPilot].location=cave;
 m=place(m,darkBig,board.sitePlacements(m,darkBig).find(p=>p.replace===big));assert.equal(sectors.caveSector(m,cave),darkBig);rules.validate(clone(m));
 m=place(m,darkCave,board.sitePlacements(m,darkCave).find(p=>p.replace===cave));assert.equal(sectors.caveSector(m,darkCave),darkBig);assert.equal(m.cards[f.lightPilot].location,darkCave);assert.equal(m.cards[cave].coveredBy,darkCave);rules.validate(clone(m));
});

test('Generic sector conversion preserves Force drain history and the physical route',()=>{
 const f=fixture();let m=f.m;const field=pull(m,'light','4_81','hand'),dark=pull(m,'dark','4_155','hand');m=deploySector(m,field);m=deploy(m,f.ywing,field);
 m=place(m,dark,board.sitePlacements(m,dark).find(p=>p.replace===field));assert.equal(m.cards[f.ywing].location,dark);assert.equal(sectors.sectorSystem(m,dark),'Tatooine');assert.equal(m.cards[field].coveredBy,dark);rules.validate(clone(m));
});

const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/named-sector-results.json',import.meta.url)));
for(const expected of oracle)test('executed GEMP named-sector observation '+expected.mode,()=>{
 const f=fixture();let m=f.m;const planet=location(m,'light','5_76'),site=location(m,'light','5_79'),city=pull(m,'light','5_77','hand');m=deploySector(m,city,'Bespin');let actual={mode:expected.mode};
 const darkAt=at=>{state.moveCard(m,f.scout,'table');m.cards[f.scout].location=at;state.moveCard(m,f.pilot,'table');m.cards[f.pilot].location=at;m.cards[f.pilot].attachedTo=f.scout;m.cards[f.pilot].aboardRole='pilot';};
 if(expected.mode.startsWith('bespin-')){
  if(['bespin-light','bespin-contested'].includes(expected.mode)){state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=planet;}
  if(['bespin-dark','bespin-contested'].includes(expected.mode))darkAt(planet);
  actual.cost=board.deploymentPayment(m,f.passenger,site).dark;
 }else if(expected.mode.startsWith('big-')&&!expected.mode.endsWith('conversion')){
  const fields=[pull(m,'light','4_81','hand'),pull(m,'light','4_81','hand')],big=pull(m,'light','4_82','hand');for(const id of [...fields,big])m=deploySector(m,id,'Bespin');
  const own=expected.mode==='big-owner';if(own){state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=big;}else darkAt(big);
  actual.drain=board.drainAmount(m,own?'light':'dark',big);
 }else if(expected.mode==='city-stats'){
  m=deploy(m,f.ywing,city);actual.power=occupancy.vesselPower(m,f.ywing);actual.maneuver=piloting.vesselManeuver(m,f.ywing);
 }else if(expected.mode==='city-battle'){
  m=deploy(m,f.ywing,city);state.moveCard(m,f.lightPilot,'table');m.cards[f.lightPilot].location=site;state.moveCard(m,f.passenger,'table');m.cards[f.passenger].location=site;
  m=priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1),'dark');m=step(m,'battle:'+site);m=seek(m,x=>x.data.battle?.stage==='weapons');actual.power=board.totalPower(m,'light',site,true);
 }else{
  const kind=expected.mode.split('-')[0],light=kind==='cave'?'4_83':kind==='big'?'4_82':'4_81',dark=kind==='cave'?'4_157':kind==='big'?'4_156':'4_155';
  const big=pull(m,'light','4_82','hand');m=deploySector(m,big,'Bespin');const old=kind==='big'?big:pull(m,'light',light,'hand');if(kind==='cave')m=place(m,old,board.sitePlacements(m,old)[0]);else if(kind==='field')m=deploySector(m,old,'Bespin');
  const convert=pull(m,'dark',dark,'hand');m=place(m,convert,board.sitePlacements(m,convert).find(p=>p.replace===old));actual.converted=m.cards[old].coveredBy===convert;
 }
 rules.validate(clone(m));assert.deepEqual(actual,expected);
});

test('Bespin deployment modifier is actually paid by the shared ground action',()=>{
 const f=fixture();let m=f.m;const planet=location(m,'light','5_76'),site=location(m,'light','5_79');m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');m=deploy(m,f.ywing,planet);
 m=priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='deploy'&&x.stack.length===1),'dark');const before=m.players.dark.force.length;m=settle(step(m,'deploy:'+f.passenger+':'+site));assert.equal(m.players.dark.force.length,before-2);assert.equal(m.cards[f.passenger].location,site);rules.validate(m);
});

test('Cloud City completes real starting setup without requiring Bespin on table',()=>{
 const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
 const r={...rules,starting:{...setup.premiereSetup,ordinarySetup:()=>true},setupComplete:m=>m.setup?.stage==='complete'};
 let m=runtime.createMatch('city-start',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['5_77']:[]),...d.main].slice(0,60)})),r);
 const command=(choice,side=runtime.prompt(m,r,'dark').side)=>{m=runtime.applyCommand(m,r,side,{revision:m.revision,choice},()=>0);state.assertState(m);m=clone(m);};
 const city=Object.values(m.cards).find(c=>c.blueprint==='5_77').id,dark=Object.values(m.cards).find(c=>c.owner==='dark'&&c.blueprint==='1_284').id;
 command('select:'+city,'light');command('select:'+dark,'dark');
 for(let n=0;n<50&&m.status==='setup';n++){const p=runtime.prompt(m,r,'dark');command(runtime.prompt(m,r,p.side).choices[0].id,p.side);}
 assert.equal(m.status,'playing');assert.ok(m.locations.includes(city));assert.equal(sectors.landingEndpoint(m,'Bespin'),city);assert.equal(board.system(m,city),'Bespin');rules.validate(m);
});
