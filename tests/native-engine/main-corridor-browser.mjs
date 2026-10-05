// Real paid movement removes Light control, restoring the free Main Corridor route.
import assert from 'node:assert/strict';
import {corridorFixture,corridorChoice} from './main-corridor-fixture.mjs';
import {mod} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('main-corridor');
try{for(const [width,height]of widths('CORRIDOR_WIDTHS').filter(([width])=>process.env.CORRIDOR_WIDTHS||width!==834)){
 const f=corridorFixture({controlled:true}),t=await h.seed(f.m,width,height),initial=f.m.players.dark.force.length;
 try{
  await t.refresh();assert.equal(mod('board').controls(t.read(),'light',f.corridor),true);
  assert.ok(!t.ids().some(id=>id.startsWith('transport:corridor:')));
  let page=await t.show('dark',true);assert.equal(await page.getByRole('button',{name:/free via Main Corridor/}).count(),0);
  if(width===390)await page.locator('.native-choices').screenshot({path:h.output+'/suppressed-choices-phone.png'});
  await t.choose('move:'+f.mover+':'+f.corridor);await t.refresh();
  await t.advance(m=>m.cards[f.mover].location===f.corridor);await t.refresh();
  assert.equal(t.read().players.dark.force.length,initial-1);
  assert.equal(mod('board').controls(t.read(),'light',f.corridor),false);
  const free=corridorChoice(f,f.second,f.corridor);await t.advance(()=>t.ids().includes(free));
  page=await t.show('dark',true);assert.equal(await page.getByRole('button',{name:/free via Main Corridor/}).count(),1);
  if(width===390)await page.locator('.native-choices').screenshot({path:h.output+'/restored-choices-phone.png'});
  await t.choose(free);await t.refresh();
  assert.ok(t.read().stack.some(frame=>frame.kind==='resolution'&&frame.action.payload?.mode==='corridor'));
  await t.advance(m=>m.cards[f.second].location===f.corridor);await t.refresh();
  assert.equal(t.read().players.dark.force.length,initial-1,'The second move costs no Force.');
  assert.equal(t.read().cards[f.rebel].location,f.corridor);
  assert.ok([f.mover,f.second].every(id=>mod('ground').usage(t.read()).moved.filter(moved=>moved===id).length===1));
  await t.advance(m=>m.stack.length===1&&t.prompt().side==='dark');
  assert.ok(!t.ids().some(id=>id.startsWith('transport:corridor:')),'Both movers have spent their regular move.');
  if(width===390){page=await t.screenshot('contested-phone.png','dark',false);await page.locator('.native-site:has(h3:text-is("Executor: Main Corridor"))').screenshot({path:h.output+'/contested-site-phone.png'});}
  console.log('Passed Main Corridor at '+width+' with paid entry, restored free route, both-seat refresh and HTTP/service/SQLite.');
 }finally{await t.close();}
}}finally{await h.close();}
