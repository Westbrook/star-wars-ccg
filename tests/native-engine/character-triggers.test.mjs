import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
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

function fixture(value=5,{trooper=true,rebels=6,lightTurn=false}={}){
 let m=fresh({light:Array(6).fill('1_28'),dark:['1_262','1_207','1_186','1_317']});
 const site=location(m,'light','1_129'),vader=pull(m,'dark','101_5','table',site);
 const imperial=trooper?pull(m,'dark','1_194','table',site):null;
 for(let i=0;i<rebels;i++)pull(m,'light','1_28','table',site);
 force(m,'dark',5);force(m,'light',5);m=phase(m,'battle');if(lightTurn)m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);
 let drawn=null;
 if(value===null){for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');}
 else drawn=topDestiny(m,'dark',value===0?'1_284':value===4?'1_207':'1_262');
 m=step(m,'battle:'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-result');
 return {m,site,vader,imperial,drawn};
}
function choke(m,vader){m=step(m,'choke:draw-choke:'+vader);return seek(m,x=>x.stack.at(-1)?.handler==='character:choke-target'||x.stack.at(-1)?.event?.kind==='battle-result');}
function damage(m){return seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');}

for(const value of [0,4,5,null])test('mandatory Vader choke: destiny '+value,()=>{
 let {m,vader,imperial,drawn}=fixture(value);assert.deepEqual(ids(m),['choke:draw-choke:'+vader]);assert.equal(prompt(m).mandatory,true);
 assert.throws(()=>step(m,'pass'),/Illegal choice/);const balance=clone(combat.battle(m));
 m=choke(m,vader);
 if(value===5||value===null){assert.equal(prompt(m).side,'dark');assert.deepEqual(new Set(ids(m)),new Set([vader,imperial].map(id=>'choke:'+id)));assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);m=step(m,'choke:'+imperial);m=seek(m,x=>x.cards[imperial].zone==='lost');assert.equal(m.cards[imperial].zone,'lost');}
 else assert.equal(m.cards[imperial].zone,'table');
 m=damage(m);assert.deepEqual(combat.battle(m).damage,balance.damage);assert.deepEqual(combat.battle(m).attrition,balance.attrition);assert.equal(combat.battle(m).premature,false);if(drawn)assert.equal(m.cards[drawn].zone,'used');
});

test('choking the sole Imperial ends the battle in power, loses hit cards and resumes the turn',()=>{
 let {m,vader}=fixture(5,{trooper:false});const b=combat.battle(m),hit=b.participants.light[0],before=clone(m.players.dark);
 b.hits.push(hit);m=choke(m,vader);assert.deepEqual(ids(m),['choke:'+vader]);m=step(m,'choke:'+vader);m=seek(m,x=>x.stack.length===1);assert.equal(combat.battle(m).stage,'complete');assert.equal(combat.battle(m).premature,true);assert.equal(m.cards[hit].zone,'lost');
 assert.equal(m.players.dark.reserve.length,before.reserve.length-1);assert.equal(m.players.dark.force.length,before.force.length);m=seek(m,x=>x.turn.phase==='move');assert.equal(m.cards[vader].zone,'lost');
});

test('choke can target a late arrival but not an excluded, alien, droid or remote character',()=>{
 let {m,vader,imperial,site}=fixture();
 const late=pull(m,'dark','1_170','table',site);
 const elsewhere=location(m,'dark','1_284'),remote=pull(m,'dark','1_181','table',elsewhere),alien=pull(m,'dark','1_196','table',site),droid=pull(m,'dark','1_186','table',site);
 m.data.ground={turn:m.turn.number,moved:[],reacted:[],drained:[],barriers:{[imperial]:m.turn.number}};
 m=choke(m,vader);assert.deepEqual(new Set(ids(m)),new Set([vader,late].map(id=>'choke:'+id)));for(const id of [imperial,remote,alien,droid])assert.throws(()=>step(m,'choke:'+id),/Illegal choice/);m=step(m,'choke:'+late);m=seek(m,x=>x.cards[late].zone==='lost');assert.equal(m.cards[late].zone,'lost');
});

test('choke attachments leave simultaneously and owner chooses their Lost order without forfeit credit',()=>{
 let {m,vader,imperial,site}=fixture();const weapon=pull(m,'dark','1_317','table',site);m.cards[weapon].attachedTo=imperial;const owed=clone(combat.battle(m).damage);
 m=choke(m,vader);m=step(m,'choke:'+imperial);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[imperial].zone,'leaving');assert.equal(m.cards[weapon].zone,'leaving');assert.equal(prompt(m).side,'dark');assert.deepEqual(new Set(ids(m)),new Set([imperial,weapon].map(id=>'place-lost:'+id)));
 m=step(m,'place-lost:'+weapon);assert.deepEqual(m.players.dark.lost.slice(0,2),[imperial,weapon]);assert.equal(m.stack.at(-1).event.kind,'character-lost');m=damage(m);assert.deepEqual(combat.battle(m).damage,owed);
});

