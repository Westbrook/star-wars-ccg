// Playwright 1.62.1 / Chromium 1234, real match HTTP handlers and SQLite D1.
// The starting board is a component fixture; production admission stays closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {battleAdditionFixture,addition} from './battle-interrupts-fixture.mjs';
import {load,rules,runtime,pull,ids} from './vessels-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),errors=[];
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-battle-interrupt-browser';fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['skywalkers','nowhere','leia'])for(const width of [1440,834,390]){
 const side='light',f=battleAdditionFixture(mode),decks={};
 for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks.light});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.dark});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'light').side);
 const show=async()=>{await owner.page.goto(origin+'/matches/'+v.id+'?progress-report');await owner.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await owner.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async id=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice);const rev=read().revision;await owner.page.getByRole('button',{name:choice.label,exact:true}).first().click();await owner.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<300;n++){const m=read();if(predicate(m))return;const p=prompt(m),choice=p.choices.find(c=>c.id==='draw-destiny')?.id??p.choices.find(c=>c.id==='pass')?.id??(p.mandatory?p.choices[0]?.id:null);assert.ok(choice,JSON.stringify(p));await fresh().command(v.id,p.side==='light'?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice});}throw Error('Missing continuation');};
 const card=f[mode==='leia'?'courage':mode],count=mode==='skywalkers'?3:mode==='leia'?2:1;
 await show();await click(addition(read(),card,mode==='leia'?2:undefined));const pending=read();await show();assert.deepEqual(read(),pending,'Refresh preserves pending addition');
 await advance(m=>m.cards[card].zone!=='playing');await show();const updated=read();await show();assert.deepEqual(read(),updated,'Refresh preserves resolved bonus');
 const pane=owner.page.getByRole('region',{name:'Light side',exact:true});assert.match(await pane.innerText(),new RegExp('Planned destiny draws\\s*'+count));
 if(width===390)await owner.page.getByRole('button',{name:/^Table/}).click();await owner.page.screenshot({path:output+'/'+mode+'-'+width+'.png',fullPage:true});
 await advance(m=>m.data.battle.totalsReady);assert.equal(read().data.battle.destinyResults.light.draws.length,count);await show();assert.equal(await owner.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await owner.context.close();console.log('Passed '+mode+' play, refresh, preview and '+count+' physical draws: '+width);
}assert.deepEqual(errors,[]);}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-2500));throw e;}finally{await browser.close();db.close();}
