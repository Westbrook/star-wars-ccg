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
function fixture(value=2,{droid=false,battle=false}={}){
 let m=fresh({light:['1_132','1_18','1_40','1_152','1_100'],dark:['1_268','1_254','1_207','1_285','1_238']});const site=location(m,'light','1_129');
 const target=pull(m,'light',droid?'1_18':'1_28','table',site),own=pull(m,'dark','1_194','table',site),card=pull(m,'dark','1_268','hand');force(m,'dark',6);force(m,'light',3);m=phase(m,battle?'battle':'control');
 let drawn=null;if(value===null)for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else drawn=topDestiny(m,'dark',({0:'1_285',1:'1_194',2:'1_268',3:'1_238'})[value]);
 if(battle){m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'dark');}
 return {m,site,target,own,card,drawn};
}
const play=f=>step(f.m,'stun:play:'+f.card+':'+f.target);
const resolved=(m,card)=>seek(m,x=>x.cards[card].zone==='lost'&&x.stack.at(-1)?.kind==='window');
for(const droid of [false,true])for(const value of [0,1,2,3,null])test('Set For Stun '+(droid?'droid':'trooper')+' destiny '+value,()=>{
 const f=fixture(value,{droid}),before=f.m.players.dark.force.length;let m=play(f);assert.equal(m.players.dark.force.length,before-2);assert.equal(m.cards[f.card].zone,'playing');m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,value!==null&&value>(droid?0:1)?'hand':'table');if(f.drawn)assert.equal(m.cards[f.drawn].zone,'used');assert.equal(m.players.dark.lost[0],f.card);
});
test('Set For Stun returns all descendant equipment to each owner without losses or forfeiture',()=>{
 const f=fixture(),gun=pull(f.m,'light','1_152','table',f.site),belt=pull(f.m,'dark','1_207','table',f.site);f.m.cards[gun].attachedTo=f.target;f.m.cards[belt].attachedTo=gun;
 let m=seek(play(f),x=>event(x)?.kind==='returned-to-hand');assert.equal(m.cards[f.card].zone,'playing');assert.deepEqual(new Set(event(m).cards),new Set([f.target,gun,belt]));for(const id of [f.target,gun,belt]){assert.equal(m.cards[id].zone,'hand');assert.equal(m.cards[id].attachedTo,undefined);assert.equal(m.cards[id].location,undefined);assert.ok(m.players[m.cards[id].owner].hand.includes(id));}assert.equal(m.players.light.lost.length,0);assert.equal(m.players.dark.lost.length,0);m=resolved(m,f.card);
});
test('Set For Stun honors available Force, phase timing, target ownership and opposing-turn play',()=>{
 const f=fixture();let m=clone(f.m);for(const id of m.players.dark.force.slice(1))state.moveCard(m,id,'hand');assert.ok(!ids(m).some(id=>id.startsWith('stun:')));assert.ok(!ids(f.m).includes('stun:play:'+f.card+':'+f.own));m=play(f);assert.ok(!ids(m).some(id=>id.startsWith('stun:')));
 m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');assert.ok(ids(m).includes('stun:play:'+f.card+':'+f.target));
});
test('Set For Stun cancellation spends cost but draws nothing',()=>{
 const f=fixture(),reserve=[...f.m.players.dark.reserve];let m=play(f);m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.deepEqual(m.players.dark.reserve,reserve);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);
});
test('Set For Stun failed or canceled destiny never treats missing value as zero',()=>{
 const f=fixture(1,{droid:true});let m=seek(play(f),x=>event(x)?.kind==='destiny-drawn');m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.drawn].zone,'used');
});
test('Set For Stun revalidates before drawing and before returning; it never chooses a replacement',()=>{
 for(const boundary of ['play','destiny-drawn','about-to-return-to-hand']){const f=fixture();let m=play(f);if(boundary!=='play')m=seek(m,x=>event(x)?.kind===boundary);state.moveCard(m,f.target,'lost');m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[f.own].zone,'table');assert.equal(m.cards[f.drawn].zone,boundary==='play'?'reserve':'used');}
});
test('return prevention leaves character and equipment on table',()=>{
 const f=fixture(),gun=pull(f.m,'light','1_152','table',f.site);f.m.cards[gun].attachedTo=f.target;let m=seek(play(f),x=>event(x)?.kind==='about-to-return-to-hand');m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[gun].attachedTo,f.target);
});
test('returning the final battle presence ends battle after Interrupt cleanup without damage',()=>{
 const f=fixture(2,{battle:true});let m=seek(play(f),x=>event(x)?.kind==='returned-to-hand');assert.ok(!combat.members(m,'light').includes(f.target));assert.equal(combat.battle(m).stage,'weapons');assert.equal(m.cards[f.card].zone,'playing');m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(m.cards[f.card].zone,'lost');assert.equal(combat.battle(m).premature,true);assert.equal(combat.battle(m).totalsReady,false);assert.equal(combat.battle(m).damage.light,0);
});
test('returning a hit character clears hit status and does not trigger Kintan or Old Ben',()=>{
 const f=fixture(2,{battle:true}),other=pull(f.m,'light','1_28','table',f.site);combat.syncBattle(f.m);combat.battle(f.m).hits.push(f.target);pull(f.m,'light','1_100','hand');pull(f.m,'dark','1_254','hand');let m=seek(play(f),x=>event(x)?.kind==='returned-to-hand');assert.ok(!combat.battle(m).hits.includes(f.target));assert.ok(!ids(m).some(id=>id.startsWith('revival:')));m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('revival:')));m=resolved(m,f.card);assert.ok(combat.members(m,'light').includes(other));
});
test('a weapons-segment Set For Stun may target a character outside the battle',()=>{
 const f=fixture(2,{battle:true});const otherSite=location(f.m,'light','1_132'),target=pull(f.m,'light','1_28','table',otherSite);assert.ok(ids(f.m).includes('stun:play:'+f.card+':'+target));let m=resolved(step(f.m,'stun:play:'+f.card+':'+target),f.card);assert.equal(m.cards[target].zone,'hand');assert.equal(m.cards[f.target].zone,'table');assert.equal(combat.battle(m).stage,'weapons');
});
test('Set For Stun rejects stale commands, wrong seats and corrupted continuations atomically',()=>{
 const f=fixture(),before=clone(f.m);for(const [side,revision,target] of [['light',f.m.revision,f.target],['dark',f.m.revision-1,f.target],['dark',f.m.revision,f.own]]){assert.throws(()=>runtime.applyCommand(f.m,rules,side,{revision,choice:'stun:play:'+f.card+':'+target}));assert.deepEqual(f.m,before);}let m=play(f);m.stack.at(-2).action.payload.target=f.own;assert.throws(()=>runtime.prompt(m,rules,'dark'),/Invalid pending Set For Stun/);
});

