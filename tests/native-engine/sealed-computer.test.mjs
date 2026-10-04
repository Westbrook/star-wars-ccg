import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {seeded} from './match-runner.mjs';
import {sealedMatchRules} from './sealed-match-fixture.mjs';
const {buildSealedComputerDeck,sealedDeckPolicy}=load(new URL('../../lib/sealed-computer-deck.ts',import.meta.url));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url));
const {allocateOtsd,poolContains,sealedCatalog}=load(new URL('../../lib/sealed-products.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const catalogRules={supports:bp=>sealedCatalog.has(bp),definition:bp=>sealedCatalog.get(bp)};
for(const side of ['light','dark'])test('sealed computer policy uses40 available copies deterministically for '+side,()=>{
 for(let seed=1;seed<=64;seed++){
  const inventory=allocateOtsd(seeded(seed))[side].flatMap(p=>p.cards),before=[...inventory];
  const cards=buildSealedComputerDeck(inventory,side,catalogRules);assert.equal(cards.length,40);assert.ok(poolContains(inventory,cards));assert.deepEqual(inventory,before);assert.deepEqual(buildSealedComputerDeck(inventory,side,catalogRules),cards);assert.deepEqual(buildSealedComputerDeck([...inventory].reverse(),side,catalogRules),cards);
  assert.ok(cards.some(bp=>sealedCatalog.get(bp).type==='Location'));assert.ok(cards.some(bp=>sealedCatalog.get(bp).type==='Character'));
 }
});
test('builder fails closed when verification or side leaves fewer than40 cards',()=>{
 const inventory=allocateOtsd(seeded(266)).dark.flatMap(p=>p.cards);
 for(const rules of [premiereRules,{...catalogRules,supports:()=>false}])assert.throws(()=>buildSealedComputerDeck(inventory,'dark',rules),e=>e.code==='COMPUTER_DECK_NOT_ADMITTED');
 assert.throws(()=>buildSealedComputerDeck(inventory,'light',catalogRules),e=>e.code==='COMPUTER_DECK_NOT_ADMITTED');
 assert.throws(()=>buildSealedComputerDeck(inventory.slice(0,39),'dark',catalogRules),e=>e.code==='COMPUTER_DECK_NOT_ADMITTED');
});
for(const side of ['light','dark'])test('computer allocation stays private, fixed and unjoinable for '+side,async t=>{
 const db=new SqliteD1();t.after(()=>db.close());const s=()=>nativeSealedService(db,{entropy:seeded(266)}),body={id:randomUUID(),side,mode:'cpu'};
 const v=await s().create('owner',body);assert.equal(v.mode,'cpu');assert.equal(v.opponentReady,true);assert.equal(v.inviteToken,undefined);assert.ok(v.cards.every(bp=>sealedCatalog.get(bp).side===side));
 const raw=db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+v.id).data;
 assert.deepEqual(await nativeSealedService(db,{entropy:()=>{throw Error('No reroll')}}).create('owner',body),v);assert.equal(db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+v.id).data,raw);
 assert.deepEqual((await s().list('owner')).pools,[v]);await assert.rejects(s().read(v.id,'stranger'),e=>e.status===404);await assert.rejects(s().computerInventory(v.id,'stranger'),e=>e.status===404);
 await assert.rejects(s().join(v.id,'guest',{inviteToken:''}),e=>e.code==='INVALID_INVITATION');await assert.rejects(s().create('owner',{...body,mode:'pvp'}),e=>e.code==='SEALED_ID_REUSED');
 const hidden=await s().computerInventory(v.id,'owner');assert.notEqual(hidden.side,side);assert.equal(v.cards.length+hidden.cards.length,186);assert.equal(v.computerDeck,undefined);assert.equal(v.pools,undefined);
});
for(const side of ['light','dark'])test('server-built sealed CPU matches freeze both decks and restore setup for '+side,async t=>{
 const db=new SqliteD1();t.after(()=>db.close());const sealed=nativeSealedService(db,{entropy:seeded(266)}),pool=await sealed.create('owner',{id:randomUUID(),side,mode:'cpu'}),cards=pool.cards.filter(bp=>sealedMatchRules.supports(bp)).slice(0,40);
 const fresh=()=>nativeMatchService(db,{currentRules:sealedMatchRules.id,rules:()=>sealedMatchRules,now:()=>1_800_000_000_000,entropy:seeded(22)});
 const body={id:randomUUID(),poolId:pool.id,side,deckSize:40,mode:'cpu',deck:cards};const v=await fresh().create('owner',body);assert.equal(v.waitingForOpponent,false);assert.equal(v.game.status,'setup');assert.equal(v.poolId,pool.id);assert.equal(v.inviteToken,undefined);assert.deepEqual(await fresh().create('owner',body),v);
 const snapshot=JSON.parse(db.sqlite.prepare('SELECT owner_deck FROM native_matches WHERE id=?').get(v.id).owner_deck);assert.equal(snapshot.computerPolicy,sealedDeckPolicy);assert.equal(snapshot.computerDeck.length,40);assert.deepEqual(snapshot.cards,cards);const inventory=await sealed.computerInventory(pool.id,'owner');assert.ok(poolContains(inventory.cards,snapshot.computerDeck));assert.equal(v.computerDeck,undefined);
 for(const change of [{computerDeck:snapshot.computerDeck},{mode:'pvp'},{side:inventory.side,deck:snapshot.computerDeck}])await assert.rejects(fresh().create('owner',{...body,id:randomUUID(),...change}));
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,1);
 const library=nativeDeckService(db,sealedMatchRules),draft=await library.save('owner',{id:randomUUID(),name:'CPU sealed',side,size:40,cards,poolId:pool.id,revision:0});assert.equal(draft.eligible,true);
 const starting=await fresh().read(v.id,'owner');await fresh().command(v.id,'owner',{commandId:randomUUID(),revision:starting.revision,choice:starting.game.prompt.choices[0].id});
 let current=await fresh().advanceComputer(v.id,'owner',{operation:'advance'});
 for(let n=0;n<12&&current.game.status==='setup';n++){
  if(current.game.prompt.choices.length)current=await fresh().command(v.id,'owner',{commandId:randomUUID(),revision:current.revision,choice:current.game.prompt.choices[0].id});
  current=await fresh().advanceComputer(v.id,'owner',{operation:'advance'});
 }
 assert.equal(current.game.status,'playing');assert.deepEqual(current.game.players[inventory.side].hand,[]);assert.equal((await fresh().read(v.id,'owner')).poolId,pool.id);
 const finished=await fresh().command(v.id,'owner',{commandId:randomUUID(),revision:current.revision,choice:'concede'});assert.equal(finished.game.result.winner,inventory.side);
});
test('CPU readiness reports a generic unmet opponent gate without exposing its pool',async t=>{
 const db=new SqliteD1();t.after(()=>db.close());const pool=await nativeSealedService(db,{entropy:seeded(266)}).create('owner',{id:randomUUID(),side:'light',mode:'cpu'}),rules={...sealedMatchRules,supports:bp=>sealedMatchRules.supports(bp)&&sealedCatalog.get(bp)?.side==='light'};
 const cards=pool.cards.filter(bp=>rules.supports(bp)).slice(0,40),saved=await nativeDeckService(db,rules).save('owner',{id:randomUUID(),name:'Partial readiness',side:'light',size:40,cards,poolId:pool.id,revision:0});
 assert.equal(saved.eligible,false);assert.equal(saved.issues.length,1);assert.match(saved.issues[0],/computer’s sealed pool/);assert.ok(saved.pool.cards.every(bp=>sealedCatalog.get(bp).side==='light'));
 await assert.rejects(nativeMatchService(db,{currentRules:rules.id,rules:()=>rules}).create('owner',{id:randomUUID(),mode:'cpu',side:'light',deckSize:40,deck:cards,poolId:pool.id}),e=>e.code==='COMPUTER_DECK_NOT_ADMITTED');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,0);
});
