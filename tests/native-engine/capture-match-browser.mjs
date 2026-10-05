// Playwright 1.62.1 / Chromium 1234. Actual UI, HTTP handlers, fresh services and
// SQLiteD1 resume checkpoints reached by a continuous legal complete match.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {captureBrowserFixtures,captureRules} from './capture-match-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const rules=captureRules(),db=new SqliteD1(),browser=await chromium.launch({headless:true}),errors=[];
let clock=1800000000000;
const fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>clock,entropy:()=>{throw Error('Unexpected entropy in captured match continuation');}}),handlers=matchHandlers(fresh);
const output='/private/tmp/swccg-capture-match-browser';fs.mkdirSync(output,{recursive:true});
const sizes=[[1440,1000],[390,844]].filter(([w])=>!process.env.CAPTURE_MATCH_WIDTHS||process.env.CAPTURE_MATCH_WIDTHS.split(',').includes(String(w)));
try{
 for(const fixture of captureBrowserFixtures())for(const [width,height]of sizes){
  const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:fixture.decks.light});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:fixture.decks.dark});
  const initial=structuredClone(fixture.start);initial.id=v.id;
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(initial),initial.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),clients={};
  for(const [side,actor]of [['light','owner'],['dark','guest']]){
   const context=await browser.newContext({viewport:{width,height}});
   await context.route('**/api/matches**',async route=>{
    const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3];
    const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
    const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})}),text=await response.text();
    if(response.status>=400)errors.push('HTTP '+response.status+' '+text);
    await route.fulfill({status:response.status,contentType:'application/json',body:text});
   });
   const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>errors.push(e.message));
   clients[side]={page,context};
  }
  const prompt=()=>runtime.prompt(read(),rules,runtime.prompt(read(),rules,'light').side);
  async function show(side,actions=false){
   const page=clients[side].page;await page.goto((process.env.NATIVE_UI_ORIGIN||'http://localhost:5173')+'/matches/'+v.id+'?progress-report');
   try{await page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(error){fs.writeFileSync(path.join(output,fixture.id+'-'+width+'-failed.json'),JSON.stringify(read()));console.error(await page.locator('body').innerText());throw error;}
   const pause=page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();
   if(width<640&&actions)await page.getByRole('button',{name:'Actions',exact:false}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal overflow');return page;
  }
  async function refresh(){const before=read();for(const side of ['light','dark'])await show(side);assert.deepEqual(read(),before,'Both-seat refresh changed saved custody or pending payment');}
  await refresh();let uiChoices=0;
  for(const command of fixture.commands){
   clock=command.time;const before=read(),p=prompt();assert.equal(before.revision,command.revision);assert.equal(p.side,command.side);assert.ok(!command.entropy?.length);
   const offered=p.choices.find(c=>c.id===command.choice);assert.ok(offered,command.choice);
   // Exercise consequential actions in the UI, including both sides' custody
   // controls. Empty response windows continue through fresh service instances.
   if(!['pass','draw-destiny'].includes(command.choice)){
    const page=await show(p.side,true),occurrence=p.choices.slice(0,p.choices.indexOf(offered)).filter(c=>c.label===offered.label).length;
    await page.screenshot({path:path.join(output,fixture.id+'-'+width+'-choice-'+uiChoices+'.png'),fullPage:true});
    const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),page.getByRole('button',{name:offered.label,exact:true}).nth(occurrence).click()]);assert.equal(response.status(),200);uiChoices++;
    await refresh();
   }else await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:command.revision,choice:command.choice});
   assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:command.revision,choice:command.choice},()=>{throw Error('Unexpected runtime entropy');},clock),'Service differs from continuous legal command result');
  }
  const expected=structuredClone(fixture.end);expected.id=v.id;assert.deepEqual(read(),expected,'Persisted endpoint differs from continuous complete-match checkpoint');
  await refresh();for(const side of ['light','dark']){const page=await show(side);await page.screenshot({path:path.join(output,fixture.id+'-'+width+'-'+side+'-settled.png'),fullPage:true});await clients[side].context.close();}
  console.log('Passed '+fixture.id+' at '+width+': '+fixture.commands.length+' service commands, '+uiChoices+' UI choices, both seats refreshed.');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();db.close();}
