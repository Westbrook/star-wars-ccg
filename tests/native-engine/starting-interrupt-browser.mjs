// Playwright1.62.1/Chromium1234. Actual HTTP handlers and persisted service;
// the no-Effects provider is an explicit protocol-only test adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {rules,decks,runtime} from './starting-interrupt-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',db=new SqliteD1(),browser=await chromium.launch({headless:true}),errors=[],output='/private/tmp/swccg-starting-protocol-browser';fs.mkdirSync(output,{recursive:true});
try{for(const first of ['dark','light','decline'])for(const [width,height] of [[1440,1000],[834,1112],[390,844]]){
 const r=rules({first:first==='light'?'light':'dark'}),ds=decks(first==='light'?'light':'dark'),fresh=()=>nativeMatchService(db,{currentRules:r.id,rules:()=>r,now:()=>1800000000000,entropy:()=>42}),handlers=matchHandlers(fresh);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
 const command=async(side,choice)=>fresh().command(v.id,side==='light'?'owner':'guest',{commandId:randomUUID(),revision:read().revision,choice});
 for(const side of ['light','dark'])await command(side,'select:'+side+'-1');await command('dark','reveal');let p=runtime.prompt(read(),r,'light');if(!p.choices.length)p=runtime.prompt(read(),r,'dark');await command(p.side,p.choices[0].id);
 const clients={};for(const side of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':side==='light'?'owner':'guest','oai-authenticated-user-email':side+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id:v.id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));clients[side]={page,context};
 }
 const show=async side=>{const page=clients[side].page;await page.goto(origin+'/matches/'+v.id+'?progress-report');await page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width<640)await page.getByRole('button',{name:'Actions',exact:false}).click();};
 const click=async(side,label)=>{const page=clients[side].page;await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),page.getByRole('button',{name:label,exact:true}).first().click()]);};
 await show('light');await click('light','Heading For The Medical Frigate');const pending=read();await show('light');assert.deepEqual(read(),pending);await show('dark');assert.equal(await clients.dark.page.getByText('Heading For The Medical Frigate',{exact:true}).count(),0);
 await click('dark',first==='decline'?'No Starting Interrupt':'Prepared Defenses');assert.equal(read().setup.stage,'starting-reveal');await show('dark');await click('dark','Reveal Starting Interrupts together');assert.equal(read().setup.stage,'starting-resolve');await show('dark');await clients.dark.page.getByText('Preparing the table',{exact:true}).waitFor({state:'visible'});await clients.dark.page.getByRole('region',{name:'Starting Interrupts',exact:true}).getByText('Heading For The Medical Frigate',{exact:true}).waitFor({state:'visible'});
 if(width===390){await show(first==='light'?'light':'dark');await clients[first==='light'?'light':'dark'].page.screenshot({path:path.join(output,'reveal-'+first+'-phone.png'),fullPage:true});}
 const order=[...read().setup.interrupts.order];for(const side of order){await show(side);const q=runtime.prompt(read(),r,side);await click(side,q.choices[0].label);const saved=read();await show(side);assert.deepEqual(read(),saved,'Refresh cannot repeat a starting result');}
 assert.equal(read().setup.stage,'shuffle');await show('dark');await click('dark','Shuffle both decks and draw opening hands');assert.equal(read().status,'playing');assert.equal(read().turn.side,first==='light'?'light':'dark');assert.deepEqual(read().data.startingResolutionOrder,order);
 for(const side of ['light','dark']){const saved=read();await show(side);assert.deepEqual(read(),saved);assert.equal(read().players[side].hand.length,8);assert.equal(await clients[side].page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await clients[side].context.close();}
 console.log('Passed '+first+' at '+width+' through actual setup and saved commands.');
 }assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
