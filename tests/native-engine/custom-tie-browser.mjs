// Pair deployment exposes matching-pilot values, then actual landing and
// disembarkation remove the pilot's in-flight functions through real service commands.
import assert from 'node:assert/strict';
import {fixture,pairId,values} from './custom-tie-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('custom-tie');
try{for(const [width,height]of widths('CUSTOM_TIE_WIDTHS').filter(([width])=>process.env.CUSTOM_TIE_WIDTHS||width!==834)){
 const f=fixture();f.target=f.m.locations.find(id=>f.m.cards[id].blueprint==='1_127');assert.ok(f.target);
 const t=await h.seed(f.m,width,height),initial=f.m.players.dark.force.length;
 const region=side=>t.clients[side].page.getByRole('region',{name:"Vader's Custom TIE crew",exact:true});
 try{
  await t.refresh();await t.choose(pairId(f));await t.refresh();
  assert.ok(t.read().stack.some(frame=>frame.kind==='resolution'&&frame.action.id===pairId(f)));
  await t.advance(m=>m.cards[f.ship].zone==='table'&&m.cards[f.pilot].attachedTo===f.ship);await t.refresh();
  assert.equal(t.read().players.dark.force.length,initial-8);
  assert.deepEqual(values(f,t.read()),{power:6,maneuver:6,hyperspeed:2,immunity:4,operational:true,navigation:true});
  for(const side of ['dark','light']){
   assert.match(await region(side).getByLabel('Current vessel values').innerText(),/Power 6 · Maneuver 6 · Hyperspeed 2 · Navigation available/);
   assert.equal(await region(side).getByRole('button',{name:'Inspect Darth Vader',exact:true}).count(),1);
  }
  if(width===390){await t.show('dark');await region('dark').screenshot({path:h.output+'/matching-pilot-phone.png'});}
  await t.advance(m=>m.turn.side==='dark'&&m.turn.phase==='move'&&m.stack.length===1&&t.prompt().side==='dark');
  const before=t.read().players.dark.force.length;
  await t.choose('voyage:land:'+f.ship+':'+f.site);await t.refresh();
  await t.advance(m=>m.cards[f.ship].location===f.site);await t.refresh();
  assert.equal(t.read().players.dark.force.length,before,'Landing at the docking bay is free.');
  assert.equal(t.read().cards[f.pilot].location,f.site);assert.equal(t.read().cards[f.pilot].attachedTo,f.ship);
  assert.deepEqual(values(f,t.read()),{power:0,maneuver:0,hyperspeed:0,immunity:0,operational:false,navigation:true});
  await t.advance(()=>t.ids().includes('vessel:exit:'+f.pilot+':'+f.ship));
  await t.choose('vessel:exit:'+f.pilot+':'+f.ship);await t.refresh();
  await t.advance(m=>!m.cards[f.pilot].attachedTo);await t.refresh();
  assert.equal(t.read().cards[f.pilot].aboardRole,undefined);
  assert.equal(t.read().cards[f.pilot].location,f.site);
  for(const side of ['dark','light']){
   assert.match(await region(side).getByLabel('Current vessel values').innerText(),/Power 0 · Maneuver 0 · Hyperspeed 0/);
   assert.equal(await region(side).getByRole('button',{name:'Inspect Darth Vader',exact:true}).count(),0);
  }
  await t.advance(m=>m.stack.length===1&&t.prompt().side==='dark');
  assert.ok(!t.ids().some(id=>id.startsWith('voyage:takeoff:'+f.ship+':')));
  if(width===390){const page=await t.screenshot('pilot-disembarked-phone.png','dark',false);await page.locator('.native-site:has(h3:text-is("Tatooine: Docking Bay 94"))').screenshot({path:h.output+'/pilot-disembarked-detail-phone.png'});}
  console.log('Passed Custom TIE at '+width+' with pair payment, matching stats, landing/disembarkation and both-seat HTTP/service/SQLite refresh.');
 }finally{await t.close();}
}}finally{await h.close();}
