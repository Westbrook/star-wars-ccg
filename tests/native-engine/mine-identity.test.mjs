import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const equipment=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only admission; not evidence that either complete deck is supported.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('equipment-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id});assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function deploy(m,id,host){m=priority(m,m.cards[id].owner);return settle(step(m,'attach:'+id+':'+host))}
function top(m,side,bp){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,'destiny '+bp);state.moveCard(m,id,'reserve');return id}
function mine(m,side,bp,site){const id=pull(m,side,bp,'table',site);equipment.recordEquipment(m).mines[id]=1;return id}


for(const mode of ['stay','target-leave','target-return','target-move','source-leave','source-return','source-move'])test('pending defuse preserves original target: '+mode,()=>{
 let m=fresh();const site=location(m,'light','1_124'),far=location(m,'dark','1_291'),droid=pull(m,'dark','1_186','table',site),target=mine(m,'light','1_162',site);force(m,'dark',3);m=phase(m,'control');const before=m.players.dark.force.length;
 m=step(m,'defuse:'+droid+':'+target);assert.ok(m.stack.some(f=>f.kind==='resolution'&&f.action.handler==='equipment:defuse'));
 if(mode.startsWith('target')){if(mode.endsWith('move'))m.cards[target].location=far;else{state.moveCard(m,target,'hand');if(mode.endsWith('return')){state.moveCard(m,target,'table');m.cards[target].location=site;equipment.recordEquipment(m).mines[target]=m.turn.number;}}}
 if(mode.startsWith('source')){if(mode.endsWith('move'))m.cards[droid].location=far;else{state.moveCard(m,droid,'hand');if(mode.endsWith('return')){state.moveCard(m,droid,'table');m.cards[droid].location=site;}}}
 m=settle(clone(m));const actual={mode,mineLost:m.cards[target].zone==='lost',forceSpent:before-m.players.dark.force.length};
 const observations=JSON.parse(fs.readFileSync(new URL('./gemp/mine-identity-results.json',import.meta.url)));
 assert.deepEqual(actual,observations.find(r=>r.mode===mode));
});

test('Electrobinoculars cannot initiate against an empty Reserve Deck',()=>{
 let m=fresh();const site=location(m,'light','1_124'),host=pull(m,'light','1_28','table',site),bin=pull(m,'light','1_35','table',site);m.cards[bin].attachedTo=host;force(m,'light',4);m=phase(m,'control');m=priority(m,'light');
 for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');
 assert.ok(!ids(m).includes('peek:'+bin));const before=clone(m);assert.throws(()=>runtime.applyCommand(clone(m),rules,'light',{revision:m.revision,choice:'peek:'+bin}));assert.deepEqual(m,before);
 // Refilling the pile makes the same action legal without consuming device use.
 state.moveCard(m,m.players.light.hand[0],'reserve');assert.ok(ids(m).includes('peek:'+bin));
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/mine-identity-results.json',import.meta.url)));
 assert.equal(observed.find(r=>r.mode==='peek-nonempty').available,true);
 // Explicit source discrepancy: Card1_035 omits the nonempty-pile condition;
 // AR p21's implied target rule forbids initiating a peek into an empty pile.
 assert.equal(observed.find(r=>r.mode==='peek-empty').available,true);
});

test('Reserve depletion during paid peek finishes without leaking an inspection or refunding cost',()=>{
 let m=fresh();const site=location(m,'light','1_124'),host=pull(m,'light','1_28','table',site),bin=pull(m,'light','1_35','table',site);m.cards[bin].attachedTo=host;force(m,'light',4);m=priority(phase(m,'control'),'light');const forceBefore=m.players.light.force.length;
 m=step(m,'peek:'+bin);for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=settle(m);
 assert.equal(m.players.light.force.length,forceBefore-2);assert.deepEqual(runtime.project(m,rules,'light').rules.peek,[]);assert.deepEqual(runtime.project(m,rules,'dark').rules.peek,[]);
});

for(const amount of [1,3])test('mine casualties have response windows, full dependent losses, correct priority and saved instances: '+amount,()=>{
 let m=fresh();const site=location(m,'light','1_124'),target=mine(m,'dark','1_322',site),one=pull(m,'light','1_28','table',site),two=pull(m,'light','1_28','table',site),gun=pull(m,'light','1_152','table',site);m.cards[gun].attachedTo=one;
 m=phase(m,'draw');top(m,'dark',amount===1?'1_194':'1_186');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+target));m=step(m,'explode:'+target);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:mine-victims'||x.stack.at(-1)?.event?.kind==='about-to-lose');
 if(m.stack.at(-1).handler==='equipment:mine-victims')m=step(m,'select:'+one);
 assert.equal(m.stack.at(-1).event.kind,'about-to-lose');assert.equal(prompt(m).side,'dark');assert.equal(m.cards[one].zone,'table');assert.equal(m.cards[gun].zone,'table');
 m=seek(clone(m),x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[one].zone,'leaving');assert.equal(m.cards[gun].zone,'leaving');
 m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='cards-lost');const e=m.stack.at(-1).event;
 assert.equal(prompt(m).side,'dark');assert.equal(e.source,target);assert.deepEqual([...e.cards].sort(),[one,gun,...(amount===3?[two]:[])].sort());assert.equal(e.cardRefs.length,e.cards.length);for(const ref of e.cardRefs){assert.equal(ref.zone,'lost');assert.equal(m.cards[ref.id].zone,'lost');}
 m=seek(clone(m),x=>x.cards[target].zone==='lost');assert.equal(m.cards[target].zone,'lost');assert.equal(m.cards[two].zone,amount===3?'lost':'table');
});

