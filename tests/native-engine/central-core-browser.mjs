// Playwright 1.62.1 / Chromium1234, actual HTTP handler/service/SQLite D1.
// Actual capture commands from controlled battle states; no full-match claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {mod,pull,step,seek,ids,rules} from './prisoner-fixture.mjs';
import {siteFixture,siteDecks,siteBeamEnding,setBeamDestinies,capturedAtSite} from './site-capture-fixture.mjs';
import {coreFixture,coreDecks,coreChoice,takeCore} from './central-core-fixture.mjs';
import {phase} from './prisoner-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-central-core-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.CORE_MODES?.split(',')??['deploy','launch','escape','two-beams','free']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
 const f=coreFixture();let start=f.m;
 if(mode==='deploy')pull(start,'light','1_28','table',f.core);
 else if(mode==='free')pull(start,'dark','1_168','table',f.core);
 else {start=takeCore(f);if(mode==='two-beams'){f.extra=pull(start,'dark','2_111','table',f.bay);start.cards[f.extra].attachedTo=f.bay;}}
 const ds=coreDecks(),v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 start=structuredClone(start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light])assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<120&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 await refresh();
 if(mode==='two-beams'&&width===390){await show(light,true);await light.page.screenshot({path:output+'/two-beams-choice-phone.png',fullPage:true});}
 if(mode==='deploy'){
  const before=read().players.dark.force.length;await choose('tractor:deploy:'+f.beam+':'+f.bay);await refresh();assert.ok(coreChoice(read()));await choose(coreChoice(read()));await advance(m=>m.cards[f.beam].zone==='lost');assert.equal(read().players.dark.force.length,before-2);
 }else if(mode==='free'){
  const before=read().players.dark.force.length;await choose('deploy-effect:'+f.wrong);await refresh();await advance(m=>m.cards[f.wrong].zone==='table');assert.equal(read().players.dark.force.length,before);
 }else{
  await choose(coreChoice(read()));await refresh();await advance(m=>m.cards[f.beam].zone==='lost');
  if(mode==='two-beams'){assert.equal(read().cards[f.ship].capturedShip.pending,undefined);await advance(m=>!!coreChoice(m));await refresh();await choose(coreChoice(read()));}
  await advance(m=>m.stack.at(-1)?.handler==='captured-ship:release');await refresh();
  if(width===390){await show(light,true);await light.page.screenshot({path:output+'/'+mode+'-release-phone.png',fullPage:true});}
  await choose(mode==='escape'?'captured-ship:escape':'captured-ship:launch:'+f.site);
  if(mode==='escape')await advance(m=>!m.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));
  assert.equal(read().cards[f.ship].zone,mode==='escape'?'used':'table');assert.equal(read().cards[f.ship].capturedShip,undefined);
 }
 await refresh();await dark.context.close();await light.context.close();console.log('Passed Central Core '+mode+' at '+width+' with persistent HTTP/service/SQLite commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
