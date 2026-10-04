// Playwright 1.62.1 / Chromium 1234, real match HTTP handlers and SQLite D1.
// The starting board is a component fixture; production admission stays closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {deployedSearch} from './otsd-support-fixture.mjs';
import {load,rules,runtime,step,seek} from './vessels-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),errors=[];
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-otsd-support-browser';fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const side of ['light','dark'])for(const width of [1440,834,390]){
 const f=deployedSearch(side),decks={};for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks[side]});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[side==='light'?'dark':'light']});
 let initial=seek(step(f.m,'alien-search:begin:'+f.source),x=>x.stack.at(-1)?.handler==='alien-search:choose');initial.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(initial),initial.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner'),guest=await client(width,'guest');
 const show=async(c)=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await c.page.getByRole('button',{name:/^Actions/}).click();};await show(owner);await show(guest);
 await owner.page.getByRole('region',{name:'Alien search'}).waitFor();assert.equal(await guest.page.getByRole('region',{name:'Alien search'}).count(),0);await owner.page.getByRole('region',{name:'Alien search'}).screenshot({path:output+'/search-'+side+'-'+width+'.png'});const before=read();await owner.page.reload();if(width===390)await owner.page.getByRole('button',{name:/^Actions/}).click();await owner.page.getByRole('region',{name:'Alien search'}).waitFor();assert.deepEqual(read(),before);
 if(width===390)await owner.page.getByRole('button',{name:/^Actions/}).click();const p=runtime.prompt(read(),rules,side),choice=p.choices[0],target=choice.id.slice('alien-search:take:'.length);
 await owner.page.getByRole('button',{name:choice.label,exact:true}).first().click();await owner.page.getByRole('heading',{name:'Alien found',exact:true}).waitFor();await show(guest);await guest.page.getByRole('heading',{name:'Alien found',exact:true}).waitFor();assert.equal(await guest.page.getByRole('region',{name:'Alien search'}).locator('.native-card').count(),1);
 for(let n=0;n<100&&read().stack.length>1;n++){const m=read(),p=runtime.prompt(m,rules,runtime.prompt(m,rules,'light').side);assert.ok(p.choices.some(c=>c.id==='pass'));await fresh().command(v.id,p.side===side?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'});}
 assert.equal(read().cards[target].zone,'hand');await show(owner);assert.equal(await owner.page.getByRole('region',{name:'Alien search'}).count(),0);assert.equal(await owner.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await owner.page.screenshot({path:output+'/'+side+'-'+width+'.png',fullPage:true});await owner.context.close();await guest.context.close();console.log('Passed private alien search, public reveal, hand delivery and refresh: '+side+' '+width);
}assert.deepEqual(errors,[]);}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-3000));throw e;}finally{await browser.close();db.close();}
