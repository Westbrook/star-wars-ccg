import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id),event=m=>m.stack.at(-1)?.event;
function step(m,id,side=prompt(m).side){const before=clone(m),n=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const seat of ['light','dark'])assert.deepEqual(runtime.project(n,rules,seat),runtime.project(clone(n),rules,seat));return n}
function seek(m,predicate){for(let i=0;i<500;i++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'game ended before boundary');m=step(m,p.choices.find(c=>c.id.startsWith('gamblers-select:'))?.id??(p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id))}throw Error('boundary not reached')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function pull(m,side,bp,zone='hand',site){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,'missing '+bp);state.moveCard(m,id,zone);if(site)m.cards[id].location=site;return id}
function fixture(bp='5_5',siteBp='1_129'){
 let m=runtime.createMatch('gamblers-luck',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['5_48','5_48',bp,'1_84','1_28','1_115','1_124','5_69','1_28','1_115','5_69']:[]),...d.main].slice(0,60)})),rules);
 const site=pull(m,siteBp==='1_293'?'dark':'light',siteBp,'table');m.locations.push(site);const character=pull(m,'light',bp,'table',site),vader=pull(m,'dark','101_5','table',site),luck=pull(m,'light','5_48'),copy=pull(m,'light','5_48'),dice=pull(m,'light','1_84');
 for(const side of ['light','dark'])for(let i=0;i<6;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');m=runtime.startTurns(m,rules);m=seek(m,x=>x.turn.phase==='battle'&&x.stack.length===1);m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');return{m,site,character,vader,luck,copy,dice};
}
function top(m,values){const cards=values.map(value=>pull(m,'light',{0:'1_124',1:'1_28',3:'5_69',5:'1_115'}[value]));for(const id of cards.slice().reverse())state.moveCard(m,id,'reserve');return cards}
function play(f,amount=2){return step(f.m,'gamblers-luck:'+f.luck+':'+amount)}
function ready(m){return seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light')}
function convert(m){m=priority(m,'light');m=step(m,ids(m).find(id=>id.startsWith('gamblers-select:')));return seek(m,x=>event(x)?.kind==='about-to-draw-destiny'&&x.stack.at(-2)?.action.payload.retain)}
function selection(m){return seek(m,x=>x.stack.at(-1)?.handler==='selection:choose')}
function done(m){return seek(m,x=>event(x)?.kind==='battle-destiny-complete')}
for(const [bp,amount,values,choices,total] of [['1_11',1,[1,5],[1],5],['5_5',1,[1,5],[0],1],['5_5',2,[1,5,0],[0,1],6]])test('Gambler’s Luck '+bp+' adds '+amount+' and selects battle destinies',()=>{
 const f=fixture(bp),cards=top(f.m,values);let m=ready(play(f,amount));assert.equal(m.cards[f.luck].zone,'lost');m=step(m,'draw-destiny');m=selection(m);assert.equal(m.players.light.destiny.length,values.length);for(const i of choices)m=step(m,'destiny-choice:'+i);m=done(m);assert.equal(combat.battle(m).destiny.light,total);assert.deepEqual(combat.battle(m).destinyPlans.light.draws.map(d=>d.value),choices.map(i=>values[i]));assert.ok(cards.every(id=>m.cards[id].zone==='used'));m=seek(m,x=>event(x)?.kind==='battle-result');assert.equal(combat.battle(m).attrition.dark,total);
});
test('skipping the scheduled draws declines all rather than offering a subset',()=>{const f=fixture();let m=ready(play(f)),reserve=[...m.players.light.reserve];m=step(m,'skip-destiny');m=done(m);assert.equal(combat.battle(m).destiny.light,null);assert.deepEqual(m.players.light.reserve,reserve)});
test('ordinary ability draw remains in addition to the selected group and shares one total',()=>{
 const f=fixture();let m=play(f);m=seek(m,x=>event(x)?.kind==='battle-weapons');pull(m,'light','101_2','table',f.site);combat.syncBattle(m);const cards=top(m,[1,5,0,3]);m=ready(m);m=step(m,'draw-destiny');m=selection(m);m=step(m,'destiny-choice:0');m=step(m,'destiny-choice:1');assert.equal(event(m).kind,'about-to-draw-destiny');m=done(m);assert.equal(combat.battle(m).destiny.light,9);assert.deepEqual(combat.battle(m).destinyPlans.light.draws.map(d=>d.value),[1,5,3]);assert.ok(cards.every(id=>m.cards[id].zone==='used'));
});
test('initiation requires the defending gambler alone in the weapons segment',()=>{
 const f=fixture('1_11');assert.ok(ids(f.m).includes('gamblers-luck:'+f.luck+':1'));assert.ok(!ids(f.m).includes('gamblers-luck:'+f.luck+':2'));pull(f.m,'light','1_28','table',f.site);combat.syncBattle(f.m);assert.ok(!ids(f.m).some(id=>id.startsWith('gamblers-luck:')));const g=fixture();combat.battle(g.m).initiator='light';assert.ok(!ids(g.m).some(id=>id.startsWith('gamblers-luck:')));
});
test('canceling Luck grants no draw and still disposes the Interrupt',()=>{const f=fixture();let m=play(f);m.stack.at(-2).cancelled=true;m=done(m);assert.equal(combat.battle(m).gamblersLuck,undefined);assert.equal(combat.battle(m).destiny.light,null);assert.equal(m.cards[f.luck].zone,'lost')});
test('later arrival and departure cannot retroactively cancel a successful scheduled addition',()=>{
 const f=fixture();let m=play(f);m=seek(m,x=>event(x)?.kind==='battle-weapons');state.moveCard(m,f.character,'hand');pull(m,'light','1_28','table',f.site);combat.syncBattle(m);top(m,[1,5,0]);m=ready(m);m=step(m,'draw-destiny');m=done(m);assert.equal(combat.battle(m).destiny.light,6);
});
test('site ability prohibition applies to the added destinies too',()=>{const f=fixture('5_5','1_293');let m=done(play(f));assert.equal(combat.battle(m).destiny.light,null);assert.equal(m.players.light.destiny.length,0)});
for(const canceled of [false,true])test('unique Luck blocks another copy this turn, canceled='+canceled,()=>{
 const f=fixture();let m=play(f);if(canceled)m.stack.at(-2).cancelled=true;m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('gamblers-luck:')));assert.throws(()=>step(m,'gamblers-luck:'+f.copy+':2'));m.turn.number++;assert.ok(ids(m).includes('gamblers-luck:'+f.copy+':2'));
});
test('Han’s Dice redraws a selection candidate without losing the group continuation',()=>{
 const f=fixture('1_11'),cards=top(f.m,[1,5,0]);let m=ready(play(f,1));m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');m=step(m,'dice:'+f.dice+':'+f.character);m=selection(m);assert.deepEqual(prompt(m).choices.map(c=>c.label.split(' · ')[1]),['5','0']);m=step(m,'destiny-choice:0');m=done(m);assert.equal(combat.battle(m).destiny.light,5);assert.deepEqual(m.players.light.used.slice(0,4),[cards[2],cards[1],cards[0],f.dice]);
});
test('Smoke Screen substitutes one candidate, which Dice cannot redraw',()=>{
 const f=fixture('1_11'),smoke=pull(f.m,'light','5_69');top(f.m,[1,5]);let m=ready(play(f,1));m=convert(step(m,'draw-destiny'));m=priority(m,'light');assert.ok(ids(m).includes('smoke:'+smoke+':'+f.character));m=step(m,'smoke:'+smoke+':'+f.character);m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('dice:')));m=selection(m);m=step(m,'destiny-choice:0');m=done(m);assert.equal(combat.battle(m).destiny.light,3);assert.equal(combat.battle(m).destinyPlans.light.draws[0].substitution.value,3);
});
test('canceled candidate is unavailable, with surviving chosen values used for attrition',()=>{
 const f=fixture();top(f.m,[1,5,0]);let m=ready(play(f));m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m.stack.at(-2).cancelled=true;m=selection(m);assert.deepEqual(ids(m),['destiny-choice:1','destiny-choice:2']);m=done(m);assert.equal(combat.battle(m).destiny.light,5);
});
test('total modifier is applied once to the aggregate selected battle destiny',()=>{
 const f=fixture();top(f.m,[1,5,0]);let m=ready(play(f));m=step(m,'draw-destiny');m=selection(m);m=step(m,'destiny-choice:0');m=step(m,'destiny-choice:1');assert.equal(event(m).kind,'destiny-total');m.stack.at(-2).action.payload.total=9;m=done(m);assert.equal(combat.battle(m).destiny.light,9);assert.deepEqual(combat.battle(m).destinyPlans.light.draws.map(d=>d.value),[1,5]);
});
test('foreign, stale and malformed planned commands fail before changing the match',()=>{
 const f=fixture();top(f.m,[1,5,0]);let m=ready(play(f));m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');let bad=clone(m);bad.stack.at(-2).action.payload.flow.side='dark';assert.throws(()=>prompt(bad));bad=clone(m);bad.stack.at(-2).action.payload.flow.reference.version=999;assert.throws(()=>prompt(bad));m=selection(m);const before=clone(m);assert.throws(()=>step(m,'destiny-choice:0','dark'));assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:'destiny-choice:0'}));assert.deepEqual(m,before);
});

