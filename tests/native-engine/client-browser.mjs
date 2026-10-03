// Portable: Playwright 1.62.1 / Chromium revision 1234. Set PLAYWRIGHT_PACKAGE
// only when using a preinstalled bundle. Start the normal local UI before running.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {load} from '../native-proof/load-engine.mjs';
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
const browserRules={...auditRules,supports:bp=>auditRules.supports(bp)||['1_42','4_133','4_16','5_149','1_109','1_267'].includes(bp),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>auditRules.supports(c.blueprint)||['1_42','4_133','4_16','5_149','1_109','1_267'].includes(c.blueprint))}};
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
  const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();
  await c.page.getByRole('button',{name:'Declare your Force activation',exact:true}).click();
  for(let n=0;n<10;n++){v=await fresh().read(v.id,'owner');if(v.game.prompt?.choices.some(x=>x.id==='core:activation-amount:2'))break;let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:'pass'})}
  await c.page.getByRole('button',{name:'Refresh',exact:true}).click();await c.page.getByRole('button',{name:'Declare 2 Force to activate',exact:true}).click();
  await c.page.getByRole('button',{name:'Pause',exact:true}).click();await c.page.getByRole('button',{name:'Inspect A Tremor In The Force',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');
  assert.match(await c.page.getByLabel('Declared activation').innerText(),/2 Force.*1 activated.*1 remaining/);const before=(await fresh().read(v.id,'owner')).revision;
  await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:'Pause',exact:true}).click();await c.page.getByLabel('Revealed inserts').waitFor();assert.equal((await fresh().read(v.id,'owner')).revision,before);
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`insert-reveal-${width}.png`),fullPage:true});await c.context.close();
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
 // A nested opposing Sense draws below an already revealed insert. Real
 // service commands and refresh preserve both the pending insert and destiny.
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const dark=[...decks.find(d=>d.side==='dark').cards],light=[...decks.find(d=>d.side==='light').cards];dark[dark.indexOf('1_224')]='5_149';dark[dark.indexOf('1_262')]='1_267';light[light.indexOf('1_64')]='4_16';light[light.indexOf('1_115')]='1_109';
  assert.ok(dark.includes('1_267'));assert.ok(light.includes('1_109'));const owner=await fresh().create('owner',{...config(randomUUID(),'pvp'),deck:dark});await fresh().join(owner.id,'guest',{commandId:randomUUID(),inviteToken:owner.inviteToken,deck:light});let v=await fresh().read(owner.id,'owner');
  for(let n=0;v.game.status==='setup'&&n<20;n++){let actor='owner',p=v.game.prompt;if(!p?.choices.length){actor='guest';p=(await fresh().read(v.id,actor)).game.prompt}assert.ok(p?.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:v.revision,choice:p.choices[0].id});v=await fresh().read(v.id,'owner')}
  let m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);const find=bp=>Object.values(m.cards).find(c=>c.blueprint===bp),anger=find('4_16'),telepathy=find('5_149'),lsSense=find('1_109'),dsSense=find('1_267');
  for(const c of [anger,telepathy,lsSense,dsSense])pileState.moveCard(m,c.id,'hand');for(const bp of ['101_2','101_5']){const hero=find(bp);pileState.moveCard(m,hero.id,'table');m.cards[hero.id].location=m.locations[0]}
  pileState.insertCard(m,anger.id,'dark',seeded(3));m.data.reserveInserts[0].position=1;const top=m.players.dark.reserve.find(id=>Number(load(new URL('../../lib/native-engine/board.ts',import.meta.url)).cardDefinition(m,id).stats.destiny)===0);assert.ok(top);const dummy=m.players.dark.reserve.find(id=>id!==top);m.players.dark.reserve=[dummy,top,...m.players.dark.reserve.filter(id=>![dummy,top].includes(id))];runtime.activateForce(m,'dark',dsSense.id,1);runtime.openWindow(m,'response','light');
  const step=id=>{const p=runtime.prompt(m,browserRules,'dark');m=runtime.applyCommand(m,browserRules,p.side,{revision:m.revision,choice:id},seeded(3))};const seek=check=>{for(let n=0;n<300&&!check();n++){const p=runtime.prompt(m,browserRules,'dark'),own=runtime.prompt(m,browserRules,p.side);step(own.mandatory?own.choices[0].id:'pass')}assert.ok(check())};
  const play=(side,card,prefix)=>{seek(()=>runtime.prompt(m,browserRules,side)?.choices.some(c=>c.id.startsWith(prefix)&&c.id.includes(card.id)));step(runtime.prompt(m,browserRules,side).choices.find(c=>c.id.startsWith(prefix)&&c.id.includes(card.id)).id)};
  play('dark',telepathy,'telepathy:play:');play('light',lsSense,'cancel:play:');seek(()=>runtime.prompt(m,browserRules,'dark')?.choices.some(c=>c.id.startsWith('cancel:play:')&&c.id.includes(dsSense.id)));const senseChoice=runtime.prompt(m,browserRules,'dark').choices.find(c=>c.id.startsWith('cancel:play:')&&c.id.includes(dsSense.id));
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);const c=await context(width,height);await c.page.goto(origin+'/matches/'+v.id+'?progress-report');if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByRole('button',{name:senseChoice.label,exact:true}).click();
  for(let n=0;n<40;n++){m=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);if(m.stack.at(-1)?.event?.kind==='destiny-drawn'&&m.stack.at(-1).event.side==='dark')break;const p=runtime.prompt(m,browserRules,'dark');await fresh().command(v.id,p.side==='dark'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'})}
  assert.equal(m.cards[top].zone,'destiny');assert.equal(m.cards[anger.id].zone,'table');assert.equal(m.data.reserveInserts[0].revealed,true);const before=m.revision;await c.page.reload();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();await c.page.getByLabel('Revealed inserts').waitFor();const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.isVisible())await pause.click();assert.equal((await fresh().read(v.id,'owner')).revision,before);
  await c.page.getByRole('button',{name:'Inspect Anger, Fear, Aggression',exact:true}).click();await c.page.getByRole('dialog').waitFor();await c.page.keyboard.press('Escape');await c.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.page.screenshot({path:path.join(output,`insert-response-${width}.png`),fullPage:true});await c.context.close();
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
 assert.deepEqual(errors,[]);console.log('Browser passed: real service recovery, receipt retry after refresh, concession/cancel, CPU dispatch, guest invitation, timed invitation acknowledgment, durable clocks/timeout across refresh, private views, card inspection timed/keyboard empty passes, untimed inspection recovery/acknowledgment, admission gate and responsive 1440/834/390 layouts.');
}finally{await browser.close();db.close()}
