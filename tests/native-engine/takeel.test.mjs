import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const policy=load(new URL('../../lib/native-engine/battle-destiny.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const response=load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x)), event=m=>m.stack.at(-1)?.event;
function rules(mode){return {...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 // Controlled modifier/cancellation providers exercise the ordinary battle
 // pipeline. They do not claim coverage for additional granting cards.
 automatic:(m,w)=>[...premiereRules.automatic(m,w),...(['about-to-draw-destiny','battle-destiny-drawn','destiny-total'].includes(w.event?.kind)?[{id:'observe:'+w.serial,label:'Observe',handler:'probe:observe',actor:'dark',payload:{event:w.event,index:m.stack.length-2}}]:[])],
 resolve:(m,r,c)=>{
  if(r.action.handler!=='probe:observe')return premiereRules.resolve(m,r,c);
  const {event:e,index}=r.action.payload,pending=m.stack[index];
  if(e.kind==='about-to-draw-destiny'&&e.side==='dark'&&mode==='substitute')assert.ok(destiny.substituteDestiny(m,pending,m.data.fixtureSite,4));
  if(e.kind==='battle-destiny-drawn'&&e.side==='dark'){
   m.data.reveals=(m.data.reveals??0)+1;
   if(m.data.reveals===1&&['cancel-one','cancel-only','redraw'].includes(mode))assert.ok(response.cancelPendingDestiny(m,pending,mode==='redraw'));
   if(mode==='individual-modifier')combat.battle(m).destiny.dark+=2;
  }
  if(e.kind==='destiny-total'&&e.category==='battle'&&mode==='total-modifier')pending.action.payload.total+=e.side==='dark'?2:4;
 }
}}
function pull(m,side,bp,zone='hand',site){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,'fixture '+bp);state.moveCard(m,id,zone);if(site)m.cards[id].location=site;return id}
function prompt(m,r){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,r,id){const before=clone(m),n=runtime.applyCommand(clone(m),r,prompt(m,r).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const side of ['dark','light'])assert.deepEqual(runtime.project(n,r,side),runtime.project(clone(n),r,side));return n}
function seek(m,r,predicate,skip=false){for(let i=0;i<900;i++){if(predicate(m))return m;const p=prompt(m,r);assert.ok(p,'game ended');m=step(m,r,p.choices.some(c=>c.id==='draw-destiny')?(skip?'skip-destiny':'draw-destiny'):p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('boundary not reached')}
function fixture(mode){const r=rules(mode);let m=runtime.createMatch('takeel-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['1_269','1_269','1_194','1_262','1_284']:['1_115']),...d.main].slice(0,60)})),r);
 const site=pull(m,'light','1_129','table');m.locations.push(site);m.data.fixtureSite=site;
 pull(m,'dark','101_5','table',site);pull(m,'light','101_2','table',site);pull(m,'light','1_28','table',site);const takeel=pull(m,'dark','1_269');
 const a=pull(m,'dark',mode==='zero'?'1_284':'1_194'),b=pull(m,'dark','1_262'),light=pull(m,'light','1_115'),lightNext=pull(m,'light','1_28');
 for(const side of ['dark','light'])for(let i=0;i<5;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=runtime.startTurns(m,r);m=seek(m,r,x=>x.turn.phase==='battle'&&x.stack.length===1);m=step(m,r,'battle:'+site);m=seek(m,r,x=>event(x)?.kind==='battle-weapons');
 state.moveCard(m,b,'reserve');state.moveCard(m,a,'reserve');state.moveCard(m,lightNext,'reserve');state.moveCard(m,light,'reserve');
 if(['dark-two','cancel-one','reserve-one','limited'].includes(mode))policy.addBattleDrawModifier(m,site,'dark','add',1);
 if(mode==='light-two')policy.addBattleDrawModifier(m,site,'light','add',1);
 if(mode==='limited')policy.addBattleDrawModifier(m,site,'dark','limit',1);
 if(mode==='reserve-one')for(const id of [...m.players.dark.reserve].slice(1))state.moveCard(m,id,'used');
 m=seek(m,r,x=>event(x)?.kind==='battle-destiny-complete',mode==='skip');if(prompt(m,r).side!=='dark')m=step(m,r,'pass');return{m,r,takeel,a,b,light};
}
export function run(mode){let{m,r,takeel}=fixture(mode);const b=combat.battle(m),offered=prompt(m,r).choices.some(c=>c.id==='takeel:'+takeel),before={...b.destiny};const count=side=>b.destinyResults?.[side]?.draws.filter(d=>d.value!==null).length??0;
 const result={name:mode,offered,darkCount:count('dark'),lightCount:count('light'),before};
 if(offered){const force=m.players.dark.force.length,cards={...b.destinyCards};m=step(m,r,'takeel:'+takeel);m=seek(m,r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(m.players.dark.force.length,force-1);assert.equal(m.cards[takeel].zone,'lost');assert.deepEqual(combat.battle(m).destinyCards,cards)}
 if(mode==='repeat'){const second=pull(m,'dark','1_269');if(prompt(m,r).side!=='dark')m=step(m,r,'pass');m=step(m,r,'takeel:'+second);m=seek(m,r,x=>event(x)?.kind==='battle-power');assert.equal(m.cards[second].zone,'lost');}
 result.after={...combat.battle(m).destiny};return result;
}
const expected={repeat:[true,1,1,1,5,5,1],normal:[true,1,1,1,5,5,1],'dark-two':[false,2,1,6,5,6,5],'light-two':[false,1,2,1,6,1,6],'cancel-one':[true,1,1,5,5,5,5],'cancel-only':[false,0,1,null,5,null,5],substitute:[true,1,1,4,5,5,4],redraw:[true,1,1,5,5,5,5],limited:[true,1,1,1,5,5,1],'reserve-one':[true,1,1,1,5,5,1],zero:[true,1,1,0,5,5,0],skip:[false,0,0,null,null,null,null],'individual-modifier':[true,1,1,3,5,5,3],'total-modifier':[true,1,1,3,9,7,5]};
for(const [mode,e] of Object.entries(expected))test('Takeel finalized draws and modifiers: '+mode,()=>{const a=run(mode);assert.deepEqual([a.offered,a.darkCount,a.lightCount,a.before.dark,a.before.light,a.after.dark,a.after.light],e)});
for(const path of ['single','plan'])test('older '+path+' battle snapshots preserve Takeel eligibility',()=>{let{m,r,takeel}=fixture(path==='plan'?'dark-two':'normal');delete combat.battle(m).destinyResults;assert.equal(prompt(clone(m),r).choices.some(c=>c.id==='takeel:'+takeel),path==='single')});
for(const change of [b=>b.destinyResults.dark.draws[0].value=-1,b=>b.destinyResults.dark.draws[0].card=b.destinyCards.light,b=>b.destinyResults.dark.total=null,b=>delete b.destinyResults.light])test('reject corrupted finalized battle destiny '+change.toString(),()=>{const{m}=fixture('normal');change(combat.battle(m));assert.throws(()=>combat.assertBattle(m),/completed battle destinies/)});

test('canceled Takeel preserves numbers after its Force cost and loses the Interrupt',()=>{
 let {m,r,takeel}=fixture('normal');const before={...combat.battle(m).destiny},force=m.players.dark.force.length;
 m=step(m,r,'takeel:'+takeel);m=seek(m,r,x=>x.stack.at(-2)?.action?.handler==='battle:takeel');m.stack.at(-2).cancelled=true;
 m=seek(m,r,x=>event(x)?.kind==='battle-power');assert.deepEqual(combat.battle(m).destiny,before);assert.equal(m.cards[takeel].zone,'lost');assert.equal(m.players.dark.force.length,force-1);
});
test('illegal Takeel with two completed draws is rejected atomically',()=>{const {m,r,takeel}=fixture('dark-two'),before=clone(m);assert.throws(()=>step(m,r,'takeel:'+takeel),/Illegal/);assert.deepEqual(m,before)});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/takeel-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP Takeel: '+row.name,()=>assert.deepEqual(run(row.name),row));
test('Takeel oracle provenance fingerprints match the executed harness and observations',async()=>{
 const {createHash}=await import('node:crypto');const p=JSON.parse(fs.readFileSync(new URL('./gemp/takeel-provenance.json',import.meta.url)));
 for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
 assert.equal(oracle.length,p.observations);
});
