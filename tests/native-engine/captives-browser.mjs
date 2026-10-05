// Playwright 1.62.1 / Chromium1234, actual HTTP handler/service/SQLite D1.
// Controlled captive states exercise lifecycle continuations; no full-match claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {captiveFixtures,decks,rules} from './captives-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-captives-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const f of captiveFixtures())for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
 const ds=decks(),v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 const start=structuredClone(f.start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),c=await client(width,height,f.side==='light'?'owner':'guest'),other=await client(width,height,f.side==='light'?'guest':'owner');
 async function show(client,actions=false){await client.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await client.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:10000});}catch(e){console.error(await client.page.locator('body').innerText());await client.page.screenshot({path:output+'/failed.png',fullPage:true});throw e;}if(width<640&&actions)await client.page.getByRole('button',{name:'Actions',exact:false}).click();const pause=client.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();}
 await show(c);await c.page.getByRole('region',{name:'Captive Luke Skywalker',exact:true}).waitFor();assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);if(width===390){await c.page.getByRole('region',{name:'Captive Luke Skywalker',exact:true}).scrollIntoViewIfNeeded();}if(width===390)await c.page.screenshot({path:path.join(output,f.id+'-phone.png'),fullPage:true});
 await show(other);await show(c,true);assert.deepEqual(read(),start,'Both-seat refresh preserves the pending choice');const p=runtime.prompt(start,rules,f.side),choice=p.choices.find(c=>c.id===f.choice);assert.ok(choice);
 await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:choice.label,exact:true}).click()]);
 let expected=runtime.applyCommand(start,rules,f.side,{revision:start.revision,choice:f.choice},()=>0,1800000000000);assert.deepEqual(read(),expected);
 // Complete any attachment Lost ordering and response windows with legal commands.
 for(let n=0;n<30&&read().stack.length>1;n++){let p=runtime.prompt(read(),rules,'light');p=runtime.prompt(read(),rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;const before=read();await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});expected=runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000);assert.deepEqual(read(),expected);}
 const result=read();if(f.id==='rally'){assert.equal(result.cards[f.target].zone,'table');assert.equal(result.cards[f.gun].zone,'table');}else if(f.id==='escape'){assert.equal(result.cards[f.target].zone,'used');assert.equal(result.cards[f.gun].zone,'lost');assert.equal(result.cards[f.device].zone,'lost');}else assert.ok(result.cards[f.target].captivity.prison);
 await show(c);await show(other);assert.deepEqual(read(),result,'Completed result survives refresh without repeating release or transfer');await c.context.close();await other.context.close();console.log('Passed '+f.id+' at '+width+' through real persistent service commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
