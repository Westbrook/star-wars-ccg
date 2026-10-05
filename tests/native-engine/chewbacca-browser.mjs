// Controlled full-deck board; every deployment resolves through the real UI/API.
import assert from 'node:assert/strict';
import {fixture,shotFixture,mod} from './chewbacca-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('chewbacca');
try{for(const [width,height]of widths('CHEWBACCA_WIDTHS')){
 if(!process.env.CHEWBACCA_REPAIR_ONLY){
 const f=fixture(),t=await h.seed(f.m,width,height),before=f.m.players.light.force.length;
 try{
  await t.refresh();await t.choose('vessel:aboard:'+f.chewie+':'+f.ship+':pilot');await t.refresh();
  await t.advance(m=>m.cards[f.chewie].zone==='table');await t.refresh();
  const m=t.read();assert.equal(m.players.light.force.length,before-4);assert.equal(m.cards[f.chewie].attachedTo,f.ship);assert.equal(m.cards[f.chewie].aboardRole,'pilot');
  assert.equal(mod('board').power(m,f.ship),5);assert.equal(mod('piloting').vesselManeuver(m,f.ship),5);assert.equal(mod('combat-modifiers').attritionImmunity(m,f.ship),5);
  for(const side of ['light','dark']){
   const page=await t.show(side),ship=page.getByRole('region',{name:'Millennium Falcon crew',exact:true});
   assert.match(await ship.getByLabel('Current vessel values').innerText(),/Power 5 · Maneuver 5/);
   const inspect=ship.getByRole('button',{name:'Inspect Chewbacca',exact:true});await inspect.click();
   await page.getByRole('dialog').getByRole('heading',{name:'Chewbacca',exact:true}).waitFor();
   assert.match(await page.getByRole('dialog').innerText(),/power/i);
  }
  if(width===390){const page=await t.show('light');await page.getByRole('region',{name:'Millennium Falcon crew',exact:true}).screenshot({path:h.output+'/chewbacca-falcon-phone.png'});}
  console.log('Passed Chewbacca pilot deployment at '+width+' with current Falcon values, inspection and both-seat refresh.');
 }finally{await t.close();}
 }
 if(width===390){
  const f=shotFixture(),t=await h.seed(f.m,width,height);
  try{
   await t.refresh();await t.choose('fire:'+f.gun+':'+f.target);await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='weapon-fired');await t.refresh();assert.ok(mod('battle').battle(t.read()).hits.includes(f.target));
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='battle-damage'&&t.ids().includes('forfeit:'+f.target));
   await t.choose('forfeit:'+f.target);await t.refresh();
   await t.advance(()=>t.ids().some(id=>id.startsWith('chewbacca:repair:')));await t.refresh();
   assert.equal(t.prompt().mandatory,true);assert.ok(!t.ids().includes('pass'));
   const page=await t.show(t.prompt().side,true);await page.locator('.native-choices').screenshot({path:h.output+'/chewbacca-repair-controls-phone.png'});
   await t.choose(t.ids().find(id=>id.startsWith('chewbacca:repair:')));await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='forfeited-to-used');await t.refresh();
   assert.equal(t.read().cards[f.target].zone,'used');assert.ok(!t.read().players.light.lost.includes(f.target));
   console.log('Passed Chewbacca real shot→hit forfeiture→mandatory Used replacement at390 with saved choice refresh.');
  }finally{await t.close();}
 }
}}finally{await h.close();}
