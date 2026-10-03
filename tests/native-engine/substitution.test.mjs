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
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,resolve:(m,r,c)=>{if(r.action.handler==='probe:done')m.data.observed=r.action.payload;else premiereRules.resolve(m,r,c)}};
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


const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));

const event=m=>m.stack.at(-1)?.event;
const pending=m=>m.stack.at(-2);
function fixture(){
 let m=fresh({light:['5_69','5_69','1_84','1_28','1_28','1_5','1_115'],dark:['101_5','1_194']});
 const site=location(m,'light','1_129'),remote=location(m,'light','1_130'),luke=pull(m,'light','101_2','table',site),rebel=pull(m,'light','1_28','table',site),away=pull(m,'light','1_28','table',remote),droid=pull(m,'light','1_5','table',site),vader=pull(m,'dark','101_5','table',site),smoke=pull(m,'light','5_69','hand'),second=pull(m,'light','5_69','hand'),dice=pull(m,'light','1_84','hand');
 force(m,'light',5);force(m,'dark',5);m=phase(m,'battle');m=step(m,'battle:'+site);
 m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');const drawn=topDestiny(m,'light','1_28');m=step(m,'draw-destiny');m=priority(m,'light');return {m,site,remote,luke,rebel,away,droid,vader,smoke,second,dice,drawn};
}
const smokeId=(f,target=f.luke,card=f.smoke)=>'smoke:'+card+':'+target;
const play=f=>step(f.m,smokeId(f));
const finished=m=>seek(m,x=>event(x)?.kind==='battle-destiny-complete');
const total=m=>seek(m,x=>event(x)?.kind==='destiny-total'&&event(x)?.side==='light');
function outcome(m){const b=combat.battle(m);return {value:b.destiny.light,card:b.destinyCards.light,draw:b.destinyDraws.light};}

test('Smoke Screen substitutes Luke ability without moving or revealing a Reserve card',()=>{
 const f=fixture(),reserve=[...f.m.players.light.reserve];let m=play(f);assert.equal(m.cards[f.smoke].zone,'playing');m=finished(m);
 assert.equal(outcome(m).value,3);assert.equal(outcome(m).card,null);assert.equal(m.cards[f.smoke].zone,'lost');assert.deepEqual(m.players.light.reserve,reserve);assert.equal(m.players.light.destiny.length,0);assert.equal(m.players.light.used.includes(f.smoke),false);
 assert.deepEqual(outcome(m).draw,{card:null,value:3,substitution:{source:f.smoke,value:3}});
});
test('only own characters with ability participating at this site are Smoke Screen targets',()=>{
 const f=fixture();assert.ok(ids(f.m).includes(smokeId(f)));assert.ok(ids(f.m).includes(smokeId(f,f.rebel)));for(const target of [f.away,f.droid,f.vader])assert.ok(!ids(f.m).includes(smokeId(f,target)));
 let m=step(f.m,smokeId(f,f.rebel));m=finished(m);assert.equal(outcome(m).value,1);
});
test('empty Reserve at initiation disallows Smoke Screen even in a lingering before-draw window',()=>{
 const f=fixture();for(const id of [...f.m.players.light.reserve])state.moveCard(f.m,id,'hand');assert.ok(!ids(f.m).some(id=>id.startsWith('smoke:')));const m=finished(f.m);assert.equal(outcome(m).value,null);
});
test('canceled Smoke Screen loses its source and restores normal physical draw',()=>{
 const f=fixture();let m=play(f);pending(m).cancelled=true;m=finished(m);assert.equal(outcome(m).value,1);assert.equal(outcome(m).card,f.drawn);assert.equal(m.cards[f.drawn].zone,'used');assert.equal(m.cards[f.smoke].zone,'lost');assert.equal(outcome(m).draw.substitution,undefined);
});
for(const mode of ['target-leave','reserve-empty'])test('initiated Smoke Screen survives '+mode,()=>{
 const f=fixture();let m=play(f);if(mode==='target-leave')state.moveCard(m,f.luke,'hand');else for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=finished(m);assert.equal(outcome(m).value,3);assert.equal(outcome(m).card,null);
});
test('substituted battle destiny cannot be canceled, reset, modified or targeted by Dice',()=>{
 const f=fixture();let m=seek(play(f),x=>event(x)?.kind==='battle-destiny-drawn');assert.equal(event(m).substituted,true);assert.equal(event(m).card,null);m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('dice:')));
 pending(m).cancelled=true;combat.battle(m).destiny.light=0;m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(event(m).value,3);m=finished(m);assert.equal(outcome(m).value,3);
});
test('substituted values still allow destiny total modification without altering the locked draw',()=>{
 const f=fixture();let m=total(play(f));assert.deepEqual(event(m).draws,[{card:null,value:3,substitution:{source:f.smoke,value:3}}]);pending(m).action.payload.total=6;m=finished(m);assert.equal(outcome(m).value,6);assert.equal(outcome(m).draw.value,3);
});
test('a completed substitute blocks another Smoke Screen for the same draw',()=>{
 const f=fixture();let m=seek(play(f),x=>x.cards[f.smoke].zone==='lost');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('smoke:')));assert.equal(m.cards[f.second].zone,'hand');
});
test('Smoke Screen is not an ordinary action and cannot answer a weapon draw',()=>{
 const f=fixture();const w=f.m.stack.at(-1),original=clone(w.event);w.event={...original,category:'weapon'};assert.ok(!ids(f.m).some(id=>id.startsWith('smoke:')));w.event={...original,kind:'battle-weapons'};assert.ok(!ids(f.m).some(id=>id.startsWith('smoke:')));
});
test('Smoke Screen rejects stale, foreign, forged and corrupted continuations atomically',()=>{
 const f=fixture(),before=clone(f.m);assert.throws(()=>step(f.m,smokeId(f),'dark'));assert.throws(()=>runtime.applyCommand(f.m,rules,'light',{revision:f.m.revision-1,choice:smokeId(f)}));assert.throws(()=>step(f.m,smokeId(f,f.vader)));assert.deepEqual(f.m,before);
 const m=play(f);for(const corrupt of [p=>p.pendingId='missing',p=>p.pendingIndex=-1,p=>p.target=f.vader]){const bad=clone(m);corrupt(pending(bad).action.payload);assert.throws(()=>prompt(bad),/Invalid Smoke Screen/);}
});
test('concession revokes Smoke Screen and its underlying draw without exposing a card',()=>{
 const f=fixture(),m=step(play(f),'concede','dark');assert.equal(m.status,'finished');assert.equal(m.cards[f.drawn].zone,'reserve');assert.equal(runtime.prompt(m,rules,'light'),null);
});

