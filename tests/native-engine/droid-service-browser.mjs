// Playwright 1.62.1 / Chromium 1234, real match HTTP handlers and SQLite D1.
// The starting board is a component fixture; production admission stays closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {link,drain} from './droid-service-fixture.mjs';
import {load,rules,runtime,pull,ids} from './vessels-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url)),{matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
assert.equal(JSON.parse(fs.readFileSync(new URL('../../node_modules/playwright/package.json',import.meta.url))).version,'1.62.1');
const db=new SqliteD1(),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>0}),handlers=matchHandlers(fresh),errors=[];
const origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',output='/private/tmp/swccg-droid-service-browser';fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
async function client(width,actor){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.route('**/api/matches**',async route=>{const req=route.request(),body=req.postData(),id=new URL(req.url()).pathname.split('/')[3],request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{for(const mode of ['drain','peek'])for(const side of ['light','dark'])for(const width of [1440,834,390]){
 const f=mode==='drain'?drain(side):link(side),decks={};for(const s of ['light','dark'])decks[s]=Object.values(f.m.cards).filter(c=>c.owner===s).map(c=>c.blueprint);
 const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side,deckSize:60,deck:decks[side]});await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks[side==='light'?'dark':'light']});f.m.id=v.id;db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(f.m),f.m.revision,v.id);
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),owner=await client(width,'owner');const prompt=m=>runtime.prompt(m,rules,runtime.prompt(m,rules,'light').side);
 const show=async()=>{await owner.page.goto(origin+'/matches/'+v.id+'?progress-report');await owner.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width===390)await owner.page.getByRole('button',{name:/^Actions/}).click();};
 const click=async id=>{const p=prompt(read()),choice=p.choices.find(x=>x.id===id);assert.ok(choice);const rev=read().revision;await owner.page.getByRole('button',{name:choice.label,exact:true}).first().click();await owner.page.getByText('Saved · move '+(rev+1),{exact:true}).waitFor();};
 const advance=async predicate=>{for(let n=0;n<100;n++){const m=read();if(predicate(m))return;const p=prompt(m);assert.ok(p.choices.some(c=>c.id==='pass'));await fresh().command(v.id,p.side===side?'owner':'guest',{commandId:randomUUID(),revision:m.revision,choice:'pass'});}throw Error('Missing continuation');};
 await show();await click(ids(f.m).find(id=>id.startsWith('scomp:play:'+f.card+':'+mode)));let before=read();await show();assert.deepEqual(read(),before,'Refresh preserves pending costs and responses');
 if(mode==='peek'){
  await advance(m=>m.stack.at(-1)?.handler==='scomp:peek');await show();await owner.page.getByRole('heading',{name:'Look at these cards',exact:true}).waitFor();const beforePeek=read();await show();assert.deepEqual(read(),beforePeek);await owner.page.getByRole('heading',{name:'Look at these cards',exact:true}).waitFor();
  const otherView=await fresh().read(v.id,'guest');assert.deepEqual(otherView.game.rules.peek,[]);await owner.page.screenshot({path:output+'/peek-'+side+'-'+width+'.png',fullPage:true});await click('scomp:finish');
 }
 await advance(m=>m.stack.length===1);assert.equal(read().cards[f.card].zone,'used');await show();assert.equal(await owner.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await owner.context.close();console.log('Passed '+mode+' cost, choice and refresh: '+side+' '+width);
}assert.deepEqual(errors,[]);}catch(e){for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator('body').innerText()).slice(-2500));throw e;}finally{await browser.close();db.close();}
