import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deploySector,pull,phase,priority,step,seek,ids,load} from './sectors-fixture.mjs';
import {deploy,rules,clone,state,prompt,location} from './vessels-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const sectors=load(new URL('../../lib/native-engine/sectors.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));
const occupancy=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url));
const piloting=load(new URL('../../lib/native-engine/piloting.ts',import.meta.url));
const setup=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const settle=m=>seek(m,x=>x.stack.length===1);
function ready(kind='cloud',n=1){const f=fixture();let m=f.m;const locations=Array.from({length:n},()=>pull(m,'light',kind==='cloud'?'5_85':'4_81','hand'));for(const id of locations)m=deploySector(m,id);return {...f,m,locations};}

test('generic sectors require a planet already on table, cannot start, allow three shared copies per system',()=>{
 const f=fixture();let m=f.m;const clouds=Array.from({length:4},()=>pull(m,'light','5_85','hand')),dark=pull(m,'dark','5_174','hand');
 assert.equal(setup.premiereSetup.location(m,clouds[0]),null);
 const noPlanet=clone(m);noPlanet.locations=noPlanet.locations.filter(id=>id!==f.planet);assert.equal(board.sitePlacements(noPlanet,clouds[0]).length,0);
 for(const id of clouds.slice(0,2))m=deploySector(m,id);m=deploySector(m,dark);
 assert.equal(sectors.sectorsAt(m,'Tatooine','cloud').length,3);assert.equal(board.sitePlacements(m,clouds[2]).filter(p=>!p.replace).length,0);
 assert.ok(m.locations.includes(clouds[0])&&m.locations.includes(dark));assert.equal(m.cards[clouds[0]].coveredBy,undefined);
 const yavin=location(m,'light','1_135');assert.ok(board.sitePlacements(m,clouds[2]).filter(p=>!p.replace).every(p=>p.sector==='Yavin 4'));
 m=deploySector(m,clouds[2],'Yavin 4');assert.equal(board.system(m,clouds[2]),'Yavin 4');rules.validate(m);assert.ok(m.locations.includes(yavin));
});

test('cloud and asteroid ordering works in either table orientation and survives system conversion',()=>{
 for(const reverse of [false,true]){const f=fixture();let m=f.m;if(reverse)m.locations=[f.planet,f.site,f.remote];
 const cloud=pull(m,'light','5_85','hand'),asteroid=pull(m,'light','4_81','hand');m=deploySector(m,cloud);m=deploySector(m,asteroid);
 assert.equal(board.system(m,cloud),'Tatooine');assert.equal(board.system(m,asteroid),undefined);assert.equal(sectors.locationGroup(m,asteroid),'Tatooine');
 const group=m.locations.filter(id=>sectors.locationGroup(m,id)==='Tatooine');assert.deepEqual(group,reverse?[asteroid,f.planet,cloud,f.site]:[f.site,cloud,f.planet,asteroid]);
 const convert=pull(m,'dark','1_289','hand');m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'dark');m=settle(step(m,'site:'+convert+':over:'+f.planet));assert.equal(sectors.sectorSystem(m,asteroid),'Tatooine');rules.validate(m);
 }
});

test('fighters move through at most two sectors; system entry only reaches nearest and needs no navigation',()=>{
 let f=ready('asteroid',3),m=deploy(f.m,f.ywing,f.planet);const paths=travel.vesselRoutes(m,f.ywing).filter(r=>r.method==='sector');assert.equal(paths.length,1);assert.equal(paths[0].path.length,2);
 board.moveWithAttachments(m,f.ywing,paths[0].path[1]);const routes=travel.vesselRoutes(m,f.ywing).filter(r=>r.method==='sector');assert.ok(routes.some(r=>r.path.length===3));assert.equal(routes.filter(r=>r.path.at(-1)===f.planet).length,1);
 m=priority(phase(m,'move'),'light');const two=routes.find(r=>r.path.length===3),used=m.players.light.force.length;
 m=step(m,'voyage:sector:'+f.ywing+':'+two.path.at(-1));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved'&&x.stack.at(-1).event.complete===false);assert.equal(m.cards[f.ywing].location,two.path[1]);m=settle(clone(m));assert.equal(m.cards[f.ywing].location,two.path[2]);assert.equal(m.players.light.force.length,used-1);rules.validate(m);
});

