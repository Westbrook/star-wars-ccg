// Playwright 1.62.1 / Chromium 1234. Component board, real HTTP/service/SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {fixture,choice} from './obi-wan-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
import {rules,runtime,state} from './noble-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),db=new SqliteD1(),fresh=()=>mod('service').nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=mod('http').matchHandlers(fresh),errors=[];
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['move','lose','guard'])for(const width of [1440,834,390]){
 const f=fixture(mode),decks={};for(const side of ['light','dark'])decks[side]=Object.values(f.m.cards).filter(c=>c.owner===side).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.light});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.dark});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'dark').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async(id,c)=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice,id);const rev=read().revision;const labels=p.choices.filter(x=>x.label===choice.label);await c.page.getByRole('button',{name:choice.label,exact:true}).nth(labels.findIndex(x=>x.id===id)).click();await c.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<150;n++){const m=read();if(predicate(m))return;const p=prompt(m),choice=p.choices.find(c=>c.id==='pass')?.id;assert.ok(choice,JSON.stringify(p));await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice});}throw Error('Missing continuation');};
 await show(owner);await click(choice(f),owner);const pending=read();await show(owner);assert.deepEqual(read(),pending,'Refresh preserves the paid reaction');assert.equal(read().players.light.force.length,f.m.players.light.force.length-1);
 if(mode!=='guard'){
  await advance(m=>m.stack.at(-1)?.handler==='obi:choose');await show(guest);const offered=read();await show(guest);assert.deepEqual(read(),offered,'Refresh preserves the opponents movement-or-loss choice');
  await click(mode==='lose'?'obi:lose':'obi:move:'+f.adj,guest);const selected=read();await show(guest);assert.deepEqual(read(),selected,'Refresh preserves selected movement or loss response windows');
 }
 await advance(m=>m.stack.at(-1)?.event?.kind===(mode==='move'?'moved':'cards-lost'));
 const final=read();assert.equal(final.cards[f.target].zone,mode==='move'?'table':'lost');if(mode==='move')assert.equal(final.cards[f.target].location,f.adj);assert.equal(final.players.dark.force.length,f.m.players.dark.force.length);assert.equal(final.players.light.force.length,f.m.players.light.force.length-1);
 await show(owner);await show(guest);assert.deepEqual(read(),final,'Both seats reload the same exact result');
 if(width===390)await guest.page.screenshot({path:'/private/tmp/swccg-obi-'+mode+'-phone.png',fullPage:true});for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();}console.log('Passed '+mode+' at '+width);
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
