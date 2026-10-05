// Playwright 1.62.1 / Chromium1234, actual HTTP handler/service/SQLite D1.
// Controlled Death Star setup; all Interrupt and ordering choices traverse real UI/HTTP/service.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {mod,pull,phase,ids,rules,state} from './prisoner-fixture.mjs';
import {fixture} from './retract-bridge-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-retract-bridge-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.BRIDGE_MODES?.split(',')??['paid','free','skywalker-cancel','edge-cancel']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]].filter(([width])=>!process.env.BRIDGE_WIDTHS||process.env.BRIDGE_WIDTHS.split(',').includes(String(width)))){
 const f=fixture();let start=f.m;
 if(mode==='free'){state.moveCard(start,f.trooper,'table');start.cards[f.trooper].location=f.core;}
 const originalSites=[...start.locations],originalLocation=start.cards[f.hero].location,forceBefore=start.players.dark.force.length;
 const ds=['light','dark'].map(side=>({side,cards:Object.values(start.cards).filter(c=>c.owner===side).map(c=>c.blueprint)}));assert.ok(ds.every(d=>d.cards.length===60));
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 start=structuredClone(start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light])assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<200&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 const decision=m=>m.stack.at(-1)?.handler==='retract:order';
 const choiceWith=prefix=>ids(read()).find(id=>id.startsWith(prefix));
 await refresh();
 if(mode==='edge-cancel'){
  if(runtime.prompt(read(),rules,'dark').side!=='light')await choose('pass');
  await choose(choiceWith('edge:play:'));await choose(ids(read())[0]);
  await advance(m=>ids(m).some(id=>id.startsWith('retract:play:'+f.card+':cancel:')));await refresh();
  await choose(choiceWith('retract:play:'+f.card+':cancel:'));await refresh();await advance(m=>m.cards[f.edge].zone==='lost'&&m.cards[f.card].zone==='lost');
  assert.equal(read().players.light.destiny.length,0);assert.deepEqual(read().locations,originalSites);assert.equal(read().players.dark.force.length,forceBefore);
 }else{
  await choose('retract:play:'+f.card+':rearrange');await refresh();
  if(mode==='skywalker-cancel'){
   await advance(m=>ids(m).some(id=>id.startsWith('scomp:play:'+f.sky+':cancel:')));await refresh();await choose(choiceWith('scomp:play:'+f.sky+':cancel:'));await refresh();await advance(m=>m.cards[f.card].zone==='lost'&&m.cards[f.sky].zone==='lost');
   assert.deepEqual(read().locations,originalSites);assert.equal(read().cards[f.sky].zone,'lost');assert.equal(read().players.dark.force.length,forceBefore-3);
  }else{
   await advance(decision);assert.equal(read().players.dark.force.length,forceBefore-(mode==='free'?0:3));await refresh();
   await choose('retract:site:'+f.corridor);await refresh();assert.deepEqual(read().stack.at(-1).payload.order,[f.corridor]);assert.ok(!ids(read()).includes('retract:site:'+f.bay));
   if(width===390){await show(dark,true);await dark.page.locator('.native-choices').screenshot({path:output+'/'+mode+'-remaining-choice-phone.png'});}
   await choose('retract:site:'+f.core);await refresh();assert.deepEqual(read().stack.at(-1).payload.order,[f.corridor,f.core]);
   await choose('retract:site:'+f.bay);assert.deepEqual(read().locations,[f.corridor,f.core,f.bay]);assert.equal(read().cards[f.card].zone,'lost');
   if(mode==='free')assert.equal(read().cards[f.trooper].location,f.core);
  }
 }
 assert.equal(read().cards[f.hero].location,originalLocation);await refresh();
 if(mode==='paid'){const titles=await dark.page.locator('.native-site h3').allTextContents();assert.deepEqual(titles,['Death Star: Detention Block Corridor','Death Star: Central Core','Death Star: Docking Bay 327']);}
 await dark.context.close();await light.context.close();console.log('Passed Retract The Bridge '+mode+' at '+width+' with persistent HTTP/service/SQLite commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