test('clouds redirect landing and takeoff to lowest cloud and apply each starship penalty once',()=>{
 const f=ready('cloud',2);let m=deploy(f.m,f.ywing,f.planet);assert.ok(!travel.vesselRoutes(m,f.ywing).some(r=>r.method==='land'));
 const low=sectors.landingEndpoint(m,'Tatooine'),before=occupancy.vesselPower(m,f.ywing),maneuver=piloting.vesselManeuver(m,f.ywing);board.moveWithAttachments(m,f.ywing,low);
 assert.equal(occupancy.vesselPower(m,f.ywing),Math.max(0,before-2));assert.equal(piloting.vesselManeuver(m,f.ywing),Math.max(0,maneuver-2));assert.ok(travel.vesselRoutes(m,f.ywing).some(r=>r.method==='land'&&r.path.at(-1)===f.site));
 board.moveWithAttachments(m,f.ywing,f.site);assert.deepEqual(travel.vesselRoutes(m,f.ywing).filter(r=>r.method==='takeoff').map(r=>r.path[1]),[low]);rules.validate(m);
});

test('capital ships deploy at asteroid sectors but not clouds; characters require a vessel',()=>{
 const f=ready('cloud'),asteroid=pull(f.m,'light','4_81','hand');let m=deploySector(f.m,asteroid),capital=pull(m,'light','1_140','hand');
 const {vesselDeploysAt}=load(new URL('../../lib/native-engine/vessels.ts',import.meta.url));assert.equal(vesselDeploysAt(m,capital,f.locations[0]),false);assert.equal(vesselDeploysAt(m,capital,asteroid),true);assert.equal(board.deploymentPayment(m,f.lightPilot,asteroid),null);
 m=deploy(m,capital,asteroid);m=deploy(m,f.lightPilot,capital,'pilot');rules.validate(m);assert.equal(board.presence(m,'light',asteroid),true);
});

for(const mode of ['low','high','asteroid','empty'])test('mandatory asteroid destiny '+mode+' settles through shared timing and refresh',()=>{
 const f=ready('asteroid',2);let m=deploy(f.m,f.ywing,f.locations[0]);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);
 if(mode==='empty')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else {const bp=mode==='asteroid'?'4_155':mode==='high'?'1_262':'1_284',id=Object.values(m.cards).find(c=>c.owner==='dark'&&c.blueprint===bp&&c.zone==='reserve')?.id;assert.ok(id,'destiny fixture '+bp);state.moveCard(m,id,'hand');state.moveCard(m,id,'reserve');}
 // Pass the ordinary opportunities: the mandatory end-of-control choice remains.
 m=seek(m,x=>x.stack.at(-1)?.kind==='window'&&x.stack.at(-1).event?.kind==='phase-end'&&prompt(x).choices.some(c=>c.id.startsWith('asteroid:')));
 const choice=ids(m).find(id=>id.startsWith('asteroid:'));m=step(m,choice);m=seek(m,x=>x.data.asteroidDraws?.at(-1)?.stage==='complete');const d=m.data.asteroidDraws.at(-1);
 assert.equal(d.side,'dark');assert.equal(d.lost===true,mode==='high'||mode==='asteroid');assert.equal(d.immediate===true,mode==='asteroid');if(mode==='empty')assert.equal(d.total,null);if(mode==='low')assert.equal(d.total,1);rules.validate(clone(m));
});

