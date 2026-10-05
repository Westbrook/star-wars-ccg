// Playwright 1.62.1 / Chromium1234, actual HTTP handler/service/SQLite D1.
// Controlled ship-site states exercise real UI commands, HTTP handlers and persistence.
// Host/beam departure is injected as a fixture event, not represented as a legal player action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {mod,pull,phase,ids,rules,state} from './prisoner-fixture.mjs';
import {bayFixture,bayDecks,deployBay,captureAtBay} from './ship-sites-fixture.mjs';
import {ending} from './captured-ships-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-ship-sites-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.SHIP_SITE_MODES?.split(',')??['deploy','two-bays','hyperspace-release','host-loss']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]].filter(([width])=>!process.env.SHIP_SITE_WIDTHS||process.env.SHIP_SITE_WIDTHS.split(',').includes(String(width)))){
 const f=bayFixture();let start=f.m;
 if(mode!=='deploy'){
  start=deployBay(start,f.bay,f.host);
  if(mode==='two-bays'){
   f.second=pull(start,'dark','4_165','hand');start=phase(start,'dark','deploy');start=deployBay(start,f.second,f.host);f.m=start;start=ending(f);
   const high=start.players.dark.reserve.find(id=>start.cards[id].blueprint==='1_241');state.moveCard(start,high,'used');state.moveCard(start,high,'reserve');
  }else{
   f.m=start;start=captureAtBay(f);f.resident=pull(start,'dark','1_194','table',f.bay);
   if(mode==='hyperspace-release'){f.yavin=pull(start,'light','1_135');start.locations.push(f.yavin);start=phase(start,'dark','move');}
   else mod('table').loseFromTable(start,[f.host]);
  }
 }
 const ds=bayDecks(),v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 const write=m=>{m=structuredClone(m);m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);};write(start);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light])assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<200&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 async function bayVisible(count=1){for(const c of [dark,light]){await show(c);assert.equal(await c.page.getByText('Aboard Imperial-Class Star Destroyer · Below decks',{exact:true}).count(),count);}}
 await refresh();
 if(mode==='deploy'){
  await choose(ids(read()).find(id=>id.startsWith('ship-site:deploy:'+f.bay+':'+f.host+':')));await refresh();await advance(m=>m.cards[f.bay].zone==='table');assert.equal(mod('ship-sites').relatedShip(read(),f.bay),f.host);await bayVisible();
 }else if(mode==='two-bays'){
  await choose('tractor:use:'+f.beam+':'+f.host);await advance(m=>m.stack.at(-1)?.handler==='tractor:custody');await refresh();assert.deepEqual(ids(read()).sort(),[f.bay,f.second].map(id=>'tractor:custody:'+id).sort());
  if(width===390){await show(dark,true);const custodyLabel=runtime.prompt(read(),rules,'dark').choices.find(c=>c.id==='tractor:custody:'+f.second).label;await dark.page.getByRole('button',{name:custodyLabel,exact:true}).scrollIntoViewIfNeeded();await dark.page.screenshot({path:output+'/custody-choice-phone.png',fullPage:true});}
  await choose('tractor:custody:'+f.second);assert.equal(read().cards[f.ship].capturedShip.host,f.second);assert.equal(read().cards[f.ship].location,f.second);await bayVisible(2);
 }else if(mode==='hyperspace-release'){
  await choose('voyage:hyperspace:'+f.host+':'+f.yavin);await refresh();await advance(m=>m.cards[f.host].location===f.yavin);assert.equal(read().cards[f.resident].location,f.bay);assert.equal(read().cards[f.ship].location,f.bay);await bayVisible();
  const moved=read();mod('table').loseFromTable(moved,[f.beam]);write(moved);await advance(m=>m.stack.at(-1)?.handler==='captured-ship:release');await refresh();assert.ok(ids(read()).includes('captured-ship:launch:'+f.yavin));assert.ok(!ids(read()).includes('captured-ship:launch:'+f.site));
  if(width===390){await show(light,true);await light.page.screenshot({path:output+'/release-phone.png',fullPage:true});}
  await choose('captured-ship:launch:'+f.yavin);assert.equal(read().cards[f.ship].location,f.yavin);assert.equal(read().cards[f.ship].capturedShip,undefined);
 }else{
  assert.ok(!read().locations.includes(f.bay));
  while(read().stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order'))await choose(ids(read())[0]);
  for(const id of [f.host,f.bay,f.ship,...f.characters,f.gun,f.resident])assert.equal(read().cards[id].zone,'lost');await bayVisible(0);
 }
 await refresh();if(width===390&&mode==='deploy'){await dark.page.getByText('Aboard Imperial-Class Star Destroyer · Below decks',{exact:true}).scrollIntoViewIfNeeded();await dark.page.screenshot({path:output+'/relationship-phone.png',fullPage:true});}await dark.context.close();await light.context.close();console.log('Passed ship sites '+mode+' at '+width+' with persistent HTTP/service/SQLite commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
