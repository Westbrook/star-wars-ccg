import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
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
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
function fixture(side='light',value=1,droid=false,initiator='dark'){
 const enemy=other(side);let m=fresh({light:['1_152','1_124','1_80','1_80','1_30','1_18','1_100','1_40'],dark:['1_317','1_285','1_237','1_237','1_182','1_186','1_254','1_207']});const site=location(m,'light','1_129');
 const first=pull(m,enemy,enemy==='light'?'1_28':'1_194','table',site),second=pull(m,enemy,droid?(enemy==='light'?'1_18':'1_186'):(enemy==='light'?'1_28':'1_194'),'table',site),own=pull(m,side,side==='light'?'1_28':'1_194','table',site),gun=pull(m,enemy,enemy==='light'?'1_152':'1_317','table',site);m.cards[gun].attachedTo=first;
 const card=pull(m,side,side==='light'?'1_80':'1_237','hand');force(m,'dark',5);force(m,'light',5);m=phase(m,'battle');if(initiator==='light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);
 let drawn=null;if(value===null)for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');else drawn=topDestiny(m,side,side==='light'?({0:'1_124',1:'1_28',2:'1_30',3:'1_113'})[value]:({0:'1_285',1:'1_194',2:'1_182',3:'1_238'})[value]);
 m=step(m,'battle:'+site);m=priority(m,side);return{m,side,enemy,site,first,second,own,gun,card,drawn};
}
const play=f=>step(f.m,'accident:play:'+f.card);
const resolved=(m,card)=>seek(m,x=>x.cards[card].zone==='lost'&&x.stack.at(-1)?.kind==='window');
for(const side of ['light','dark'])for(const value of [0,1,2,3,null])test(side+' accident destiny '+value+' and owner casualty choice',()=>{
 const f=fixture(side,value),force=f.m.players[side].force.length;let m=play(f);assert.equal(m.players[side].force.length,force);assert.equal(m.cards[f.card].zone,'playing');
 if(value!==null&&value<2){m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');assert.equal(prompt(m).side,f.enemy);assert.deepEqual(new Set(ids(m)),new Set(['accident-lose:'+f.first,'accident-lose:'+f.second]));m=step(m,'accident-lose:'+f.second);m=seek(m,x=>event(x)?.kind==='character-lost');assert.equal(m.cards[f.second].zone,'lost');assert.equal(m.cards[f.gun].zone,'table');assert.equal(m.cards[f.card].zone,'playing');assert.equal(event(m).cause,'accident');}
 m=resolved(m,f.card);assert.equal(m.cards[f.first].zone,'table');assert.equal(m.cards[f.second].zone,value!==null&&value<2?'lost':'table');if(f.drawn)assert.equal(m.cards[f.drawn].zone,'used');assert.equal(combat.battle(m).totalsReady,false);assert.equal(combat.battle(m).damage.dark+combat.battle(m).damage.light,0);
});

test('accidents require two participating opposing characters and an opposing weapon at battle start',()=>{
 let f=fixture(),m=clone(f.m);state.moveCard(m,f.gun,'lost');assert.ok(!ids(m).includes('accident:play:'+f.card));m=clone(f.m);state.moveCard(m,f.second,'lost');assert.ok(!ids(m).includes('accident:play:'+f.card));m=clone(f.m);ground.record(m).barriers[f.second]=m.turn.number;combat.syncBattle(m);assert.ok(!ids(m).includes('accident:play:'+f.card));m=clone(f.m);ground.record(m).barriers[f.first]=m.turn.number;combat.syncBattle(m);assert.ok(!ids(m).includes('accident:play:'+f.card));m=clone(f.m);m.stack.at(-2).cancelled=true;assert.ok(!ids(m).includes('accident:play:'+f.card));m=seek(f.m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');assert.ok(!ids(m).some(x=>x.startsWith('accident:')));
});

test('canceling an accident leaves all characters and Reserve unchanged',()=>{
 const f=fixture(),reserve=[...f.m.players.light.reserve];let m=play(f);m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.deepEqual(m.players.light.reserve,reserve);assert.equal(m.cards[f.first].zone,'table');assert.equal(m.cards[f.second].zone,'table');
});

test('canceling the destiny supplies no casualty even when zero would succeed',()=>{
 const f=fixture('light',0);let m=play(f);m=seek(m,x=>event(x)?.kind==='destiny-drawn');m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.cards[f.first].zone,'table');assert.equal(m.cards[f.second].zone,'table');assert.equal(m.cards[f.drawn].zone,'used');
});

for(const side of ['light','dark'])test(side+' armed casualty takes attachments and ends battle if presence is gone',()=>{
 const f=fixture(side,0,true),belt=pull(f.m,f.enemy,f.enemy==='light'?'1_40':'1_207','table',f.site);f.m.cards[belt].attachedTo=f.first;let m=play(f);m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');m=step(m,'accident-lose:'+f.first);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.ok([f.first,f.gun,belt].every(id=>m.cards[id].zone==='leaving'));m=step(m,'place-lost:'+f.gun);m=step(m,'place-lost:'+f.first);m=seek(m,x=>event(x)?.kind==='character-lost');assert.deepEqual(m.players[f.enemy].lost.slice(0,3),[belt,f.first,f.gun]);m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(combat.battle(m).premature,true);assert.equal(m.cards[f.second].zone,'table');assert.equal(m.cards[f.card].zone,'lost');assert.ok(!combat.battle(m).totalsReady);
});

test('accident loss permits Kintan but never Old Ben; pending Interrupt stays outside Lost during responses',()=>{
 const f=fixture('dark',0),kintan=pull(f.m,'dark','1_254','hand'),ben=pull(f.m,'light','1_100','hand'),lost=pull(f.m,'dark','1_194','lost');let m=play(f);m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');m=step(m,'accident-lose:'+f.second);m=seek(m,x=>event(x)?.kind==='character-lost');assert.equal(m.cards[f.card].zone,'playing');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.includes(ben)));m=priority(m,'dark');assert.ok(ids(m).includes('revival:kintan:'+kintan));m=step(m,'revival:kintan:'+kintan);m=seek(m,x=>x.cards[kintan].zone==='lost');assert.equal(m.cards[lost].zone,'hand');m=resolved(m,f.card);assert.equal(m.players.dark.lost[0],f.card);
});

test('loss prevention and a departing chosen character finish without selecting a replacement',()=>{
 for(const prevent of [true,false]){const f=fixture();let m=play(f);m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');m=step(m,'accident-lose:'+f.second);if(prevent)m.stack.at(-2).cancelled=true;else state.moveCard(m,f.second,'hand');m=resolved(m,f.card);assert.equal(m.cards[f.second].zone,prevent?'table':'hand');assert.equal(m.cards[f.first].zone,'table');}
});

test('accident target group excludes later arrivals and revalidates before resolution',()=>{
 let f=fixture(),m=play(f);state.moveCard(m,f.second,'hand');m=resolved(m,f.card);assert.equal(m.cards[f.drawn].zone,'reserve');
 f=fixture();m=play(f);m=seek(m,x=>event(x)?.kind==='destiny-drawn');const arrival=pull(m,'dark','1_194','table',f.site);combat.syncBattle(m);m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');assert.ok(!ids(m).includes('accident-lose:'+arrival));assert.equal(ids(m).length,2);
});

test('accident choice rejects the wrong seat, stale revisions and non-target cards',()=>{
 const f=fixture();let m=seek(play(f),x=>x.stack.at(-1)?.handler==='accident:select');const before=clone(m);for(const c of [{side:'light',revision:m.revision,choice:'accident-lose:'+f.first},{side:'dark',revision:m.revision-1,choice:'accident-lose:'+f.first},{side:'dark',revision:m.revision,choice:'accident-lose:'+f.own}]){assert.throws(()=>runtime.applyCommand(m,rules,c.side,c));assert.deepEqual(m,before);}let bad=clone(m);bad.stack.at(-1).side='light';assert.throws(()=>runtime.prompt(bad,rules,'light'),/Invalid pending accident/);bad=clone(m);bad.stack.at(-1).payload.characters.push(f.first);assert.throws(()=>runtime.prompt(bad,rules,'dark'),/Invalid pending accident/);
});

test('both accident cards work when Light initiated the battle',()=>{
 for(const side of ['light','dark']){const f=fixture(side,0,false,'light');let m=seek(play(f),x=>x.stack.at(-1)?.handler==='accident:select');assert.equal(prompt(m).side,f.enemy);m=step(m,'accident-lose:'+f.second);m=resolved(m,f.card);assert.equal(m.cards[f.second].zone,'lost');assert.equal(combat.battle(m).initiator,'light');}
});

test('removing the original weapon before resolution prevents an accident draw',()=>{
 const f=fixture();let m=play(f);state.moveCard(m,f.gun,'lost');m=resolved(m,f.card);assert.equal(m.cards[f.drawn].zone,'reserve');assert.equal(m.cards[f.first].zone,'table');assert.equal(m.cards[f.second].zone,'table');
});

test('native battle accidents match all twelve fresh GEMP outcomes',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/accident-results.json',import.meta.url)));assert.equal(oracle.length,12);
 for(const o of oracle){const side=o.name.startsWith('light')?'light':'dark',label=o.name.slice(side.length+1),armed=label==='armed',value=armed?0:label==='-1'?null:Number(label);const f=fixture(side,value,armed);let belt;if(armed){belt=pull(f.m,f.enemy,f.enemy==='light'?'1_40':'1_207','table',f.site);f.m.cards[belt].attachedTo=f.first;}const before=f.m.players[side].force.length;let m=play(f);if(value!==null&&value<2){m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');m=step(m,'accident-lose:'+(armed?f.first:f.second));}m=resolved(m,f.card);if(armed)m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.deepEqual({name:o.name,firstLost:m.cards[f.first].zone==='lost',secondLost:m.cards[f.second].zone==='lost',gunLost:m.cards[f.gun].zone==='lost',beltLost:!!belt&&m.cards[belt].zone==='lost',interruptLost:m.cards[f.card].zone==='lost',forceSpent:before-m.players[side].force.length,battleContinues:combat.battle(m).stage!=='complete'},o);}
});
