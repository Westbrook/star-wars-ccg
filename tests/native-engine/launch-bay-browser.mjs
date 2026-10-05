// Playwright 1.62.1 / Chromium1234, real HTTP handlers/service/SQLite D1.
// Controlled Launch Bay states; action/transfer choices use the actual match UI.
// The fixture rules admit these scenarios only; this is not full-match coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {mod,pull,phase,ids,rules} from './prisoner-fixture.mjs';
import {launchFixture} from './launch-bay-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-launch-bay-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.LAUNCH_BAY_MODES?.split(',')??['unlimited','docking']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]].filter(([width])=>!process.env.LAUNCH_BAY_WIDTHS||process.env.LAUNCH_BAY_WIDTHS.split(',').includes(String(width)))){
 assert.ok(['unlimited','docking'].includes(mode),mode);
 const f=launchFixture();let start=f.m;
 if(mode==='unlimited')f.tie=pull(start,'dark','1_304','table',f.site);
 else{f.other=pull(start,'dark','1_302','table',f.site);f.resident=pull(start,'dark','1_194','table',f.bay);}
 start=phase(start,'dark','move');
 // Deliberately start with the regular move spent: free repeats must not reset it.
 if(mode==='unlimited')mod('ground').record(start).moved.push(f.tie);
 const forceBefore=start.players.dark.force.length,turnBefore=start.turn.number;
 const ds=['light','dark'].map(side=>({side,cards:Object.values(start.cards).filter(c=>c.owner===side).map(c=>c.blueprint)}));assert.ok(ds.every(d=>d.cards.length===60));
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 start=structuredClone(start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await c.page.getByText('Aboard Imperial-Class Star Destroyer · Below decks',{exact:true}).count(),1);}}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<200&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 await refresh();
 if(mode==='unlimited'){
  for(let repeat=0;repeat<2;repeat++)for(const [method,to]of [['land',f.bay],['takeoff',f.site]]){
   const choice='voyage:'+method+':'+f.tie+':'+to;assert.ok(ids(read()).includes(choice));await choose(choice);await refresh();
   assert.ok(read().stack.some(frame=>frame.kind==='resolution'&&frame.action.handler==='voyage:begin'));
   await advance(m=>m.cards[f.tie].location===to&&m.stack.length===1&&runtime.prompt(m,rules,'dark').side==='dark');
   assert.equal(read().turn.number,turnBefore);assert.equal(read().players.dark.force.length,forceBefore);assert.equal(mod('ground').usage(read()).moved.filter(id=>id===f.tie).length,1);await refresh();
   if(width===390&&repeat===1&&method==='land'){await show(dark,true);await dark.page.locator('.native-choices').screenshot({path:output+'/repeated-takeoff-phone.png'});}
  }
 }else{
  const dock=ids(read()).find(id=>id.startsWith('dock:')&&id.includes(f.other));assert.ok(dock);await choose(dock);await refresh();
  const transfer=m=>m.stack.at(-1)?.handler==='docking:transfer';await advance(transfer);await refresh();
  const outbound='transfer:'+f.resident+':'+f.other+':passenger';assert.ok(ids(read()).includes(outbound));
  if(width===390){await show(dark,true);await dark.page.locator('.native-choices').screenshot({path:output+'/saved-transfer-phone.png'});}
  await choose(outbound);await refresh();await advance(transfer);await refresh();
  assert.equal(read().cards[f.resident].location,f.site);assert.equal(read().cards[f.resident].attachedTo,f.other);assert.equal(read().cards[f.resident].aboardRole,'passenger');assert.equal(read().players.dark.force.length,forceBefore);
  await choose('transfer:'+f.resident+':'+f.bay+':site');await refresh();await advance(transfer);await refresh();
  assert.equal(read().cards[f.resident].location,f.bay);assert.equal(read().cards[f.resident].attachedTo,undefined);assert.equal(read().cards[f.resident].aboardRole,undefined);assert.equal(read().players.dark.force.length,forceBefore);assert.equal(read().turn.number,turnBefore);
 }
 await dark.context.close();await light.context.close();console.log('Passed Launch Bay '+mode+' at '+width+' with persistent HTTP/service/SQLite commands and both-seat refresh.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
