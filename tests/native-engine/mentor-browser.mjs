// Playwright 1.62.1 / Chromium 1234, real match HTTP handlers and SQLite D1.
// The starting board is a component fixture; production admission stays closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {mentorFixture,play} from './mentor-fixture.mjs';
import {load,rules,runtime,pull,ids,state} from './vessels-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),errors=[];
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-mentor-browser';fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['search','failed-search','tie','eye'])for(const width of [1440,834,390]){
 const f=mentorFixture(mode==='failed-search'?'search':mode),side=f.side,decks={};if(mode==='failed-search')state.moveCard(f.m,f.saber,'hand');
 for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks[side]});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[side==='light'?'dark':'light']});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'light').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async(id,c=owner)=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice);const rev=read().revision;await c.page.getByRole('button',{name:choice.label,exact:true}).first().click();await c.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<300;n++){const m=read();if(predicate(m))return;const p=prompt(m),choice=p.choices.find(c=>c.id==='skip-destiny')?.id??p.choices.find(c=>c.id==='pass')?.id??(p.mandatory&&p.choices.length===1?p.choices[0].id:null);assert.ok(choice,JSON.stringify(p));await fresh().command(v.id,p.side===side?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice});}throw Error('Missing continuation');};
 const card=f[mode==='eye'?'eye':mode==='tie'?'cocky':'gift'];await show(owner);await click(play(f));const pending=read();await show(owner);assert.deepEqual(read(),pending,'Refresh preserves pending Interrupt');
 if(mode.includes('search')){
  await advance(m=>m.stack.at(-1)?.handler==='mentor:choose');await show(owner);await show(guest);await owner.page.getByRole('region',{name:'Lightsaber search',exact:true}).waitFor();assert.equal(await guest.page.getByRole('region',{name:'Lightsaber search',exact:true}).count(),0);
  const searching=read();await show(owner);assert.deepEqual(read(),searching);await owner.page.screenshot({path:output+'/'+mode+'-'+width+'.png',fullPage:true});
  await click(mode==='search'?'mentor:take:'+f.saber:'mentor:not-found');
  if(mode==='failed-search'){await show(guest);await guest.page.getByRole('heading',{name:'Verify the search',exact:true}).waitFor();const verifying=read();await show(guest);assert.deepEqual(read(),verifying);await click('mentor:verified',guest);}
 }
 await advance(m=>m.cards[card].zone==='lost');await show(owner);if(mode==='search')assert.equal(read().cards[f.saber].zone,'hand');if(mode==='failed-search')assert.equal(read().data.failedSearches.length,1);if(mode==='tie'){assert.equal(read().cards[f.tie].zone,'lost');assert.equal(read().cards[f.secondTie].zone,'table');}if(mode==='eye'){await advance(m=>m.data.battle.totalsReady);assert.equal(read().data.battle.power.dark,modPower(read(),f.vader)+1);await show(owner);await owner.page.screenshot({path:output+'/'+mode+'-'+width+'.png',fullPage:true});}
 assert.equal(await owner.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await owner.context.close();await guest.context.close();console.log('Passed '+mode+' play and recovery: '+width);
}assert.deepEqual(errors,[]);}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-2500));throw e;}finally{await browser.close();db.close();}
function modPower(m,id){return load(new URL('../../lib/native-engine/board.ts',import.meta.url)).power(m,id);}
