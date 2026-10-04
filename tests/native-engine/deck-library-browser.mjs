// Playwright 1.62.1 / Chromium 1234; actual HTTP handlers, service and SQLite D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url));
const {nativeSealedHandlers}=load(new URL('../../lib/native-sealed-http.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url)),{nativeDeckHandlers}=load(new URL('../../lib/native-deck-http.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-native-client-browser',errors=[];
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules,entropy:seeded(1)});
const seed=async(actor,size,side)=>nativeDeckService(db,auditRules).save(actor,{id:randomUUID(),name:`${side} custom ${size}`,side,size,cards:[...starterDecks(size).find(d=>d.side===side).cards].reverse(),revision:0});
async function client(actor,width,rules=auditRules){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});let interrupt='';
 const handlers=matchHandlers(()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,entropy:seeded(1)})),decks=nativeDeckHandlers(()=>nativeDeckService(db,rules));
 await context.route('**/api/sealed-pools**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),h=nativeSealedHandlers(()=>nativeSealedService(db,{entropy:seeded(1)})),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const r=id?await h.room(request,{params:Promise.resolve({id})}):await h.collection(request);await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()})});
 await context.route('**/api/match**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postData(),id=url.pathname.split('/')[3];
  const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const isDeck=url.pathname==='/api/match-decks',r=isDeck?await decks[req.method()==='POST'?'save':'list'](request):id?await handlers[req.method()==='POST'?'update':'read'](request,{params:Promise.resolve({id})}):await handlers[req.method()==='POST'?'create':'list'](request);
  if(body&&(interrupt==='save'&&isDeck||interrupt==='create'&&!isDeck&&!id)){interrupt='';await route.abort();return;}
  await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context,interrupt:kind=>interrupt=kind};
}
try{
 for(const width of [1440,834,390]){
  const actor='editor-'+width,deck=await seed(actor,40,'light'),c=await client(actor,width);
  await c.page.goto(origin+'/matches?progress-report');await c.page.getByLabel('Match format').selectOption('40');await c.page.getByLabel('Your deck',{exact:true}).selectOption(deck.id);
  await c.page.getByRole('button',{name:'Edit selected deck'}).click();await c.page.getByLabel('Deck name').fill('Edited fleet '+width);
  // Edit actual multiplicities, then restore the count and save a real draft.
  const remove=c.page.getByRole('button',{name:'Remove Rebel Trooper',exact:true});await remove.click();await c.page.getByText('39 / 40 cards',{exact:false}).waitFor();
  await c.page.getByLabel('Find cards',{exact:true}).fill('1_28');await c.page.getByRole('button',{name:'Add Rebel Trooper',exact:true}).click();
  c.interrupt('save');await c.page.getByRole('button',{name:'Save deck',exact:true}).click();await c.page.getByRole('alert').waitFor();
  await c.page.getByRole('button',{name:'Save deck',exact:true}).click();await c.page.getByText('Deck saved to your account.',{exact:true}).waitFor();
  assert.equal((await nativeDeckService(db,auditRules).list(actor)).decks.find(d=>d.id===deck.id).revision,2);
  await c.page.reload();await c.page.getByLabel('Match format').selectOption('40');await c.page.getByLabel('Your deck',{exact:true}).selectOption(deck.id);
  assert.match(await c.page.getByLabel('Your deck',{exact:true}).textContent(),new RegExp('Edited fleet '+width));
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.getByRole('button',{name:'Edit selected deck'}).click();await c.page.screenshot({path:path.join(output,'custom-deck-editor-'+width+'.png'),fullPage:true});await c.context.close();
  console.log('Saved edit, lost response and reload at '+width);
  for(const size of [40,60]){
   const owner=`owner-${width}-${size}`,guest=`guest-${width}-${size}`,light=await seed(owner,size,'light'),dark=await seed(owner,size,'dark'),guestDeck=await seed(guest,size,'dark');
   for(const mode of ['cpu','pvp']){
    const c=await client(owner,width);await c.page.goto(origin+'/matches?progress-report');await c.page.getByLabel('Match format').selectOption(String(size));await c.page.getByLabel('Your deck',{exact:true}).selectOption(light.id);await c.page.getByLabel('Your opponent').selectOption(mode);
    if(mode==='cpu')await c.page.getByLabel('Computer deck').selectOption(dark.id);else await c.page.getByLabel('Match clock',{exact:true}).selectOption('30');
    const before=(await fresh().list(owner)).length;
    if(mode==='pvp')c.interrupt('create');
    await c.page.getByRole('button',{name:'Start match',exact:true}).click();
    if(mode==='pvp'){
     await c.page.getByRole('alert').waitFor();await c.page.reload();await c.page.getByRole('button',{name:'Recover match',exact:true}).click();
    }
    await c.page.waitForURL(url=>/\/matches\/[A-Za-z0-9_-]+/.test(url.pathname));
    const id=new URL(c.page.url()).pathname.split('/').at(-1),view=await fresh().read(id,owner);assert.equal(view.deckSize,size);assert.equal((await fresh().list(owner)).length,before+1);
    const row=db.sqlite.prepare('SELECT * FROM native_matches WHERE id=?').get(id);assert.deepEqual(JSON.parse(row.owner_deck),light.cards);
    if(mode==='pvp'){
     const g=await client(guest,width);await g.page.goto(origin+'/matches/'+id+'?progress-report#'+new URLSearchParams({invite:view.inviteToken,side:'dark',size:String(size),minutes:'30'}));
     await g.page.getByLabel('Your deck',{exact:true}).selectOption(guestDeck.id);await g.page.screenshot({path:path.join(output,`custom-deck-invite-${size}-${width}.png`),fullPage:true});await g.page.getByRole('button',{name:'Join match',exact:true}).click();await g.page.getByRole('heading',{name:'The opening table.',exact:true}).waitFor();
     assert.equal(new URL(g.page.url()).hash,'');await g.page.reload();await g.page.getByRole('heading',{name:'The opening table.',exact:true}).waitFor();assert.equal((await fresh().read(id,guest)).deckSize,size);await g.context.close();
    }else await c.page.getByRole('heading',{name:'The opening table.',exact:true}).waitFor();
    assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();
    console.log(`Created ${size}-card ${mode} at ${width}${mode==='pvp'?' with lost-response recovery and custom guest deck':''}`);
   }
  }
 }
 const gate=await client('production-owner',390,premiereRules);await seed('production-owner',40,'light');await gate.page.goto(origin+'/matches');await gate.page.getByLabel('Match format').selectOption('40');await gate.page.getByLabel('Your opponent').selectOption('pvp');assert.equal(await gate.page.getByRole('button',{name:'Start match'}).isDisabled(),true);await gate.context.close();
 assert.deepEqual(errors,[]);console.log('Passed all custom deck browser checks; production admission remains closed.');
}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(0,3500));throw e}finally{await browser.close();db.close()}
