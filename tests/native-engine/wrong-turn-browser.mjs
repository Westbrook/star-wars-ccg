// Playwright 1.62.1 / Chromium 1234. Component board, real HTTP/service/SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {fixture} from './wrong-turn-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
import {rules,runtime,state} from './noble-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),db=new SqliteD1(),fresh=()=>mod('service').nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=mod('http').matchHandlers(fresh),errors=[];
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['pending','table','countered'])for(const width of [1440,834,390]){
 const f=fixture(),decks={};state.moveCard(f.m,f.second,'reserve');for(const side of ['light','dark'])decks[side]=Object.values(f.m.cards).filter(c=>c.owner===side).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'dark',deckSize:60,deck:decks.dark});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.light});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'dark').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async(id,c)=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice,id);const rev=read().revision;await c.page.getByRole('button',{name:choice.label,exact:true}).first().click();await c.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<150;n++){const m=read();if(predicate(m))return;const p=prompt(m),choice=p.choices.find(c=>c.id==='pass')?.id;assert.ok(choice,JSON.stringify(p));await fresh().command(v.id,p.side==='dark'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice});}throw Error('Missing continuation');};
 await show(owner);await click('deploy-effect:'+f.wrong,owner);const pending=read();await show(owner);assert.deepEqual(read(),pending,'Refresh must preserve the paid deployment');assert.equal(read().players.dark.force.length,9);
 if(mode!=='pending')await advance(m=>m.stack.length===1);
 const prefix='scomp:play:'+f.sky+':'+(mode==='pending'?'cancel':'table')+':';await advance(m=>prompt(m).side==='light'&&prompt(m).choices.some(c=>c.id.startsWith(prefix)));await show(guest);await click(prompt(read()).choices.find(c=>c.id.startsWith(prefix)).id,guest);
 const response=read();await show(guest);assert.deepEqual(read(),response,'Refresh must preserve pending cancellation');
 if(mode==='countered'){const prefix='scomp:play:'+f.boring+':cancel:';await advance(m=>prompt(m).side==='dark'&&prompt(m).choices.some(c=>c.id.startsWith(prefix)));await show(owner);await click(prompt(read()).choices.find(c=>c.id.startsWith(prefix)).id,owner);}
 await advance(m=>m.stack.length===1);assert.equal(read().cards[f.wrong].zone,mode==='countered'?'table':'lost');assert.equal(read().players.dark.force.length,9);assert.equal(mod('deploy-costs').deployValue(read(),f.troop),mode==='countered'?2:1);await show(owner);const final=read();await show(guest);assert.deepEqual(read(),final);
 if(width===390)await guest.page.screenshot({path:'/private/tmp/swccg-wrong-turn-'+mode+'-phone.png',fullPage:true});for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();}console.log('Passed '+mode+' at '+width);
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
