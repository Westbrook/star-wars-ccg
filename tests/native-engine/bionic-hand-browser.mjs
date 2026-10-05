// Playwright 1.62.1 / Chromium 1234. Component board, real HTTP/service/SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {handReady,rearmed,totalReady,attach,boundary,priority,step,finish} from './bionic-hand-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
import {rules,runtime,state} from './noble-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),db=new SqliteD1(),fresh=()=>mod('service').nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=mod('http').matchHandlers(fresh),errors=[];
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['rearm','disarm-again','total'])for(const width of [1440,834,390]){
 const f=mode==='rearm'?handReady():mode==='total'?totalReady('saber'):rearmed();if(mode==='disarm-again'){f.m=finish(step(f.m,'equip:'+f.spare+':'+f.target));f.m.turn.phase='control';f.m.turn.side='dark';f.m.stack[0].priority='dark';}const decks={};for(const side of ['light','dark'])decks[side]=Object.values(f.m.cards).filter(c=>c.owner===side).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.light});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.dark});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'dark').side);
 const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async(id,c)=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice,id);const rev=read().revision;const labels=p.choices.filter(x=>x.label===choice.label);await c.page.getByRole('button',{name:choice.label,exact:true}).nth(labels.findIndex(x=>x.id===id)).click();await c.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<150;n++){const m=read();if(predicate(m))return;const p=prompt(m),choice=p.choices.find(c=>c.id==='pass')?.id??(p.mandatory?p.choices[0]?.id:undefined);assert.ok(choice,JSON.stringify(p));await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice});}throw Error('Missing continuation');};
 const actor=mode==='disarm-again'?guest:owner;
 await show(actor);const initial=read();await show(actor);assert.deepEqual(read(),initial);
 if(mode==='rearm'){
  await click(attach(f),owner);const pending=read();await show(owner);assert.deepEqual(read(),pending);await advance(m=>m.stack.length===1);assert.equal(mod('disarmed-state').isDisarmed(read(),f.target),false);assert.equal(read().cards[f.card].zone,'lost');assert.equal(read().cards[f.hand].zone,'table');
 }else if(mode==='disarm-again'){
  await click('disarm:deploy:'+f.second+':'+f.target,guest);await advance(m=>m.stack.at(-1)?.event?.kind==='about-to-lose'&&m.stack.at(-1).event.card===f.hand);const pending=read();await show(owner);assert.deepEqual(read(),pending);await advance(m=>m.stack.length===1);assert.equal(read().cards[f.hand].zone,'lost');assert.equal(mod('disarmed-state').isDisarmed(read(),f.target),true);
 }else{
  const panel=owner.page.getByRole('region',{name:'Weapon destiny total'});await panel.waitFor();assert.match(await panel.innerText(),/Draws 3 \+ 3 · Total modifier \+1 · Total 7/);if(width===390)await owner.page.screenshot({path:'/private/tmp/swccg-bionic-total-phone.png',fullPage:true});await advance(m=>m.stack.at(-1)?.event?.kind==='weapon-fired');assert.equal(read().data.battle.saberShots[0].total,7);
 }
 const final=read();await show(owner);await show(guest);if(mode==='disarm-again'){assert.equal(await owner.page.getByText('DISARMED',{exact:true}).count(),1);if(width===390){await owner.page.getByRole('button',{name:'Table',exact:true}).click();await owner.page.getByText('DISARMED',{exact:true}).waitFor();await owner.page.screenshot({path:'/private/tmp/swccg-bionic-disarmed-phone.png',fullPage:true});}}assert.deepEqual(read(),final,'Both seats reload the exact resolved result');for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();}console.log('Passed '+mode+' at '+width);
}assert.deepEqual(errors,[]);}finally{await browser.close();db.close();}
