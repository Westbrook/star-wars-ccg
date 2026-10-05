// Real legal site placement, followed by a controlled Light permission to move
// the opponent's Executor during Dark's move phase without changing ownership.
import assert from 'node:assert/strict';
import {controlFixture} from './control-station-fixture.mjs';
import {mod,pull,phase,state} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('control-station');
try{for(const [width,height]of widths('CONTROL_STATION_WIDTHS').filter(([width])=>process.env.CONTROL_STATION_WIDTHS||width!==834)){
 {
  const f=controlFixture({controlled:false});f.m.locations=f.m.locations.filter(id=>id!==f.station);state.moveCard(f.m,f.station,'hand');
  f.bay=pull(f.m,'dark','4_165');f.m.locations.push(f.bay);mod('ship-sites').registerShipSite(f.m,f.bay,f.ship);f.m=phase(f.m,'dark','deploy');
  const t=await h.seed(f.m,width,height);
  try{
   await t.refresh();const prefix='ship-site:deploy:'+f.station+':EXECUTOR:',atBay=t.read().locations.indexOf(f.bay),choices=t.ids().filter(id=>id.startsWith(prefix));
   assert.ok(choices.includes(prefix+atBay));assert.ok(!choices.includes(prefix+(atBay+1)),'An interior cannot turn the exterior Launch Bay into a middle site.');
   await t.choose(prefix+atBay);await t.refresh();await t.advance(m=>m.cards[f.station].zone==='table');await t.refresh();
   assert.deepEqual(t.read().locations,[f.from,f.to,f.theatre,f.corridor,f.station,f.bay]);
   if(width===390){const page=await t.screenshot('legal-placement-phone.png','dark',false);await page.locator('.native-site:has(h3:text-is("Executor: Control Station"))').screenshot({path:h.output+'/legal-placement-detail-phone.png'});}
  }finally{await t.close();}
 }
 {
  const f=controlFixture(),t=await h.seed(f.m,width,height),route='voyage:hyperspace:'+f.ship+':'+f.to,force={dark:f.m.players.dark.force.length,light:f.m.players.light.force.length};
  try{
   await t.refresh();assert.equal(t.prompt().side,'dark');assert.ok(!t.ids().includes(route));
   let page=await t.show('dark',true);assert.equal(await page.getByRole('button',{name:/Hyperspace Executor/}).count(),0);
   await t.advance(()=>t.prompt().side==='light');await t.refresh();assert.ok(t.ids().includes(route));
   if(width===390){page=await t.screenshot('light-controls-movement-phone.png','light',true);await page.locator('.native-choices').screenshot({path:h.output+'/light-movement-controls-phone.png'});}
   await t.choose(route);await t.refresh();
   const pending=t.read().stack.find(frame=>frame.kind==='resolution'&&frame.action.handler==='voyage:begin');assert.equal(pending.actor,'light');assert.deepEqual(pending.action.payment,{light:1});
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='vessel-moving');await t.refresh();assert.equal(t.read().cards[f.ship].location,f.from);
   await t.advance(m=>m.cards[f.ship].location===f.to);await t.refresh();
   assert.equal(t.read().cards[f.ship].owner,'dark');assert.equal(t.read().players.dark.force.length,force.dark);assert.equal(t.read().players.light.force.length,force.light-1);
   assert.equal(t.read().cards[f.rebel].location,f.station);assert.ok(mod('ground').usage(t.read()).moved.includes(f.ship));
   assert.equal(mod('vessel-travel').vesselTravelActions(t.read(),{timing:'phase'},'light').some(action=>action.source===f.ship),false);
   if(width===390){page=await t.screenshot('opponent-ship-moved-phone.png','light',false);await page.getByRole('region',{name:'Executor crew',exact:true}).screenshot({path:h.output+'/opponent-ship-moved-detail-phone.png'});}
  }finally{await t.close();}
 }
 console.log('Passed Control Station placement and Light-controlled move at '+width+' with Dark blocked, correct payer and both-seat HTTP/service/SQLite refresh.');
}}finally{await h.close();}
