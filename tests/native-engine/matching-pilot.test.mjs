import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,deployed,battleStart,values,searchFixture,searching,searchDone,runtime,state,rules,clone,pull,ids,step,seek,phase,priority,mod} from './matching-pilot-fixture.mjs';
for(const bp of ['1_3','2_23','1_173'])test('Real deployment and matching battle destiny: '+bp,()=>{
 const f=fixture(bp),before=f.m.players[f.side].force.length;let m=deployed(f);assert.equal(m.players[f.side].force.length,before-2);m=battleStart(f,m);assert.equal(values(f,m).draws,1);assert.equal(values(f,m).maneuver,bp==='2_23'?6:5);m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&x.stack.at(-1).side===f.side);m=step(m,'draw-destiny');m=seek(m,x=>x.data.battle?.stage==='damage');assert.equal(m.data.battle.destinyPlans[f.side].draws.length,1);
});
test('Wedge grants two maneuver on Red 2; its immunity uses Wedge identity even if his text is canceled',()=>{
 for(const mode of ['matched','pilot-canceled','ship-canceled','landed','other-ship']){const f=fixture('2_23',mode),m=mode==='landed'?deployed(f):battleStart(f);assert.equal(values(f,m).immunity,['matched','pilot-canceled'].includes(mode)?3:0);}
});
test('Matching fallback never adds to an ordinary ability destiny',()=>{
 const f=fixture();let m=deployed(f);const y=f.ywing;state.moveCard(m,y,'table');m.cards[y].location=f.planet;state.moveCard(m,f.lightPilot,'table');Object.assign(m.cards[f.lightPilot],{attachedTo:y,aboardRole:'pilot',location:f.planet});m=battleStart(f,m);assert.equal(values(f,m).draws,1);
});
test('Pilot departure immediately removes power, maneuver and immunity',()=>{
 const f=fixture();let m=deployed(f);mod('table').returnToHand(m,[f.pilot]);assert.deepEqual(values(f,m),{power:0,maneuver:0,immunity:0,draws:null});rules.validate(m);
});
test('Black 2 obeys TIE cargo and landing restrictions',()=>{
 const f=fixture('1_173');let m=deployed(f);assert.ok(mod('occupancy').capacityFits(m,f.enemy,[])===true);const sd=pull(m,'dark','1_302','table',f.planet);assert.ok(mod('occupancy').capacityFits(m,sd,[{id:f.ship,role:'starship'}]));const nonBay=pull(m,'light','1_130','table');m.locations.push(nonBay);assert.ok(!mod('vessel-travel').vesselRoutes(m,f.ship).some(r=>r.path.at(-1)===nonBay));assert.ok(mod('vessel-travel').vesselRoutes(m,f.ship).some(r=>r.path.at(-1)===f.site));
});
test('Paid search privately reveals Reserve, publicly reveals selected Slip and reshuffles',()=>{
 const f=searchFixture(),before=f.m.players.light.force.length;let m=searching(f);assert.equal(m.players.light.force.length,before-1);assert.ok(rules.view(m,'light').wedgeSearch.cards.length);assert.equal(rules.view(m,'dark').wedgeSearch,null);assert.deepEqual(rules.view(m,'light').wedgeSearch.cards.map(c=>c.id),[...m.players.light.reserve].sort());m=step(clone(m),'wedge:take:'+f.slips[0]);assert.deepEqual(rules.view(m,'dark').wedgeSearch.cards.map(c=>c.id),[f.slips[0]]);m=searchDone(clone(m));assert.equal(m.cards[f.slips[0]].zone,'hand');assert.equal(rules.view(m,'dark').wedgeSearch,null);assert.ok(ids(priority(m,'light')).includes('wedge:begin:'+f.pilot));
});
test('Successful searches may be repeated with a separate cost',()=>{
 const f=searchFixture();let m=searchDone(step(searching(f),'wedge:take:'+f.slips[0]));m=priority(m,'light');m=searching({...f,m});m=searchDone(step(m,'wedge:take:'+f.slips[1]));assert.ok(f.slips.every(id=>m.cards[id].zone==='hand'));assert.equal(m.players.light.force.length,f.m.players.light.force.length-2);
});
test('Verified failure locks same search this turn even if a Slip later enters Reserve',()=>{
 const f=searchFixture('failure');let m=searching(f);m=step(m,'wedge:not-found');assert.equal(m.stack.at(-1).side,'dark');assert.ok(rules.view(m,'dark').wedgeSearch.cards.length);m=searchDone(step(clone(m),'wedge:verified'));state.moveCard(m,f.slips[0],'reserve');assert.ok(!ids(priority(m,'light')).includes('wedge:begin:'+f.pilot));m.turn.number++;assert.ok(ids(priority(m,'light')).includes('wedge:begin:'+f.pilot));
});
test('Wedge search is unavailable without Force, empty Reserve or active text',()=>{
 for(const mode of ['force','reserve','text']){const f=searchFixture(),m=f.m;if(mode==='text')mod('game-text').suppressGameText(m,f.planet,f.pilot);else while(m.players.light[mode].length)state.moveCard(m,m.players.light[mode][0],'hand');assert.ok(!ids(m).includes('wedge:begin:'+f.pilot));}
});
test('Search source departure after costs does not undo the initiated search',()=>{
 const f=searchFixture();let m=step(f.m,'wedge:begin:'+f.pilot);mod('table').returnToHand(m,[f.pilot]);m=seek(m,x=>x.stack.at(-1)?.handler==='wedge:choose');m=searchDone(step(m,'wedge:take:'+f.slips[0]));assert.equal(m.cards[f.slips[0]].zone,'hand');
});
test('Canceling the search keeps paid Force but reveals no Reserve',()=>{
 const f=searchFixture();let m=step(f.m,'wedge:begin:'+f.pilot);m.stack.find(x=>x.action?.handler==='wedge:begin').cancelled=true;m=searchDone(m);assert.equal(m.players.light.force.length,f.m.players.light.force.length-1);assert.ok(f.slips.every(id=>m.cards[id].zone==='reserve'));assert.equal(rules.view(m,'dark').wedgeSearch,null);
});
test('Stale revealed card cannot be taken again and saved bindings reject corruption',()=>{
 const f=searchFixture();let m=step(searching(f),'wedge:take:'+f.slips[0]);const bad=clone(m);bad.stack.find(x=>x.action?.handler==='wedge:take').action.payload.target.version=999;assert.throws(()=>rules.validate(bad));state.moveCard(m,f.slips[0],'hand');state.moveCard(m,f.slips[0],'reserve');m=searchDone(m);assert.equal(m.cards[f.slips[0]].zone,'reserve');
});
for(const row of JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/matching-pilot-results.json',import.meta.url))))test('Executed GEMP matching pilot comparison '+(row.pilot||'Wedge search')+' '+row.mode,()=>{
 if(row.kind==='pilot'){
  const f=fixture(row.pilot,row.mode),before=f.m.players[f.side].force.length;let m=deployed(f);const deploymentCost=before-m.players[f.side].force.length;if(row.mode!=='landed')m=battleStart(f,m);
  assert.deepEqual({kind:'pilot',pilot:row.pilot,mode:row.mode,deploymentCost,...values(f,m)},row);
 }else{
  const f=searchFixture(row.mode);let m=step(f.m,'wedge:begin:'+f.pilot);if(row.mode==='source-leaves')mod('table').returnToHand(m,[f.pilot]);m=seek(m,x=>x.stack.at(-1)?.handler==='wedge:choose');m=step(m,row.mode==='failure'?'wedge:not-found':'wedge:take:'+f.slips[0]);m=searchDone(m);
  if(row.mode==='repeat'){m=searching({...f,m:priority(m,'light')});m=searchDone(step(m,'wedge:take:'+f.slips[1]));}
  assert.deepEqual({kind:'search',mode:row.mode,cost:f.m.players.light.force.length-m.players.light.force.length,slipsInHand:f.slips.filter(id=>m.cards[id].zone==='hand').length,again:ids(priority(m,'light')).includes('wedge:begin:'+f.pilot)},row);
 }
});
test('Wedge can search aboard during a battle, but not from an unrelated site',()=>{
 const f=fixture();let m=battleStart(f);assert.ok(ids(priority(m,'light')).includes('wedge:begin:'+f.pilot));mod('table').returnToHand(m,[f.pilot]);state.moveCard(m,f.pilot,'table');m.cards[f.pilot].location=f.site;assert.ok(!ids(priority(m,'light')).includes('wedge:begin:'+f.pilot));
});
test('Wedge can search during the opponent turn when given normal priority',()=>{
 const f=searchFixture();f.m.turn.side='dark';f.m.stack[0].priority='light';let m=searchDone(step(searching(f),'wedge:take:'+f.slips[0]));assert.equal(m.cards[f.slips[0]].zone,'hand');assert.equal(m.turn.side,'dark');
});