test('equipment loss timing and attribution match GEMP including all attached casualties',()=>{
 let m=fresh();const site=location(m,'light','1_124'),target=mine(m,'dark','1_322',site),victim=pull(m,'light','1_28','table',site),gun=pull(m,'light','1_152','table',site);m.cards[gun].attachedTo=victim;m=phase(m,'draw');top(m,'dark','1_194');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+target));m=step(m,'explode:'+target);
 const events=[],seen=new Set();for(let i=0;i<100;i++){
  const frame=m.stack.at(-1),e=frame?.event;
  if(frame.kind==='window'&&!seen.has(frame.serial)&&['about-to-lose','cards-lost'].includes(e?.kind)){
   seen.add(frame.serial);const actor=prompt(m).side==='dark'?'light':'dark';
   for(const id of e.cards)events.push(e.kind==='about-to-lose'?{stage:'about-to-lose',actor}:{stage:'lost',actor,card:m.cards[id].blueprint});
  }
  if(m.cards[target].zone==='lost'&&e?.kind==='cards-lost')break;
  const p=prompt(m);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id);
 }
 // Grouped simultaneous native events and GEMP's per-card events are equivalent.
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/mine-identity-results.json',import.meta.url))).find(x=>x.mode==='casualty-timing');
 const sorted=rows=>rows.map(x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort()))).sort();assert.deepEqual(sorted(events),sorted(observed.events));
 assert.equal(events.filter(e=>e.stage==='lost').length,3);
});

for(const mutate of [p=>p.cards=[],p=>p.cards.push(p.cards[0]),p=>p.cards=['missing'],p=>p.source='missing'])test('pending equipment loss rejects a corrupted target list: '+mutate,()=>{
 let m=fresh();const site=location(m,'light','1_124'),droid=pull(m,'dark','1_186','table',site),target=mine(m,'light','1_162',site);force(m,'dark',3);m=phase(m,'control');m=step(m,'defuse:'+droid+':'+target);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-lose');
 mutate(m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='equipment:lose').action.payload);assert.throws(()=>premiereRules.validate(m),/equipment loss/);
});

for(const corrupt of ['owner','source','card','duplicate'])test('private saved inspection rejects '+corrupt+' corruption',()=>{
 let m=fresh();const site=location(m,'light','1_124'),host=pull(m,'light','1_28','table',site),bin=pull(m,'light','1_35','table',site);m.cards[bin].attachedTo=host;force(m,'light',4);m=priority(phase(m,'control'),'light');m=settle(step(m,'peek:'+bin));const d=m.stack.at(-1);
 if(corrupt==='owner')d.side='dark';if(corrupt==='source')d.payload.card=host;if(corrupt==='card')d.payload.cards=[m.players.light.reserve[1]];if(corrupt==='duplicate')d.payload.cards.push(d.payload.cards[0]);assert.throws(()=>premiereRules.validate(m),/equipment/);
});

test('a retrieved and re-lost casualty does not revive its old just-lost response',()=>{
 const {revivalActions}=load(new URL('../../lib/native-engine/revival.ts',import.meta.url));
 let m=fresh();const site=location(m,'light','1_124'),target=mine(m,'dark','1_322',site),victim=pull(m,'light','1_28','table',site),kintan=pull(m,'dark','1_254','hand');pull(m,'dark','1_194','lost');force(m,'dark',2);m=phase(m,'draw');top(m,'dark','1_194');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+target));m=step(m,'explode:'+target);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='cards-lost');const window=m.stack.at(-1);assert.ok(revivalActions(m,window,'dark').some(a=>a.source===kintan));
 state.moveCard(m,victim,'hand');state.moveCard(m,victim,'lost');assert.ok(!revivalActions(m,window,'dark').some(a=>a.source===kintan));
});

test('revealed location, character and device duds never become active cards or character-loss triggers',()=>{
 const {revivalActions}=load(new URL('../../lib/native-engine/revival.ts',import.meta.url));
 let m=fresh();const site=location(m,'light','1_130'),near=location(m,'dark','1_291'),droid=pull(m,'light','1_18','table',site),troop=pull(m,'dark','1_194','table',near),kintan=pull(m,'dark','1_254','hand');pull(m,'dark','1_194','lost');const duds=['1_124','1_28','1_35'].map(bp=>pull(m,'light',bp,'buried',site));force(m,'dark',4);m=phase(m,'move');m=step(m,'move:'+troop+':'+site);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');
 assert.ok(duds.every(id=>m.cards[id].zone==='leaving'));assert.ok(!m.locations.includes(duds[0]));assert.equal(m.cards[droid].zone,'table');
 m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='buried-cards-lost');assert.ok(duds.every(id=>m.cards[id].zone==='lost'));assert.deepEqual([...m.stack.at(-1).event.cards].sort(),[...duds].sort());assert.ok(!revivalActions(m,m.stack.at(-1),'dark').some(a=>a.source===kintan));
});
