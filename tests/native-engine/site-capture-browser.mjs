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
import {siteFixture,siteDecks,siteBeamEnding,setBeamDestinies,capturedAtSite} from './site-capture-fixture.mjs';
import {phase} from './prisoner-fixture.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs'))),browser=await chromium.launch({headless:true});
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),{nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
const output='/private/tmp/swccg-site-capture-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){const context=await browser.newContext({viewport:{width,height}});await context.route('**/api/matches**',async route=>{const req=route.request(),id=new URL(req.url()).pathname.split('/')[3],body=req.postData(),request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});const responseBody=await response.text();if(response.status>=400)console.error(response.status,responseBody);await route.fulfill({status:response.status,contentType:'application/json',body:responseBody});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});return {context,page};}
try{for(const mode of (process.env.SITE_CAPTURE_MODES?.split(',')??['deploy','capture','crew','guard','convert']))for(const [width,height]of [[1440,1000],[834,1112],[390,844]]){
 const f=siteFixture(mode!=='convert');let start=f.m;
 if(mode==='capture'){start=siteBeamEnding(f);setBeamDestinies(start);}
 else if(mode==='convert'){start=capturedAtSite(f);f.replacement=pull(start,'light','1_124','hand');start=phase(start,'light','deploy');}
 else if(mode==='crew'||mode==='guard'){start=phase(capturedAtSite(f),'light','move');if(mode==='guard')pull(start,'dark','1_168','table',f.bay);}
 const ds=siteDecks(),v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:ds.find(d=>d.side==='light').cards});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:ds.find(d=>d.side==='dark').cards});
 start=structuredClone(start);start.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(start),start.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),dark=await client(width,height,'guest'),light=await client(width,height,'owner');
 async function show(c,actions=false){await c.page.goto(origin+'/matches/'+v.id+'?progress-report');try{await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor({timeout:15000});}catch(e){console.error(await c.page.locator('body').innerText());throw e;}const pause=c.page.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();if(width<640&&actions)await c.page.getByRole('button',{name:'Actions',exact:false}).click();}
 async function refresh(){const before=read();await show(dark);await show(light);assert.deepEqual(read(),before);for(const c of [dark,light])assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function choose(choice){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const c=p.side==='dark'?dark:light;await show(c,true);const label=p.choices.find(x=>x.id===choice)?.label;assert.ok(label,choice);await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:label,exact:true}).click()]);assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}
 async function advance(done){for(let n=0;n<120&&!done(read());n++){const before=read();let p=runtime.prompt(before,rules,'light');p=runtime.prompt(before,rules,p.side);const choice=p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id;await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:before.revision,choice});assert.deepEqual(read(),runtime.applyCommand(before,rules,p.side,{revision:before.revision,choice},()=>0,1800000000000));}assert.ok(done(read()));}
 await refresh();
 if(mode==='deploy'){await choose('tractor:deploy:'+f.beam+':'+f.bay);await advance(m=>m.cards[f.beam].zone==='table');assert.equal(read().cards[f.beam].attachedTo,f.bay);}
 else if(mode==='convert'){
  await choose(ids(read()).find(id=>id.startsWith('site:'+f.replacement+':')));await advance(m=>m.cards[f.replacement].zone==='table');await refresh();assert.equal(read().cards[f.ship].capturedShip.host,f.replacement);assert.equal(read().cards[f.beam].attachedTo,f.replacement);
  await advance(m=>ids(m).includes('vessel:escape:'+f.characters[0]+':'+f.ship));await choose('vessel:escape:'+f.characters[0]+':'+f.ship);await advance(m=>m.cards[f.characters[0]].zone==='table');assert.equal(read().cards[f.characters[0]].location,f.replacement);
 }else if(mode==='capture'){
  await choose('tractor:use:'+f.beam+':'+f.bay);
  await advance(m=>m.stack.at(-1)?.event?.kind==='destiny-drawn');const first=read().stack.at(-1).event.card;await refresh();
  await advance(m=>m.stack.at(-1)?.event?.kind==='destiny-drawn'&&m.stack.at(-1).event.card!==first);assert.ok(read().players.dark.used.includes(first));await refresh();
  await advance(m=>!!m.cards[f.ship].capturedShip);assert.equal(read().cards[f.ship].capturedShip.host,f.bay);
 }else if(mode==='crew'){
  for(const id of f.characters){await advance(m=>ids(m).includes('vessel:escape:'+id+':'+f.ship));await choose('vessel:escape:'+id+':'+f.ship);await advance(m=>m.cards[id].zone==='table');await refresh();}
  await advance(m=>m.stack.at(-1)?.kind==='decision'&&m.stack.at(-1)?.handler==='captured-ship:steal');await refresh();await choose('captured-ship:launch:'+f.site);assert.equal(read().cards[f.ship].owner,'dark');assert.ok(f.characters.every(id=>read().cards[id].location===f.bay));
 }else {assert.ok(!ids(read()).some(id=>id.startsWith('vessel:escape:')));await light.page.getByText('Dark occupies this site · trapped crew cannot disembark',{exact:true}).waitFor();}
 await refresh();if(['capture','guard'].includes(mode))await light.page.getByRole('region',{name:'Captured ship Corellian Corvette'}).screenshot({path:output+'/'+mode+'-group-'+width+'.png'});if(width===390)await light.page.screenshot({path:output+'/'+mode+'-phone.png',fullPage:true});await dark.context.close();await light.context.close();console.log('Passed site capture '+mode+' at '+width+' with persistent HTTP/service/SQLite commands.');
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
