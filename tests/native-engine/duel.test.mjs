import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {duel}=load(new URL('../../lib/native-engine/duel.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}

function fixture(dark=[1,1],light=[1,1]){
 let m=fresh({dark:['101_6','101_6','1_194','1_194'],light:['101_3','101_3','1_28','1_28']});
 const site=location(m,'light','1_129'),from=location(m,'dark','1_293'),vader=pull(m,'dark','101_5','table',from),luke=pull(m,'light','101_2','table',site),card=pull(m,'dark','101_6','hand'),second=pull(m,'dark','101_6','hand'),run=pull(m,'light','101_3','hand'),run2=pull(m,'light','101_3','hand');
 const lost={dark:[],light:[]};for(const side of ['dark','light'])for(let i=0;i<3;i++)lost[side].push(pull(m,side,side==='dark'?'1_194':'1_28','lost'));
 force(m,'dark',6);force(m,'light',6);m=phase(m,'move');
 const draws={dark:[],light:[]};for(const side of ['dark','light']){
  for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');
  for(const value of (side==='dark'?dark:light).slice().reverse()){
   const id=m.players[side].hand.find(id=>![card,second,run,run2].includes(id)&&board.printed(m,id,'destiny')===value);assert.ok(id,'destiny fixture '+side+' '+value);state.moveCard(m,id,'reserve');draws[side].unshift(id);
  }
 }
 m=step(m,'move:'+vader+':'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');m=priority(m,'dark');return{m,card,second,run,run2,vader,luke,site,from,lost,draws};
}
function start(f){return step(f.m,'duel:obsession:'+f.card)}
function finish(m){return seek(m,x=>duel(x)?.stage==='complete'&&x.stack.length===1)}
function result(m){return seek(m,x=>x.stack.at(-1)?.event?.kind==='duel-result')}

for(const [dark,light,winner,difference] of [[[1,1],[1,1],'dark',2],[[0,0],[2,2],'light',2],[[0,0],[1,1],null,0]])test('duel resolves '+winner+' outcome, retrieves before Force loss then loses character',()=>{
 const f=fixture(dark,light);let m=result(start(f));assert.equal(duel(m).winner,winner);assert.equal(duel(m).difference,difference);assert.deepEqual(duel(m).draws.dark.map(d=>d.value),dark);assert.deepEqual(duel(m).draws.light.map(d=>d.value),light);assert.equal(m.cards[f.card].zone,'playing');
 for(const side of ['dark','light'])assert.deepEqual(m.players[side].used.slice(0,2),f.draws[side].slice().reverse());
 if(winner){const loser=winner==='dark'?'light':'dark';m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-loss');assert.equal(m.cards[f.lost[winner].at(-1)].zone,'used');assert.equal(m.cards[loser==='dark'?f.vader:f.luke].zone,'table');assert.equal(m.players[loser].lost.length,3);}
 m=finish(m);assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.vader].zone,winner==='light'?'lost':'table');assert.equal(m.cards[f.luke].zone,winner==='dark'?'lost':'table');assert.equal(m.turn.phase,'move');assert.deepEqual(combat.battleHistory(m).sites,[]);
});

test('all four duel draws happen in Dark, Dark, Light, Light order with independent saved responses',()=>{
 const f=fixture();let m=start(f),events=[];for(let i=0;i<150&&m.cards[f.card].zone!=='lost';i++){
  const w=m.stack.at(-1);if(w.event?.category==='duel'&&w.event?.kind==='destiny-drawn'&&w.passes===0)events.push([w.event.side,w.event.card]);
  m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);
 }
 assert.deepEqual(events,[...f.draws.dark.map(id=>['dark',id]),...f.draws.light.map(id=>['light',id])]);assert.equal(m.cards[f.card].zone,'lost');
});

test('Run Luke cancels Obsession before any destiny, keeps movement cost and consumes both unique plays',()=>{
 const f=fixture();let m=start(f);const before=clone(m.players);assert.ok(ids(m).includes('duel:cancel:'+f.run+':'+f.card));m=step(m,'duel:cancel:'+f.run+':'+f.card);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='interrupt-canceled');assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.run].zone,'playing');m=seek(m,x=>x.cards[f.run].zone==='lost');assert.equal(m.cards[f.run].zone,'lost');assert.equal(duel(m),undefined);assert.equal(travel.travelState(m).runPlayed,true);assert.equal(m.data.duelUsage.obsession,true);
 for(const side of ['dark','light'])assert.deepEqual(m.players[side].reserve,before[side].reserve);assert.equal(m.cards[f.vader].location,f.site);assert.equal(m.players.dark.force.length,5);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('duel:obsession:')));
});

