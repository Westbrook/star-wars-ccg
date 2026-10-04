import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {pairedPool,sealedMatchRules} from './sealed-match-fixture.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const create=(pool,side='light')=>({id:randomUUID(),poolId:pool.id,side,deckSize:40,mode:'pvp',deck:pool.decks[side]});
const join=(v,cards)=>({operation:'join',commandId:randomUUID(),inviteToken:v.inviteToken,deck:cards});
function fixture(t){const db=new SqliteD1();t.after(()=>db.close());return {db,fresh:()=>nativeMatchService(db,{currentRules:sealedMatchRules.id,rules:()=>sealedMatchRules,now:()=>1_800_000_000_000})}}
test('paired sealed match freezes pool and cards, survives exact retries and ordinary setup',async t=>{
 const {db,fresh}=fixture(t),pool=await pairedPool(db),request=create(pool),waiting=await fresh().create('owner',request);
 assert.equal(waiting.format,'otsd');assert.equal(waiting.poolId,pool.id);assert.equal(waiting.waitingForOpponent,true);
 assert.deepEqual(await fresh().create('owner',request),waiting);
 await assert.rejects(fresh().create('owner',{...request,poolId:randomUUID()}),e=>e.code==='MATCH_ID_REUSED');
 const body=join(waiting,pool.decks.dark),v=await fresh().join(waiting.id,'guest',body);assert.equal(v.game.status,'setup');assert.equal(v.game.setup.selected.light,null);assert.equal(v.inviteToken,undefined);
 assert.equal((await fresh().join(waiting.id,'guest',body)).duplicate,true);
 const snapshot=JSON.parse(db.sqlite.prepare('SELECT owner_deck FROM native_matches WHERE id=?').get(waiting.id).owner_deck);assert.equal(snapshot.poolId,pool.id);assert.deepEqual(snapshot.cards,pool.decks.light);
 const saved=await nativeDeckService(db,sealedMatchRules).save('owner',{id:randomUUID(),name:'Sealed deck',side:'light',size:40,cards:pool.decks.light,poolId:pool.id,revision:0});assert.equal(saved.eligible,true);
 await nativeDeckService(db,sealedMatchRules).save('owner',{id:saved.id,name:'Edited after seating',side:'light',size:40,cards:[],poolId:pool.id,revision:saved.revision});
 assert.deepEqual(JSON.parse(db.sqlite.prepare('SELECT owner_deck FROM native_matches WHERE id=?').get(waiting.id).owner_deck).cards,pool.decks.light);
 // Every setup command uses a new service instance; both players' hands remain private.
 let owner=await fresh().read(v.id,'owner');
 for(let n=0;n<15&&owner.game.status==='setup';n++){
  const guest=await fresh().read(v.id,'guest'),view=owner.game.prompt.choices.length?owner:guest,actor=view.side==='light'?'owner':'guest';
  assert.ok(view.game.prompt.choices.length);await fresh().command(v.id,actor,{commandId:randomUUID(),revision:view.revision,choice:view.game.prompt.choices[0].id});owner=await fresh().read(v.id,'owner');
 }
 assert.equal(owner.game.status,'playing');assert.equal(owner.game.players.light.hand.length,8);assert.deepEqual(owner.game.players.dark.hand,[]);assert.equal(owner.poolId,pool.id);
 const end=await fresh().command(v.id,'owner',{commandId:randomUUID(),revision:owner.revision,choice:'concede'});assert.equal(end.game.result.winner,'dark');assert.equal((await fresh().read(v.id,'guest')).game.status,'finished');
});
test('sealed creation and joining reject cross-pool, foreign players, excess copies and incompatible formats atomically',async t=>{
 const {db,fresh}=fixture(t),pool=await pairedPool(db),other=await pairedPool(db,'another','stranger');
 for(const bad of [{deck:Array(40).fill(pool.decks.light[0])},{side:'dark',deck:pool.decks.dark},{poolId:other.id},{mode:'cpu',computerDeck:pool.decks.dark},{deckSize:60,deck:[...pool.decks.light,...pool.decks.light.slice(0,20)]}])await assert.rejects(fresh().create('owner',{...create(pool),...bad}));
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,0);
 const waiting=await fresh().create('owner',create(pool));
 await assert.rejects(fresh().join(waiting.id,'stranger',join(waiting,pool.decks.dark)),e=>e.status===404);
 await assert.rejects(fresh().join(waiting.id,'guest',join(waiting,Array(40).fill(pool.decks.dark[0]))),e=>e.code==='OUTSIDE_SEALED_POOL');
 assert.equal((await fresh().read(waiting.id,'owner')).revision,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,0);
 const reverse=await fresh().create('guest',create(pool,'dark'));await fresh().join(reverse.id,'owner',join(reverse,pool.decks.light));assert.equal((await fresh().read(reverse.id,'owner')).side,'light');
});
test('production sealed admission remains closed and HTTP reports bounded inventory errors',async t=>{
 const {db,fresh}=fixture(t),pool=await pairedPool(db);
 await assert.rejects(nativeMatchService(db,{currentRules:premiereRules.id,rules:()=>premiereRules}).create('owner',create(pool)),e=>e.code==='DECK_NOT_ADMITTED');
 const h=matchHandlers(fresh),request=new Request('https://table.test/api/matches',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid'},body:JSON.stringify({...create(pool),deck:Array(40).fill(pool.decks.light[0])})});
 const response=await h.create(request);assert.equal(response.status,422);assert.equal((await response.json()).code,'OUTSIDE_SEALED_POOL');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,0);
});
