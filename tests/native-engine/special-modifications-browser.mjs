// Effect deployment follows current "your starship" errata. The theft branch
// starts at controlled capture after genuine deployment, then uses the real saved theft choice.
import assert from 'node:assert/strict';
import {fixture,theftFixture,action,values,pull,mod} from './starship-effects-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('special-modifications');
try{for(const mode of (process.env.MODIFICATIONS_MODES?.split(',')??['deploy','theft']))for(const [width,height]of widths('MODIFICATIONS_WIDTHS')){
 assert.ok(['deploy','theft'].includes(mode));
 const f=mode==='deploy'?fixture('han'):await theftFixture();
 const opponent=mode==='deploy'?pull(f.m,'dark','1_302','table',f.planet):null,t=await h.seed(f.m,width,height);
 try{
  await t.refresh();
  if(mode==='deploy'){
   const before=t.read().players.light.force.length;
   assert.ok(!t.ids().includes('starship-effect:deploy:'+f.effect+':'+opponent),'Current errata excludes an opponent-owned initial target.');
   const page=await t.show('light',true);assert.equal(await page.getByRole('button',{name:/Deploy Special Modifications on Imperial-Class Star Destroyer/}).count(),0);
   await t.choose(action(f));await t.refresh();
   assert.equal(t.read().cards[f.effect].zone,'playing');
   await t.advance(m=>m.cards[f.effect].zone==='table');await t.refresh();
   assert.equal(t.read().players.light.force.length,before-1);assert.equal(t.read().cards[f.effect].attachedTo,f.ship);
   assert.deepEqual(values(f,t.read()),{power:7,maneuver:8,armor:null,forfeit:9,immunity:5,effectOwner:'light'});
   for(const side of ['dark','light']){
    const ship=t.clients[side].page.getByRole('region',{name:'Millennium Falcon crew',exact:true});
    assert.match(await ship.getByLabel('Current vessel values').innerText(),/Power 7 · Maneuver 8/);
    assert.equal(await ship.getByRole('button',{name:'Inspect Special Modifications',exact:true}).count(),1);
   }
   if(width===390){await t.show('light');await t.clients.light.page.getByRole('region',{name:'Millennium Falcon crew',exact:true}).screenshot({path:h.output+'/modified-falcon-phone.png'});}
  }else{
   await t.advance(m=>m.stack.at(-1)?.handler==='captured-ship:steal');await t.refresh();
   assert.equal(t.read().cards[f.ship].owner,'light');assert.equal(t.read().cards[f.effect].owner,'light');
   if(width===390){const page=await t.screenshot('saved-theft-phone.png','dark',true);await page.locator('.native-choices').screenshot({path:h.output+'/saved-theft-controls-phone.png'});}
   await t.choose('captured-ship:launch:'+f.site);await t.refresh();
   await t.advance(m=>m.cards[f.ship].zone==='table'&&m.cards[f.ship].owner==='dark');await t.refresh();
   assert.equal(t.read().cards[f.ship].originalOwner,'light');assert.equal(t.read().cards[f.effect].owner,'light');assert.equal(t.read().cards[f.effect].zone,'table');assert.equal(t.read().cards[f.effect].attachedTo,f.ship);
   assert.equal(mod('piloting').vesselArmor(t.read(),f.ship),6,'The retained opposing Effect still modifies its host.');
   for(const side of ['dark','light']){
    const ship=t.clients[side].page.getByRole('region',{name:'Corellian Corvette crew',exact:true});
    assert.match(await ship.getByLabel('Current vessel values').innerText(),/Armor 6/);
    assert.equal(await ship.getByRole('button',{name:'Inspect Special Modifications',exact:true}).count(),1);
   }
   if(width===390){await t.show('dark');await t.clients.dark.page.getByRole('region',{name:'Corellian Corvette crew',exact:true}).screenshot({path:h.output+'/stolen-ship-light-effect-phone.png'});}
  }
  console.log('Passed Special Modifications '+mode+' at '+width+' with actual HTTP/service/SQLite and both-seat refresh.');
 }finally{await t.close();}
}}finally{await h.close();}
