// Two bounded hit-loss flows: actual shot → release, and a labeled capture foundation.
import assert from 'node:assert/strict';
import {releaseFixture,capturedFixture} from './hit-departure-browser-fixture.mjs';
import {releaseId,mod} from './alternatives-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('hit-departure');
try{for(const mode of (process.env.HIT_DEPARTURE_MODES?.split(',')??['release','capture-foundation']))for(const [width,height]of widths('HIT_DEPARTURE_WIDTHS').filter(([width])=>process.env.HIT_DEPARTURE_WIDTHS||width===(mode==='release'?1440:390))){
 assert.ok(['release','capture-foundation'].includes(mode));const f=mode==='release'?releaseFixture():capturedFixture(),t=await h.seed(f.m,width,height);
 try{
  await t.refresh();
  if(mode==='release'){
   await t.choose('fire:'+f.blaster+':'+f.target);await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='battle-weapons'&&mod('battle').battle(m).hits.includes(f.target));
   await t.advance(()=>t.ids().includes(releaseId(f)));await t.choose(releaseId(f));await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.event?.cause==='hit-outside-battle');await t.refresh();
   assert.equal(t.read().cards[f.target].zone,'table');assert.equal(t.read().cards[f.target].location,f.bay);
   assert.equal(t.read().cards[f.ship].owner,'light');assert.ok(!t.read().stack.some(frame=>frame.handler==='captured-ship:steal'||frame.action?.handler==='captured-ship:steal'));
  }else{
   assert.equal(t.read().cards[f.target].zone,'captive');assert.equal(t.read().cards[f.gun].zone,'inactive');
  }
  assert.equal(t.read().stack.at(-1).event.kind,'about-to-lose');assert.equal(t.read().stack.at(-1).event.cause,'hit-outside-battle');
  assert.ok(mod('battle').battle(t.read()).hits.includes(f.target));
  if(width===390)await t.screenshot(mode+'-saved-hit-loss-phone.png',t.prompt().side,false);
  await t.advance(m=>m.stack.at(-1)?.handler==='table:lost-order');await t.refresh();
  assert.ok(t.ids().includes('place-lost:'+f.gun));
  if(width===390){const page=await t.screenshot(mode+'-saved-order-phone.png','light',true);await page.locator('.native-choices').screenshot({path:h.output+'/'+mode+'-saved-order-controls-phone.png'});}
  await t.choose('place-lost:'+f.gun);await t.refresh();
  if(mode==='capture-foundation'){assert.equal(t.read().stack.at(-1)?.handler,'table:lost-order');await t.choose('place-lost:'+f.device);await t.refresh();}
  if(mode==='release'){
   // Mandatory theft follows completed loss, before its optional after-response.
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='about-to-steal');await t.refresh();
   assert.ok(f.losses.every(id=>t.read().cards[id].zone==='lost'));assert.equal(t.read().cards[f.ship].owner,'light');
   await t.advance(m=>m.stack.at(-1)?.handler==='captured-ship:steal');await t.refresh();
   await t.choose('captured-ship:launch:'+f.site);await t.refresh();
  }
  await t.advance(m=>m.stack.at(-1)?.event?.kind==='cards-lost'&&m.stack.at(-1).event.cause==='hit-outside-battle');await t.refresh();
  assert.ok(f.losses.every(id=>t.read().cards[id].zone==='lost'&&t.read().players.light.lost.includes(id)));
  assert.equal(t.read().cards[f.escort].zone,'table');assert.ok(!mod('battle').battle(t.read()).hits.includes(f.target));
  if(mode==='release'){
   assert.equal(t.read().cards[f.characters[1]].zone,'table');assert.equal(t.read().cards[f.characters[1]].location,f.bay);
   await t.advance(m=>m.cards[f.alt].zone==='lost');await t.refresh();
   assert.equal(t.read().cards[f.ship].owner,'dark');assert.equal(t.read().cards[f.characters[1]].owner,'light');
  }else{
   assert.equal(t.read().cards[f.target].captivity,undefined);assert.equal(mod('captives').escorted(t.read(),f.escort).length,0);
  }
  if(width===390){const page=await t.show('light');await page.getByText('Public Lost Piles, destiny & out of play',{exact:true}).click();await page.locator('.native-public-piles').screenshot({path:h.output+'/'+mode+'-completed-loss-phone.png'});}
  console.log('Passed hit departure '+mode+' at '+width+' with saved loss/order refresh and actual UI/HTTP/service/SQLite.');
 }finally{await t.close();}
}}finally{await h.close();}
