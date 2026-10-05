// Playwright 1.62.1 / Chromium 1234. Actual UI → HTTP → service → SQLiteD1.
// This is component coverage, not full-match admission or a new Rules Lab study.
import assert from 'node:assert/strict';
import {fixture} from './lift-tube-browser-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';

const h=await browserHarness('lift-tube');
try{
 for(const side of process.env.LIFT_TUBE_SIDES?.split(',')??['light','dark'])for(const [width,height]of widths('LIFT_TUBE_WIDTHS')){
  assert.ok(['light','dark'].includes(side));
  const f=fixture(side),t=await h.seed(f.m,width,height);
  try{
   const ready=()=>t.read().stack.length===1&&t.prompt().side===side;
   await t.refresh();
   const initialForce=t.read().players[side].force.length;
   await t.choose('vessel:deploy:'+f.tube+':'+f.core);await t.refresh();
   assert.equal(t.read().cards[f.tube].zone,'playing');
   assert.equal(t.read().players[side].force.length,initialForce-1,'Printed deployment costs one Force.');
   await t.advance(m=>m.cards[f.tube].zone==='table'&&ready());await t.refresh();
   await t.advance(m=>m.turn.side===side&&m.turn.phase==='move'&&ready());
   assert.ok(!t.ids().includes('move:'+f.passenger+':'+f.corridor),'A weak pedestrian cannot cross Laser Gate.');
   await t.choose('vessel:embark:'+f.passenger+':'+f.tube+':passenger');await t.refresh();
   await t.advance(m=>m.cards[f.passenger].attachedTo===f.tube&&ready());
   assert.equal(t.read().cards[f.passenger].aboardRole,'passenger');
   const moveForce=t.read().players[side].force.length;
   await t.choose('voyage:landspeed:'+f.tube+':'+f.corridor);await t.refresh();
   assert.equal(t.read().players[side].force.length,moveForce-1);
   await t.advance(m=>m.cards[f.tube].location===f.corridor&&ready());await t.refresh();
   assert.equal(t.read().cards[f.passenger].location,f.corridor);
   assert.equal(t.read().cards[f.passenger].attachedTo,f.tube,'Passengers cross the Gate aboard their Lift Tube.');
   await t.advance(m=>m.turn.side===f.opponent&&m.turn.phase==='control'&&m.stack.length===1&&t.prompt().side===f.opponent);
   await t.choose('drain:'+f.core);await t.refresh();
   await t.advance(()=>t.ids().includes('vehicle-react:'+f.tube+':'+f.core));
   const reactForce=t.read().players[side].force.length;
   await t.choose('vehicle-react:'+f.tube+':'+f.core);await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.handler==='vehicle-react:board');
   assert.equal(t.read().players[side].force.length,reactForce-1);
   await t.choose('board:'+f.boarding+':passenger');await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.handler==='vehicle-react:board');
   assert.equal(t.read().cards[f.boarding].attachedTo,f.tube);
   if(width===390){const page=await t.screenshot(side+'-boarding-phone.png',side);await page.locator('.native-choices').screenshot({path:h.output+'/'+side+'-boarding-controls-phone.png'});}
   await t.choose('continue-react');await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.handler==='vehicle-react:exit');await t.refresh();
   assert.equal(t.read().cards[f.tube].location,f.core);
   for(const id of [f.passenger,f.boarding])assert.equal(t.read().cards[id].location,f.core);
   assert.ok(t.read().stack.some(frame=>frame.kind==='resolution'&&frame.action.handler==='ground:drain'&&frame.cancelled),'Passenger presence on arrival cancels the drain.');
   await t.choose('exit:'+f.boarding);await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.handler==='vehicle-react:exit');
   assert.equal(t.read().cards[f.boarding].attachedTo,undefined);
   await t.choose('continue-react');await t.refresh();
   await t.advance(m=>m.stack.length===1&&m.turn.side===f.opponent&&m.turn.phase==='control');await t.refresh();
   assert.equal(t.read().players[side].force.length,reactForce-1,'No additional drain loss or duplicate payment after refresh.');
   assert.equal(t.read().cards[f.passenger].attachedTo,f.tube);
   await t.screenshot(side+'-complete-'+width+'.png',side,false);
   console.log('Passed '+side+' Lift Tube deploy, Gate crossing, boarding react and drain cancellation at '+width+' through actual UI/HTTP/service/SQLite with both-seat refresh.');
  }finally{await t.close();}
 }
}finally{await h.close();}
