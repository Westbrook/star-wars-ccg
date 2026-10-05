// Playwright 1.62.1 / Chromium 1234. Resume a real, fully replayed 60-card match
// through nativeMatchService + SQLiteD1; test admission and recorded lawful shuffle entropy are explicit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {seeded} from './match-runner.mjs';
import {searchFixtures,decks,rules as auditRules} from './search-match-fixture.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
const require=createRequire(import.meta.url),root=process.env.PLAYWRIGHT_PACKAGE||path.dirname(require.resolve('playwright/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(root,'index.mjs')));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const db=new SqliteD1(),origin=process.env.NATIVE_UI_ORIGIN||'http://localhost:5173',errors=[];
let clock=1_800_000_000_000,entropyValues=null,replaying=false;const fallbackEntropy=seeded(1);const entropy=()=>{if(entropyValues!==null){assert.ok(entropyValues.length,'Unexpected extra shuffle entropy');return entropyValues.shift();}assert.equal(replaying,false,"Unexpected unrecorded entropy during replay");return fallbackEntropy();};
const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules,now:()=>clock,entropy}),handlers=matchHandlers(fresh);
const browser=await chromium.launch({headless:true}),fixtures=searchFixtures();
const output=process.env.NATIVE_UI_OUTPUT||'/private/tmp/swccg-search-match-browser';fs.mkdirSync(output,{recursive:true});
async function client(width,height,actor){
 const context=await browser.newContext({viewport:{width,height}});
 await context.route('**/api/matches**',async route=>{
  const req=route.request(),url=new URL(req.url()),id=url.pathname.split('/')[3],body=req.postData();
  const request=new Request(req.url(),{method:req.method(),headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@test.invalid'},...(body?{body}:{})});
  const response=await handlers[req.method()==='GET'?'read':'update'](request,{params:Promise.resolve({id})});
  await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
}
try{
 for(const fixture of fixtures.filter(f=>!process.env.NATIVE_UI_CASE||f.id===process.env.NATIVE_UI_CASE))for(const [width,height]of [[1440,1000],[834,1112],[390,844]].filter(([w])=>!process.env.NATIVE_UI_WIDTH||w===Number(process.env.NATIVE_UI_WIDTH))){
  replaying=false;const v=await fresh().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:60,deck:decks.find(d=>d.side==='light').cards});
  await fresh().join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:decks.find(d=>d.side==='dark').cards});
  const initial=structuredClone(fixture.start);initial.id=v.id;
  db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(initial),initial.revision,v.id);
  const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);
  const prompt=m=>runtime.prompt(m,auditRules,runtime.prompt(m,auditRules,'light').side);
  const owner=await client(width,height,'owner'),guest=await client(width,height,'guest');
  const show=async c=>{await c.page.goto(origin+'/matches/'+v.id+'?progress-report');await c.page.getByText('Saved · move '+read().revision,{exact:true}).waitFor();if(width<640)await c.page.getByRole('button',{name:'Actions',exact:false}).click();};
  replaying=true;for(const command of fixture.commands){
   clock=command.time;const m=read(),p=prompt(m);assert.equal(m.revision,command.revision);assert.equal(p.side,command.side);const c=command.side==='light'?owner:guest,actor=command.side==='light'?'owner':'guest';
   if(command.choice.startsWith('mentor:')){
    await show(c);const pending=read();await show(c);assert.deepEqual(read(),pending,'Refresh preserves private choice and pending search');
    if(command.choice.startsWith('mentor:take:')||command.choice==='mentor:not-found'){
     await c.page.getByRole('region',{name:'Lightsaber search',exact:true}).waitFor();await show(guest);assert.equal(await guest.page.getByRole('region',{name:'Lightsaber search',exact:true}).count(),0,'Opponent cannot see successful or not-yet-verified private search');
     const opponent=await fresh().read(v.id,'guest');assert.equal(opponent.game.rules.mentorSearch,null);
    }
    if(command.choice==='mentor:verified'){
     await c.page.getByRole('heading',{name:'Verify the search',exact:true}).waitFor();const opponent=await fresh().read(v.id,'guest');assert.equal(opponent.game.rules.mentorSearch.stage,'verify');assert.deepEqual(opponent.game.rules.mentorSearch.cards.map(c=>c.id).sort(),[...read().players.light.reserve].sort());
    }
    if(width===390&&(command.choice.startsWith('mentor:take:')||command.choice==='mentor:verified'))await c.page.screenshot({path:path.join(output,'choice-'+fixture.id+'-'+command.choice.split(':')[1]+'-phone.png'),fullPage:true});
    const choice=p.choices.find(x=>x.id===command.choice);assert.ok(choice);const index=p.choices.filter(x=>x.label===choice.label).findIndex(x=>x.id===command.choice);entropyValues=command.entropy?[...command.entropy]:null;
    await Promise.all([c.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/matches/'+v.id)),c.page.getByRole('button',{name:choice.label,exact:true}).nth(index).click()]);
   }else{entropyValues=command.entropy?[...command.entropy]:null;await fresh().command(v.id,actor,{commandId:randomUUID(),revision:command.revision,choice:command.choice});}
   if(entropyValues!==null)assert.equal(entropyValues.length,0,'Recorded shuffle entropy must be consumed exactly');entropyValues=null;
  }
  const expected=structuredClone(fixture.end);expected.id=v.id;
  assert.deepEqual(read(),expected,'Service must produce the exact full-match checkpoint');
  await show(owner);await show(guest);assert.deepEqual(read(),expected,'Both seats preserve the exact completed search checkpoint');if(fixture.selected)assert.equal(read().cards[fixture.selected].zone,'hand');
  for(const c of [owner,guest]){assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await c.context.close();}console.log('Passed '+fixture.id+' at '+width+' through '+fixture.commands.length+' real service commands.');
 }
 assert.deepEqual(errors,[]);
 console.log('Passed real complete-match private searches, opponent verification, exact reshuffles and refreshed saved states at 1440/834/390.');
}finally{await browser.close();db.close();}
