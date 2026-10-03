import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const inserts=load(new URL('../../lib/native-engine/reserve-inserts.ts',import.meta.url));
const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(count=4){const m=state.initialState('inserts',40,['light','dark'].map(side=>({side,cards:Array(40).fill(side)})),'insert-components',bp=>({side:bp,name:bp}));for(const side of ['light','dark'])for(const id of m.players[side].reserve.slice(count))state.moveCard(m,id,'hand');return m}
function put(m,owner='light',side='dark'){const id=m.players[owner].hand[0];state.insertCard(m,id,side,()=>0);return id}
function expose(m,side='dark'){while(!inserts.topInsert(m,side))state.moveTop(m,side,'reserve','used');return inserts.topInsert(m,side)}
for(const owner of ['light','dark'])for(const target of ['light','dark'])test(`insert conserves ownership and ordinary piles ${owner} → ${target}`,()=>{
 const m=fixture(),life={light:state.lifeForce(m,'light'),dark:state.lifeForce(m,'dark')},id=put(m,owner,target);state.assertState(m);
 assert.equal(m.cards[id].owner,owner);assert.equal(m.cards[id].zone,'table');assert.ok(!m.players[target].reserve.includes(id));assert.equal(m.players[target].reserve.length,4);
 for(const side of ['light','dark']){assert.equal(state.lifeForce(m,side),life[side]);const view=state.publicState(m,side);assert.equal(view.players[target].counts.reserve,null);assert.equal(view.players[target].lifeForce,null);assert.ok(!view.table.some(c=>c.id===id));assert.equal(view.inserts[0].card?.id,owner===target||owner===side?id:undefined);assert.equal(view.inserts[0].side,target);assert.ok(!JSON.stringify(view).includes('position'));}
});
for(const count of [0,1])test('Reserve requires two ordinary cards for insertion: '+count,()=>{const m=fixture(count),before=clone(m);assert.throws(()=>put(m));assert.deepEqual(m,before)});
test('exactly two ordinary cards can accept several inserts without counting them as Reserve',()=>{const m=fixture(2);put(m);put(m);assert.equal(m.players.dark.reserve.length,2);state.assertState(m)});
test('conditional shuffle covers all four equally likely legal orders for two ordinary cards and one insert',()=>{
 const outcomes=new Map();for(let a=0;a<2;a++)for(let b=0;b<2;b++){const m=fixture(2),id=m.players.light.hand[0],values=[a,b];state.insertCard(m,id,'dark',()=>values.shift());const x=inserts.insertsIn(m,'dark')[0];assert.ok(x.position>0);const order=[...m.players.dark.reserve];order.splice(x.position,0,id);outcomes.set(order.join(','),(outcomes.get(order.join(','))??0)+1);state.assertState(m)}assert.equal(outcomes.size,4);assert.deepEqual([...outcomes.values()],[1,1,1,1]);
});
test('all Reserve shuffles include inserts, preserve instances, and never leave one on top',()=>{
 const m=fixture(),id=put(m),ref=identity.referenceCard(m,id),other=put(m,'dark','light');for(let i=0;i<30;i++){state.shufflePile(m,'dark','reserve',()=>i);assert.ok(inserts.insertsIn(m,'dark').every(x=>x.position>0));assert.ok(identity.sameCard(m,ref));state.assertState(m)}assert.ok(inserts.isInserted(m,other));
});
for(const entropy of [()=>-1,()=>NaN,()=>{throw Error('entropy unavailable')}])test('invalid insertion entropy is atomic',()=>{const m=fixture(),before=clone(m);assert.throws(()=>state.insertCard(m,m.players.light.hand[0],'dark',entropy));assert.deepEqual(m,before)});
test('invalid shuffle entropy preserves the existing insert order and Reserve',()=>{const m=fixture();put(m);const before=clone(m);assert.throws(()=>state.shufflePile(m,'dark','reserve',()=>-1));assert.deepEqual(m,before)});
for(const to of ['force','lost','destiny','used','hand'])test('exposed insert suspends ordinary Reserve movement to '+to,()=>{
 const m=fixture(),id=put(m);expose(m);const before=clone(m);assert.throws(()=>state.moveTop(m,'dark','reserve',to));assert.deepEqual(m,before);const ref=inserts.revealInsert(m,'dark');assert.equal(ref.id,id);assert.equal(inserts.revealInsert(m,'dark'),undefined);state.assertState(m);const publicInsert=state.publicState(m,'dark').inserts[0];assert.equal(publicInsert.card.id,id);assert.equal(publicInsert.revealed,true);state.moveCard(m,id,'lost');assert.equal(m.players.light.lost[0],id);assert.equal(inserts.insertsIn(m,'dark').length,0);state.moveTop(m,'dark','reserve',to);state.assertState(m);
});
test('moving a card from below an insert leaves its depth unchanged',()=>{const m=fixture();put(m);const x=inserts.insertsIn(m,'dark')[0];x.position=1;state.moveCard(m,m.players.dark.reserve.at(-1),'lost');assert.equal(x.position,1);state.assertState(m)});
test('top and bottom additions, recirculation, and top-to-top reorder maintain physical depth',()=>{
 const m=fixture(),id=put(m),x=inserts.insertsIn(m,'dark')[0];x.position=2;const first=m.players.dark.reserve[0];state.moveCard(m,first,'reserve');assert.equal(x.position,2);const newCard=m.players.dark.hand[0];state.moveCard(m,newCard,'reserve');assert.equal(x.position,3);state.moveCard(m,m.players.dark.hand[0],'reserve','bottom');assert.equal(x.position,3);state.moveTop(m,'dark','reserve','used');assert.equal(x.position,2);const old=[...m.players.dark.reserve],used=[...m.players.dark.used];state.recirculate(m);assert.deepEqual(m.players.dark.reserve,[...old,...used]);assert.equal(x.position,2);assert.ok(inserts.isInserted(m,id));state.assertState(m);
});
test('adjacent inserts reveal separately in physical order, without consuming an ordinary card',()=>{
 const m=fixture(),a=put(m),b=put(m);const entries=inserts.insertsIn(m,'dark');for(const x of entries)x.position=0;const order=entries.map(x=>x.card.id),real=[...m.players.dark.reserve];assert.equal(inserts.revealInsert(m,'dark').id,order[0]);assert.equal(inserts.revealInsert(m,'dark'),undefined);state.moveCard(m,order[0],'lost');assert.equal(inserts.revealInsert(m,'dark').id,order[1]);state.moveCard(m,order[1],'lost');assert.deepEqual(m.players.dark.reserve,real);assert.deepEqual(new Set(m.players.light.lost),new Set([a,b]));state.assertState(m);
});
test('private projection does not reveal relative insert positions through list ordering',()=>{
 const m=fixture();put(m);put(m);const before=state.publicState(m,'light').inserts;const entries=inserts.insertsIn(m,'dark');entries.reverse();entries[0].position=1;entries[1].position=3;inserts.saveInserts(m,entries);assert.deepEqual(state.publicState(m,'light').inserts,before);
});
test('revealed insert remains pending if a response puts an ordinary card on top',()=>{const m=fixture();put(m);expose(m);inserts.revealInsert(m,'dark');state.moveCard(m,m.players.dark.hand[0],'reserve');assert.equal(inserts.topInsert(m,'dark'),undefined);assert.equal(inserts.insertsIn(m,'dark')[0].revealed,true);assert.equal(inserts.insertsIn(m,'dark')[0].position,1);state.assertState(m)});
test('removing an inserted card retires registration and its original table instance',()=>{const m=fixture(),id=put(m),ref=identity.referenceCard(m,id);state.moveCard(m,id,'hand');assert.equal(inserts.isInserted(m,id),false);state.moveCard(m,id,'table');assert.equal(identity.sameCard(m,ref),false);assert.equal(inserts.isInserted(m,id),false);state.assertState(m)});
for(const change of [x=>x.position=-1,x=>x.position=.5,x=>x.position=999,x=>x.side='both',x=>x.revealed='yes',x=>x.card.version++,x=>x.card.zone='reserve'])test('corrupt insert snapshots are rejected: '+change,()=>{const m=fixture();put(m);change(inserts.insertsIn(m,'dark')[0]);assert.throws(()=>state.assertState(clone(m)))});
test('duplicate insert references and ordinary foreign ownership remain invalid',()=>{const m=fixture(),id=put(m);inserts.saveInserts(m,[...inserts.reserveInserts(m),clone(inserts.reserveInserts(m)[0])]);assert.throws(()=>state.assertState(m));const clean=fixture();const foreign=clean.players.light.reserve.shift();clean.players.dark.reserve.push(foreign);assert.throws(()=>state.assertState(clean));assert.ok(id)});
test('legacy snapshots need no insert registry and keep numeric counts',()=>{const m=fixture();assert.equal(m.data.reserveInserts,undefined);state.assertState(clone(m));assert.equal(state.publicState(m,'light').players.dark.counts.reserve,4);assert.equal(state.publicState(m,'light').players.dark.lifeForce,4)});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/reserve-inserts-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP physical insert comparison: '+row.kind+' '+row.owner+' '+(row.count??''),()=>{
 const side=row.owner==='light'?'dark':'light',m=fixture(row.count??4),before=state.lifeForce(m,side);
 if(row.allowed===false){assert.throws(()=>put(m,row.owner,side));return}
 const id=put(m,row.owner,side);
 if(row.kind==='placement'){
  assert.equal(m.cards[id].owner===row.owner,row.ownerPreserved);
  for(let i=0;i<30;i++){state.shufflePile(m,side,'reserve',()=>i);assert.equal(!inserts.topInsert(m,side),row.topOrdinary)}
 }else{inserts.insertsIn(m,side)[0].position=0;inserts.revealInsert(m,side);state.moveCard(m,id,'lost');assert.equal(m.players[row.owner].lost.includes(id),row.ownerLost);assert.equal(!inserts.isInserted(m,id),row.registrationCleared)}
 assert.equal(m.players[side].reserve.length,row.ordinaryCount);assert.equal(state.lifeForce(m,side)-before,row.lifeChange);state.assertState(m);
});
test('insert evidence fingerprints unchanged GEMP production and preserves the full-match gate',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/reserve-inserts-provenance.json',import.meta.url)));for(const [file,hash]of[[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.unchangedProductionFiles,6820);const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));assert.equal(premiereRules.supports('1_42'),false);
});
