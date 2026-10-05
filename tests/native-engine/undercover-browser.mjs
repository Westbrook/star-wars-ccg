// Actual Effect deployment, opponent-turn movement and voluntary breaking cover.
import assert from 'node:assert/strict';
import {fixture,pull,mod} from './undercover-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('undercover');
try{for(const [width,height]of widths('UNDERCOVER_WIDTHS')){
 const f=fixture({side:'light'}),gun=pull(f.m,'light','1_152','table',f.site),device=pull(f.m,'light','1_40','table',f.site);
 for(const id of [gun,device])f.m.cards[id].attachedTo=f.spy;
 const t=await h.seed(f.m,width,height),version=mod('identity').cardVersion(f.m,f.spy);
 try{
  await t.refresh();await t.choose('undercover:deploy:'+f.effect+':'+f.spy);await t.refresh();
  await t.advance(m=>mod('undercover-state').activeUndercoverSpy(m,f.spy));await t.refresh();
  assert.equal(t.read().cards[f.spy].zone,'inactive');assert.equal(t.read().cards[f.spy].owner,'light');
  for(const id of [gun,device,f.effect]){assert.equal(t.read().cards[id].zone,'table');assert.equal(mod('game-text').gameTextActive(t.read(),id),true);}
  for(const side of ['light','dark']){
   const page=await t.show(side),spy=page.getByRole('button',{name:'Inspect Leia Organa',exact:true});
   assert.match(await spy.innerText(),/UNDERCOVER/);assert.doesNotMatch(await spy.innerText(),/INACTIVE/);
   for(const name of ['Leia Organa','Undercover','Blaster','Tatooine Utility Belt']){
    await page.getByRole('button',{name:'Inspect '+name,exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name,exact:true}).waitFor();await page.keyboard.press('Escape');
   }
  }
  if(width===390){const page=await t.show('light'),spy=page.getByRole('button',{name:'Inspect Leia Organa',exact:true});await spy.scrollIntoViewIfNeeded();const cardBox=await spy.boundingBox(),badgeBox=await spy.locator('.native-undercover').boundingBox();assert.ok(badgeBox.x>=cardBox.x&&badgeBox.x+badgeBox.width<=cardBox.x+cardBox.width,'Undercover badge fits the phone card.');await spy.locator('..').screenshot({path:h.output+'/undercover-active-attachments-phone.png'});}
  const move='undercover:move:'+f.spy+':'+f.to;
  await t.advance(m=>m.turn.side==='dark'&&m.turn.phase==='move'&&t.ids().includes(move));await t.refresh();
  const force=t.read().players.light.force.length;await t.choose(move);await t.refresh();await t.advance(m=>m.cards[f.spy].location===f.to);await t.refresh();
  assert.equal(t.read().players.light.force.length,force-1);assert.equal(t.read().cards[f.spy].zone,'inactive');
  for(const id of [gun,device,f.effect])assert.equal(t.read().cards[id].location,f.to);
  const uncover='undercover:break:'+f.spy;await t.advance(m=>m.turn.side==='light'&&m.turn.phase==='deploy'&&t.ids().includes(uncover));await t.refresh();
  await t.choose(uncover);await t.refresh();await t.advance(m=>!mod('undercover-state').activeUndercoverSpy(m,f.spy));await t.refresh();
  assert.equal(t.read().cards[f.spy].zone,'table');assert.equal(t.read().cards[f.effect].zone,'lost');assert.equal(mod('identity').cardVersion(t.read(),f.spy),version);
  for(const id of [gun,device])assert.equal(t.read().cards[id].zone,'table');
  for(const side of ['light','dark'])assert.doesNotMatch(await (await t.show(side)).getByRole('button',{name:'Inspect Leia Organa',exact:true}).innerText(),/UNDERCOVER|INACTIVE/);
  console.log('Passed Undercover deployment, active attachment inspection, opponent-turn movement and break cover at '+width+' with both-seat refresh.');
 }finally{await t.close();}
}}finally{await h.close();}
