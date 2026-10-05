import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const equipment=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component boards only. This does not admit an entire starter or full catalog.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
const observed=name=>JSON.parse(fs.readFileSync(new URL('./gemp/starter-compound-results.json',import.meta.url))).find(x=>x.name===name);
function fresh(extra={}){return runtime.createMatch('starter-compound',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function top(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve')}
const event=m=>m.stack.at(-1)?.event?.kind;

test('compound receipt binds both executed outcomes to the unchanged pinned reference',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/starter-compound-provenance.json',import.meta.url)));
 assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.extraProductionFiles,0);
 assert.deepEqual({tests:p.junit.tests,failures:p.junit.failures,errors:p.junit.errors,skipped:p.junit.skipped},{tests:2,failures:0,errors:0,skipped:0});
 const rows=JSON.parse(fs.readFileSync(new URL('./gemp/starter-compound-results.json',import.meta.url)));assert.equal(p.observations,2);assert.deepEqual(rows.map(r=>r.name).sort(),['mine-kintan','talz-old-ben']);
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
});

test('actual blaster hit → Talz cost → Old Ben return → restoration matches executed GEMP ordering',()=>{
 let m=fresh({light:['1_31','1_100'],dark:[...Array(10).fill('1_194'),'1_317','1_317']});
 const site=location(m,'light','1_129'),target=pull(m,'light','1_28','table',site),talz=pull(m,'light','1_31','table',site),ben=pull(m,'light','1_100','hand');
 const enemies=Array.from({length:10},()=>pull(m,'dark','1_194','table',site)),gun=pull(m,'dark','1_317','table',site);m.cards[gun].attachedTo=enemies[0];force(m,'dark',8);force(m,'light',5);
 m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>event(x)==='battle-weapons');m=priority(m,'dark');top(m,'dark','1_317');m=step(m,'fire:'+gun+':'+target);m=seek(m,x=>event(x)==='battle-damage');m=priority(m,'light');assert.ok(combat.battle(m).hits.includes(target));
 const damageBefore=combat.battle(m).damage.light,value=board.forfeit(m,talz),forceBefore=m.players.light.force.length;
 m=step(m,'rescue:'+talz+':'+target);m=seek(m,x=>event(x)==='forfeited');assert.equal(m.cards[talz].zone,'lost');assert.ok(combat.battle(m).hits.includes(target));const paid=clone(combat.battle(m));assert.equal(paid.damage.light,Math.max(0,damageBefore-value));
 m=priority(clone(m),'light');m=step(m,'revival:old-ben:'+ben+':'+talz);m=seek(m,x=>x.cards[ben].zone==='lost'&&event(x)==='forfeited');assert.equal(m.cards[talz].zone,'table');assert.ok(!combat.members(m,'light').includes(talz));assert.ok(combat.battle(m).hits.includes(target));
 m=seek(clone(m),x=>event(x)==='battle-damage');assert.deepEqual(combat.battle(m).damage,paid.damage);assert.deepEqual(combat.battle(m).attrition,paid.attrition);
 assert.deepEqual({name:'talz-old-ben',damageBefore,damageAfter:combat.battle(m).damage.light,forfeit:value,returned:m.cards[talz].zone==='table'&&m.cards[talz].location===site,returnedParticipating:combat.members(m,'light').includes(talz),targetRestored:!combat.battle(m).hits.includes(target),targetParticipating:combat.members(m,'light').includes(target),forceSpent:forceBefore-m.players.light.force.length,interruptLost:m.cards[ben].zone==='lost'},observed('talz-old-ben'));
});

test('Timer Mine → Kintan retrieval → remaining owner-chosen casualties matches executed GEMP ordering',()=>{
 let m=fresh();const site=location(m,'light','1_129'),mine=pull(m,'dark','1_322','table',site),victims=Array.from({length:3},()=>pull(m,'light','1_28','table',site)),kintan=pull(m,'dark','1_254','hand'),retrieve=pull(m,'dark','1_194','lost');equipment.recordEquipment(m).mines[mine]=1;force(m,'dark',4);
 m=phase(m,'draw');top(m,'dark','1_186');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+mine));m=step(m,'explode:'+mine);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:mine-order');const forceBefore=m.players.dark.force.length;
 m=step(m,'lose-mine:'+victims[1]);m=seek(m,x=>event(x)==='cards-lost');m=priority(m,'dark');assert.ok(ids(m).includes('revival:kintan:'+kintan));assert.equal(m.cards[victims[1]].zone,'lost');assert.equal(m.cards[mine].zone,'table');
 m=step(clone(m),'revival:kintan:'+kintan);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:mine-order');assert.equal(m.cards[retrieve].zone,'hand');assert.equal(m.cards[kintan].zone,'lost');const remaining= victims.filter(id=>m.cards[id].zone==='table').length,minePresent=m.cards[mine].zone==='table';assert.deepEqual(new Set(ids(m)),new Set([victims[0],victims[2]].map(id=>'lose-mine:'+id)));
 m=step(clone(m),'lose-mine:'+victims[2]);m=seek(m,x=>x.cards[mine].zone==='lost');
 assert.deepEqual({name:'mine-kintan',retrievedBetweenCasualties:true,remainingCasualtiesBeforeResume:remaining,minePresentDuringRetrieval:minePresent,allVictimsLost:victims.every(id=>m.cards[id].zone==='lost'),mineLost:m.cards[mine].zone==='lost',forceSpent:forceBefore-m.players.dark.force.length,interruptLost:m.cards[kintan].zone==='lost',retrieved:m.cards[retrieve].zone==='hand'},observed('mine-kintan'));
});