test('cloud cover adds one to a related-site drain, consumes its turn use, and honors ownership',()=>{
 const f=ready('cloud');let m=deploy(f.m,f.ywing,f.locations[0]);state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'light');m=step(m,'drain:'+f.site);m=seek(m,x=>ids(x).some(id=>id.startsWith('sector:boost:')));
 const before=m.players.dark.lost.length;m=step(m,ids(m).find(id=>id.startsWith('sector:boost:')));assert.ok(m.data.cloudDrainUses?.length);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(m.stack.at(-1).payload.remaining,2);m=settle(m);assert.equal(m.players.dark.lost.length-before,2);
 assert.equal(board.drainAmount(m,'dark',f.locations[0]),1);board.moveWithAttachments(m,f.ywing,f.planet);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.locations[0];assert.equal(board.drainAmount(m,'dark',f.locations[0]),2);rules.validate(m);
});

test('controlling an asteroid field cancels a related system drain without losing Force',()=>{
 const f=ready('asteroid');let m=deploy(f.m,f.ywing,f.locations[0]);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');const lost=m.players.light.lost.length;m=step(m,'drain:'+f.planet);m=seek(m,x=>ids(x).some(id=>id.startsWith('sector:cancel:')));m=step(m,ids(m).find(id=>id.startsWith('sector:cancel:')));m=settle(m);assert.equal(m.players.light.lost.length,lost);assert.ok(!ids(priority(m,'dark')).includes('drain:'+f.planet));rules.validate(m);
});

test('shuttling adds every cloud, while asteroid carriers cannot shuttle to sites',()=>{
 const f=ready('cloud',2);let m=f.m;const cap=pull(m,'light','1_140','hand');m=deploy(m,cap,f.planet);state.moveCard(m,f.lightPilot,'table');m.cards[f.lightPilot].location=f.site;m=priority(phase(m,'move'),'light');
 const {transportActions}=load(new URL('../../lib/native-engine/transport.ts',import.meta.url));let options=transportActions(m,m.stack[0],'light').filter(a=>a.source===f.lightPilot&&a.handler==='transport:begin');assert.ok(options.length);assert.ok(options.every(a=>a.payment.light===3));
 const a=options[0];m=settle(step(m,a.id));assert.equal(m.cards[f.lightPilot].attachedTo,cap);
 const asteroid=pull(m,'light','4_81','hand');m=deploySector(m,asteroid);board.moveWithAttachments(m,cap,asteroid);m=priority(phase(m,'move'),'light');assert.ok(!transportActions(m,m.stack[0],'light').some(a=>a.payload.mode==='shuttle'&&a.source===f.lightPilot));rules.validate(m);
});

test('sector records reject missing group, excess shared copies, and changed pending destiny targets',()=>{
 const f=ready('asteroid',2);let m=deploy(f.m,f.ywing,f.locations[0]);const bad=clone(m);bad.data.sectors[0].system='Death Star';assert.throws(()=>rules.validate(bad));delete bad.data.sectors;assert.throws(()=>rules.validate(bad));
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');m=step(m,ids(m).find(id=>id.startsWith('asteroid:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');
 for(const edit of [p=>p.next.payload.target.version++,p=>p.source=f.planet,p=>p.next.payload.window++,p=>p.next.payload.serial++]){const b=clone(m);edit(b.stack.find(r=>r.action?.handler==='destiny:finish').action.payload);assert.throws(()=>rules.validate(b));}
});

test('multiple Clouds cannot stack the same drain bonus',()=>{
 const f=ready('cloud',2);let m=deploy(f.m,f.ywing,f.locations[0]);const ship=pull(m,'light','1_140','table',f.planet);m.cards[ship].blueprint='1_147';board.moveWithAttachments(m,ship,f.locations[1]);state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'light');m=step(m,'drain:'+f.site);
 for(let n=0;n<2;n++){m=seek(m,x=>ids(x).some(id=>id.startsWith('sector:boost:')));m=step(m,ids(m).find(id=>id.startsWith('sector:boost:')));}
 m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(m.stack.at(-1).payload.remaining,2);assert.equal(m.data.cloudDrainUses.length,2);rules.validate(m);
});

