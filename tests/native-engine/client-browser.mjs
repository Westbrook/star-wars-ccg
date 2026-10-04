import {fixture as tallonFixture,start as tallonStart} from './tallon-fixture.mjs';
import {fixture as maneuverFixture,shot as maneuverShot,priority as maneuverPriority} from './maneuvers-fixture.mjs';
import {fixture as navigationFixture} from './navigation-fixture.mjs';
import {fixture as mobileFixture} from './mobile-systems-fixture.mjs';
import {fixture as spaceWeaponFixture,draws as spaceWeaponDraws,boundary as spaceWeaponBoundary,step as spaceWeaponStep,priority as spaceWeaponPriority} from './starship-weapons-fixture.mjs';
import {fixture as characterReactFixture} from './character-react-fixture.mjs';
import {fixture as aboardTravelFixture} from './aboard-travel-fixture.mjs';
import {fixture as cargoReactFixture} from './cargo-react-fixture.mjs';
import {fixture as pilotReactFixture} from './pilot-react-fixture.mjs';
import {fixture as deployReactFixture} from './deploy-react-fixture.mjs';
import {fixture as vehicleReactFixture} from './vehicle-react-fixture.mjs';
import {fixture as openFixture,prepared as openPrepared,step as openStep,settled as openSettled,priority as openPriority,phase as openPhase} from './open-vehicles-fixture.mjs';
import {fixture as crewFixture,paired as crewPaired,phase as crewPhase,priority as crewPriority,deploy as crewDeploy} from './crew-fixture.mjs';
import {fixture as pilotFixture} from './pilot-fixture.mjs';
import {fixture as dockingFixture} from './docking-fixture.mjs';
import {fixture as shuttleFixture,prepared as shuttlePrepared,moving as shuttleMoving} from './shuttle-fixture.mjs';
import {fixture as voyageFixture,driven as voyageDriven,moving as voyageMoving} from './vessel-travel-fixture.mjs';
// Portable: Playwright 1.62.1 / Chromium revision 1234. Set PLAYWRIGHT_PACKAGE
// only when using a preinstalled bundle. Start the normal local UI before running.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {load} from '../native-proof/load-engine.mjs';
import {fleets as vesselFleets,fixture as vesselFixture,deploy as vesselDeploy} from './vessels-fixture.mjs';
import {fixture as sunsFixture,deployed as sunsDeployed,battleStart as sunsBattle} from './sunsdown-fixture.mjs';
import {fixture as labriaFixture} from './labria-fixture.mjs';
import {fixture as nobleFixture} from './noble-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,starterDecks,runStarterMatch,seeded} from './match-runner.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const pileState=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173';
const browserRules={...auditRules,supports:bp=>auditRules.supports(bp)||['1_270','2_47','1_70','1_241','1_24','1_142','1_145','2_71','2_14','1_19','2_143','1_158','1_159','1_323','1_42','4_133','4_16','5_149','1_109','1_267','1_99','8_114','13_86','1_184','1_127','1_289','1_230','1_224','1_305','1_309','1_147','1_150','1_179','1_11','1_5','1_135','1_296','1_140','1_302','1_141','1_144','1_300','1_8','1_174','1_149','1_151','1_310','1_2','1_22','3_59'].includes(bp),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>auditRules.supports(c.blueprint)||['1_270','2_47','1_70','1_241','1_24','1_142','1_145','2_71','2_14','1_19','2_143','1_158','1_159','1_323','1_42','4_133','4_16','5_149','1_109','1_267','1_99','8_114','13_86','1_184','1_127','1_289','1_230','1_224','1_305','1_309','1_147','1_150','1_179','1_11','1_5','1_135','1_296','1_140','1_302','1_141','1_144','1_300','1_8','1_174','1_149','1_151','1_310','1_2','1_22','3_59'].includes(c.blueprint))}};
let time=1_800_000_000_000;const fresh=()=>nativeMatchService(db,{currentRules:browserRules.id,rules:()=>browserRules,now:()=>time,entropy:seeded(1)}),handlers=matchHandlers(fresh);
const browser=await chromium.launch({headless:true});const errors=[];
const output=process.env.NATIVE_UI_OUTPUT||'/private/tmp/swccg-native-client-browser';fs.mkdirSync(output,{recursive:true});
async function context(width,height,actor='owner'){
 const context=await browser.newContext({viewport:{width,height}});let interrupt=false;
 await context.route('**/api/matches**',async route=>{
  const req=route.request(),url=new URL(req.url()),id=url.pathname.split('/')[3],body=req.postData();
  const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const r=id?await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})}):await handlers[req.method()==='GET'?'list':'create'](request);
  if(interrupt&&body&&(interrupt==='command'?JSON.parse(body).operation==='command':!id&&req.method()==='POST')){interrupt=false;await route.abort();return}
  await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page,interrupt:(operation='command')=>interrupt=operation};
}
const decks=starterDecks(60),config=(id,mode='cpu',side='dark')=>({id,mode,side,deckSize:60,deck:decks.find(d=>d.side===side).cards,...(mode==='cpu'?{computerDeck:decks.find(d=>d.side!==side).cards}:{})});
try{
 // A lost response after commit, then full browser refresh, must retry the receipt.
 const a=await context(1440,1000),v=await fresh().create('owner',config(randomUUID(),'pvp'));
 await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
 await a.page.goto(origin+'/matches/'+v.id+'?progress-report');await a.page.locator('.native-choice').first().waitFor();
 assert.ok(await a.page.locator('.native-force').count());a.interrupt();await a.page.locator('.native-choice').first().click();await a.page.getByRole('button',{name:'Retry the same move'}).waitFor();
 const revision=(await fresh().read(v.id,'owner')).revision;await a.page.reload();await a.page.getByRole('button',{name:'Recover saved move'}).click();await a.page.getByRole('heading',{name:'Your opponent’s move.'}).waitFor();assert.equal((await fresh().read(v.id,'owner')).revision,revision);
 await a.page.getByRole('button',{name:'Forfeit match',exact:true}).click();await a.page.getByRole('button',{name:'Keep playing'}).click();assert.equal((await fresh().read(v.id,'owner')).game.status,'setup');
 await a.page.getByRole('button',{name:'Forfeit match',exact:true}).click();await a.page.getByRole('button',{name:'Confirm forfeit'}).click();await a.page.getByRole('heading',{name:'Dark side wins.'}).or(a.page.getByRole('heading',{name:'Light side wins.'})).waitFor();await a.context.close();
 // Capture an authentic battle state reached through normal complete-match play.
 let battle,empty,scan;runStarterMatch({seed:1,size:60,onStep:m=>{if(!battle&&m.data.battle?.stage==='damage'&&m.data.battle?.totalsReady)battle=structuredClone(m);const p=runtime.prompt(m,auditRules,'dark');if(!empty&&m.status==='playing'&&p?.side==='dark'&&!p.mandatory&&p.choices.length===1&&p.choices[0].id==='pass')empty=structuredClone(m);if(!scan&&m.stack.at(-1)?.handler==='scan:peek')scan=structuredClone(m)}});assert.ok(battle);assert.ok(empty);assert.ok(scan);
 for(const [width,height] of [[1440,1000],[834,1112],[390,844]]){
  const {context:ctx,page}=await context(width,height);const id=randomUUID(),v=await fresh().create('owner',config(id,'pvp'));await fresh().join(id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const snapshot={...structuredClone(battle),id};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(snapshot),snapshot.revision,id);
  await page.goto(origin+'/matches/'+id+'?progress-report');await page.locator('[aria-label="Dark side battle losses"]').waitFor();
  assert.equal(await page.locator('.native-losses').count(),2);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'horizontal overflow at '+width);
  if(width<640){await page.getByRole('button',{name:'Your hand',exact:false}).click();await page.locator('.native-hand').waitFor({state:'visible'});await page.getByRole('button',{name:'Actions',exact:false}).click();await page.locator('.native-actions').waitFor({state:'visible'});await page.getByRole('button',{name:'Table',exact:true}).click()}
  const card=page.locator('.native-site[data-battle="true"] .native-card').first();await card.click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(output,`table-${width}.png`),fullPage:true});
  // A controlled Effect supplies physical insert placement only. This does not
  // grant Macroscan insert gameplay; it exercises the real service projection.
  const insertSnapshot=structuredClone(snapshot),insert=Object.values(insertSnapshot.cards).find(c=>c.blueprint==='1_224');assert.ok(insert);
  pileState.moveCard(insertSnapshot,insert.id,'hand');pileState.insertCard(insertSnapshot,insert.id,'dark',seeded(7));
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(insertSnapshot),insertSnapshot.revision,id);
  await fresh().read(id,'owner');
  await page.reload();await page.locator('.native-player.dark [title="Count unavailable while an insert is in Reserve"]').first().waitFor();
  assert.equal(await page.locator('.native-player.dark [title="Count unavailable while an insert is in Reserve"]').count(),2);
  assert.equal(await page.locator('.native-player.dark .native-piles b').first().innerText(),'?');
  assert.equal(await page.locator('.native-player.light .native-piles b').first().innerText(),String(insertSnapshot.players.light.reserve.length));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(output,`insert-counts-${width}.png`),fullPage:true});await ctx.close();
 }
 // Insert declarations and revealed-card inspection survive refresh. The fixture
 // grants real insert placement; commands and UI use the real rules/service.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const owner=await fresh().create('owner',config(randomUUID(),'pvp')),light=[...decks.find(d=>d.side==='light').cards];light[light.indexOf('1_64')]='1_42';
  await fresh().join(owner.id,'guest',{commandId:randomUUID(),inviteToken:owner.inviteToken,deck:light});
  let v=await fresh().read(owner.id,'owner');
  for(let n=0;v.game.status==='setup'&&n<20;n++){let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:p.choices[0].id});v=await fresh().read(v.id,'owner')}
  let m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const insert=Object.values(m.cards).find(c=>c.blueprint==='1_42');pileState.moveCard(m,insert.id,'hand');pileState.insertCard(m,insert.id,'dark',seeded(3));m.data.reserveInserts.find(x=>x.card.id===insert.id).position=1;
  for(let n=0;n<20&&!(m.stack.length===1&&m.stack[0].timing==='phase');n++){const p=runtime.prompt(m,browserRules,'dark');const own=runtime.prompt(m,browserRules,p.side);m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:own.mandatory?own.choices[0].id:'pass'},seeded(3))}
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  await fresh().read(v.id,'owner');
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Declare your Force activation',exact:true}).click();
  for(let n=0;n<10;n++){v=await fresh().read(v.id,'owner');if(v.game.prompt?.choices.some(x=>x.id==='core:activation-amount:2'))break;let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:'pass'})}
  await c.page.getByRole('button',{name:'Refresh',exact:true}).click();await c.page.getByRole('button',{name:'Declare 2 Force to activate',exact:true}).click();
  await c.page.getByRole('button',{name:'Pause',exact:true}).click();await c.page.getByRole('button',{name:'Inspect A Tremor In The Force',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');
  assert.match(await c.page.getByLabel('Declared activation').innerText(),/2 Force.*1 activated.*1 remaining/);const before=(await fresh().read(v.id,'owner')).revision;
  await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Pause',exact:true}).click();await c.page.getByLabel('Revealed inserts').waitFor();assert.equal((await fresh().read(v.id,'owner')).revision,before);
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`insert-reveal-${width}.png`),fullPage:true});
  // After reveal responses, the opponent receives the first top-level interval.
  for(let n=0;n<30;n++){
   const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
   if(saved.stack.at(-1)?.event?.kind==='activation-between'){assert.equal(runtime.prompt(saved,browserRules,'dark').side,'light');break;}
   const ownerView=await fresh().read(v.id,'owner');let actor='owner',p=ownerView.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:ownerView.revision,choice:p.mandatory?p.choices[0].id:'pass'});
  }
  const interval=await fresh().read(v.id,'owner');assert.equal(interval.game.prompt.side,'light');assert.equal(interval.game.prompt.choices.length,0);
  await c.page.getByRole('button',{name:'Refresh',exact:true}).click();await c.page.getByRole('heading',{name:"Your opponent’s move.",exact:true}).waitFor();assert.equal(await c.page.locator('.native-choices button').count(),0);
  await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('heading',{name:"Your opponent’s move.",exact:true}).waitFor();assert.equal((await fresh().read(v.id,'owner')).revision,interval.revision);await c.context.close();
 }
 // Dark Path uses the real service for both private choices and refresh recovery.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const dark=[...decks.find(d=>d.side==='dark').cards];dark[dark.indexOf('1_224')]='4_133';
  const owner=await fresh().create('owner',{...config(randomUUID(),'pvp'),deck:dark}),light=[...decks.find(d=>d.side==='light').cards];light[light.indexOf('1_64')]='1_42';
  await fresh().join(owner.id,'guest',{commandId:randomUUID(),inviteToken:owner.inviteToken,deck:light});
  let v=await fresh().read(owner.id,'owner');
  for(let n=0;v.game.status==='setup'&&n<20;n++){let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:p.choices[0].id});v=await fresh().read(v.id,'owner')}
  let m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const pathCard=Object.values(m.cards).find(c=>c.blueprint==='4_133'),insert=Object.values(m.cards).find(c=>c.blueprint==='1_42');assert.ok(pathCard);pileState.moveCard(m,pathCard.id,'table');pileState.moveCard(m,insert.id,'hand');pileState.insertCard(m,insert.id,'dark',seeded(4));m.data.reserveInserts.find(x=>x.card.id===insert.id).position=1;
  for(let n=0;n<20&&!(m.stack.length===1&&m.stack[0].timing==='phase');n++){const p=runtime.prompt(m,browserRules,'dark');const own=runtime.prompt(m,browserRules,p.side);m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:own.mandatory?own.choices[0].id:'pass'},seeded(3))}
  m=runtime.applyCommand(m,browserRules,'dark',{revision:m.revision,choice:'dark-path:peek:'+pathCard.id},seeded(4));
  for(let n=0;n<20&&m.stack.at(-1)?.handler!=='dark-path:select';n++){const p=runtime.prompt(m,browserRules,'dark');m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:'pass'},seeded(4))}
  assert.equal(m.stack.at(-1)?.handler,'dark-path:select');const viewed=m.stack.at(-1).payload.inspection.cards.map(c=>c.id);db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  assert.deepEqual((await fresh().read(v.id,'guest')).game.rules.peek,[]);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByText('Inserts passed during this peek',{exact:true}).waitFor();await c.page.getByRole('button',{name:'Inspect A Tremor In The Force',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');
  await c.page.locator('.native-choices button').first().click();const afterFirst=(await fresh().read(v.id,'owner')).revision;await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByText('Inserts passed during this peek',{exact:true}).waitFor();assert.equal((await fresh().read(v.id,'owner')).revision,afterFirst);assert.equal(await c.page.locator('.native-choices button').count(),2);
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`reserve-peek-${width}.png`),fullPage:true});await c.page.locator('.native-choices button').first().click();
  const final=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(final.cards[viewed[0]].zone,'lost');assert.equal(final.cards[viewed[1]].zone,'lost');assert.equal(final.players.dark.reserve[0],viewed[2]);assert.equal(final.data.reserveInserts[0].position,1);assert.equal(final.data.reserveInserts[0].revealed,false);await c.context.close();
 }
 // Real Telepathy choices and delayed Anger obligations use durable service state.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  for(const choice of ['pay','cancel','obligation']){
   const dark=[...decks.find(d=>d.side==='dark').cards],light=[...decks.find(d=>d.side==='light').cards];dark[dark.indexOf('1_224')]='5_149';light[light.indexOf('1_64')]='4_16';
   const owner=await fresh().create('owner',{...config(randomUUID(),'pvp'),deck:dark});await fresh().join(owner.id,'guest',{commandId:randomUUID(),inviteToken:owner.inviteToken,deck:light});let v=await fresh().read(owner.id,'owner');
   for(let n=0;v.game.status==='setup'&&n<20;n++){let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:p.choices[0].id});v=await fresh().read(v.id,'owner')}
   let m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);const find=bp=>Object.values(m.cards).find(c=>c.blueprint===bp),anger=find('4_16'),telepathy=find('5_149'),troop=find('1_28');
   pileState.moveCard(m,anger.id,'hand');pileState.moveCard(m,telepathy.id,'hand');pileState.moveCard(m,troop.id,'table');m.cards[troop.id].location=m.locations[0];
   const step=id=>{const p=runtime.prompt(m,browserRules,'dark');m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:id},seeded(3))};
   const seek=check=>{for(let i=0;i<300&&!check();i++){const p=runtime.prompt(m,browserRules,'dark'),own=runtime.prompt(m,browserRules,p.side);step(own.mandatory?own.choices[0].id:'pass')}assert.ok(check())};
   if(choice==='obligation'){
    seek(()=>m.turn.side==='dark'&&m.turn.phase==='control'&&m.stack.length===1);pileState.insertCard(m,anger.id,'dark',seeded(3));m.data.reserveInserts.find(x=>x.card.id===anger.id).position=1;runtime.activateForce(m,'dark',telepathy.id,1);runtime.openWindow(m,'response','light');
    seek(()=>m.data.angerObligations?.length===1&&m.stack.length===1);
   }else{
    seek(()=>m.turn.side==='light'&&m.turn.phase==='control'&&m.stack.length===1&&runtime.prompt(m,browserRules,'light')?.side==='light');while(m.players.light.force.length<2)pileState.moveTop(m,'light','reserve','force');
    step('drain:'+m.locations[0]);seek(()=>runtime.prompt(m,browserRules,'dark')?.choices.some(c=>c.id.startsWith('telepathy:play:')));step(runtime.prompt(m,browserRules,'dark').choices.find(c=>c.id.startsWith('telepathy:play:')).id);seek(()=>m.stack.at(-1)?.handler==='telepathy:choose');
   }
   const before=m.players.light.force.length;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
   const c=await context(width,height,choice==='obligation'?'owner':'guest');await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
   if(choice==='obligation'){await c.page.getByLabel('Pending battle obligations').waitFor();await c.page.getByRole('button',{name:'Pause',exact:true}).click();assert.match(await c.page.getByLabel('Pending battle obligations').innerText(),/You must initiate a battle.*your next battle phase/)}else{await c.page.getByRole('button',{name:'Use 2 Force · continue this Force drain',exact:true}).waitFor()}
   await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
   if(choice==='obligation'){await c.page.getByLabel('Pending battle obligations').waitFor();await c.page.getByRole('button',{name:'Pause',exact:true}).click();assert.equal((await fresh().read(v.id,'owner')).game.rules.anger.length,1)}else{await c.page.getByRole('button',{name:'Use 2 Force · continue this Force drain',exact:true}).waitFor();assert.equal((await fresh().read(v.id,'guest')).revision,m.revision)}
   assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`telepathy-${choice}-${width}.png`),fullPage:true});
   if(choice!=='obligation'){await c.page.getByRole('button',{name:choice==='pay'?'Use 2 Force · continue this Force drain':'Cancel this Force drain',exact:true}).click();await c.page.getByRole('button',{name:'Cancel this Force drain',exact:true}).waitFor({state:'hidden'});const after=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(after.players.light.force.length,before-(choice==='pay'?2:0));assert.equal(after.stack.find(f=>f.action?.handler==='ground:drain')?.cancelled,choice==='cancel')}
   await c.context.close();
  }
 }
 // A controlled shuffle buries a pending insert before a nested opposing Sense.
 // Real service commands and refresh preserve the pending insert and destiny.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const dark=[...decks.find(d=>d.side==='dark').cards],light=[...decks.find(d=>d.side==='light').cards];dark[dark.indexOf('1_224')]='5_149';dark[dark.indexOf('1_262')]='1_267';light[light.indexOf('1_64')]='4_16';light[light.indexOf('1_115')]='1_109';
  assert.ok(dark.includes('1_267'));assert.ok(light.includes('1_109'));const owner=await fresh().create('owner',{...config(randomUUID(),'pvp'),deck:dark});await fresh().join(owner.id,'guest',{commandId:randomUUID(),inviteToken:owner.inviteToken,deck:light});let v=await fresh().read(owner.id,'owner');
  for(let n=0;v.game.status==='setup'&&n<20;n++){let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:p.choices[0].id});v=await fresh().read(v.id,'owner')}
  let m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);const find=bp=>Object.values(m.cards).find(c=>c.blueprint===bp),anger=find('4_16'),telepathy=find('5_149'),lsSense=find('1_109'),dsSense=find('1_267');
  for(const c of [anger,telepathy,lsSense,dsSense])pileState.moveCard(m,c.id,'hand');for(const bp of ['101_2','101_5']){const hero=find(bp);pileState.moveCard(m,hero.id,'table');m.cards[hero.id].location=m.locations[0]}
  pileState.insertCard(m,anger.id,'dark',seeded(3));m.data.reserveInserts[0].position=1;const top=m.players.dark.reserve.find(id=>Number(load(new URL('../../lib/native-engine/board.ts',import.meta.url)).cardDefinition(m,id).stats.destiny)===0);assert.ok(top);const dummy=m.players.dark.reserve.find(id=>id!==top);m.players.dark.reserve=[dummy,top,...m.players.dark.reserve.filter(id=>![dummy,top].includes(id))];runtime.activateForce(m,'dark',dsSense.id,1);runtime.openWindow(m,'response','light');
  const step=id=>{const p=runtime.prompt(m,browserRules,'dark');m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:id},seeded(3))};const seek=check=>{for(let n=0;n<300&&!check();n++){const p=runtime.prompt(m,browserRules,'dark'),own=runtime.prompt(m,browserRules,p.side);step(own.mandatory?own.choices[0].id:'pass')}assert.ok(check())};
  const play=(side,card,prefix)=>{seek(()=>runtime.prompt(m,browserRules,side)?.choices.some(c=>c.id.startsWith(prefix)&&c.id.includes(card.id)));step(runtime.prompt(m,browserRules,side).choices.find(c=>c.id.startsWith(prefix)&&c.id.includes(card.id)).id)};
  play('dark',telepathy,'telepathy:play:');play('light',lsSense,'cancel:play:');seek(()=>runtime.prompt(m,browserRules,'dark')?.choices.some(c=>c.id.startsWith('cancel:play:')&&c.id.includes(dsSense.id)));pileState.shufflePile(m,'dark','reserve',seeded(9));pileState.moveCard(m,top,'reserve');assert.ok(m.data.reserveInserts[0].position>0);const senseChoice=runtime.prompt(m,browserRules,'dark').choices.find(c=>c.id.startsWith('cancel:play:')&&c.id.includes(dsSense.id));
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:senseChoice.label,exact:true}).click();
  for(let n=0;n<40;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.stack.at(-1)?.event?.kind==='destiny-drawn'&&m.stack.at(-1).event.side==='dark')break;const p=runtime.prompt(m,browserRules,'dark');await fresh().command(v.id,p.side==='dark'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'})}
  assert.equal(m.cards[top].zone,'destiny');assert.equal(m.cards[anger.id].zone,'table');assert.equal(m.data.reserveInserts[0].revealed,true);const before=m.revision;await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByLabel('Revealed inserts').waitFor();const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.isVisible())await pause.click();assert.equal((await fresh().read(v.id,'owner')).revision,before);
  await c.page.getByRole('button',{name:'Inspect Anger, Fear, Aggression',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`insert-shuffle-response-${width}.png`),fullPage:true});await c.context.close();
 }
 // Timed match: real service transitions, responsive clocks, invitation terms,
 // refresh recovery and server-authoritative timeout. No browser clock decides a winner.
 for(const [width,height] of [[1440,1000],[834,1112],[390,844]]){
  const owner=await fresh().create('owner',{...config(randomUUID(),'pvp'),clockMinutes:15});
  const guest=await context(width,height,'guest');
  await guest.page.goto(origin+'/matches/'+owner.id+'#'+new URLSearchParams({invite:owner.inviteToken,side:'light',size:'60',minutes:'15'}));
  await guest.page.getByText(/15 minutes per player/).waitFor();
  await guest.page.getByRole('button',{name:'Join match',exact:true}).click();await guest.page.getByText('Starts after setup',{exact:true}).first().waitFor();
  assert.equal(await guest.page.locator('.native-clock').count(),2);await guest.context.close();
  let v=await fresh().read(owner.id,'owner');
  for(let n=0;v.game.status==='setup'&&n<20;n++){
   let actor='owner',choice=v.game.prompt?.choices[0]?.id;if(!choice){actor='guest';choice=(await fresh().read(v.id,actor)).game.prompt?.choices[0]?.id}
   assert.ok(choice);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice});v=await fresh().read(v.id,'owner');
  }
  assert.equal(v.game.status,'playing');const started=time;time+=123000;
  const client=await context(width,height);await client.page.goto(origin+'/matches/'+owner.id);
  const dark=client.page.getByLabel('Dark side match clock');await dark.getByText('12:57',{exact:true}).waitFor();
  // Pause only the empty-opportunity UI timer, not the authoritative match clock.
  if(width<640)await client.page.getByRole('button',{name:'Actions',exact:false}).click();
  await client.page.getByRole('button',{name:'Pause',exact:true}).click();
  assert.equal(await client.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await client.page.screenshot({path:path.join(output,`clock-${width}.png`),fullPage:true});
  time=started+124000;await client.page.reload();await dark.getByText('12:56',{exact:true}).waitFor();
  time=started+900000;await client.page.getByRole('button',{name:'Refresh',exact:true}).click();await client.page.getByRole('heading',{name:'Light side wins.'}).waitFor();
  if(width<640)await client.page.getByRole('button',{name:'Actions',exact:false}).click();
  await client.page.getByText('The losing side ran out of match time.',{exact:true}).waitFor();assert.equal(await dark.locator('strong').textContent(),'0:00');
  await client.context.close();
 }
 // CPU dispatch is driven by the client, and private opponent cards never enter DOM.
 const c=await context(1440,1000),cpu=await fresh().create('owner',config(randomUUID(),'cpu','light'));
 await c.page.goto(origin+'/matches/'+cpu.id);await c.page.getByText('Saved · move 1',{exact:true}).waitFor();assert.equal((await fresh().read(cpu.id,'owner')).revision,1);assert.equal(await c.page.locator('.report-return').count(),0);await c.context.close();
 // Separate signed-in guest joins through a private fragment invitation.
 const wait=await fresh().create('owner',config(randomUUID(),'pvp','dark')),j=await context(834,1112,'guest');
 await j.page.goto(origin+'/matches/'+wait.id+'#'+new URLSearchParams({invite:wait.inviteToken,side:'light',size:'60'}));await j.page.getByRole('button',{name:'Join match',exact:true}).click();await j.page.getByRole('heading',{name:'The opening table.'}).waitFor();assert.equal((await fresh().read(wait.id,'guest')).side,'light');assert.equal(new URL(j.page.url()).hash,'');await j.context.close();
 // Real Noble Sacrifice commands, refresh before optional retrieval, and the
 // public out-of-play area across desktop/tablet/phone. Component admission only.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=nobleFixture(),m=f.m;m.id=v.id;
  m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  await fresh().read(v.id,'owner');
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:/Noble Sacrifice · place Rebel Trooper/}).click();
  async function advanceUntil(predicate){
   for(let n=0;n<60;n++){
    const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
    if(predicate(saved))return saved;
    const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest';
    const view=await fresh().read(v.id,actor),choice=view.game.prompt.choices.find(c=>c.id==='pass')??view.game.prompt.choices[0];assert.ok(choice);
    await fresh().command(v.id,actor,{commandId:randomUUID(),revision:view.revision,choice:choice.id});
   }throw Error('Noble Sacrifice boundary not reached');
  }
  // Let the initiating UI request commit before sending the response passes.
  await c.page.getByRole('button',{name:/Noble Sacrifice · place Rebel Trooper/}).waitFor({state:'hidden'});
  await advanceUntil(m=>m.stack.at(-1)?.handler==='noble:retrieve');
  await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Retrieve 2 Force',exact:true}).waitFor();
  if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();
  await c.page.locator('.native-public-piles summary').click();
  await c.page.locator('.native-public-piles').getByRole('button',{name:'Inspect Rebel Trooper',exact:true}).click();
  await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.screenshot({path:path.join(output,`noble-out-of-play-${width}.png`),fullPage:true});
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Retrieve 2 Force',exact:true}).click();
  await c.page.getByRole('button',{name:'Retrieve 2 Force',exact:true}).waitFor({state:'hidden'});
  const done=await advanceUntil(m=>m.cards[f.noble].zone==='lost');assert.equal(done.cards[f.target].zone,'out');assert.equal(f.lost.filter(id=>done.cards[id].zone==='used').length,2);
  await c.context.close();
 }
 // Public Labria reveal survives refresh for both authenticated seats.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=labriaFixture(),m=f.m;m.id=v.id;
  m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height),op=await context(width,height,'guest');
  await c.page.goto(origin+'/matches/'+v.id+'?progress-report');
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Labria · reveal the top Reserve card',exact:true}).click();
  await c.page.getByRole('button',{name:'Labria · reveal the top Reserve card',exact:true}).waitFor({state:'hidden'});
  for(let n=0;n<30;n++){
   const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
   if(saved.stack.at(-1)?.handler==='labria:acknowledge')break;
   const p=runtime.prompt(saved,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest';
   const view=await fresh().read(v.id,actor);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:view.revision,choice:'pass'});
  }
  await op.page.goto(origin+'/matches/'+v.id);await op.page.reload();if(width<640)await op.page.getByRole('button',{name:'Actions',exact:false}).click();
  await op.page.getByRole('heading',{name:'Revealed Reserve card',exact:true}).waitFor();
  await op.page.locator('.native-inspection').getByRole('button',{name:'Inspect Stormtrooper',exact:true}).click();
  await op.page.getByRole('dialog').waitFor();await op.page.keyboard.press('Escape');await op.page.getByRole('dialog').waitFor({state:'hidden'});
  if(width<640)await op.page.getByRole('button',{name:'Actions',exact:false}).click();
  await op.page.getByRole('button',{name:'Continue · I have seen the revealed card',exact:true}).click();
  await op.page.getByRole('button',{name:'Continue · I have seen the revealed card',exact:true}).waitFor({state:'hidden'});
  await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('heading',{name:'Revealed Reserve card',exact:true}).waitFor();
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.screenshot({path:path.join(output,`labria-reveal-${width}.png`),fullPage:true});
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:/Return Stormtrooper to top of Force Pile/}).click();
  await c.page.getByRole('button',{name:/Return Stormtrooper to top of Force Pile/}).waitFor({state:'hidden'});
  const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(saved.players.dark.force[0],f.top);assert.equal(saved.turn.activated,m.turn.activated);
  await c.context.close();await op.context.close();
 }
 // Actual nighttime deployment and power-destiny recovery through both service seats.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=sunsFixture();let m=sunsDeployed(f);m.id=v.id;
  m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');
  if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();
  await c.page.getByText('PLANET SYSTEM · Parsec 7',{exact:true}).waitFor();await c.page.getByText('NIGHTTIME',{exact:true}).waitFor();
  assert.equal(await c.page.locator('.native-site').getByRole('button',{name:'Inspect Sunsdown',exact:true}).count(),1);
  await c.page.locator('.native-site').getByRole('button',{name:'Inspect Sunsdown',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});
  m=sunsBattle(f,m);db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const advance=async predicate=>{for(let n=0;n<180;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(predicate(saved))return saved;const p=runtime.prompt(saved,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:own.choices.some(x=>x.id==='draw-destiny')?'draw-destiny':own.choices.some(x=>x.id==='pass')?'pass':own.choices[0].id});}throw Error('Sunsdown boundary missing')};
  m=await advance(x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1).event.category==='power');
  const before=m.revision;await c.page.reload();assert.equal((await fresh().read(v.id,'owner')).revision,before);
  m=await advance(x=>x.data.battle?.stage==='damage');await c.page.reload();
  for(const s of ['Dark','Light']){const losses=c.page.getByLabel(s+' side battle losses');await losses.waitFor();assert.match(await losses.textContent(),/Power destiny/);assert.match(await losses.textContent(),/Battle destiny/);}
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.screenshot({path:path.join(output,`sunsdown-power-${width}.png`),fullPage:true});await c.context.close();
 }
 // Crew assignments are live actions, persist through refresh and remain grouped with their ship.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=vesselFixture();let m=vesselDeploy(f.m,f.scout,f.planet);m=vesselDeploy(m,f.pilot,f.scout,'pilot');m=vesselDeploy(m,f.passenger,f.scout,'passenger');m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Assign Grand Moff Tarkin as passenger aboard TIE Scout',exact:true}).click();await c.page.getByRole('button',{name:'Assign Grand Moff Tarkin as passenger aboard TIE Scout',exact:true}).waitFor({state:'hidden'});
  for(let n=0;n<60;n++){const pending=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(pending.cards[f.pilot].aboardRole==='passenger')break;const p=runtime.prompt(pending,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(pending,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:pending.revision,choice:'pass'});}
  await c.page.reload();
  if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const crew=c.page.getByRole('region',{name:'TIE Scout crew',exact:true});await crew.scrollIntoViewIfNeeded();await crew.getByRole('button',{name:'Inspect Grand Moff Tarkin',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await crew.locator('.native-crew>div>b').allTextContents().then(x=>x.filter(v=>v==='passenger').length),2);const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(saved.cards[f.pilot].aboardRole,'passenger');assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`vessel-crew-${width}.png`),fullPage:true});await c.context.close();
 }
 // Refresh during a vehicle's intermediate-site response, then finish its saved route.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=voyageFixture();let m=voyageMoving(voyageDriven(f));m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Move Sandcrawler to Tatooine: Jawa Camp via Tatooine: Dune Sea · 1 Force',exact:true}).click();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Vessel travel boundary missing');};
  m=await advance(x=>x.cards[f.crawler].location===f.dune);await c.page.reload();assert.equal((await fresh().read(v.id,'owner')).revision,m.revision);const journey=c.page.getByRole('status',{name:'Journey in progress'});await journey.waitFor();assert.match(await journey.textContent(),/Currently at Tatooine: Dune Sea/);await c.page.screenshot({path:path.join(output,`vessel-journey-${width}.png`),fullPage:true});
  m=await advance(x=>x.cards[f.crawler].location===f.camp);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const crew=c.page.getByRole('region',{name:'Sandcrawler crew',exact:true});await crew.scrollIntoViewIfNeeded();assert.equal(m.cards[f.driver].location,f.camp);assert.equal(m.data.ground.moved.includes(f.driver),false);assert.equal(await crew.getByRole('button',{name:'Inspect Labria',exact:true}).count(),1);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`vessel-travel-${width}.png`),fullPage:true});await c.context.close();
 }
 // Nested cargo and crew survive an actual shuttle command and response-window refresh.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=shuttleFixture();let m=shuttleMoving(shuttlePrepared(f));m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Shuttle Sandcrawler to Imperial-Class Star Destroyer as vehicle · 1 Force',exact:true}).click();await c.page.reload();
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.cards[f.crawler].attachedTo===f.carrier)break;const p=runtime.prompt(m,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.cards[f.crawler].attachedTo,f.carrier);assert.equal(m.cards[f.driver].attachedTo,f.crawler);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const host=c.page.getByRole('region',{name:'Imperial-Class Star Destroyer crew',exact:true});await host.scrollIntoViewIfNeeded();const cargo=host.getByRole('region',{name:'Sandcrawler crew',exact:true});await cargo.getByRole('button',{name:'Inspect Labria',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.match(await cargo.textContent(),/Landed/);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`shuttle-cargo-${width}.png`),fullPage:true});await c.context.close();
 }
 // One paid docking session survives transfers and refresh without another charge.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=dockingFixture();let m=f.m;const force=m.players.dark.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Dock Imperial-Class Star Destroyer/}).click();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Docking boundary missing');};
  const atChoice=x=>x.stack.at(-1)?.handler==='docking:transfer';m=await advance(atChoice);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Transfer Grand Moff Tarkin to Imperial-Class Star Destroyer '+f.second+' as passenger',exact:true}).click();m=await advance(atChoice);await c.page.reload();
  const status=c.page.getByRole('status',{name:'Ships docked'});await status.waitFor();assert.match(await status.textContent(),/1 transfer complete/);assert.equal(m.cards[f.pilot].attachedTo,f.second);assert.equal(m.players.dark.force.length,force-1);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Transfer Sandcrawler to Imperial-Class Star Destroyer '+f.second+' as vehicle',exact:true}).click();m=await advance(atChoice);await c.page.reload();await status.waitFor();assert.match(await status.textContent(),/2 transfers complete/);assert.equal(m.cards[f.crawler].attachedTo,f.second);assert.equal(m.cards[f.driver].attachedTo,f.crawler);assert.equal(m.players.dark.force.length,force-1);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`docking-session-${width}.png`),fullPage:true});
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Finish transfers and undock',exact:true}).click();m=await advance(x=>x.stack.length===1);await c.page.reload();assert.equal(await status.count(),0);assert.equal(m.players.dark.force.length,force-1);await c.context.close();
 }
 // Tallon Roll: respond with Corellian Slip, refresh between draws and after crew loss.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=tallonFixture();let m=tallonStart(f);m.id=v.id;m.turn.number=2;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Corellian Slip · add maneuver and pilot ability',exact:true}).first().click();await c.page.reload();
  const advance=async done=>{for(let n=0;n<150;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:own.choices.find(x=>x.id==='pass')?.id??own.choices[0].id});}throw Error('Missing Tallon Roll boundary');};
  m=await advance(x=>x.stack.at(-1)?.event?.kind==='destiny-drawn'&&x.stack.at(-1).event.side==='light');await c.page.reload();const panel=c.page.getByRole('region',{name:'Tallon Roll comparison'});await panel.waitFor();assert.match(await panel.textContent(),/Light side draws destiny/);
  m=await advance(x=>x.data.tallonRoll?.stage==='complete');assert.equal(m.cards[f.tie].zone,'lost');assert.equal(m.cards[f.pilot].zone,'lost');await c.page.reload();await panel.waitFor();assert.match(await panel.textContent(),/Black 3 lost/);assert.match(await panel.textContent(),/Pilot ability/);assert.deepEqual(await panel.locator('dd').allTextContents(),['1','3','3','7','5','2','3','1','11']);await panel.scrollIntoViewIfNeeded();assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`tallon-roll-${width}.png`),fullPage:false});await c.context.close();
 }
 // Just-drawn maneuver response survives refresh and changes the pending shot.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=maneuverFixture();let m=maneuverPriority(maneuverShot(f),'light');m.id=v.id;m.turn.number=2;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'A Few Maneuvers · Y-wing',exact:true}).first().click();await c.page.reload();
  for(let n=0;n<150;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.stack.at(-1)?.event?.kind==='weapon-fired')break;const p=runtime.prompt(m,browserRules,'light'),actor=p.side==='light'?'owner':'guest';await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.data.battle.starshipShots[0].outcome,'miss');assert.equal(m.data.battle.starshipShots[0].defense,5);assert.equal(m.data.battle.starshipShots[0].total,5);assert.equal(m.data.statModifiers.length,2);await c.page.reload();const summary=c.page.getByRole('region',{name:'Starship weapon fire'});await summary.waitFor();assert.match(await summary.textContent(),/Miss/);assert.match(await summary.textContent(),/Total 5 · Defense 5/);await summary.scrollIntoViewIfNeeded();assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`maneuver-response-${width}.png`),fullPage:false});await c.context.close();
 }
 // Astromech deployment and its extended hyperspace route persist through real service refresh.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=navigationFixture('red5-r2');let m=f.m;m.id=v.id;m.turn.number=2;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Deploy R2-D2 (Artoo-Detoo) aboard Red 5 as passenger',exact:true}).click();await c.page.reload();
  const advance=async done=>{for(let n=0;n<150;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest';await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Missing navigation boundary');};
  m=await advance(x=>x.stack.length===1&&x.turn.phase==='move'&&x.stack[0].priority==='light');assert.equal(m.cards[f.r2].attachedTo,f.ship);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Hyperspace Red 5 to Death Star · 1 Force',exact:true}).click();m=await advance(x=>x.stack.at(-1)?.event?.kind==='vessel-moving');await c.page.reload();await c.page.getByRole('status',{name:'Journey in progress'}).waitFor();assert.equal(m.cards[f.ship].location,f.planet);
  m=await advance(x=>x.stack.at(-1)?.event?.kind==='moved');for(const id of [f.ship,f.r2,f.lukePilot])assert.equal(m.cards[id].location,f.death);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const ship=c.page.locator('.native-vessel[aria-label="Red 5 crew"]');await ship.scrollIntoViewIfNeeded();assert.match(await ship.textContent(),/Power 9 · Maneuver 9 · Hyperspeed 8 · Navigation available/);assert.match(await ship.textContent(),/1 pilot · 1 astromech slots/);await ship.evaluate(el=>el.closest('.native-site').scrollIntoView({block:'nearest',inline:'start'}));const inspectedCard=ship.getByRole('button',{name:'Inspect R2-D2 (Artoo-Detoo)',exact:true});await inspectedCard.click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await inspectedCard.evaluate(el=>el===document.activeElement),true);await ship.evaluate(el=>el.closest('.native-site').scrollIntoView({block:'nearest',inline:'start'}));await c.page.waitForFunction(()=>{const r=document.querySelector('.native-vessel[aria-label="Red 5 crew"]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth});await c.page.screenshot({path:path.join(output,`astromech-navigation-${width}.png`),fullPage:false});await c.context.close();
 }
 // Moving a mobile system preserves both fleets and mounted weapons through refresh.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=mobileFixture(3);let m=f.m;m.id=v.id;m.turn.number=2;pileState.moveCard(m,f.gun,'table');m.cards[f.gun].attachedTo=f.death;m.setup={stage:'complete',selected:{light:f.yavin,dark:f.death},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Move Death Star to parsec 4 · orbit Yavin 4',exact:true}).click();await c.page.reload();const status=c.page.getByRole('status',{name:'Mobile system movement'});await status.waitFor();assert.match(await status.textContent(),/parsec 3 · deep space → parsec 4 · orbit Yavin 4/);
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest';await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Missing mobile movement boundary');};
  m=await advance(x=>x.stack.at(-1)?.event?.kind==='mobile-moving');assert.equal(m.data.mobileSystems[f.death].parsec,3);await c.page.reload();await status.waitFor();m=await advance(x=>x.stack.at(-1)?.event?.kind==='mobile-moved');assert.equal(m.data.mobileSystems[f.death].parsec,4);assert.equal(m.data.mobileSystems[f.death].orbit,'Yavin 4');for(const id of [f.scout,f.ywing])assert.equal(m.cards[id].location,f.death);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const site=c.page.locator('.native-site').filter({has:c.page.getByRole('heading',{name:'Death Star',exact:true})});await site.scrollIntoViewIfNeeded();assert.match(await site.textContent(),/MOBILE SYSTEM · Parsec 4Orbiting Yavin 4/);await site.getByRole('button',{name:'Inspect Turbolaser Battery',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`mobile-system-${width}.png`),fullPage:true});await c.context.close();
 }
 // Paid two-destiny starship firing restores before draws and preserves the hit summary.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=spaceWeaponFixture('1_323');spaceWeaponDraws(f,[5,5]);let m=spaceWeaponPriority(spaceWeaponBoundary(spaceWeaponStep(f.m,'battle:'+f.site),'battle-weapons'),'dark');m.id=v.id;m.setup={stage:'complete',selected:{light:f.ground,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Fire Turbolaser Battery at Y-wing',exact:true}).click();await c.page.reload();const summary=c.page.getByRole('region',{name:'Starship weapon fire'});await summary.waitFor();assert.match(await summary.textContent(),/Resolving shot/);
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.stack.at(-1)?.event?.kind==='weapon-fired')break;const p=runtime.prompt(m,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.data.battle.starshipShots[0].outcome,'hit');await c.page.reload();await summary.waitFor();assert.match(await summary.textContent(),/Hit · must be forfeited/);assert.match(await summary.textContent(),/Destiny 5 \+ 5 · modifier -5 · Total 5 · Defense 3/);await summary.scrollIntoViewIfNeeded();assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`starship-weapons-${width}.png`),fullPage:true});await c.context.close();
 }
 // Character reactions restore disembarking, movement and optional arrival boarding independently.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=characterReactFixture('embark');let m=f.m;const force=m.players.light.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'React with Shistavanen Wolfman',exact:true}).click();await c.page.reload();const status=c.page.getByRole('status',{name:'Character reaction'});await status.waitFor();assert.match(await status.textContent(),/Disembark before departure/);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Disembark Shistavanen Wolfman before reacting',exact:true}).click();await c.page.reload();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Character react boundary missing');};
  m=await advance(x=>x.stack.at(-2)?.action?.handler==='ground:move');assert.equal(m.cards[f.wolf].attachedTo,undefined);assert.equal(m.cards[f.wolf].location,f.site);assert.equal(m.players.light.force.length,force-1);await c.page.reload();
  m=await advance(x=>x.stack.at(-1)?.handler==='character-react:board');assert.equal(m.cards[f.wolf].location,f.dune);await c.page.reload();await status.waitFor();assert.match(await status.textContent(),/Embark after arrival/);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:"Embark Shistavanen Wolfman on Luke's X-34 Landspeeder as passenger",exact:true}).click();await c.page.reload();
  m=await advance(x=>x.stack.length===1);assert.equal(m.cards[f.wolf].attachedTo,f.dest);assert.equal(m.players.light.force.length,force-1);assert.equal(m.cards[f.gun].attachedTo,f.wolf);assert.equal(m.cards[f.gun].location,f.dune);await c.page.reload();assert.equal(await status.count(),0);if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const host=c.page.getByRole('region',{name:"Luke's X-34 Landspeeder crew",exact:true});await host.scrollIntoViewIfNeeded();await host.getByRole('button',{name:'Inspect Shistavanen Wolfman',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`character-react-${width}.png`),fullPage:true});await c.context.close();
 }
 // Narrow Escape disembarks only after payment/responses; restore both pending and completed movement.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=aboardTravelFixture();let m=f.m;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Narrow Escape · target Han Solo/}).click();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Aboard movement boundary missing');};
  await advance(x=>x.stack.at(-1)?.handler==='travel:escape');await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Disembark and move Luke to Tatooine: Dune Sea · 1 Force',exact:true}).click();await c.page.reload();
  m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(m.cards[f.luke].attachedTo,f.host);assert.equal(m.players.light.force.length,0);
  m=await advance(x=>x.cards[f.interrupt].zone==='used');assert.equal(m.cards[f.luke].attachedTo,undefined);assert.equal(m.cards[f.luke].location,f.dune);assert.equal(m.cards[f.gun].location,f.dune);assert.equal(m.cards[f.gun].attachedTo,f.luke);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const luke=c.page.getByRole('button',{name:'Inspect Luke',exact:true});await luke.scrollIntoViewIfNeeded();await luke.click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`aboard-travel-${width}.png`),fullPage:true});await c.context.close();
 }
 // Cargo deploys into the carrier, survives pending refresh and remains landed in battle.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=cargoReactFixture();let m=f.m;const force=m.players.dark.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Deploy TIE Scout to Imperial-Class Star Destroyer as starship .* as a react using Comlink/}).click();await c.page.reload();
  m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);assert.equal(m.cards[f.cargo].zone,'playing');assert.equal(m.players.dark.force.length,force-2);
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.data.battle?.stage==='weapons')break;const p=runtime.prompt(m,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.cards[f.cargo].attachedTo,f.carrier);assert.equal(m.players.dark.force.length,force-2);assert.ok(m.data.battle.participants.dark.includes(f.cargo));await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const host=c.page.getByRole('region',{name:'Imperial-Class Star Destroyer crew',exact:true}),cargo=host.getByRole('region',{name:'TIE Scout crew',exact:true});await cargo.scrollIntoViewIfNeeded();assert.match(await cargo.textContent(),/Landed/);assert.match(await cargo.getByLabel('Current vessel values').textContent(),/Power 0/);await cargo.getByRole('button',{name:'Inspect TIE Scout',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`cargo-react-${width}.png`),fullPage:true});await c.context.close();
 }
 // A required ship/pilot react restores its single pending action and shared arrival.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=pilotReactFixture();let m=f.m;const force=m.players.light.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Deploy Red 1 with Han Solo .* as a react using CZ-3/}).click();await c.page.reload();
  const status=c.page.getByRole('status',{name:'Deploying together'});await status.waitFor();assert.match(await status.textContent(),/Red 1/);assert.match(await status.textContent(),/Han Solo/);
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.cards[f.pilot].attachedTo===f.ship)break;const p=runtime.prompt(m,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.cards[f.pilot].attachedTo,f.ship);assert.equal(m.players.light.force.length,force-5);assert.ok(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const host=c.page.getByRole('region',{name:'Red 1 crew',exact:true});await host.scrollIntoViewIfNeeded();assert.match(await host.textContent(),/Han Solo/);assert.match(await host.textContent(),/pilot/);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`pilot-react-${width}.png`),fullPage:true});await c.context.close();
 }
 // Vehicle and crew deploy as separate reacts and restore their own pending action.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=deployReactFixture();let m=f.m;const force=m.players.light.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Deploy Luke's X-34 Landspeeder to Tatooine: Jawa Camp as a react/}).click();await c.page.reload();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Deployment react boundary missing');};
  m=await advance(x=>x.stack.at(-2)?.action?.handler==='ground:drain'&&x.stack.at(-1)?.priority==='light');assert.equal(m.cards[f.vehicle].zone,'table');assert.equal(m.players.light.force.length,force-2);assert.equal(m.stack.at(-2).cancelled,false);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Deploy Han Solo aboard Luke's X-34 Landspeeder as driver as a react/}).click();await c.page.reload();
  m=await advance(x=>x.cards[f.crew].attachedTo===f.vehicle);assert.equal(m.players.light.force.length,force-5);assert.ok(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const host=c.page.getByRole('region',{name:"Luke's X-34 Landspeeder crew",exact:true});await host.scrollIntoViewIfNeeded();assert.match(await host.textContent(),/Han Solo/);assert.match(await host.textContent(),/driver/);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`deploy-react-${width}.png`),fullPage:true});await c.context.close();
 }
 // Reacting crew choices and paid Force survive refresh before and after travel.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=vehicleReactFixture({boarding:true});let m=f.m;const force=m.players.light.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^React with Luke's X-34 Landspeeder/}).click();
  const advance=async done=>{for(let n=0;n<100;n++){const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(saved))return saved;const p=runtime.prompt(saved,browserRules,'light'),actor=p.side==='light'?'owner':'guest',own=runtime.prompt(saved,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:saved.revision,choice:'pass'});}throw Error('Vehicle react boundary missing');};
  m=await advance(x=>x.stack.at(-1)?.handler==='vehicle-react:board');await c.page.reload();const status=c.page.getByRole('status',{name:'Vehicle reaction'});await status.waitFor();assert.match(await status.textContent(),/Board before departure/);assert.equal(m.players.light.force.length,force-1);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Embark Luke as passenger',exact:true}).click();await c.page.reload();m=await advance(x=>x.stack.at(-1)?.handler==='vehicle-react:exit');await c.page.reload();await status.waitFor();assert.match(await status.textContent(),/Disembark after arrival/);assert.equal(m.cards[f.rider].attachedTo,f.host);assert.equal(m.players.light.force.length,force-1);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`vehicle-react-${width}.png`),fullPage:true});
  if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Disembark Luke at Tatooine: Jawa Camp',exact:true}).click();await c.page.reload();m=await advance(x=>x.stack.at(-1)?.handler==='vehicle-react:exit');await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Finish disembarking',exact:true}).click();m=await advance(x=>x.stack.length===1);assert.equal(m.cards[f.rider].attachedTo,undefined);assert.equal(m.cards[f.rider].location,f.camp);assert.equal(m.players.light.force.length,force-1);await c.context.close();
 }
 // One action deploys a ship and pilot; both hidden playing cards survive refresh.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=pilotFixture();let m=f.m;const force=m.players.dark.force.length;m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Deploy Black 3 with Grand Moff Tarkin to Tatooine · 5 Force',exact:true}).click();await c.page.reload();
  const status=c.page.getByRole('status',{name:'Deploying together'});await status.waitFor();assert.match(await status.textContent(),/Black 3/);assert.match(await status.textContent(),/Grand Moff Tarkin/);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`pilot-deploy-${width}.png`),fullPage:true});
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.cards[f.pilot].attachedTo===f.black)break;const p=runtime.prompt(m,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest',own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
  assert.equal(m.cards[f.black].zone,'table');assert.equal(m.cards[f.pilot].attachedTo,f.black);assert.equal(m.players.dark.force.length,force-5);await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();const crew=c.page.getByRole('region',{name:'Black 3 crew',exact:true});await crew.scrollIntoViewIfNeeded();await crew.getByRole('button',{name:'Inspect Grand Moff Tarkin',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();
 }
 // A pilot barred from battle keeps a seat, but stops operating/enhancing the ship.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','dark'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='light').cards});
  const f=crewFixture();let m=crewDeploy(crewPaired(f),f.scout,f.planet);pileState.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;load(new URL('../../lib/native-engine/ground.ts',import.meta.url)).record(m).barriers[f.ds]=m.turn.number;m=crewPriority(crewPhase(m,'battle'),'dark');m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');const crew=c.page.getByRole('region',{name:'Black 3 crew',exact:true});assert.match(await crew.getByLabel('Current vessel values').textContent(),/Power 4 · Maneuver 4/);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Battle at Tatooine',exact:true}).click();
  for(let n=0;n<100;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.data.battle?.stage==='weapons')break;const p=runtime.prompt(m,browserRules,'dark'),actor=p.side==='dark'?'owner':'guest';await fresh().command(v.id,actor,{commandId:randomUUID(),revision:m.revision,choice:'pass'});}assert.equal(m.data.battle.stage,'weapons');await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();await crew.scrollIntoViewIfNeeded();assert.match(await crew.getByLabel('Current vessel values').textContent(),/Power 0 · Maneuver 0/);assert.match(await crew.textContent(),/Unpiloted/);assert.match(await crew.textContent(),/Not participating in this battle/);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`excluded-pilot-${width}.png`),fullPage:true});await c.context.close();
 }
 // Open-vehicle crew can fire through the real client and survive pending-shot refresh.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',config(randomUUID(),'pvp','light'));await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=openFixture();let m=openPrepared(f);m=openPriority(openSettled(openStep(m,'equip:'+f.gun+':'+f.rider)),'light');pileState.moveCard(m,f.passenger,'table');m.cards[f.passenger].location=f.site;pileState.moveCard(m,f.lightHigh,'reserve');m=openPriority(openPhase(m,'battle'),'light');m.id=v.id;m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const advance=async done=>{for(let n=0;n<140;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(done(m))return;const p=runtime.prompt(m,browserRules,'light'),own=runtime.prompt(m,browserRules,p.side);assert.ok(own.choices.some(x=>x.id==='pass'));await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'});}throw Error('Open vehicle boundary missing')};
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');const crew=c.page.getByRole('region',{name:"Luke's X-34 Landspeeder crew",exact:true});assert.match(await crew.textContent(),/Open vehicle · occupants contribute power/);if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:/^Battle at Tatooine: Docking Bay 94$/}).click();await advance(x=>x.stack.at(-1)?.event?.kind==='battle-weapons'&&x.stack.at(-1)?.priority==='light');await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Fire Blaster at Stormtrooper',exact:true}).click();await c.page.reload();await advance(x=>x.data.battle?.shots?.[0]?.hit!==null&&x.data.battle?.hits?.includes(f.passenger));await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Table',exact:true}).click();await crew.scrollIntoViewIfNeeded();await crew.getByRole('button',{name:'Inspect Luke',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(m.cards[f.rider].attachedTo,f.host);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`open-vehicle-${width}.png`),fullPage:true});await c.context.close();
 }
 // A failed creation response survives refresh without creating another match.
 const start=await context(1440,1000,'new-owner');await start.page.goto(origin+'/matches');await start.page.getByRole('button',{name:'Start match'}).waitFor();await start.page.getByLabel('Your opponent').selectOption('pvp');await start.page.getByLabel('Match clock',{exact:true}).selectOption('30');start.interrupt('create');await start.page.getByRole('button',{name:'Start match'}).click();await start.page.getByRole('alert').waitFor();const owned=await fresh().list('new-owner');assert.equal(owned.length,1);await start.page.reload();await start.page.getByRole('button',{name:'Start match'}).click();await start.page.waitForURL('**/matches/'+owned[0].id);assert.equal((await fresh().list('new-owner')).length,1);await start.context.close();
 const bad=await context(834,1112,'other-guest');await bad.page.goto(origin+'/matches/'+wait.id+'#'+new URLSearchParams({invite:'invalid',side:'light',size:'60'}));await bad.page.getByRole('button',{name:'Join match',exact:true}).click();await bad.page.getByRole('alert').filter({hasText:'This invitation cannot seat you'}).waitFor();await bad.context.close();
 // Empty opportunity timers survive polling; paused prompts also support ArrowRight.
 const e=await context(1440,1000),ev=await fresh().create('owner',config(randomUUID(),'pvp'));await fresh().join(ev.id,'guest',{commandId:randomUUID(),inviteToken:ev.inviteToken,deck:decks.find(d=>d.side==='light').cards});
 const em={...structuredClone(empty),id:ev.id};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(em),em.revision,ev.id);
 await e.page.goto(origin+'/matches/'+ev.id,{waitUntil:'domcontentloaded'});await e.page.getByRole('button',{name:'Pass empty opportunity',exact:true}).waitFor();
 await e.page.waitForFunction(rev=>!document.querySelector('.native-turn')?.textContent.includes('Saved · move '+rev),em.revision);assert.ok((await fresh().read(ev.id,'owner')).revision>em.revision);
 db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(em),em.revision,ev.id);db.sqlite.prepare('DELETE FROM native_commands WHERE match_id=?').run(ev.id);
 await e.page.reload({waitUntil:'domcontentloaded'});await e.page.getByRole('button',{name:'Pause',exact:true}).click();await e.page.locator('h1').click();await e.page.keyboard.press('ArrowRight');await e.page.waitForFunction(rev=>!document.querySelector('.native-turn')?.textContent.includes('Saved · move '+rev),em.revision);await e.context.close();
 // Scanning Crew's obsolete printed time limit must not close inspection or
 // its card dialog. Refresh recovers the same choice; acknowledgment ends it.
 const x=await context(1440,1000),xv=await fresh().create('owner',config(randomUUID(),'pvp'));await fresh().join(xv.id,'guest',{commandId:randomUUID(),inviteToken:xv.inviteToken,deck:decks.find(d=>d.side==='light').cards});
 const sm={...structuredClone(scan),id:xv.id};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(sm),sm.revision,xv.id);
 await x.page.clock.install();await x.page.goto(origin+'/matches/'+xv.id,{waitUntil:'domcontentloaded'});await x.page.locator('.native-inspection .native-card').first().click();await x.page.getByRole('dialog').waitFor();
 time+=60000;await x.page.clock.fastForward(60000);assert.equal(await x.page.getByRole('dialog').isVisible(),true);assert.equal(await x.page.getByRole('timer').count(),0);
 await x.page.keyboard.press('Escape');const count=await x.page.locator('.native-inspection .native-card').count();assert.ok(count>0);await x.page.reload({waitUntil:'domcontentloaded'});await x.page.getByRole('button',{name:'Finish viewing',exact:true}).waitFor();assert.equal(await x.page.locator('.native-inspection .native-card').count(),count);assert.equal((await fresh().read(xv.id,'owner')).revision,sm.revision);
 await x.page.screenshot({path:path.join(output,'inspection-acknowledgment.png'),fullPage:true});
 await x.page.getByRole('button',{name:'Finish viewing',exact:true}).click();await x.page.getByRole('button',{name:'Finish viewing',exact:true}).waitFor({state:'hidden'});
 if((await fresh().read(xv.id,'owner')).game.rules.scan?.stage==='select')await x.page.getByRole('button',{name:'Leave the hand unchanged',exact:true}).click();
 await x.page.locator('.native-inspection').waitFor({state:'hidden'});await x.context.close();time=1_800_000_000_000;
 // The production registry advertises closed starter admission, without a bypass.
 const gate=await context(1440,1000);await gate.context.unroute('**/api/matches**');await gate.context.route('**/api/matches',async route=>{const h=matchHandlers(()=>nativeMatchService(db,{currentRules:premiereRules.id,rules:()=>premiereRules}));const r=await h.list(new Request(route.request().url(),{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid'}}));await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()})});await gate.page.goto(origin+'/matches');await gate.page.getByText('Starter admission is not open yet.',{exact:false}).waitFor();assert.equal(await gate.page.getByRole('button',{name:'Start match'}).isDisabled(),true);await gate.context.close();
 assert.deepEqual(errors,[]);console.log('Browser passed: astromech deployment, current values and extended hyperspace recovery at three sizes; mobile-system orbit movement, mounted weapon inspection and two-stage refresh at three sizes; starship weapon firing/destiny/hit summary with pending and completed refresh at three sizes; character reaction disembark/move/embark with saved recovery at three sizes; aboard Narrow Escape payment, disembarking, equipment and refresh recovery at three sizes; cargo deploy react with pending refresh, landed battle participation and nested inspection at three sizes; required ship/pilot react with pending/arrival refresh at three sizes; separate vehicle/crew deployment reacts with refresh at three sizes; vehicle react boarding, paid movement and disembarking recovery at three sizes; open-vehicle passenger firing and pending-shot recovery at three sizes; current ship power/maneuver and excluded pilot recovery at three sizes; simultaneous ship/pilot deployment, pending refresh and crew inspection at three sizes; paid docking session, multi-transfer refresh and undocking at three sizes; nested vehicle/crew shuttling and refresh at three sizes; intermediate-site vessel travel and refresh at three sizes; vessel crew reassignment through responses, inspection and refresh at three sizes; Sunsdown planet/nighttime display, attachment inspection and power-destiny recovery at three sizes; Labria public reveal/acknowledgment/return with both-seat refresh at three sizes; Noble Sacrifice cost/retrieval recovery and public out-of-play inspection at three sizes; real service recovery, receipt retry after refresh, concession/cancel, CPU dispatch, guest invitation, timed invitation acknowledgment, durable clocks/timeout across refresh, private views, card inspection timed/keyboard empty passes, untimed inspection recovery/acknowledgment, admission gate and responsive 1440/834/390 layouts.');
}finally{await browser.close();db.close()}