test('winning, tied, barred and absent Vader do not trigger; an active losing Vader triggers once',()=>{
 for(const rebels of [4,6]){let {m,vader}=fixture(4,{rebels});if(rebels===4){assert.ok(!ids(m).some(id=>id.startsWith('choke:')));continue;}m=choke(m,vader);assert.ok(!ids(m).some(id=>id.startsWith('choke:')));m=step(m,'pass');assert.ok(!ids(m).some(id=>id.startsWith('choke:')));}
 for(const mode of ['absent','barred']){let {m,vader}=fixture();if(mode==='absent')state.moveCard(m,vader,'lost');else m.data.ground={turn:m.turn.number,moved:[],reacted:[],drained:[],barriers:{[vader]:m.turn.number}};assert.ok(!ids(m).some(id=>id.startsWith('choke:')));}
 // Exercise the exact tie boundary independently of the losing fixture.
 let {m}=fixture(4,{rebels:6});combat.battle(m).power.dark=combat.battle(m).power.light;assert.ok(!ids(m).some(id=>id.startsWith('choke:')));
});

test('destiny canceled during the draw resolves against Vader, while source removal leaves no present target',()=>{
 let {m,vader}=fixture(0);m=step(m,'choke:draw-choke:'+vader);m=seek(m,x=>x.stack.at(-1)?.event?.category==='choke');m.stack.at(-2).cancelled=true;m=seek(m,x=>x.stack.at(-1)?.handler==='character:choke-target');assert.ok(ids(m).includes('choke:'+vader));
 let f=fixture(5);m=step(f.m,'choke:draw-choke:'+f.vader);m=seek(m,x=>x.stack.at(-1)?.event?.category==='choke');state.moveCard(m,f.vader,'lost');m=damage(m);assert.equal(m.cards[f.imperial].zone,'table');
});

test('choke rejects opposing commands, stale retries and corrupted saved outcomes',()=>{
 let {m,vader}=fixture();m=choke(m,vader);const before=clone(m);assert.throws(()=>step(m,'choke:'+vader,'light'),/Illegal choice/);assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision-1,choice:'choke:'+vader}),/Stale/);assert.deepEqual(m,before);
 for(const value of [-1,2]){const bad=clone(m);bad.stack.at(-1).payload.draw.value=value;assert.throws(()=>prompt(bad),/Invalid choke/);}let bad=clone(m);bad.stack.at(-1).side='light';assert.throws(()=>prompt(bad),/Invalid character trigger/);
});


test('Light orders the mandatory trigger on Light’s turn; only Dark chooses its Imperial',()=>{
 let {m,vader}=fixture(5,{lightTurn:true});assert.equal(prompt(m).side,'light');assert.deepEqual(ids(m),['choke:draw-choke:'+vader]);m=choke(m,vader);assert.equal(prompt(m).side,'dark');assert.ok(ids(m).includes('choke:'+vader));assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);
});

test('choke does not satisfy nonzero attrition and later forfeits still pay both balances',()=>{
 let {m,vader,imperial}=fixture();
 // Re-enter the totals resolver with a known completed battle destiny.
 const b=combat.battle(m);b.totalsReady=false;b.stage='power';b.destiny.light=4;
 m.stack=m.stack.slice(0,1);m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:{id:'totals',label:'Totals',handler:'battle:totals',payload:{}}});runtime.openWindow(m,'response','dark',{kind:'battle-power'});
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-result');assert.equal(combat.battle(m).attrition.dark,4);const before=clone(combat.battle(m));m=choke(m,vader);m=step(m,'choke:'+imperial);m=damage(m);assert.deepEqual(combat.battle(m).attrition,before.attrition);assert.deepEqual(combat.battle(m).damage,before.damage);
 m=step(m,'forfeit:'+vader);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');assert.equal(combat.battle(m).attrition.dark,0);assert.equal(combat.battle(m).damage.dark,Math.max(0,before.damage.dark-5));
});


test('selected choke target is respondable before loss and cancellation does not repeat the trigger',()=>{
 let {m,vader,imperial}=fixture();m=choke(m,vader);m=step(m,'choke:'+imperial);assert.equal(m.stack.at(-1).event.kind,'about-to-lose');assert.equal(m.cards[imperial].zone,'table');m.stack.at(-2).cancelled=true;m=damage(m);assert.equal(m.cards[imperial].zone,'table');assert.equal(m.cards[vader].zone,'table');
});


test('native choke agrees with all eight executed GEMP outcomes',()=>{
 const observations=JSON.parse(fs.readFileSync(new URL('./gemp/choke-results.json',import.meta.url)));
 for(const value of [0,4,5,null])for(const alone of [false,true]){
  let {m,vader,imperial}=fixture(value,{trooper:!alone});m=choke(m,vader);if(value===5||value===null)m=step(m,'choke:'+(alone?vader:imperial));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage'||combat.battle(x).stage==='complete');
  const ended=combat.battle(m).premature;
  assert.deepEqual({name:'choke-'+(value===null?-1:value)+'-'+(alone?'alone':'trooper'),lost:m.cards[alone?vader:imperial].zone==='lost',ended,damage:combat.battle(m).damage.dark,vaderLost:m.cards[vader].zone==='lost'},observations.find(o=>o.name==='choke-'+(value===null?-1:value)+'-'+(alone?'alone':'trooper')));
 }
});
