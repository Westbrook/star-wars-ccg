// Scenario coverage for legal gap deployment, saved Retract choices and real movement.
// Initial controlled fixture only; all later state transitions use UI or match service.
import assert from 'node:assert/strict';
import {fixture} from './laser-gate-fixture.mjs';
import {mod} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';

const board=mod('board'),h=await browserHarness('laser-gate');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
try{
 for(const mode of (process.env.LASER_GATE_MODES?.split(',')??['keep','relocate']))for(const [width,height]of widths('LASER_GATE_WIDTHS')){
  assert.ok(['keep','relocate'].includes(mode));
  const f=fixture(),t=await h.seed(f.m,width,height),force=f.m.players.dark.force.length;
  try{
   await t.refresh();
   await t.choose('laser-gate:deploy:'+f.card+':'+f.core+':'+f.corridor);await t.refresh();
   assert.equal(t.read().cards[f.card].zone,'playing');
   await t.advance(m=>m.cards[f.card].zone==='table');await t.refresh();
   assert.equal(t.read().players.dark.force.length,force,'Laser Gate deploys without a Force payment.');
   assert.deepEqual(t.read().data.laserGates[f.card].sites.map(ref=>ref.id),[f.core,f.corridor]);
   for(const side of ['dark','light'])assert.equal(await t.clients[side].page.getByRole('region',{name:'Laser Gate passage',exact:true}).count(),1);
   await t.advance(()=>t.ids().includes('retract:play:'+f.retract+':rearrange'));
   await t.choose('retract:play:'+f.retract+':rearrange');await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.handler==='retract:order');
   await t.choose('retract:site:'+f.corridor);await t.refresh();
   assert.deepEqual(t.read().stack.at(-1).payload.order,[f.corridor]);
   assert.ok(!t.ids().includes('retract:site:'+f.bay),'Site ordering preserves the existing Gate pair.');
   await t.choose('retract:site:'+f.core);await t.refresh();
   await t.choose('retract:site:'+f.bay);await t.refresh();
   assert.equal(t.read().stack.at(-1).handler,'retract:relocate');
   assert.deepEqual(t.read().locations,[f.corridor,f.core,f.bay]);
   assert.equal(t.read().cards[f.weak].location,f.core);
   assert.equal(t.read().cards[f.hero].location,f.core);
   assert.ok(t.ids().includes('retract:gate:keep'));
   assert.ok(t.ids().includes('retract:gate:'+f.core+':'+f.bay));
   if(width===390){const page=await t.screenshot(mode+'-saved-relocation-phone.png');await page.locator('.native-choices').screenshot({path:h.output+'/'+mode+'-saved-relocation-controls-phone.png'});}
   await t.choose(mode==='keep'?'retract:gate:keep':'retract:gate:'+f.core+':'+f.bay);await t.refresh();
   const expectedPair=mode==='keep'?[f.core,f.corridor]:[f.core,f.bay];
   assert.deepEqual(new Set(t.read().data.laserGates[f.card].sites.map(ref=>ref.id)),new Set(expectedPair));
   assert.equal(t.read().cards[f.retract].zone,'lost');
   await t.advance(m=>m.turn.side==='light'&&m.turn.phase==='move'&&m.stack.length===1&&t.prompt().side==='light');
   const weakMove='move:'+f.weak+':'+f.corridor,heroMove='move:'+f.hero+':'+f.corridor;
   assert.ok(t.ids().includes(heroMove),'A strong character may cross this gap.');
   assert.equal(t.ids().includes(weakMove),mode==='relocate','Moving the Gate changes the weak character’s legal path.');
   const page=await t.show('light',true),blockedLabel=new RegExp('^Move '+escape(board.name(t.read(),f.weak))+' to '+escape(board.name(t.read(),f.corridor)));
   assert.equal(await page.getByRole('button',{name:blockedLabel}).count(),mode==='relocate'?1:0);
   if(width===390){await page.locator('.native-choices').screenshot({path:h.output+'/'+mode+'-movement-controls-phone.png'});}
   const mover=mode==='relocate'?f.weak:f.hero,before=t.read().players.light.force.length;
   await t.choose(mode==='relocate'?weakMove:heroMove);await t.refresh();
   await t.advance(m=>m.cards[mover].location===f.corridor);await t.refresh();
   assert.equal(t.read().players.light.force.length,before-1);
   if(mode==='keep')assert.equal(t.read().cards[f.weak].location,f.core);
   for(const side of ['dark','light']){
    const passage=t.clients[side].page.getByRole('region',{name:'Laser Gate passage',exact:true});
    assert.match(await passage.innerText(),new RegExp(escape(board.name(t.read(),expectedPair[0]))));
    assert.match(await passage.innerText(),new RegExp(escape(board.name(t.read(),expectedPair[1]))));
   }
   if(width===390)await t.screenshot(mode+'-moved-phone.png','light',false);
   console.log('Passed Laser Gate '+mode+' at '+width+' with real UI/HTTP/service/SQLite, saved relocation and both seats.');
  }finally{await t.close();}
 }
}finally{await h.close();}