function general(value,modifier=0){let m=fresh({light:['5_69']});const source=pull(m,'light','5_69','playing');m=phase(m);const card=m.players.light.reserve[0];destiny.drawDestiny(m,'light',source,'probe',{id:'done',label:'Observe',handler:'probe:done',payload:{}},true,modifier);m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny');assert.equal(destiny.substituteDestiny(m,pending(m),source,value),true);return {m,source,card};}
for(const value of [0,3])test('generic substitute '+value+' is a successful draw with no card and ignores individual modifiers',()=>{
 const f=general(value,8);let m=seek(f.m,x=>event(x)?.kind==='destiny-drawn');assert.equal(event(m).substituted,true);assert.equal(event(m).value,value);pending(m).cancelled=true;pending(m).action.payload.draw.value=12;m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(event(m).value,value);pending(m).action.payload.draw.value=15;m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,value);pending(m).action.payload.total=value+2;m=seek(m,x=>!!x.data.observed);assert.equal(m.data.observed.draw.value,value+2);assert.equal(m.data.observed.draw.substitution.value,value);assert.equal(m.cards[f.card].zone,'reserve');assert.equal(m.cards[f.source].zone,'playing');
});
test('shared substitute only modifies the specified pending draw once',()=>{
 const f=general(3),p=pending(f.m);assert.equal(destiny.substituteDestiny(f.m,p,f.source,6),false);assert.equal(destiny.substituteDestiny(f.m,clone(p),f.source,6),false);assert.throws(()=>destiny.substituteDestiny(f.m,p,f.source,-1));assert.throws(()=>destiny.substituteDestiny(f.m,p,'missing',1));
});
test('malformed substitutions cannot disguise a failed draw or a physical card',()=>{
 const f=general(3);for(const corrupt of [p=>p.substitution.value=-1,p=>p.substitution.source='missing']){const m=clone(f.m);corrupt(pending(m).action.payload);assert.throws(()=>prompt(m),/Invalid destiny initiation/);}
 for(const d of [{card:null,value:3},{card:f.card,value:3,substitution:{source:f.source,value:3}},{card:null,value:null,substitution:{source:f.source,value:3}},{card:null,value:3,substitution:{source:'missing',value:3}}])assert.equal(destiny.validDraw(f.m,d,'light'),false);
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/substitution-results.json',import.meta.url)));
for(const mode of ['normal','target-leave','reserve-empty','canceled'])test('Smoke Screen matches executed GEMP: '+mode,()=>{
 const f=fixture();let m=play(f);
 if(mode==='target-leave')state.moveCard(m,f.luke,'hand');
 if(mode==='reserve-empty')for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');
 if(mode==='canceled')pending(m).cancelled=true; // Reference uses actual Sense; native Sense is separate required work.
 const reserve=m.players.light.reserve.length,events=[],drawn=new Set(),seen=new Set();let diceOffered=false;
 for(let i=0;i<200;i++){
  const w=m.stack.at(-1),e=event(m);
  if(e&&!seen.has(w.serial)){
   seen.add(w.serial);const stage=e.kind==='about-to-draw-destiny'?'before':e.kind==='battle-destiny-drawn'?'drawn':e.kind==='destiny-draw-complete'?'complete':e.kind==='destiny-total'?'total':null;
   if(stage&&e.side==='light'){
    if(stage==='drawn'&&e.card)drawn.add(e.card);
    events.push({stage,side:'light',value:stage==='before'?null:stage==='total'?e.total:stage==='complete'?e.value:combat.battle(m).destiny.light,unresolved:[...drawn].filter(id=>m.cards[id].zone==='destiny').length,used:[...drawn].filter(id=>m.cards[id].zone==='used').length});
    if(stage==='total')break;
   }
  }
  const p=prompt(m);if(p.side==='light'&&p.choices.some(c=>c.id.startsWith('dice:')))diceOffered=true;m=step(m,'pass');
 }
 assert.equal(events.at(-1)?.stage,'total');assert.deepEqual({name:mode,events,cardsDrawn:reserve-m.players.light.reserve.length,smokeLost:m.cards[f.smoke].zone==='lost',diceOffered},oracle.find(r=>r.name===mode));
});