test('insufficient Reserve still yields the surviving selected battle destiny',()=>{
 const f=fixture();const card=top(f.m,[1])[0];for(const id of [...f.m.players.light.reserve])if(id!==card)state.moveCard(f.m,id,'hand');let m=ready(play(f));m=step(m,'draw-destiny');m=selection(m);assert.equal(ids(m).length,1);m=done(m);assert.equal(combat.battle(m).destiny.light,1);assert.equal(m.cards[card].zone,'used');
});
test('concession freezes a partly selected group without discarding the rest',()=>{
 const f=fixture(),cards=top(f.m,[1,5,0]);let m=selection(step(ready(play(f)),'draw-destiny'));m=step(m,'destiny-choice:0');m=step(m,'concede','light');assert.equal(m.result.winner,'dark');assert.equal(m.cards[cards[0]].zone,'used');assert.ok(cards.slice(1).every(id=>m.cards[id].zone==='destiny'));
});
test('planned draw source and batch linkage cannot be forged in saved continuations',()=>{
 const f=fixture();top(f.m,[1,5,0]);let m=step(ready(play(f)),'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');for(const mutate of [f=>f.source='not-a-card',f=>f.category='weapon',f=>f.retain=false,f=>f.next.handler='battle:plan-draw']){const bad=clone(m);mutate(bad.stack.at(-2).action.payload.flow);assert.throws(()=>prompt(bad));}
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/gamblers-luck-results.json',import.meta.url)));
for(const ref of oracle.filter(r=>r.name!=='delay'))test('actual GEMP Gambler’s Luck: '+ref.name,()=>{
 const mode=ref.name,one=['han-one','lando-one','dice','smoke-delay'].includes(mode),f=fixture(['han-one','dice','smoke-delay'].includes(mode)?'1_11':'5_5');let m=play(f,one?1:2);
 if(mode==='canceled')m.stack.at(-2).cancelled=true;
 m=seek(m,x=>event(x)?.kind==='battle-weapons');
 if(['base-plus','delay-base','smoke-delay'].includes(mode)){pull(m,'light','101_2','table',f.site);combat.syncBattle(m)}
 if(mode==='departed'){state.moveCard(m,f.character,'hand');pull(m,'light','1_28','table',f.site);combat.syncBattle(m)}
 if(mode==='repeat'){m=priority(m,'light');assert.equal(ids(m).some(id=>id.startsWith('gamblers-luck:'+f.copy+':')),ref.repeatAvailable)}
 const smoke=mode==='smoke-delay'?pull(m,'light','5_69'):null;
 const values=mode==='short'?[1]:['base-plus','delay-base'].includes(mode)?[1,5,0,3]:[1,5,0],cards=top(m,values);
 if(mode==='short')for(const id of [...m.players.light.reserve])if(id!==cards[0])state.moveCard(m,id,'hand');
 let usedDice=false,usedSmoke=false;const seen=new Set(),events=[];
 for(let guard=0;guard<500&&event(m)?.kind!=='battle-result';guard++){
  const e=event(m),frame=m.stack.at(-1);
  if(e&&e.side==='light'&&!seen.has(frame.serial)){
   seen.add(frame.serial);const stage={'about-to-draw-destiny':'before','battle-destiny-drawn':'drawn','destiny-draw-complete':'complete','destiny-total':'total'}[e.kind];
   if(stage)events.push({stage,value:stage==='before'?null:stage==='drawn'?combat.battle(m).destiny.light:stage==='total'?e.total:e.value,unresolved:m.players.light.destiny.length});
  }
  const p=prompt(m);
  if(frame.handler==='battle:destiny'){m=step(m,p.side==='dark'||mode==='skip'?'skip-destiny':'draw-destiny');continue}
  if(mode==='dice'&&!usedDice&&ids(m).includes('dice:'+f.dice+':'+f.character)){m=step(m,'dice:'+f.dice+':'+f.character);usedDice=true;continue}
  if(smoke&&!usedSmoke&&ids(m).includes('smoke:'+smoke+':'+f.character)){m=step(m,'smoke:'+smoke+':'+f.character);usedSmoke=true;continue}
  const conversion=ids(m).find(id=>id.startsWith('gamblers-select:'));
  if(conversion&&mode!=='decline'&&(mode!=='delay-base'||events.some(e=>e.stage==='complete'))){m=step(m,conversion);continue}
  if(frame.handler==='selection:choose'){m=step(m,ids(m)[0]);continue}
  assert.ok(ids(m).includes('pass'),JSON.stringify({mode,frame,p}));m=step(m,'pass');
 }
 assert.equal(event(m).kind,'battle-result');const b=combat.battle(m);assert.deepEqual(events,ref.events);assert.equal(b.attrition.dark,ref.darkAttrition);assert.equal(b.damage.dark,ref.darkDamage);assert.equal(b.damage.light,ref.lightDamage);assert.equal(m.cards[f.luck].zone==='lost',ref.luckLost);
 const labels=new Map(cards.map((id,i)=>[id,{0:'zero',1:'one',3:'three',5:'five'}[values[i]]]));assert.deepEqual(m.players.light.used.filter(id=>labels.has(id)).map(id=>labels.get(id)),ref.used);
});

function beforeDraw(f,amount=2){return step(ready(play(f,amount)),'draw-destiny')}
function passWindow(m){const serial=m.stack.at(-1).serial;while(m.stack.at(-1)?.serial===serial)m=step(m,'pass');return m}
function beforeNext(m){return seek(m,x=>event(x)?.kind==='about-to-draw-destiny')}

test('optional conversion belongs to the draw owner and reveals no card before its choice',()=>{
 const f=fixture();top(f.m,[1,5,0]);let m=beforeDraw(f),reserve=[...m.players.light.reserve];assert.ok(!ids(m).some(id=>id.startsWith('gamblers-select:')));m=priority(m,'light');assert.ok(ids(m).includes('gamblers-select:'+f.luck));assert.deepEqual(m.players.light.reserve,reserve);assert.equal(m.players.light.destiny.length,0);assert.throws(()=>step(m,'gamblers-select:'+f.luck,'dark'));
 const pending=step(m,'gamblers-select:'+f.luck);assert.deepEqual(pending.players.light.reserve,reserve);assert.equal(pending.cards[f.luck].zone,'lost');assert.deepEqual(runtime.prompt(pending,rules,'light'),runtime.prompt(clone(pending),rules,'light'));
});

test('conversion cannot recursively reapply within its group or after it finishes',()=>{
 const f=fixture();let m=play(f);m=seek(m,x=>event(x)?.kind==='battle-weapons');pull(m,'light','101_2','table',f.site);combat.syncBattle(m);top(m,[1,5,0,3]);m=convert(step(ready(m),'draw-destiny'));let before=0;
 for(let i=0;i<300&&event(m)?.kind!=='battle-destiny-complete';i++){
  const p=prompt(m);assert.ok(!p.choices.some(c=>c.id.startsWith('gamblers-select:')));if(event(m)?.kind==='about-to-draw-destiny'&&m.stack.at(-1).passes===0)before++;m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id);
 }
 assert.equal(before,4);assert.equal(combat.battle(m).destiny.light,9);
});

test('canceling conversion preserves ordinary draws and consumes only its once-per-battle use',()=>{
 const f=fixture(),cards=top(f.m,[1,5,0]);let m=priority(beforeDraw(f),'light');m=step(m,'gamblers-select:'+f.luck);m.stack.at(-2).cancelled=true;m=done(m);assert.equal(combat.battle(m).destiny.light,6);assert.equal(combat.battle(m).destinyPlans.light.selection,null);assert.equal(m.cards[cards[2]].zone,'reserve');assert.equal(m.cards[f.luck].zone,'lost');
});

test('Smoke Screen first blocks conversion for that draw but leaves a later eligible draw available',()=>{
 const f=fixture('1_11'),smoke=pull(f.m,'light','5_69');let m=play(f,1);m=seek(m,x=>event(x)?.kind==='battle-weapons');pull(m,'light','101_2','table',f.site);combat.syncBattle(m);top(m,[1,5]);m=priority(step(ready(m),'draw-destiny'),'light');m=step(m,'smoke:'+smoke+':'+f.character);m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny'&&x.stack.at(-2)?.action.payload.substitution);m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('gamblers-select:')));m=passWindow(m);m=beforeNext(m);m=priority(m,'light');assert.ok(ids(m).includes('gamblers-select:'+f.luck));m=convert(m);m=done(m);assert.equal(combat.battle(m).destiny.light,4);
});

test('conversion with too few remaining scheduled draws is explicitly unverified, not a dangling group',()=>{
 const f=fixture(),cards=top(f.m,[1,5,0,3]);let m=beforeDraw(f);m=passWindow(m);m=beforeNext(m);m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('gamblers-select:')));m=done(m);assert.equal(combat.battle(m).destiny.light,6);assert.equal(m.players.light.destiny.length,0);assert.equal(m.cards[cards[2]].zone,'reserve');
 const ref=oracle.find(r=>r.name==='delay');assert.ok(ref);assert.equal(ref.events.at(-1).value,1);assert.equal(ref.events.at(-1).unresolved,2);assert.deepEqual(ref.used,['one']);
});