test('Set For Stun compares ability at result time after destiny responses',()=>{
 const f=fixture(2);let m=seek(play(f),x=>event(x)?.kind==='destiny-drawn');
 // Fixture intervention changes the current printed ability from 1 to 3;
 // this does not claim an implemented ability-modifying card.
 m.cards[f.target].blueprint='101_2';m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,'table');
});
test('native Set For Stun matches thirteen freshly executed GEMP outcomes',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/stun-results.json',import.meta.url)));assert.equal(oracle.length,13);
 for(const o of oracle){const [,type,valueText,mode]=o.name.match(/^(trooper|droid)-(-?\d+)-(control|gear|battle|outside)$/);const value=Number(valueText);const f=fixture(value<0?null:value,{droid:type==='droid',battle:['battle','outside'].includes(mode)});let gun,belt,target=f.target;
  if(mode==='gear'){gun=pull(f.m,'light','1_152','table',f.site);belt=pull(f.m,'dark','1_207','table',f.site);f.m.cards[gun].attachedTo=f.target;f.m.cards[belt].attachedTo=f.target;}
  if(mode==='outside'){const site=location(f.m,'light','1_132');target=pull(f.m,'light','1_28','table',site);}
  const force=f.m.players.dark.force.length;let m=resolved(step(f.m,'stun:play:'+f.card+':'+target),f.card);if(mode==='battle')m=seek(m,x=>combat.battle(x)?.stage==='complete');
  assert.deepEqual({name:o.name,targetReturned:m.cards[target].zone==='hand',gunReturned:!!gun&&m.cards[gun].zone==='hand',beltReturned:!!belt&&m.cards[belt].zone==='hand',forceSpent:force-m.players.dark.force.length,interruptLost:m.cards[f.card].zone==='lost',battleContinues:!!combat.battle(m)&&combat.battle(m).stage!=='complete'},o);
 }
});

for(const boundary of ['play','destiny-drawn','about-to-return-to-hand'])test('Set For Stun does not follow a target that leaves and returns at '+boundary,()=>{
 const f=fixture();let m=play(f);if(boundary!=='play')m=seek(m,x=>event(x)?.kind===boundary);state.moveCard(m,f.target,'hand');state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;m=resolved(m,f.card);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.drawn].zone,boundary==='play'?'reserve':'used');assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);
});
