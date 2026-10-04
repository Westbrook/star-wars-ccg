// Playwright 1.62.1 / Chromium 1234. Resume a real, fully replayed 60-card match
// through nativeMatchService + SQLiteD1; only test admission and transport differ.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
import {battleResponseFixtures} from './battle-response-match-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
let clock=1_800_000_000_000;
const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules,now:()=>clock,entropy:seeded(1)}),handlers=matchHandlers(fresh);
const travel=process.env.NATIVE_MATCH_RESPONSES==='travel';
const browser=await chromium.launch({headless:true}),decks=starterDecks(60),fixtures=battleResponseFixtures(travel?[
 ['run-luke','ground-travel-responses','run-luke',true],['escape','ground-travel-responses','escape',true],
]:undefined);
const output=process.env.NATIVE_UI_OUTPUT||'/private/tmp/swccg-native-client-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){
 const context=await browser.newContext({viewport:{width,height}});
 await context.route('**/api/matches**',async route=>{
  const req=route.request(),url=new URL(req.url()),id=url.pathname.split('/')[3],body=req.postData();
  const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});
  await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
}
try{
 for(const fixture of fixtures)for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.find(d=>d.side==='light').cards});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const initial=structuredClone(fixture.start);initial.id=v.id;
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(initial),initial.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const prompt=m=>runtime.prompt(m,auditRules,runtime.prompt(m,auditRules,'light').side);
  const first=fixture.commands[0],actor=first.side==='light'?'owner':'guest',c=await client(width,height,actor);
  const show=async()=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();};
  await show();clock=first.time;
  const clickChoice=async command=>{
   const p=prompt(read()),choice=p.choices.find(x=>x.id===command.choice);assert.ok(choice);
   const index=p.choices.filter(x=>x.label===choice.label).findIndex(x=>x.id===command.choice);
   await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:choice.label,exact:true}).nth(index).click()]);
  };
  await clickChoice(first);
  assert.equal(read().revision,first.revision+1);assert.equal(read().cards[fixture.card].zone,'playing');
  const pending=read();await c.page.reload();await c.page.getByText('Saved · move '+pending.revision,{exact:true}).waitFor();
  assert.deepEqual(read(),pending,'Refresh cannot repeat play, payment or change the pending action');
  // Continue the real recorded command sequence through fresh service instances.
  // The client adapter supplies no replacement state or corrections.
  for(const command of fixture.commands.slice(1)){
   clock=command.time;const m=read(),p=prompt(m);assert.equal(m.revision,command.revision);assert.equal(p.side,command.side);
   assert.ok(p.choices.some(x=>x.id===command.choice));
   if(travel&&command.choice.startsWith('away:')){await show();await clickChoice(command);}
   else await fresh().command(v.id,command.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:command.revision,choice:command.choice});
  }
  const expected=structuredClone(fixture.end);expected.id=v.id;
  assert.deepEqual(read(),expected,'Service must produce the exact full-match checkpoint');
  await show();assert.deepEqual(read(),expected,'Final refresh preserves the resolved checkpoint');
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.screenshot({path:path.join(output,'battle-response-'+fixture.id+'-'+width+'.png')});
  await c.context.close();console.log('Passed '+fixture.id+' at '+width+' through '+fixture.commands.length+' real service commands.');
 }
 assert.deepEqual(errors,[]);
 console.log('Passed: '+(travel?'Run Luke and complete Narrow Escape movement':'successful/failed Stun, Dice and Takeel')+' from actual complete matches, pending and resolved refresh, exact service state at 1440/834/390.');
}finally{await browser.close();db.close();}
