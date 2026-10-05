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
import {fixture,shipDecks,ending} from './captured-ships-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-captured-ships-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.SHIP_BROWSER_MODES?.split(',')??['crew','launch','escape','empty','tractor']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
 const f=fixture(mode==='empty'?0:2,{capture:mode!=='tractor'});let start=f.m;
 if(mode==='tractor'){pull(f.m,'light','1_147','table',f.site);start=ending(f);const destiny=start.players.dark.reserve.find(id=>start.cards[id].blueprint==='1_241');start.players.dark.reserve.splice(start.players.dark.reserve.indexOf(destiny),1);start.players.dark.reserve.unshift(destiny);}
 else if(mode==='crew')start=seek(start,m=>ids(m).some(id=>id.startsWith('prisoner:ship-play:')));
 else if(mode==='empty')start=seek(start,m=>m.stack.at(-1)?.handler==='captured-ship:steal'&&m.stack.at(-1)?.kind==='decision');
 else {mod('table').loseFromTable(start,[f.beam]);start=seek(start,m=>m.stack.at(-1)?.handler==='captured-ship:release');}
 const ds=shipDecks(),v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 start=structuredClone(start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light])assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<120&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 await refresh();if(mode!=='tractor')await dark.page.getByRole('region',{name:'Captured ship Corellian Corvette'}).waitFor();
 if(width===390){await dark.page.screenshot({path:output+'/'+mode+'-phone.png',fullPage:true});if(mode!=='tractor')await dark.page.getByRole('region',{name:'Captured ship Corellian Corvette'}).screenshot({path:output+'/'+mode+'-group-phone.png'});}
 if(mode==='tractor'){await choose('tractor:use:'+f.beam+':'+f.host);await advance(m=>m.stack.at(-1)?.handler==='tractor:target');await refresh();await choose('tractor:target:'+f.ship);await advance(m=>!!m.cards[f.ship].capturedShip);}
 else if(mode==='crew'){
  await choose(ids(read()).find(id=>id.startsWith('prisoner:ship-play:')));
  for(const [i,id]of f.characters.entries()){
   await advance(m=>m.stack.at(-1)?.handler==='prisoner:ship-order');await refresh();await choose('prisoner:ship-character:'+id);
   await advance(m=>m.stack.at(-1)?.handler==='prisoner:ship-destination');await refresh();await choose(i===0?'prisoner:escort:'+f.escort:'prisoner:escape');
  }
  await advance(m=>m.stack.at(-1)?.handler==='captured-ship:steal'&&m.stack.at(-1)?.kind==='decision');await refresh();await choose('captured-ship:launch:'+f.site);await advance(m=>m.cards[f.card].zone==='lost');assert.equal(read().cards[f.ship].owner,'dark');
 }else {await choose('captured-ship:'+(mode==='escape'?'escape':'launch:'+f.site));if(mode==='escape')await advance(m=>!m.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));}
 await refresh();const result=read();assert.equal(result.cards[f.ship].zone,mode==='escape'?'used':mode==='tractor'?'inactive':'table');assert.equal(result.cards[f.ship].owner,['crew','empty'].includes(mode)?'dark':'light');await dark.context.close();await light.context.close();console.log('Passed captured ship '+mode+' at '+width+' through real persistent service commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
