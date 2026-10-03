import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only admission; not evidence that either complete deck is supported.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('travel-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}

const observed=JSON.parse(fs.readFileSync(new URL('./gemp/echo-transit-results.json',import.meta.url)));
const owner=bp=>['1_124','1_129','3_59'].includes(bp)?'light':'dark';
function fixture(echo,other,side='dark',outbound=false,amount=12){
 const extra={light:[],dark:[]};extra[owner(echo)].push(echo);extra[owner(other)].push(other);
 let m=fresh(extra);const e=location(m,owner(echo),echo),o=location(m,owner(other),other),from=outbound?e:o,to=outbound?o:e;
 const party=[pull(m,side,side==='dark'?'1_194':'1_28','table',from),pull(m,side,side==='dark'?'1_194':'1_28','table',from)];
 force(m,side,amount);m=phase(m,'move',side);return {m,e,o,from,to,party};
}
function select(m,from,to,party){m=step(m,'transit:'+from+':'+to);for(const id of party)m=step(m,'toggle:'+id);return m;}
for(const echo of ['3_59','3_147'])for(const other of ['1_124','1_285','1_129','1_291'])for(const side of ['dark','light'])for(const outbound of [false,true]){
 const name=echo+'-'+other+'-'+side+'-'+(outbound?'out':'in');
 test('Echo route agrees with actual GEMP group movement: '+name,()=>{
  let {m,from,to,party}=fixture(echo,other,side,outbound);const before=m.players[side].force.length,expected=observed.find(r=>r.name===name);assert.ok(expected);
  m=select(m,from,to,party);assert.equal(prompt(m).choices.find(c=>c.id==='confirm').label,'Move party · '+expected.cost+' Force total');
  m=step(m,'confirm');assert.equal(m.players[side].force.length,before-expected.cost);assert.ok(party.every(id=>m.cards[id].location===from),'responses precede arrival');
  m=settle(clone(m));assert.deepEqual({name,cost:before-m.players[side].force.length,moved:party.filter(id=>m.cards[id].location===to).length,repeat:ids(priority(m,side)).includes('transit:'+to+':'+from)},expected);
  assert.deepEqual(ground.usage(m).moved,party);
 });
}
for(const [other,side,cost] of [['1_124','dark',5],['1_129','dark',6],['1_291','dark',5],['1_124','light',1]])for(const amount of new Set([0,cost-1,cost]))test('full-route affordability '+other+' '+side+' '+amount,()=>{
 const {m,from,to}=fixture('3_59',other,side,false,amount);assert.equal(ids(m).includes('transit:'+from+':'+to),amount>=cost);
});
test('explicitly free transit ignores the arrival surcharge with an empty Force Pile',()=>{
 let {m,from,to,party}=fixture('3_59','1_285','dark',false,0);assert.equal(travel.transitCost(m,'dark',from,to),0);m=settle(step(select(m,from,to,party),'confirm'));assert.ok(party.every(id=>m.cards[id].location===to));assert.equal(m.players.dark.force.length,0);
});
for(const side of ['dark','light'])test('conversion installs current icons and costs, preserves occupants: '+side,()=>{
 const incoming=side==='dark'?'3_147':'3_59',old=side==='dark'?'3_59':'3_147';let m=fresh({light:['3_59'],dark:['3_147']});
 const before=location(m,owner(old),old),next=pull(m,side,incoming,'hand'),to=location(m,'light','1_129'),one=pull(m,'dark','1_194','table',before),two=pull(m,'light','1_28','table',before);
 m=phase(m,'deploy',side);m=settle(step(m,'site:'+next+':over:'+before));assert.ok(!m.locations.includes(before));assert.equal(m.cards[before].coveredBy,next);assert.equal(m.cards[one].location,next);assert.equal(m.cards[two].location,next);
 assert.deepEqual({name:'convert-'+incoming,darkDeparture:travel.transitCost(m,'dark',next,to),lightDeparture:travel.transitCost(m,'light',next,to),charactersStay:true},observed.find(r=>r.name==='convert-'+incoming));
 assert.equal(travel.transitCost(m,'dark',to,next),side==='dark'?2:6);assert.throws(()=>travel.transitCost(m,'dark',before,to),/route/);
 assert.deepEqual(load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url)).premiereSetup.location(m,next).icons,{dark:side==='dark'?1:0,light:1});
});
test('War Room searches for the Dark Echo bay and converts its Light version',()=>{
 let m=fresh({light:['3_59'],dark:['3_147']});const old=location(m,'light','3_59'),room=location(m,'dark','101_4');pull(m,'dark','1_194','table',room);const card=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='3_147');m=phase(m);
 m=settle(step(m,'search:'+room));assert.ok(ids(m).includes('take:'+card));assert.deepEqual(runtime.project(m,rules,'light').rules.searchCards,[]);m=step(m,'take:'+card);assert.deepEqual(ids(m),['place:over:'+old]);m=settle(step(m,'place:over:'+old));
 assert.deepEqual({name:'search-convert',converted:m.cards[old].coveredBy===card&&m.locations.includes(card)},observed.find(r=>r.name==='search-convert'));assert.equal(travel.travelState(m).shuffles,1);
});
test('canceling the party selection charges no surcharge; canceling paid transit retains it',()=>{
 let {m,from,to,party}=fixture('3_59','1_124','dark',false,5);m=step(select(m,from,to,party),'cancel');assert.equal(m.players.dark.force.length,5);m=step(select(m,from,to,party),'confirm');m.stack.at(-2).cancelled=true;m=settle(m);assert.equal(m.players.dark.force.length,0);assert.ok(party.every(id=>m.cards[id].location===from));assert.deepEqual(ground.usage(m).moved,[]);
});
test('opposing player cannot select a transit party and full production admission remains closed',()=>{
 let {m,from,to,party}=fixture('3_59','1_124');m=select(m,from,to,party);assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);assert.throws(()=>runtime.applyCommand(clone(m),rules,'light',{revision:m.revision,choice:'confirm'},()=>0));assert.equal(premiereRules.supports('3_59'),false);assert.equal(premiereRules.supports('3_147'),false);
});
for(const other of ['1_124','1_129','1_291','1_285'])for(const amount of [0,4,6])test('GEMP affordability at Echo arrival: '+other+' '+amount,()=>{
 const {m,from,to}=fixture('3_59',other,'dark',false,amount);const name='afford-'+other+'-'+amount;assert.deepEqual({name,offered:ids(m).includes('transit:'+from+':'+to)},observed.find(r=>r.name===name));
});
