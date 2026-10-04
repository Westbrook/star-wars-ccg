// Playwright 1.62.1 / Chromium 1234. Controlled component boards, real service/D1.
// Official-rule vehicle escape; GEMP card-filter discrepancy is documented separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
import {fixture,escapeChoice} from './vehicle-escape-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
let clock=1_800_000_000_000;
const browserRules={...auditRules,supports:()=>true};
assert.equal(load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.supports('1_98'),false);
const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>browserRules,now:()=>clock,entropy:seeded(1)}),handlers=matchHandlers(fresh);
const browser=await chromium.launch({headless:true}),decks=starterDecks(60);
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
 for(const passengerFirst of [false,true])for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
  const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.find(d=>d.side==='light').cards});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const f=fixture(passengerFirst?'escape-passenger':'escape-long'),m=f.m;m.id=v.id;
  m.setup={stage:'complete',selected:{light:f.site,dark:f.remote},committed:{light:true,dark:true},revealed:true,rejected:[],priority:'dark',covered:null};
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const prompt=()=>{const x=read();return runtime.prompt(x,browserRules,runtime.prompt(x,browserRules,'light').side);};
  const command=choice=>fresh().command(v.id,prompt().side==='light'?'owner':'guest',{commandId:randomUUID(),revision:read().revision,choice});
  const advance=async done=>{for(let n=0;n<150;n++){if(done(read()))return;assert.ok(prompt().choices.some(c=>c.id==='pass'));await command('pass');}throw Error('Missing vehicle escape boundary');};
  const c=await client(width,height,'owner');
  const show=async()=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();};
  const click=async name=>{await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'),c.page.getByRole('button',{name,exact:true}).click()]);};
  const choosing=x=>x.stack.at(-1)?.handler==='travel:escape';
  await show();await click('Narrow Escape · target Han Solo and attempt to move your cards with ability away');
  await advance(choosing);await show();
  if(passengerFirst){await click('Disembark and move Luke to Tatooine: Dune Sea · 1 Force');await advance(choosing);await show();}
  await click('Move Snowspeeder to '+(passengerFirst?'Tatooine: Dune Sea':"Tatooine: Lars' Moisture Farm")+' · 1 Force');
  const paid=read();assert.equal(paid.players.light.force.length,0);assert.equal(paid.cards[f.host].location,f.site);await show();assert.deepEqual(read(),paid);
  if(!passengerFirst){await advance(x=>x.cards[f.host].location===f.dune);const midway=read();assert.equal(midway.cards[f.luke].location,f.dune);await show();assert.deepEqual(read(),midway);}
  await advance(x=>x.cards[f.interrupt].zone==='used');const done=read();
  assert.equal(done.cards[f.host].location,f.to);assert.equal(done.cards[f.luke].attachedTo,passengerFirst?undefined:f.host);assert.equal(done.cards[f.gun].location,done.cards[f.luke].location);
  await show();assert.deepEqual(read(),done);assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await c.page.screenshot({path:path.join(output,'vehicle-escape-'+(passengerFirst?'passenger':'vehicle')+'-'+width+'.png')});
  await c.context.close();console.log('Passed '+(passengerFirst?'passenger first':'vehicle first through three sites')+' at '+width);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();db.close();}
