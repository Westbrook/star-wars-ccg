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
import {battleReductionFixture} from './recovery-match-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules,now:()=>1_800_000_000_000,entropy:seeded(1)}),handlers=matchHandlers(fresh);
const browser=await chromium.launch({headless:true}),decks=starterDecks(60),fixture=battleReductionFixture();
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
 for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.find(d=>d.side==='light').cards});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const initial=structuredClone(fixture.m);initial.id=v.id;
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(initial),initial.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const prompt=m=>runtime.prompt(m,auditRules,runtime.prompt(m,auditRules,'light').side);
  const advance=async done=>{for(let n=0;n<100;n++){const m=read();if(done(m))return;const p=prompt(m);assert.ok(p.choices.some(c=>c.id==='pass'),'Only empty response passes should remain');await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'});}throw Error('Missing damage boundary');};
  const light=await client(width,height,'owner'),dark=await client(width,height,'guest');
  const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('THE LIVING TABLE',{exact:true}).waitFor();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();};
  const click=async(c,id)=>{const m=read(),p=prompt(m),choice=p.choices.find(c=>c.id===id);assert.ok(choice,id);const peers=p.choices.filter(c=>c.label===choice.label),index=peers.findIndex(c=>c.id===id);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:choice.label,exact:true}).nth(index).click()]);};
  await show(light);await click(light,'battle-reduce:'+fixture.card+':'+fixture.amount);
  assert.equal(read().cards[fixture.card].zone,'playing');const revision=read().revision;
  await light.page.reload();await light.page.getByText('THE LIVING TABLE',{exact:true}).waitFor();assert.equal(read().revision,revision,'Refresh must not repeat the Interrupt or its cost');
  await advance(m=>m.stack.at(-1)?.event?.kind==='battle-damage');
  assert.equal(read().data.battle.damage.light,4);assert.equal(runtime.prompt(read(),auditRules,'light').side,'light');
  await show(light);await light.page.getByRole('heading',{name:'Your move.',exact:true}).waitFor();
  await show(dark);await dark.page.getByRole('heading',{name:'Your opponent’s move.',exact:true}).waitFor();
  assert.equal(await light.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await light.page.screenshot({path:path.join(output,'recovery-loss-turn-'+width+'.png')});
  await click(light,'forfeit:'+fixture.light);await advance(m=>m.stack.at(-1)?.event?.kind==='battle-damage');
  assert.equal(runtime.prompt(read(),auditRules,'dark').side,'dark');assert.equal(read().cards[fixture.light].zone,'lost');
  await show(dark);await click(dark,'forfeit:'+fixture.dark);await advance(m=>m.stack.at(-1)?.event?.kind==='battle-damage');
  assert.equal(runtime.prompt(read(),auditRules,'light').side,'light');assert.equal(read().cards[fixture.dark].zone,'lost');
  await show(light);await light.page.getByRole('heading',{name:'Your move.',exact:true}).waitFor();
  await light.context.close();await dark.context.close();
 }
 assert.deepEqual(errors,[]);console.log('Passed: real complete-match damage reduction, pending refresh without duplicate cost, Light-first forfeiture and alternating opponent losses at 1440/834/390.');
}finally{await browser.close();db.close();}
