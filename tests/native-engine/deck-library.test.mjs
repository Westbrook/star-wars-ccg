import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,starterDecks} from './match-runner.mjs';
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url));
const {nativeDeckHandlers}=load(new URL('../../lib/native-deck-http.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const input=(size=40,side='light')=>({id:randomUUID(),name:'Custom '+size,side,size,cards:starterDecks(size).find(d=>d.side===side).cards,revision:0});
const saved=list=>list.decks.filter(d=>d.source==='saved');
test('private saved drafts persist across service instances without exposing legacy records',async()=>{
 const db=new SqliteD1();try{
  db.sqlite.prepare('INSERT INTO decks VALUES (?,?,?,?)').run('legacy','owner','{"old":true}',1);
  const d=input(),v=await nativeDeckService(db,auditRules).save('owner',d);
  assert.equal(v.eligible,true);assert.equal(v.revision,1);
  assert.deepEqual(saved(await nativeDeckService(db,auditRules).list('owner')),[v]);
  assert.deepEqual(saved(await nativeDeckService(db,auditRules).list('stranger')),[]);
  await assert.rejects(nativeDeckService(db,auditRules).save('stranger',d),e=>e.status===409);
  assert.equal(db.sqlite.prepare('SELECT data FROM decks WHERE id=?').get('legacy').data,'{"old":true}');
 }finally{db.close()}
});
test('lost response retries are idempotent; stale and concurrent edits cannot overwrite',async()=>{
 const db=new SqliteD1();try{
  const d=input(),fresh=()=>nativeDeckService(db,auditRules);const first=await fresh().save('owner',d);
  assert.deepEqual(await fresh().save('owner',d),first);
  const edits=await Promise.allSettled(['Alpha','Bravo'].map(name=>fresh().save('owner',{...d,name,revision:1})));
  assert.equal(edits.filter(x=>x.status==='fulfilled').length,1);assert.equal(edits.filter(x=>x.status==='rejected'&&x.reason.code==='STALE_DECK').length,1);
  const winner=edits.find(x=>x.status==='fulfilled').value;
  assert.deepEqual(await fresh().save('owner',{...d,name:winner.name,revision:1}),winner);
  await assert.rejects(fresh().save('owner',{...d,name:'stale'}),e=>e.code==='STALE_DECK');
  assert.deepEqual(saved(await fresh().list('owner')),[winner]);
 }finally{db.close()}
});
test('draft storage never admits unsupported, wrong-side or incomplete decks',async()=>{
 const db=new SqliteD1();try{
  for(const cards of [[],['999999_1'],input().cards.slice(1),[...input().cards.slice(1),'1_194']]){
   const v=await nativeDeckService(db,auditRules).save('owner',{...input(),cards});assert.equal(v.eligible,false);assert.ok(v.issues.length);
  }
  const d=input(),v=await nativeDeckService(db,premiereRules).save('owner',d);assert.equal(v.eligible,false);
  assert.ok(v.issues.some(x=>x.includes('verification')));assert.equal(premiereRules.supports(d.cards[0]),false);
  await assert.rejects(nativeMatchService(db,{currentRules:premiereRules.id,rules:()=>premiereRules}).create('owner',{id:randomUUID(),mode:'pvp',side:d.side,deckSize:d.size,deck:d.cards}),e=>e.code==='DECK_NOT_ADMITTED');
 }finally{db.close()}
});
for(const size of [40,60])test('custom '+size+' decks seat CPU and private opponents with frozen match copies',async()=>{
 const db=new SqliteD1();try{
  const service=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:()=>auditRules});
  const light=await nativeDeckService(db,auditRules).save('owner',input(size)),dark=await nativeDeckService(db,auditRules).save('guest',input(size,'dark'));
  const cpu=await service().create('owner',{id:randomUUID(),mode:'cpu',side:'light',deckSize:size,deck:light.cards,computerDeck:dark.cards});assert.equal(cpu.game.status,'setup');
  const pvp=await service().create('owner',{id:randomUUID(),mode:'pvp',side:'light',deckSize:size,deck:light.cards});
  const joined=await service().join(pvp.id,'guest',{commandId:randomUUID(),inviteToken:pvp.inviteToken,deck:dark.cards});assert.equal(joined.side,'dark');assert.equal(joined.deckSize,size);
  const raw=db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(pvp.id).state;
  await nativeDeckService(db,auditRules).save('owner',{id:light.id,name:'Edited later',side:'light',size,cards:[],revision:1});
  assert.equal(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(pvp.id).state,raw);
 }finally{db.close()}
});
test('deck HTTP requires trusted identity, same-origin JSON and bounded validated fields',async()=>{
 const db=new SqliteD1();try{
  const h=nativeDeckHandlers(()=>nativeDeckService(db,auditRules));
  const request=(body,extra={})=>new Request('https://table.test/api/match-decks',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid',...extra},body:JSON.stringify(body)});
  assert.equal((await h.list(new Request('https://table.test/api/match-decks'))).status,401);
  assert.equal((await h.save(request(input(),{origin:'https://evil.test'}))).status,403);
  for(const extra of [{owner:'guest'},{eligible:true},{revision:-1},{name:''},{size:41},{side:['light']},{cards:['bad']},{cards:Array(121).fill('1_28')}])assert.equal((await h.save(request({...input(),...extra}))).status,400);
  assert.equal((await h.save(request({...input(),name:'x'.repeat(40000)}))).status,413);
  const r=await h.save(request(input()));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
 }finally{db.close()}
});
