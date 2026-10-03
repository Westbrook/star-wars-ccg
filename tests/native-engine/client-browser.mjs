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
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173';
let time=1_800_000_000_000;const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules,now:()=>time,entropy:seeded(1)}),handlers=matchHandlers(fresh);
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
  await page.screenshot({path:path.join(output,`table-${width}.png`),fullPage:true});await ctx.close();
 }
 // CPU dispatch is driven by the client, and private opponent cards never enter DOM.
 const c=await context(1440,1000),cpu=await fresh().create('owner',config(randomUUID(),'cpu','light'));
 await c.page.goto(origin+'/matches/'+cpu.id);await c.page.getByText('Saved · move 1',{exact:true}).waitFor();assert.equal((await fresh().read(cpu.id,'owner')).revision,1);assert.equal(await c.page.locator('.report-return').count(),0);await c.context.close();
 // Separate signed-in guest joins through a private fragment invitation.
 const wait=await fresh().create('owner',config(randomUUID(),'pvp','dark')),j=await context(834,1112,'guest');
 await j.page.goto(origin+'/matches/'+wait.id+'#'+new URLSearchParams({invite:wait.inviteToken,side:'light',size:'60'}));await j.page.getByRole('button',{name:'Join match',exact:true}).click();await j.page.getByRole('heading',{name:'The opening table.'}).waitFor();assert.equal((await fresh().read(wait.id,'guest')).side,'light');assert.equal(new URL(j.page.url()).hash,'');await j.context.close();
 // A failed creation response survives refresh without creating another match.
 const start=await context(1440,1000,'new-owner');await start.page.goto(origin+'/matches');await start.page.getByRole('button',{name:'Start match'}).waitFor();start.interrupt('create');await start.page.getByRole('button',{name:'Start match'}).click();await start.page.getByRole('alert').waitFor();const owned=await fresh().list('new-owner');assert.equal(owned.length,1);await start.page.reload();await start.page.getByRole('button',{name:'Start match'}).click();await start.page.waitForURL('**/matches/'+owned[0].id);assert.equal((await fresh().list('new-owner')).length,1);await start.context.close();
 const bad=await context(834,1112,'other-guest');await bad.page.goto(origin+'/matches/'+wait.id+'#'+new URLSearchParams({invite:'invalid',side:'light',size:'60'}));await bad.page.getByRole('button',{name:'Join match',exact:true}).click();await bad.page.getByRole('alert').filter({hasText:'This invitation cannot seat you'}).waitFor();await bad.context.close();
 // Empty opportunity timers survive polling; paused prompts also support ArrowRight.
 const e=await context(1440,1000),ev=await fresh().create('owner',config(randomUUID(),'pvp'));await fresh().join(ev.id,'guest',{commandId:randomUUID(),inviteToken:ev.inviteToken,deck:decks.find(d=>d.side==='light').cards});
 const em={...structuredClone(empty),id:ev.id};db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(em),em.revision,ev.id);
 await e.page.goto(origin+'/matches/'+ev.id,{waitUntil:'domcontentloaded'});await e.page.getByRole('button',{name:'Pass empty opportunity',exact:true}).waitFor();
 await e.page.waitForFunction(rev=>!document.querySelector('.native-turn')?.textContent.includes('Saved · move '+rev),em.revision);assert.ok((await fresh().read(ev.id,'owner')).revision>em.revision);
 db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(em),em.revision,ev.id);db.sqlite.prepare('DELETE FROM native_commands WHERE match_id=?').run(ev.id);
 await e.page.reload({waitUntil:'domcontentloaded'});await e.page.getByRole('button',{name:'Pause',exact:true}).click();await e.page.locator('h1').click();await e.page.keyboard.press('ArrowRight');await e.page.waitForFunction(rev=>!document.querySelector('.native-turn')?.textContent.includes('Saved · move '+rev),em.revision);await e.context.close();
 // An open private card dialog loses access at the saved inspection deadline.
 const x=await context(1440,1000),xv=await fresh().create('owner',config(randomUUID(),'pvp'));await fresh().join(xv.id,'guest',{commandId:randomUUID(),inviteToken:xv.inviteToken,deck:decks.find(d=>d.side==='light').cards});
 const sm={...structuredClone(scan),id:xv.id};time=sm.stack.at(-1).payload.expiresAt-5000;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(sm),sm.revision,xv.id);
 await x.page.clock.install();await x.page.goto(origin+'/matches/'+xv.id,{waitUntil:'domcontentloaded'});await x.page.locator('.native-inspection .native-card').first().click();await x.page.getByRole('dialog').waitFor();time+=6000;await x.page.clock.fastForward(6000);await x.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await x.page.locator('.native-inspection .native-card').count(),0);await x.context.close();time=1_800_000_000_000;
 // The production registry advertises closed starter admission, without a bypass.
 const gate=await context(1440,1000);await gate.context.unroute('**/api/matches**');await gate.context.route('**/api/matches',async route=>{const h=matchHandlers(()=>nativeMatchService(db,{currentRules:premiereRules.id,rules:()=>premiereRules}));const r=await h.list(new Request(route.request().url(),{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid'}}));await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()})});await gate.page.goto(origin+'/matches');await gate.page.getByText('Starter admission is not open yet.',{exact:false}).waitFor();assert.equal(await gate.page.getByRole('button',{name:'Start match'}).isDisabled(),true);await gate.context.close();
 assert.deepEqual(errors,[]);console.log('Browser passed: real service recovery, receipt retry after refresh, concession/cancel, CPU dispatch, guest invitation, private views, card inspection timed/keyboard empty passes, inspection expiry, admission gate and responsive 1440/834/390 layouts.');
}finally{await browser.close();db.close()}
