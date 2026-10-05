// Shared browser harness: controlled fixture setup, then real HTTP/service/SQLite transitions.
// Playwright 1.62.1 uses its pinned Chromium 1234 browser; no production API is mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {rules,runtime} from './prisoner-fixture.mjs';

export const widths=key=>[[1440,1000],[834,1112],[390,844]].filter(([width])=>!process.env[key]||process.env[key].split(',').includes(String(width)));
export async function browserHarness(name){
 const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
 const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
 const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
 const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),errors=[];
 const output='/private/tmp/swccg-'+name+'-browser';fs.mkdirSync(output,{recursive:true});
 async function seed(start,width,height){
  const decks=['light','dark'].map(side=>({side,cards:Object.values(start.cards).filter(c=>c.owner===side).map(c=>c.blueprint)}));
  assert.ok(decks.every(d=>d.cards.length===60),'Each fixture must preserve a complete 60-card deck.');
  const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks[0].cards});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[1].cards});
  start=structuredClone(start);start.id=v.id;
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const prompt=()=>{const p=runtime.prompt(read(),rules,'light');return runtime.prompt(read(),rules,p.side);};
  const ids=()=>prompt().choices.map(c=>c.id),clients={};
  for(const [side,actor]of [['light','owner'],['dark','guest']]){
   const context=await browser.newContext({viewport:{width,height}});
   await context.route('**/api/matches**',async route=>{
    const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData();
    const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
    const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})}),responseBody=await response.text();
    if(response.status>=400)errors.push('HTTP '+response.status+' '+responseBody);
    await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});
   });
   const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',message=>{if(message.type()==='error')console.error(side+' browser console: '+message.text());});
   clients[side]={context,page};
  }
  async function show(side,actions=false){
   const {page}=clients[side];await page.goto((process.env.NATIVE_UI_ORIGIN||'http://localhost:5173')+'/matches/'+v.id+'?progress-report');
   try{await page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(error){console.error(await page.locator('body').innerText());fs.writeFileSync(path.join(output,'failed-'+width+'-'+side+'-state.json'),JSON.stringify(read(),null,2));await page.screenshot({path:path.join(output,'failed-'+width+'-'+side+'.png'),fullPage:true});throw error;}
   const pause=page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();
   if(width<640&&actions)await page.getByRole('button',{name:'Actions',exact:false}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,side+' viewport overflow at '+width);
   return page;
  }
  async function refresh(){const before=read();for(const side of ['dark','light'])await show(side);assert.deepEqual(read(),before,'Both-seat refresh must preserve pending choices and exact persisted state.');}
  async function choose(choice){
   const before=read(),p=prompt(),label=p.choices.find(c=>c.id===choice)?.label;assert.ok(label,'Missing choice '+choice);
   const page=await show(p.side,true);
   // Copies of the same card have the same human-readable label. The UI maps
   // prompt choices in order, so use the matching occurrence of that label.
   const occurrence=p.choices.slice(0,p.choices.findIndex(c=>c.id===choice)).filter(c=>c.label===label).length;
   const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),page.getByRole('button',{name:label,exact:true}).nth(occurrence).click()]);
   assert.equal(response.status(),200);
   assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));
  }
  async function advance(done,select){
   for(let n=0;n<300&&!done(read());n++){
    const before=read(),p=prompt(),options=p.choices.map(c=>c.id),choice=select?.(before,options)??(options.includes('pass')?'pass':options.includes('skip-destiny')?'skip-destiny':options[0]);
    await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});
    assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));
   }
   assert.ok(done(read()),'Did not reach requested service boundary.');
  }
  async function screenshot(file,side=prompt().side,actions=true){const page=await show(side,actions);await page.screenshot({path:path.join(output,file),fullPage:true});return page;}
  return {read,prompt,ids,show,refresh,choose,advance,screenshot,clients,close:async()=>{for(const c of Object.values(clients))await c.context.close();}};
 }
 return {seed,output,close:async()=>{await browser.close();db.close();assert.deepEqual(errors,[]);}};
}