test('canceled Run Luke stays Lost and used this turn, while Obsession continues normally',()=>{
 const f=fixture();let m=start(f);m=step(m,'duel:cancel:'+f.run+':'+f.card);m.stack.at(-2).cancelled=true;m=seek(m,x=>x.cards[f.run].zone==='lost');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('duel:cancel:')));m=finish(m);assert.equal(duel(m).winner,'dark');assert.equal(m.cards[f.luke].zone,'lost');
});

test('Run Luke movement mode and cancellation share the same turn limit',()=>{
 const f=fixture();travel.markRunPlayed(f.m);let m=start(f);assert.ok(!ids(m).some(id=>id.startsWith('duel:cancel:')));m=finish(m);m=seek(m,x=>x.turn.number===2);assert.equal(travel.travelState(m).runPlayed,false);
});

test('Obsession requires an actual adjacent arrival during Dark move and its immediate response',()=>{
 const f=fixture();for(const mutation of [m=>m.turn.side='light',m=>m.turn.phase='battle',m=>m.stack.at(-1).event.from=f.site,m=>m.stack.at(-1).event.card=f.luke,m=>state.moveCard(m,f.luke,'lost')]){const m=clone(f.m);mutation(m);assert.ok(!ids(m).some(id=>id.startsWith('duel:obsession:')));}
 let m=seek(f.m,x=>x.stack.length===1);assert.ok(!ids(m).some(id=>id.startsWith('duel:obsession:')));
 const group=clone(f.m);group.stack.at(-1).event={kind:'moved',cards:[f.vader],from:f.from,site:f.site};assert.ok(ids(group).includes('duel:obsession:'+f.card));
});

test('participant leaves before draws: Interrupt cleans up and duel ends without results',()=>{
 const f=fixture();let m=start(f);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='duel-initiated');state.moveCard(m,f.luke,'lost');m=finish(m);assert.equal(duel(m).interrupted,true);assert.equal(duel(m).winner,null);assert.deepEqual(duel(m).draws,{dark:[],light:[]});assert.equal(m.cards[f.vader].zone,'table');
});

test('source and participant changes during draw settle the drawn card before ending the duel',()=>{
 const f=fixture();let m=start(f);m=seek(m,x=>x.stack.at(-1)?.event?.category==='duel'&&x.stack.at(-1)?.event?.kind==='destiny-drawn');const drawn=m.stack.at(-1).event.card;state.moveCard(m,f.luke,'lost');m=finish(m);assert.equal(m.cards[drawn].zone,'used');assert.equal(duel(m).interrupted,true);assert.equal(m.players.dark.reserve.length,1);assert.equal(m.players.light.reserve.length,2);
});

test('duel totals use current individual power including equipment, not the whole site',()=>{
 const f=fixture();const belt=f.m.players.light.hand.find(id=>f.m.cards[id].blueprint==='1_40');assert.ok(belt);state.moveCard(f.m,belt,'table');f.m.cards[belt].location=f.site;f.m.cards[belt].attachedTo=f.luke;
 const extra=f.m.players.light.hand.find(id=>f.m.cards[id].blueprint==='1_28');state.moveCard(f.m,extra,'table');f.m.cards[extra].location=f.site;let m=result(start(f));assert.equal(duel(m).total.light,6);assert.equal(duel(m).total.dark,6);assert.equal(duel(m).difference,0);
});

for(const [dark,light,winner] of [[[0],[0,0],'dark'],[[],[0,0],'light'],[[0,0],[],'dark'],[[],[],null]])test('failed versus successful-zero destiny '+JSON.stringify([dark,light]),()=>{
 const f=fixture(dark,light);let m=result(start(f));assert.equal(duel(m).winner,winner);assert.deepEqual(duel(m).draws.dark.map(x=>x.value),[dark[0]??null,dark[1]??null]);assert.deepEqual(duel(m).draws.light.map(x=>x.value),[light[0]??null,light[1]??null]);if(Boolean(dark.length)!==Boolean(light.length)){assert.equal(duel(m).difference,null);m=step(m,'pass');const before=clone(m);assert.throws(()=>step(m,'pass'),/Unverified rule/);assert.deepEqual(m,before);return;}m=finish(m);assert.equal(m.cards[f.vader].zone,winner==='light'?'lost':'table');assert.equal(m.cards[f.luke].zone,winner==='dark'?'lost':'table');
});

test('invalid saved duel history and forged decisions fail without mutating state',()=>{
 const f=fixture();let m=result(start(f));const before=clone(m);assert.throws(()=>step(m,'duel:obsession:'+f.card),/Illegal/);assert.deepEqual(m,before);
 for(const mutate of [m=>duel(m).draws.dark.push({card:null,value:0}),m=>duel(m).difference=-1,m=>duel(m).characters.light=f.vader]){const bad=clone(m);mutate(bad);assert.throws(()=>prompt(bad),/Invalid duel/);}
});


