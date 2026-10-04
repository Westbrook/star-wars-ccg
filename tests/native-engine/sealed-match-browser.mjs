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
const fresh=()=>nativeSealedService(db,{entropy:seeded(17)});
async function client(actor,width){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});let interrupt=false;
 const matches=matchHandlers(()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>sealedMatchRules})),decks=nativeDeckHandlers(()=>nativeDeckService(db,sealedMatchRules)),sealed=nativeSealedHandlers(fresh);
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postData(),id=url.pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const r=url.pathname.startsWith('/api/sealed-pools')?id?await sealed.room(request,{params:Promise.resolve({id})}):await sealed.collection(request):url.pathname==='/api/match-decks'?await decks[req.method()==='POST'?'save':'list'](request):id?await matches[req.method()==='POST'?'update':'read'](request,{params:Promise.resolve({id})}):await matches[req.method()==='POST'?'create':'list'](request);
  if(interrupt&&body&&url.pathname==='/api/matches'){interrupt=false;await route.abort();return;}
  await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context,interrupt:()=>interrupt=true};
}
try{
 for(const width of [1440,834,390]){
  const actor='match-owner-'+width,guestActor='match-guest-'+width,pool=await pairedPool(db,actor,guestActor);
  const save=(side,owner)=>nativeDeckService(db,sealedMatchRules).save(owner,{id:crypto.randomUUID(),name:'My sealed '+side,side,size:40,cards:pool.decks[side],poolId:pool.id,revision:0});
  const light=await save('light',actor),dark=await save('dark',guestActor);
  const c=await client(actor,width),g=await client(guestActor,width);
  await c.page.goto(origin+'/matches?progress-report');await c.page.getByLabel('Match format',{exact:true}).selectOption('otsd');await c.page.getByLabel('Your deck',{exact:true}).selectOption(light.id);
  assert.equal(await c.page.getByLabel('Your opponent',{exact:true}).inputValue(),'pvp');assert.equal(await c.page.getByLabel('Your opponent',{exact:true}).isDisabled(),true);
  c.interrupt();await c.page.getByRole('button',{name:'Start match',exact:true}).click();await c.page.getByRole('alert').waitFor();
  const row=db.sqlite.prepare('SELECT * FROM native_matches WHERE owner=?').get(actor);assert.equal(JSON.parse(row.owner_deck).poolId,pool.id);
  await c.page.reload();await c.page.getByRole('button',{name:'Recover match',exact:true}).click();await c.page.waitForURL('**/matches/'+row.id+'?progress-report');
  await c.page.getByRole('button',{name:'Copy private invitation',exact:true}).waitFor();assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches WHERE owner=?').get(actor).n,1);
  // Fragment carries only the invitation and pool identity; server validates both players independently.
  await g.page.goto(origin+'/matches/'+row.id+'?progress-report#'+new URLSearchParams({invite:row.invite_token,side:'dark',size:'40',pool:pool.id}));
  await g.page.getByLabel('Your deck',{exact:true}).selectOption(dark.id);await g.page.getByRole('button',{name:'Join match',exact:true}).click();await g.page.getByRole('heading',{name:'The opening table.',exact:true}).waitFor();
  assert.equal(new URL(g.page.url()).hash,'');await c.page.reload();await c.page.getByRole('heading',{name:'The opening table.',exact:true}).waitFor();
  // Starting options and Force icons come from the existing official setup path.
  for(let i=0;i<15;i++){
   const service=nativeMatchService(db,{currentRules:sealedMatchRules.id,rules:()=>sealedMatchRules}),a=await service.read(row.id,actor),b=await service.read(row.id,guestActor);
   if(a.game.status!=='setup')break;
   const view=a.game.prompt.choices.length?a:b,p=view.side==='light'?c.page:g.page;await p.reload();
   if(width===390)await p.getByRole('button',{name:/^Actions/}).click();
   const choices=p.locator('.native-choices button');await choices.first().waitFor();await choices.first().click();
   await p.waitForFunction(rev=>document.querySelector('.native-turn small')?.textContent!==`Saved · move ${rev}`,view.revision);
  }
  await c.page.reload();await c.page.getByRole('heading',{name:'Across the galaxy.',exact:true}).waitFor();await c.page.locator('.native-turn').waitFor();
  const view=await nativeMatchService(db,{currentRules:sealedMatchRules.id,rules:()=>sealedMatchRules}).read(row.id,actor);assert.equal(view.game.status,'playing');assert.equal(view.poolId,pool.id);
  await c.page.screenshot({path:path.join(output,'sealed-match-'+width+'.png'),fullPage:true});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.context.close();await g.context.close();console.log('Passed sealed match binding, lost-create recovery, paired invitation and ordinary setup at '+width);
 }
 assert.deepEqual(errors,[]);
}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-2500));throw e}finally{await browser.close();db.close()}