test('a maneuver response can save the original ship from numeric asteroid destiny',()=>{
 const f=ready('asteroid');let m=deploy(f.m,f.ywing,f.locations[0]),maneuver=pull(m,'light','1_70','hand');m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);const die=pull(m,'dark','1_262','hand');state.moveCard(m,die,'reserve');m=priority(m,'dark');m=step(m,ids(m).find(id=>id.startsWith('asteroid:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');assert.ok(ids(m).includes('maneuver:'+maneuver+':'+f.ywing));m=step(m,'maneuver:'+maneuver+':'+f.ywing);m=seek(m,x=>x.data.asteroidDraws.at(-1).stage==='complete');assert.equal(m.cards[f.ywing].zone,'table');assert.equal(m.data.asteroidDraws.at(-1).total,5);assert.equal(m.data.asteroidDraws.at(-1).defense,5);
});

test('drawing an asteroid is required before optional maneuver and loses attachments in selected order',()=>{
 const f=ready('asteroid');let m=deploy(f.m,f.ywing,f.locations[0]);m=deploy(m,f.lightPilot,f.ywing,'pilot');const maneuver=pull(m,'light','1_70','hand');m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);const die=pull(m,'dark','4_155','hand');state.moveCard(m,die,'reserve');m=priority(m,'dark');m=step(m,ids(m).find(id=>id.startsWith('asteroid:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');assert.ok(ids(m).every(id=>id.startsWith('asteroid:immediate:')));m=step(m,ids(m)[0]);m=seek(m,x=>x.data.asteroidDraws.at(-1).stage==='complete');assert.equal(m.cards[f.ywing].zone,'lost');assert.equal(m.cards[f.lightPilot].zone,'lost');assert.equal(m.cards[maneuver].zone,'hand');assert.equal(m.cards[die].zone,'used');
});

test('canceled asteroid draws fail without treating a nonexistent destiny as zero',()=>{
 const f=ready('asteroid',2);let m=deploy(f.m,f.ywing,f.locations[0]);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');m=step(m,ids(m).find(id=>id.startsWith('asteroid:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');const r=m.stack.find(r=>r.action?.handler==='destiny:finish');load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url)).cancelPendingDestiny(m,r);m=seek(m,x=>x.data.asteroidDraws.at(-1).stage==='complete');assert.equal(m.data.asteroidDraws.at(-1).total,null);assert.equal(m.cards[f.ywing].zone,'table');
});

test('a battle at Clouds uses reduced power and Hyper Escape can move through the adjacent sector',()=>{
 const f=ready('cloud',2);let m=deploy(f.m,f.ywing,f.locations[0]);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.locations[0];const escape=pull(m,'light','1_88','hand');
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'dark');m=step(m,'battle:'+f.locations[0]);m=seek(m,x=>ids(x).includes('hyper-escape:'+escape));m=step(m,'hyper-escape:'+escape);m=seek(m,x=>x.stack.at(-1)?.handler==='hyper-escape:move');const destination=ids(m).find(id=>id.includes(':sector:'));assert.ok(destination);m=step(m,destination);m=settle(m);assert.notEqual(m.cards[f.ywing].location,f.locations[0]);assert.equal(m.data.battle.stage,'complete');rules.validate(m);
});

for(const row of JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/sector-results.json',import.meta.url))))test('executed GEMP sector observation '+row.mode,()=>{
 const f=ready(row.mode==='cloud'?'cloud':'asteroid',2);let m=deploy(f.m,f.ywing,f.locations[0]);const actual={mode:row.mode,power:occupancy.vesselPower(m,f.ywing),maneuver:piloting.vesselManeuver(m,f.ywing)};
 if(row.mode!=='cloud'){
  m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);
  if(row.mode==='asteroid-empty')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else {const die=pull(m,'dark',row.mode==='asteroid-card'?'4_155':row.mode==='asteroid-high'?'1_262':'1_284','hand');state.moveCard(m,die,'reserve');}
  m=priority(m,'dark');m=step(m,ids(m).find(id=>id.startsWith('asteroid:')));m=seek(m,x=>x.data.asteroidDraws.at(-1).stage==='complete');actual.lost=m.cards[f.ywing].zone==='lost';actual.total=m.data.asteroidDraws.at(-1).total;
 }
 assert.deepEqual(actual,row);
});
