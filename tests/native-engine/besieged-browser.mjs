// Controlled scenario coverage, not a claim of full starter-match support or GEMP parity.
// Deployment, saved selection, battle initiation and weapon targeting use actual UI controls.
import assert from 'node:assert/strict';
import {fixture} from './besieged-fixture.mjs';
import {pull} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';

const h=await browserHarness('besieged');
try{
 for(const mode of (process.env.BESIEGED_MODES?.split(',')??['ship','site']))for(const [width,height]of widths('BESIEGED_WIDTHS')){
  assert.ok(['ship','site'].includes(mode));
  const f=fixture({site:mode==='site'});
  const outside=mode==='site'?pull(f.m,'light','1_28','table',f.bay):null;
  const t=await h.seed(f.m,width,height);
  try{
   await t.refresh();
   await t.choose('besieged:deploy:'+f.card+':'+f.ship);await t.refresh();
   await t.advance(m=>m.cards[f.card].zone==='table'&&m.cards[f.card].attachedTo===f.ship);
   assert.equal(t.read().cards[f.card].attachedTo,f.ship);
   await t.advance(()=>t.ids().includes('besieged:select:'+f.card+':'+f.ship));
   await t.choose('besieged:select:'+f.card+':'+f.ship);await t.refresh();
   assert.ok(!t.ids().includes('besieged:begin'),'Empty selection cannot initiate battle.');
   await t.choose('besieged:add:'+f.escort);await t.refresh();
   assert.deepEqual(t.read().stack.at(-1).payload.selected.map(ref=>ref.id),[f.escort]);
   assert.ok(!t.ids().includes('besieged:add:'+f.escort));
   assert.ok(t.ids().includes('besieged:add:'+f.second),'A second eligible character remains optional.');
   if(width===390){const page=await t.screenshot(mode+'-saved-selection-phone.png');await page.locator('.native-choices').screenshot({path:h.output+'/'+mode+'-saved-selection-controls-phone.png'});}
   // Cancel and reopen through the UI; a prior subset must not leak into a new selection.
   await t.choose('besieged:cancel');await t.refresh();
   await t.advance(()=>t.ids().includes('besieged:select:'+f.card+':'+f.ship));
   await t.choose('besieged:select:'+f.card+':'+f.ship);
   assert.deepEqual(t.read().stack.at(-1).payload.selected,[]);
   await t.choose('besieged:add:'+f.escort);
   const force=t.read().players.dark.force.length;
   await t.choose('besieged:begin');await t.refresh();
   assert.equal(t.read().players.dark.force.length,force-1);
   assert.deepEqual(t.read().data.battle.participants,{dark:[f.escort],light:f.characters});
   assert.ok(f.characters.every(id=>t.read().cards[id].zone==='table'));
   assert.equal(t.read().cards[f.ship].zone,'inactive');
   for(const side of ['dark','light'])assert.equal(await t.clients[side].page.getByRole('region',{name:'Besieged battle',exact:true}).count(),1);
   if(outside)assert.ok(!t.read().data.battle.participants.light.includes(outside));
   await t.advance(()=>t.ids().includes('fire:'+f.gun+':'+f.escort));
   await t.choose('fire:'+f.gun+':'+f.escort);await t.refresh();
   await t.advance(m=>m.data.battle.shots[0]?.hit!=null);
   assert.equal(t.read().data.battle.shots[0].weapon,f.gun);
   await t.advance(m=>m.data.battle?.stage==='complete',(_m,ids)=>ids.includes('battle-lose:force')?'battle-lose:force':undefined);
   await t.refresh();
   const survivors=f.characters.filter(id=>t.read().cards[id].attachedTo===f.ship);
   assert.ok(survivors.length,'This controlled weapon scenario leaves trapped survivors.');
   assert.ok(survivors.every(id=>t.read().cards[id].zone==='inactive'));
   if(t.read().cards[f.gun].attachedTo)assert.equal(t.read().cards[f.gun].zone,'inactive');
   assert.equal(t.read().cards[f.second].zone,'table');
   await t.advance(m=>m.stack.length===1&&m.turn.side==='dark'&&m.turn.phase==='battle'&&t.prompt().side==='dark');
   assert.ok(!t.ids().some(id=>id.startsWith('besieged:select:')),'The host cannot be besieged twice this turn.');
   if(outside)assert.ok(!t.ids().includes('battle:'+f.bay),'A site cannot host an extra outside battle this turn.');
   if(width===390)await t.screenshot(mode+'-completed-phone.png','light',false);
   console.log('Passed Besieged '+mode+' at '+width+' with real UI/HTTP/service/SQLite, subset refresh and both seats.');
  }finally{await t.close();}
 }
}finally{await h.close();}
