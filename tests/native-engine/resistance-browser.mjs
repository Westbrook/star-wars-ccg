// Playwright 1.62.1 / Chromium 1234; prepared component boards, real HTTP/service/SQLite D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {fixture,loss,payment,ordinary,rules,runtime} from './resistance-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),db=new SqliteD1(),fresh=()=>mod('service').nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=mod('http').matchHandlers(fresh),errors=[];
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const side of ['dark','light'])for(const width of [1440,834,390]){
 const f=fixture({side,count:3}),decks={};for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks[side]});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[side==='dark'?'light':'dark']});f.m=payment(loss(f));f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'dark').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const refresh=async()=>{const m=read();await show(owner);await show(guest);assert.deepEqual(read(),m);};
 const click=async id=>{const m=read(),p=prompt(m),c=p.side===side?owner:guest,label=p.choices.find(c=>c.id===id)?.label;assert.ok(label);await show(c);await c.page.getByRole('button',{name:label,exact:true}).nth(p.choices.filter(c=>c.label===label).findIndex(c=>c.id===id)).click();await c.page.getByText('Saved · move '+(m.revision+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<150;n++){const m=read();if(predicate(m))return;const p=prompt(m),c=p.choices.find(c=>c.id==='pass')??(p.mandatory?p.choices[0]:undefined);assert.ok(c,JSON.stringify(p));await fresh().command(v.id,p.side===side?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:c.id});}throw Error('Missing continuation');};
 await refresh();const panel=owner.page.getByRole('region',{name:'Force loss'});await panel.getByText('Current limit: 2 Force for this Force drain.',{exact:true}).waitFor();await panel.getByRole('heading',{name:(side==='dark'?'Dark side':'Light side')+' · 2 Force remaining',exact:true}).waitFor();
 const before=read().players[side].lost.length,paying=m=>m.stack.at(-1)?.handler==='ground:force-loss';
 await click('lose:reserve');await advance(paying);await refresh();assert.equal(read().stack.at(-1).payload.remaining,1);await owner.page.getByRole('region',{name:'Force loss'}).getByText('4 before modifiers · 1 paid',{exact:true}).waitFor();
 if(width===390)await owner.page.screenshot({path:'/private/tmp/swccg-resistance-'+side+'-phone.png',fullPage:true});
 await click('lose:reserve');await advance(ordinary);await refresh();assert.equal(read().players[side].lost.length-before,2);assert.equal(await owner.page.getByRole('region',{name:'Force loss'}).count(),0);

 for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();}console.log('Passed '+side+' at '+width);
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
