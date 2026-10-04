// Playwright 1.62.1 / Chromium 1234, real HTTP handlers and SQLite D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,seeded} from './match-runner.mjs';
import {pairedPool,sealedMatchRules} from './sealed-match-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url)),{nativeSealedHandlers}=load(new URL('../../lib/native-sealed-http.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url)),{nativeDeckHandlers}=load(new URL('../../lib/native-deck-http.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const {sealedCatalog}=load(new URL('../../lib/sealed-products.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-native-client-browser',errors=[];
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
const fresh=()=>nativeSealedService(db,{entropy:seeded(266)});
async function client(actor,width){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});let interruptPath=null;
 const matches=matchHandlers(()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>sealedMatchRules})),decks=nativeDeckHandlers(()=>nativeDeckService(db,sealedMatchRules)),sealed=nativeSealedHandlers(fresh);
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postData(),id=url.pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const r=url.pathname.startsWith('/api/sealed-pools')?id?await sealed.room(request,{params:Promise.resolve({id})}):await sealed.collection(request):url.pathname==='/api/match-decks'?await decks[req.method()==='POST'?'save':'list'](request):id?await matches[req.method()==='POST'?'update':'read'](request,{params:Promise.resolve({id})}):await matches[req.method()==='POST'?'create':'list'](request);
  if(interruptPath&&body&&url.pathname===interruptPath){interruptPath=null;await route.abort();return;}
  await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context,interrupt:path=>interruptPath=path};
}
try{
 for(const width of [1440,834,390]){
  const actor='cpu-sealed-'+width,side=width===834?'dark':'light',c=await client(actor,width);await c.page.goto(origin+'/matches?progress-report');
  const region=c.page.getByRole('region',{name:'Sealed play'});await region.getByLabel('Your sealed side',{exact:true}).selectOption(side);await region.getByLabel('Your sealed opponent',{exact:true}).selectOption('cpu');
  c.interrupt('/api/sealed-pools');await region.getByRole('button',{name:'Create sealed table',exact:true}).click();await region.getByRole('alert').waitFor();await c.page.reload();
  assert.equal(await region.getByLabel('Your sealed side',{exact:true}).inputValue(),side);assert.equal(await region.getByLabel('Your sealed opponent',{exact:true}).inputValue(),'cpu');
  await region.getByRole('button',{name:'Recover sealed table',exact:true}).click();await region.getByRole('button',{name:'Build from this pool',exact:true}).waitFor();
  const pools=(await fresh().list(actor)).pools;assert.equal(pools.length,1);const pool=pools[0];assert.equal(pool.mode,'cpu');assert.equal(pool.inviteToken,undefined);assert.ok(pool.cards.every(bp=>sealedCatalog.get(bp).side===side));
  await region.getByRole('button',{name:'Build from this pool',exact:true}).click();await c.page.getByLabel('Deck name',{exact:true}).fill('Sealed against computer');
  const cards=pool.cards.filter(bp=>sealedMatchRules.supports(bp)).slice(0,40);assert.equal(cards.length,40);
  for(const bp of cards){await c.page.getByLabel('Find cards',{exact:true}).fill(bp);await c.page.getByRole('button',{name:'Add '+sealedCatalog.get(bp).name,exact:true}).click();}
  await c.page.getByRole('button',{name:'Save deck',exact:true}).click();await c.page.getByText('Deck saved to your account.',{exact:true}).waitFor();
  assert.equal(await c.page.getByLabel('Your opponent',{exact:true}).inputValue(),'cpu');assert.equal(await c.page.getByLabel('Computer deck',{exact:true}).count(),0);
  c.interrupt('/api/matches');await c.page.getByRole('button',{name:'Start match',exact:true}).click();await c.page.getByRole('alert').waitFor();const row=db.sqlite.prepare('SELECT * FROM native_matches WHERE owner=?').get(actor);assert.equal(row.mode,'cpu');
  const snapshot=JSON.parse(row.owner_deck);assert.equal(snapshot.poolId,pool.id);assert.equal(snapshot.computerDeck.length,40);
  await c.page.reload();await c.page.getByRole('button',{name:'Recover match',exact:true}).click();await c.page.waitForURL('**/matches/'+row.id+'?progress-report');await c.page.locator('.native-turn').waitFor();
  if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();
  for(let i=0;i<12;i++){
   await c.page.waitForFunction(()=>document.querySelector('h1')?.textContent!=='The opening table.'||[...document.querySelectorAll('.native-choices button')].some(b=>!b.disabled));
   if(await c.page.locator('h1').innerText()!=='The opening table.')break;
   const rev=await c.page.locator('.native-turn small').innerText();await c.page.locator('.native-choices button').first().click();await c.page.waitForFunction(old=>document.querySelector('.native-turn small')?.textContent!==old,rev);
  }
  await c.page.getByRole('heading',{name:'Across the galaxy.',exact:true}).waitFor();await c.page.reload();await c.page.locator('.native-turn').waitFor();
  const v=await nativeMatchService(db,{currentRules:sealedMatchRules.id,rules:()=>sealedMatchRules}).read(row.id,actor);assert.equal(v.game.status,'playing');assert.equal(v.poolId,pool.id);assert.deepEqual(v.game.players[side==='light'?'dark':'light'].hand,[]);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches WHERE owner=?').get(actor).n,1);assert.equal(JSON.parse(db.sqlite.prepare('SELECT owner_deck FROM native_matches WHERE id=?').get(row.id).owner_deck).computerPolicy,'sealed-balanced-1');
  await c.page.screenshot({path:path.join(output,'cpu-sealed-'+width+'.png'),fullPage:true});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.context.close();console.log('Passed computer sealed opening, construction, both lost responses and automatic setup at '+width+' as '+side);
 }
 assert.deepEqual(errors,[]);
}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-3000));throw e}finally{await browser.close();db.close()}