test('empty Reserve during conversion responses terminates with a failed set and no stranded cards',()=>{
 const f=fixture();let m=priority(beforeDraw(f),'light');m=step(m,'gamblers-select:'+f.luck);for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=done(m);assert.equal(combat.battle(m).destiny.light,null);assert.equal(m.players.light.destiny.length,0);assert.equal(combat.battle(m).destinyPlans.light.remaining,0);
});

test('pending conversion refuses stale commands and forged draw ownership or linkage',()=>{
 const f=fixture();let m=priority(beforeDraw(f),'light');const before=clone(m);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:'gamblers-select:'+f.luck}));assert.deepEqual(m,before);m=step(m,'gamblers-select:'+f.luck);
 for(const mutate of [p=>p.pendingIndex=999,p=>p.pendingId='other',p=>p.card=f.copy,p=>p.amount=1]){const bad=clone(m);mutate(bad.stack.at(-2).action.payload);assert.throws(()=>prompt(bad));}
});

test('concession during conversion keeps the exact frozen pending draw',()=>{
 const f=fixture();let m=priority(beforeDraw(f),'light');m=step(m,'gamblers-select:'+f.luck);const reserve=[...m.players.light.reserve];m=step(m,'concede','light');assert.equal(m.result.winner,'dark');assert.deepEqual(m.players.light.reserve,reserve);assert.equal(m.players.light.destiny.length,0);assert.equal(runtime.prompt(m,rules,'light'),null);
});
