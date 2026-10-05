// Alternatives releases trapped characters and their personal attachments;
// the emptied captured hull then follows the ordinary saved theft choice.
import assert from 'node:assert/strict';
import {fixture,releaseReady,releaseId,mod} from './alternatives-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('alternatives');
try{for(const [width,height]of widths('ALTERNATIVES_WIDTHS')){
 const f=fixture(),t=await h.seed(releaseReady(f),width,height),initial=t.read();
 try{
  await t.refresh();
  for(const side of ['light','dark'])assert.equal(await t.clients[side].page.getByRole('region',{name:'Captured ship Corellian Corvette',exact:true}).count(),1);
  if(width===390){const page=await t.screenshot('release-choices-phone.png','light',true);await page.locator('.native-choices').screenshot({path:h.output+'/release-controls-phone.png'});}
  await t.choose(releaseId(f));await t.refresh();
  await t.advance(m=>m.stack.at(-1)?.event?.kind==='relocating');await t.refresh();
  assert.ok(f.characters.every(id=>t.read().cards[id].zone==='inactive'&&t.read().cards[id].attachedTo===f.ship));
  assert.equal(t.read().cards[f.gun].zone,'inactive');
  // Empty-hull theft is mandatory and interrupts the relocated response.
  // Stop at that saved decision before a generic advance can choose it.
  await t.advance(m=>m.stack.at(-1)?.handler==='captured-ship:steal');await t.refresh();
  assert.ok(t.read().stack.some(frame=>frame.event?.kind==='relocated'));
  for(const id of f.characters){assert.equal(t.read().cards[id].zone,'table');assert.equal(t.read().cards[id].location,f.bay);assert.equal(t.read().cards[id].attachedTo,undefined);assert.equal(t.read().cards[id].aboardRole,undefined);}
  assert.equal(t.read().cards[f.gun].zone,'table');assert.equal(t.read().cards[f.gun].attachedTo,f.characters[0]);assert.equal(t.read().cards[f.gun].location,f.bay);
  assert.ok(f.characters.every(id=>!mod('ground').usage(t.read()).moved.includes(id)),'Relocation does not consume a regular move.');
  assert.equal(t.prompt().side,'dark');
  if(width===390){const page=await t.screenshot('saved-theft-phone.png','dark',true);await page.locator('.native-choices').screenshot({path:h.output+'/saved-theft-controls-phone.png'});}
  await t.choose('captured-ship:launch:'+f.site);await t.refresh();
  await t.advance(m=>m.stack.at(-1)?.event?.kind==='relocated');await t.refresh();
  await t.advance(m=>m.cards[f.alt].zone==='lost');await t.refresh();
  assert.equal(t.read().cards[f.ship].owner,'dark');assert.equal(t.read().cards[f.ship].capturedShip,undefined);
  assert.ok(f.characters.every(id=>t.read().cards[id].owner==='light'&&t.read().cards[id].location===f.bay));
  for(const side of ['light','dark'])assert.equal(t.read().players[side].force.length,initial.players[side].force.length,'Release and mandatory theft cost no Force.');
  if(width===390){const page=await t.screenshot('released-crew-phone.png','light',false);await page.locator('.native-site:has(h3:text-is("Tatooine: Docking Bay 94"))').screenshot({path:h.output+'/released-crew-detail-phone.png'});}
  console.log('Passed Alternatives release at '+width+' with response refresh, personal attachments, saved theft and real HTTP/service/SQLite.');
 }finally{await t.close();}
}}finally{await h.close();}
