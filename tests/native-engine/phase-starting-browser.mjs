// Playwright 1.62.1 / Chromium 1234. Normal create/join and actual HTTP/service
// writes to SQLite D1; test admission only, no prepared-state SQL injection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {rules,decks,runtime,flowClient,firstLightBattle} from './phase-starting-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',db=new SqliteD1(),browser=await chromium.launch({headless:true}),errors=[],output='/private/tmp/swccg-phase-start-browser';fs.mkdirSync(output,{recursive:true});
try{for(const branch of ['dark','light','three','mixed','flow-none','flow-light','flow-both'])for(const [width,height] of [[1440,1000],[834,1112],[390,844]]){
 if(process.env.NATIVE_FLOW_ONLY&&!branch.startsWith('flow-'))continue;
 if(process.env.NATIVE_BRANCH&&branch!==process.env.NATIVE_BRANCH||process.env.NATIVE_WIDTH&&width!==Number(process.env.NATIVE_WIDTH))continue;
 const ds=decks({first:branch==='light'?'light':'dark',three:branch==='three'||branch==='mixed',immune:branch==='mixed'}),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>42}),handlers=matchHandlers(fresh);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
 const command=async(side,choice)=>fresh().command(v.id,side==='light'?'owner':'guest',{commandId:randomUUID(),revision:read().revision,choice});
 const clients={};for(const side of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':side==='light'?'owner':'guest','oai-authenticated-user-email':side+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id:v.id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  const page=await context.newPage();await page.clock.install({time:new Date(1800000000000)});await page.clock.pauseAt(new Date(1800000000000));page.on('pageerror',e=>errors.push(e.message));clients[side]={page,context};
 }
 const show=async side=>{const page=clients[side].page;await page.goto(origin+'/matches/'+v.id+'?progress-report');try{await page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();}catch(e){console.log('RECOVERY',branch,width,side,read().revision,await page.locator('body').innerText());await page.screenshot({path:'/private/tmp/swccg-effect-start-failure.png',fullPage:true});throw e;}if(width<640)await page.getByRole('button',{name:'Actions',exact:false}).click();};
 const refreshBoth=async()=>{const saved=read();for(const s of ['dark','light'])await show(s);assert.deepEqual(read(),saved,'Refresh cannot repeat a setup result');};
 const click=async(side,label)=>{const page=clients[side].page;await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),page.getByRole('button',{name:label,exact:true}).first().click()]);};
 for(const side of ['light','dark'])await command(side,'select:'+side+'-1');await command('dark','reveal');let p=runtime.prompt(read(),rules,'light');if(!p.choices.length)p=runtime.prompt(read(),rules,'dark');await command(p.side,p.choices[0].id);
 await show('light');await click('light',branch==='three'||branch==='mixed'?'Heading For The Medical Frigate':'The Signal');await refreshBoth();assert.equal(await clients.dark.page.getByText('The Signal',{exact:true}).count(),0);
 await click('dark',branch==='three'||branch==='mixed'?'Prepared Defenses':"Twi'lek Advisor");await show('dark');await click('dark','Reveal Starting Interrupts together');
 const observed=new Set();
 for(let n=0;n<150&&read().status==='setup';n++){
  const m=read(),p0=runtime.prompt(m,rules,'dark'),p=runtime.prompt(m,rules,p0.side),choice=p.choices.find(c=>c.id==='pass')??p.choices[0],top=m.stack.at(-1);
  if(top?.handler==='prep-start:choose'||top?.handler==='prep-start:verify'){
   if(branch==='three'||branch==='mixed')assert.ok(!p.choices.some(c=>c.id==='prep-start:deploy:'+p.side+'-3'||c.id==='prep-start:deploy:'+p.side+'-4'));else if(top.handler==='prep-start:choose')assert.ok(p.choices.some(c=>c.id==='prep-start:deploy:'+p.side+'-3'));
   const key=top.handler+':'+p.side;observed.add(key);await refreshBoth();const own=await fresh().read(v.id,p.side==='light'?'owner':'guest'),other=p.side==='light'?'dark':'light',hidden=await fresh().read(v.id,other==='light'?'owner':'guest');
   assert.ok(own.game.rules.startingSearch.cards.length>0);assert.deepEqual(hidden.game.rules.startingSearch.cards,[]);
   assert.equal(await clients[other].page.getByText(/Inspect the Reserve Deck/).count(),0);
   const page=clients[p.side].page;await page.getByRole('region',{name:'Starting Effect search'}).getByText(/Inspect the Reserve Deck/).click();
   if(width===390){await page.getByRole('region',{name:'Starting Effect search'}).getByText(/Inspect the Reserve Deck/).click();await page.getByRole('button',{name:choice.label,exact:true}).first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,branch+'-'+top.handler.split(':')[1]+'-'+p.side+'.png'),fullPage:true});}
   await click(p.side,choice.label);
  }else if(choice.id.startsWith('prep-start:begin:')||choice.id==='begin'){
   await show(p.side);await click(p.side,choice.label);
  }else if(top?.kind==='window'&&m.cards['dark-3']?.zone==='playing'&&!observed.has('pending-deploy')){
   observed.add('pending-deploy');await refreshBoth();await command(p.side,choice.id);
  }else await command(p.side,choice.id);
 }
 assert.equal(read().status,'playing');assert.equal(read().turn.side,branch==='light'?'light':'dark');await refreshBoth();
 if(branch.startsWith('flow-')){
  const mode=branch.slice(5),client=flowClient(mode),lost=read().players.light.lost.length;let pendingLoss=false,pendingDeploy=false;
  for(let n=0;n<700&&!firstLightBattle(read());n++){
   const m=read(),p0=runtime.prompt(m,rules,'dark'),p=runtime.prompt(m,rules,p0.side),c=client.choose(m,p),top=m.stack.at(-1);
   if(top?.handler==='ground:force-loss'){
    pendingLoss=true;assert.equal(m.turn.phase,'deploy');await refreshBoth();
    await click(p.side,c.label);
    if(width===390)await clients[p.side].page.screenshot({path:path.join(output,branch+'-loss.png'),fullPage:true});
   }else if(c.id.startsWith('deploy:')||c.id==='core:activate'){
    await show(p.side);await click(p.side,c.label);await refreshBoth();pendingDeploy ||= c.id.startsWith('deploy:');
   }else await command(p.side,c.id);
  }
  assert.ok(firstLightBattle(read()));assert.equal(read().players.light.lost.length-lost,mode==='none'?2:0);
  assert.equal(read().cards['dark-3'].zone==='lost',mode==='light');
  assert.equal(pendingLoss,mode==='none');assert.equal(pendingDeploy,mode!=='none');await refreshBoth();
 }

 for(const side of ['light','dark']){assert.ok(observed.has('prep-start:choose:'+side));if(!branch.startsWith('flow-'))assert.equal(read().players[side].hand.length,8);assert.equal(read().cards[side+'-2'].zone,'lost');if(branch==='dark'||branch==='light'||branch.startsWith('flow-'))assert.equal(read().cards[side+'-3'].zone,branch==='flow-light'&&side==='dark'?'lost':'table');else if(branch==='mixed')assert.equal(read().cards[side+'-5'].zone,'table');else assert.ok(observed.has('prep-start:verify:'+side));assert.equal(await clients[side].page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await clients[side].context.close();}
 console.log('Passed '+branch+' at '+width+'; private search, actual setup/phase actions and both-seat refresh.');
 }assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
