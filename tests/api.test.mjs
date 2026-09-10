import assert from 'node:assert/strict';
import {starter} from '../lib/cards.ts';
const base='http://localhost:5173/api/holo';
function client(){let cookie='';return async(action,data={},id)=>{let r=await fetch(base+(id?'?game='+id:''),{method:action?'POST':'GET',headers:{...(action?{'Content-Type':'application/json','Origin':'http://localhost:5173'}:{}),...(cookie?{Cookie:cookie}:{})},...(action?{body:JSON.stringify({action,...data})}:{})});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,data:await r.json()}}}
const a=client(),b=client(),intruder=client();assert.equal((await a()).status,200);assert.equal((await b()).status,200);
let r=await a('saveDeck',{deck:{...starter('light',40),name:'Validation deck'}});assert.equal(r.status,200,JSON.stringify(r.data));const deck=r.data.deck;assert.equal((await a()).data.decks[0].id,deck.id);assert.equal((await b()).data.decks.length,0);assert.equal((await b('saveDeck',{deck})).status,400);
r=await a('openPacks',{side:'dark',size:60});assert.equal(r.status,200);const pool=r.data.pool;assert.equal(pool.cards.length,120);assert.equal(pool.packs,8);const sealed={id:'new',name:'Validation sealed',side:'dark',size:60,cards:pool.cards.slice(0,60),poolId:pool.id};assert.equal((await a('saveDeck',{deck:sealed})).status,200);assert.equal((await b('saveDeck',{deck:sealed})).status,400);
r=await a('createGame',{deck:starter('dark',40),mode:'online'});assert.equal(r.status,200,JSON.stringify(r.data));let table=r.data;assert.equal(table.game.started,false);assert(table.game.players[1].hand.every(id=>id==='?'));assert.equal((await intruder(undefined,{},table.id)).status,404);
assert.equal((await a('gameAction',{id:table.id,version:table.version,move:{type:'activate'}})).status,400);
r=await b('joinGame',{code:table.code,deck:starter('light',40)});assert.equal(r.status,200,JSON.stringify(r.data));let guest=r.data;assert.equal(guest.game.started,true);assert.equal(guest.viewer,1);assert(guest.game.players[0].hand.every(id=>id==='?'));assert(guest.game.players[1].hand.every(id=>id!=='?'));assert.equal((await intruder('joinGame',{code:table.code})).status,400);
table=(await a(undefined,{},table.id)).data;assert.equal(table.version,1);assert.equal((await b('gameAction',{id:table.id,version:table.version,move:{type:'activate'}})).status,400);
r=await a('gameAction',{id:table.id,version:table.version,move:{type:'activate'}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.game.players[0].force.length,5);assert.equal((await a('gameAction',{id:table.id,version:table.version,move:{type:'next'}})).status,409);table=r.data;
for(let i=0;i<6;i++){r=await a('gameAction',{id:table.id,version:table.version,move:{type:'next'}});assert.equal(r.status,200,JSON.stringify(r.data));table=r.data}assert.equal(table.game.active,1);guest=(await b(undefined,{},table.id)).data;assert.equal(guest.game.active,guest.viewer);assert.equal((await b('gameAction',{id:table.id,version:guest.version,move:{type:'activate'}})).status,200);
r=await a('createGame',{deck:starter('light',60),mode:'cpu',difficulty:'commander'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.game.active,0);assert(r.data.game.players[1].units.length>0);assert(r.data.game.players[1].hand.every(id=>id==='?'));
r=await a('createGame',{deck:starter('light',40),mode:'local'});assert.equal(r.status,200);assert.equal(r.data.viewer,1);assert(r.data.game.players[0].hand.every(id=>id==='?'));
console.log('PASS: persistent deck isolation, sealed pools, 40/60 formats, invitation join, private hands, turn ownership, stale-write protection, shared turn propagation, CPU start, and local pass-and-play.');

const altered={...sealed,size:40,cards:sealed.cards.slice(0,40)};assert.equal((await a('saveDeck',{deck:altered})).status,400);let cancelled=(await a('createGame',{deck:starter('light',40),mode:'online'})).data;assert.equal((await a('gameAction',{id:cancelled.id,version:cancelled.version,move:{type:'concede'}})).status,200);assert.equal((await b('joinGame',{code:cancelled.code})).status,400);console.log('PASS: sealed format enforcement and cancelled-table join rejection.');
let sealedTable=(await a('createGame',{deck:sealed,mode:'online'})).data;
assert.equal(sealedTable.game.sealed,true);
assert.equal((await b('joinGame',{code:sealedTable.code})).status,400);
const guestPool=(await b('openPacks',{side:'light',size:60})).data.pool;
const guestSealed={id:'new',name:'Guest sealed',side:'light',size:60,cards:guestPool.cards.slice(0,60),poolId:guestPool.id};
assert.equal((await b('joinGame',{code:sealedTable.code,deck:guestSealed})).status,200);
const localCustom=(await a('createGame',{deck:starter('dark',40),mode:'local',otherDeck:deck}));
assert.equal(localCustom.status,200);
assert.equal((await a('createGame',{deck:sealed,mode:'local',otherDeck:starter('light',60)})).status,400);
console.log('PASS: sealed-vs-sealed tables and customizable pass-and-play opponent decks.');
