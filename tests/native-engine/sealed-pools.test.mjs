import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {seeded,auditRules} from './match-runner.mjs';
const {collateBooster,openBooster,openOtsd,allocateOtsd,poolContains,sealedCatalog}=load(new URL('../../lib/sealed-products.ts',import.meta.url));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url));
const {nativeSealedHandlers}=load(new URL('../../lib/native-sealed-http.ts',import.meta.url));
const {nativeDeckService}=load(new URL('../../lib/native-decks.ts',import.meta.url));
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/sealed-products-results.json',import.meta.url)));
const products=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/sealed-products.json',import.meta.url)));
for(const p of reference.packs)test(`GEMP booster collation set ${p.set}, seed ${p.seed}`,()=>{
 const sheet=Object.fromEntries(Object.entries(products.sets[String(p.set)]).map(([r,ids])=>[r,ids.filter(bp=>!reference.excluded[String(p.set)].includes(bp))]));
 let i=0;assert.deepEqual(collateBooster(sheet,()=>p.entropy[i++]),p.cards);assert.equal(i,p.entropy.length);
});
test('OTSD fixed cards and nested product counts match GEMP',()=>{
 const packs=openOtsd(seeded(1)),fixed=reference.fixed.filter(bp=>bp.includes('_'));
 assert.deepEqual([...packs[0].cards].sort(),fixed.sort());assert.equal(reference.fixed.filter(x=>x==='Premiere Booster Pack').length,4);
 assert.equal(reference.fixed.filter(x=>x==='A New Hope Booster Pack').length,1);assert.equal(packs.length,6);assert.equal(packs.flatMap(p=>p.cards).length,93);
});
test('two complete products exchange sides without adding, dropping or exposing the opposite side',()=>{
 const source=[...openOtsd(seeded(1))]; // Independent size/metadata checks supplement exact booster fixtures.
 assert.equal(source.flatMap(p=>p.cards).length,93);
 for(let seed=1;seed<=20;seed++){
  const rng=seeded(seed),expected=[...openOtsd(rng),...openOtsd(rng)].flatMap(p=>p.cards),pools=allocateOtsd(seeded(seed));
  const actual=Object.values(pools).flatMap(ps=>ps.flatMap(p=>p.cards));assert.deepEqual(actual.sort(),expected.sort());assert.equal(actual.length,186);
  for(const side of ['light','dark'])assert.ok(pools[side].every(p=>p.cards.every(bp=>sealedCatalog.get(bp).side===side)));
 }
 assert.equal(poolContains(['1_28','1_28'],['1_28','1_28']),true);assert.equal(poolContains(['1_28'],['1_28','1_28']),false);
});
test('product creation is private and idempotent across concurrent requests and new services',async()=>{
 const db=new SqliteD1();try{
  db.sqlite.prepare('INSERT INTO pools VALUES (?,?,?,?)').run('legacy','owner','not-json',1);
  const d={id:randomUUID(),side:'light'},fresh=()=>nativeSealedService(db,{entropy:seeded(4)});
  const [a,b]=await Promise.all([fresh().create('owner',d),fresh().create('owner',d)]);assert.deepEqual(a,b);assert.deepEqual(a.cards,[]);assert.deepEqual(a.packs,[]);
  const raw=db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+d.id).data;
  assert.deepEqual(await nativeSealedService(db,{entropy:()=>{throw Error('Must not reroll')}}).create('owner',d),a);
  assert.equal(db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('native-sealed:'+d.id).data,raw);
  assert.deepEqual((await fresh().list('stranger')).pools,[]);assert.equal((await fresh().list('owner')).pools.length,1);
  await assert.rejects(fresh().read(d.id,'stranger'),e=>e.status===404);await assert.rejects(fresh().checkDeck(d.id,'owner','light',40,[]),e=>e.code==='SEALED_WAITING');
  assert.equal(db.sqlite.prepare('SELECT data FROM pools WHERE id=?').get('legacy').data,'not-json');
 }finally{db.close()}
});
test('one guest wins a racing join; only each assigned inventory is projected',async()=>{
 const db=new SqliteD1();try{
  const s=()=>nativeSealedService(db,{entropy:seeded(7)}),r=await s().create('owner',{id:randomUUID(),side:'dark'});
  await assert.rejects(s().join(r.id,'bad',{inviteToken:'wrong'}),e=>e.status===403);
  const outcomes=await Promise.allSettled(['guest1','guest2'].map(actor=>s().join(r.id,actor,{inviteToken:r.inviteToken})));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  const actor=outcomes[0].status==='fulfilled'?'guest1':'guest2',guest=await s().read(r.id,actor),owner=await s().read(r.id,'owner');
  assert.equal(guest.side,'light');assert.equal(owner.side,'dark');assert.equal(guest.cards.length+owner.cards.length,186);
  assert.equal(guest.inviteToken,undefined);assert.equal(owner.inviteToken,undefined);
  assert.ok(guest.cards.every(bp=>sealedCatalog.get(bp).side==='light'));assert.ok(owner.cards.every(bp=>sealedCatalog.get(bp).side==='dark'));
  assert.deepEqual(await s().join(r.id,actor,{inviteToken:r.inviteToken}),guest);assert.deepEqual((await s().list(actor)).pools,[guest]);
 }finally{db.close()}
});
test('sealed drafts cannot use another pool, wrong side, wrong format or extra copies',async()=>{
 const db=new SqliteD1();try{
  const s=nativeSealedService(db,{entropy:seeded(5)}),r=await s.create('owner',{id:randomUUID(),side:'light'});await s.join(r.id,'guest',{inviteToken:r.inviteToken});const p=await s.read(r.id,'owner');
  const d={id:randomUUID(),name:'My sealed draft',side:'light',size:40,cards:p.cards.slice(0,40),revision:0,poolId:p.id};const library=()=>nativeDeckService(db,auditRules);
  const saved=await library().save('owner',d);assert.equal(saved.eligible,false);assert.equal(saved.poolId,p.id);assert.deepEqual(saved.pool.cards,p.cards);assert.deepEqual(await library().save('owner',d),saved);
  for(const change of [{side:'dark'},{size:60},{cards:['999999_1']},{cards:Array(p.cards.filter(bp=>bp===p.cards[0]).length+1).fill(p.cards[0])}])await assert.rejects(library().save('owner',{...d,id:randomUUID(),...change}),e=>['SEALED_FORMAT','OUTSIDE_SEALED_POOL'].includes(e.code));
  await assert.rejects(library().save('stranger',{...d,id:randomUUID()}),e=>e.status===404);
  const {poolId,...unbound}=d;await assert.rejects(library().save('owner',{...unbound,revision:1}),/original pool/);
  assert.equal((await library().list('owner')).decks.find(x=>x.id===d.id).poolId,p.id);
 }finally{db.close()}
});
test('sealed HTTP requires trusted identity and rejects client-supplied allocations',async()=>{
 const db=new SqliteD1();try{
  const h=nativeSealedHandlers(()=>nativeSealedService(db,{entropy:seeded(1)}));
  assert.equal((await h.collection(new Request('https://table.test/api/sealed-pools'))).status,401);
  const req=(body,headers={})=>new Request('https://table.test/api/sealed-pools',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid',...headers},body:JSON.stringify(body)});
  assert.equal((await h.collection(req({id:randomUUID(),side:'light',cards:['1_28']}))).status,400);
  assert.equal((await h.collection(req({id:randomUUID(),side:'light'},{origin:'https://evil.test'}))).status,403);
  const good=await h.collection(req({id:randomUUID(),side:'light'}));assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'private, no-store');assert.deepEqual((await good.json()).cards,[]);
 }finally{db.close()}
});

test('native physical packs retain all eleven printed cards omitted by GEMP availability filtering',()=>{
 const seen=new Set();for(let seed=1;seed<=1024;seed++)for(const set of ['1','2'])for(const bp of openBooster(set,seeded(seed)))seen.add(bp);
 const excluded=Object.values(reference.excluded).flat();assert.equal(excluded.length,11);for(const bp of excluded){assert.ok(sealedCatalog.has(bp));assert.ok(seen.has(bp),bp+' missing from physical product');}
 assert.equal(sealedCatalog.size,504);
});

test('sealed evidence binds the exact executed harness, observed filter and printed catalog',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/sealed-products-provenance.json',import.meta.url)));for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../'+file,import.meta.url))).digest('hex'),hash,file);assert.equal(p.unchangedProductionFiles,6820);assert.deepEqual(p.referenceExclusions,reference.excluded)});
