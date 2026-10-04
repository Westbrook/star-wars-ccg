// Playwright 1.62.1 / Chromium 1234, real HTTP handlers and SQLite D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,seeded} from './match-runner.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url)),{nativeSealedHandlers}=load(new URL('../../lib/native-sealed-http.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url)),{nativeDeckHandlers}=load(new URL('../../lib/native-deck-http.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const {sealedCatalog}=load(new URL('../../lib/sealed-products.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-native-client-browser',errors=[];
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
const fresh=()=>nativeSealedService(db,{entropy:seeded(17)});
async function client(actor,width){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});let interrupt=false;
 const matches=matchHandlers(()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules})),decks=nativeDeckHandlers(()=>nativeDeckService(db,auditRules)),sealed=nativeSealedHandlers(fresh);
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postData(),id=url.pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const r=url.pathname.startsWith('/api/sealed-pools')?id?await sealed.room(request,{params:Promise.resolve({id})}):await sealed.collection(request):url.pathname==='/api/match-decks'?await decks[req.method()==='POST'?'save':'list'](request):id?await matches[req.method()==='POST'?'update':'read'](request,{params:Promise.resolve({id})}):await matches[req.method()==='POST'?'create':'list'](request);
  if(interrupt&&body&&url.pathname==='/api/sealed-pools'){interrupt=false;await route.abort();return;}
  await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context,interrupt:()=>interrupt=true};
}
try{
 for(const width of [1440,834,390]){
  const actor='sealed-owner-'+width,guestActor='sealed-guest-'+width,c=await client(actor,width);await c.page.goto(origin+'/matches?progress-report');
  const region=c.page.getByRole('region',{name:'Sealed play'});await region.getByRole('button',{name:'Create sealed table',exact:true}).waitFor();
  c.interrupt();await region.getByRole('button',{name:'Create sealed table',exact:true}).click();await region.getByRole('alert').waitFor();
  const before=(await fresh().list(actor)).pools;assert.equal(before.length,1);assert.deepEqual(before[0].cards,[]);
  const raw=db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+before[0].id).data;
  await c.page.reload();await region.getByRole('button',{name:'Recover sealed table',exact:true}).click();await region.getByRole('button',{name:'Copy sealed invitation',exact:true}).waitFor();
  assert.equal((await fresh().list(actor)).pools.length,1);assert.equal(db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+before[0].id).data,raw);
  const waiting=(await fresh().list(actor)).pools[0],g=await client(guestActor,width);await g.page.goto(origin+'/matches?sealed='+waiting.id+'#'+new URLSearchParams({sealedInvite:waiting.inviteToken}));
  await g.page.getByRole('button',{name:'Join sealed table',exact:true}).click();await g.page.getByRole('button',{name:'Build from this pool',exact:true}).waitFor();assert.equal(new URL(g.page.url()).hash,'');
  await region.getByRole('button',{name:'Build from this pool',exact:true}).waitFor();const pool=await fresh().read(waiting.id,actor);assert.ok(pool.cards.length>=40);assert.equal(pool.side,'light');
  await region.getByRole('button',{name:'Build from this pool',exact:true}).click();await c.page.getByLabel('Deck name',{exact:true}).fill('Sealed fleet '+width);
  assert.equal(await c.page.getByLabel('Deck size',{exact:true}).isDisabled(),true);assert.equal(await c.page.getByLabel('Deck side',{exact:true}).isDisabled(),true);
  for(const bp of pool.cards.slice(0,40)){
   await c.page.getByLabel('Find cards',{exact:true}).fill(bp);await c.page.getByRole('button',{name:'Add '+sealedCatalog.get(bp).name,exact:true}).click();
  }
  await c.page.getByText('40 / 40 cards',{exact:false}).waitFor();
  const bp=pool.cards[0],copies=pool.cards.filter(x=>x===bp).length,chosen=pool.cards.slice(0,40).filter(x=>x===bp).length;
  if(copies===chosen){await c.page.getByLabel('Find cards',{exact:true}).fill(bp);assert.equal(await c.page.getByRole('button',{name:'Add '+sealedCatalog.get(bp).name,exact:true}).isDisabled(),true);}
  await c.page.getByRole('button',{name:'Save deck',exact:true}).click();await c.page.getByText('Deck saved to your account.',{exact:true}).waitFor();
  const deck=(await nativeDeckService(db,auditRules).list(actor)).decks.find(d=>d.name==='Sealed fleet '+width);assert.equal(deck.poolId,pool.id);assert.deepEqual(deck.cards,pool.cards.slice(0,40));assert.equal(deck.eligible,false);
  await c.page.reload();await c.page.getByLabel('Match format',{exact:true}).selectOption('40');await c.page.getByLabel('Your deck',{exact:true}).selectOption(deck.id);assert.equal(await c.page.getByRole('button',{name:'Start match',exact:true}).isDisabled(),true);
  await c.page.getByRole('button',{name:'Edit selected deck',exact:true}).click();assert.equal(await c.page.getByLabel('Deck size',{exact:true}).isDisabled(),true);
  await c.page.screenshot({path:path.join(output,'sealed-editor-'+width+'.png'),fullPage:true});await g.page.reload();await g.page.getByRole('button',{name:'Build from this pool',exact:true}).waitFor();
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await g.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.context.close();await g.context.close();console.log('Passed paired sealed opening, exact recovery, private exchange and 40-card construction at '+width);
 }
 assert.deepEqual(errors,[]);
}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-2500));throw e}finally{await browser.close();db.close()}