test('reducing duel Force loss does not prevent the losing character or its attachments being lost',()=>{
 const f=fixture();const belt=f.m.players.light.hand.find(id=>f.m.cards[id].blueprint==='1_40');state.moveCard(f.m,belt,'table');f.m.cards[belt].location=f.site;f.m.cards[belt].attachedTo=f.luke;
 // Introduce the belt after results to check that finalized totals stay fixed.
 state.moveCard(f.m,belt,'hand');let m=result(start(f));state.moveCard(m,belt,'table');m.cards[belt].location=f.site;m.cards[belt].attachedTo=f.luke;
 const worse=m.players.light.hand.find(id=>m.cards[id].blueprint==='1_90');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-loss');const reduce=ids(m).find(id=>id.startsWith('reduce:'+worse+':2'));assert.ok(reduce,ids(m).join(','));m=step(m,reduce);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[f.luke].zone,'leaving');assert.equal(m.cards[belt].zone,'leaving');m=step(m,'place-lost:'+f.luke);assert.deepEqual(m.players.light.lost.slice(0,2),[belt,f.luke]);m=finish(m);assert.equal(m.cards[worse].zone,'used');assert.equal(duel(m).difference,2);
});

test('character-loss cancellation finishes the duel after its Force payments',()=>{
 const f=fixture();let m=start(f);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-lose'&&x.stack.at(-1).event.cause==='duel');assert.equal(m.players.light.lost.length,5);m.stack.at(-2).cancelled=true;m=finish(m);assert.equal(m.cards[f.luke].zone,'table');assert.equal(duel(m).winner,'dark');assert.equal(m.cards[f.card].zone,'lost');
});

test('final Life Force loss ends the game before later character-loss steps',()=>{
 const f=fixture();let m=result(start(f));for(const id of [...m.players.light.force,...m.players.light.used])state.moveCard(m,id,'hand');const id=m.players.light.hand.find(id=>id!==f.run);state.moveCard(m,id,'force');m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:force');assert.equal(m.status,'finished');assert.equal(m.result.winner,'dark');assert.equal(m.cards[f.luke].zone,'table');assert.throws(()=>step(m,'pass','light'));
});

test('canceling all draws is distinct from drawing zero, with no effect when both players fail',()=>{
 const f=fixture([0,0],[0,0]);let m=start(f);for(let i=0;i<160&&duel(m)?.stage!=='result';i++){
  const w=m.stack.at(-1);if(w.event?.category==='duel'&&w.event?.kind==='destiny-drawn'&&w.passes===0)m.stack.at(-2).cancelled=true;
  m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);
 }
 assert.equal(duel(m).winner,null);assert.ok(Object.values(duel(m).draws).flat().every(d=>d.card&&d.value===null));m=finish(m);assert.equal(m.cards[f.luke].zone,'table');assert.equal(m.cards[f.vader].zone,'table');
});

test('normal wins, tie, partial draws and cancellation match five fresh GEMP outcomes',()=>{
 const observations=JSON.parse(fs.readFileSync(new URL('./gemp/duel-results.json',import.meta.url)));
 for(const [name,dark,light,cancel] of [['duel-1-1',[1,1],[1,1],false],['duel-0-2',[0,0],[2,2],false],['duel-0-1',[0,0],[1,1],false],['partial',[1],[1,1],false],['cancel',[1,1],[1,1],true]]){
  const f=fixture(dark,light),before=clone(f.m.players);let m=start(f);if(cancel)m=step(m,'duel:cancel:'+f.run+':'+f.card);m=seek(m,x=>x.stack.length===1);const d=duel(m);
  assert.deepEqual({name,...(d?{darkTotal:d.total.dark,lightTotal:d.total.light,winner:d.winner??'none'}:{}),vaderLost:m.cards[f.vader].zone==='lost',lukeLost:m.cards[f.luke].zone==='lost',runLost:m.cards[f.run].zone==='lost',darkForceLost:before.dark.force.length-m.players.dark.force.length,lightForceLost:before.light.force.length-m.players.light.force.length,darkRetrieved:f.lost.dark.filter(id=>m.cards[id].zone==='used').length,lightRetrieved:f.lost.light.filter(id=>m.cards[id].zone==='used').length},observations.find(o=>o.name===name));
 }
});

test('recorded GEMP failures do not override the rulebook’s failed-destiny winner',()=>{
 const observations=JSON.parse(fs.readFileSync(new URL('./gemp/duel-results.json',import.meta.url)));
 for(const [name,dark,light,expected] of [['duel--1-0',[],[0,0],'light'],['duel--1--1',[],[],null]]){
  const f=fixture(dark,light),m=result(start(f));assert.equal(duel(m).winner,expected);assert.equal(observations.find(o=>o.name===name).winner,'dark');assert.notEqual(duel(m).winner,'dark');
 }
});
