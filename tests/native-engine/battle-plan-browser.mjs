// Playwright 1.62.1 / Chromium 1234; prepared component boards, real HTTP/service/SQLite D1.
// Freeze the UI clock to isolate refresh from the separately tested automatic pass timer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {fixture,ordinary,rules,runtime} from './battle-plan-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),db=new SqliteD1(),fresh=()=>mod('service').nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=mod('http').matchHandlers(fresh),errors=[];
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();await page.clock.install({time:1800000000000});await page.clock.pauseAt(1800000000000);page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['drain','battle-free','battle-paid'])for(const side of ['dark','light'])for(const width of [1440,834,390]){
 if(process.env.NATIVE_UI_CASE&&process.env.NATIVE_UI_CASE!==mode+':'+side+':'+width)continue;
 const f=fixture({side,plan:true,order:true,battle:mode!=='drain',amount:4}),decks={};for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks[side]});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[side==='dark'?'light':'dark']});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'dark').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const refresh=async()=>{const m=read();await show(owner);await show(guest);assert.deepEqual(read(),m);};
 const click=async id=>{const m=read(),p=prompt(m),c=p.side===side?owner:guest,label=p.choices.find(c=>c.id===id)?.label;assert.ok(label);await show(c);await c.page.getByRole('button',{name:label,exact:true}).nth(p.choices.filter(c=>c.label===label).findIndex(c=>c.id===id)).click();await c.page.getByText('Saved · move '+(m.revision+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<150;n++){const m=read();if(predicate(m))return;const p=prompt(m),c=p.choices.find(c=>c.id==='pass')??(p.mandatory?p.choices[0]:undefined);assert.ok(c,JSON.stringify(p));await fresh().command(v.id,p.side===side?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:c.id});}throw Error('Missing continuation');};
 await refresh();const id=(mode==='drain'?'drain:':mode==='battle-free'?'battle-free:':'battle:')+f.sites[0],before=read().players[side].force.length,used=read().players[side].used.length,cost=mode==='drain'?3:mode==='battle-free'?0:1;
 const label=prompt(read()).choices.find(c=>c.id===id)?.label;assert.ok(label);assert.ok(label.includes(cost?'use '+cost+' Force':'free'));if(width===390){const button=owner.page.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox(),reportBox=await owner.page.getByRole('link',{name:'Progress Report ↗',exact:true}).boundingBox();assert.ok(box.y+box.height<=reportBox.y,'Report link must stay below visible action buttons');await owner.page.screenshot({path:'/private/tmp/swccg-plan-choices-'+mode+'-'+side+'.png',fullPage:true});}await click(id);await refresh();
 await advance(m=>m.stack.some(r=>r.kind==='resolution'&&r.action.handler===(mode==='drain'?'ground:drain':'battle:begin')&&!r.awaitingResponses));await refresh();
 assert.equal(read().players[side].force.length,before-cost);assert.equal(read().players[side].used.length-used,cost);
 if(width===390)await owner.page.screenshot({path:'/private/tmp/swccg-plan-'+mode+'-'+side+'-phone.png',fullPage:true});
 await advance(ordinary);await refresh();
 assert.ok(!prompt(read()).choices.some(c=>c.id===id));

 for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);if(width===390&&mode==='battle-free'&&side==='light'){await c.page.goto(origin+'/matches/'+v.id);await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();assert.equal(await c.page.getByRole('link',{name:'Progress Report ↗',exact:true}).count(),0);assert.equal(await c.page.locator('.native-shell').getAttribute('data-progress-report'),null);}await c.context.close();}console.log('Passed '+mode+' '+side+' at '+width);
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
