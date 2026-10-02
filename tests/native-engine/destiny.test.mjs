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
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/destiny-results.json',import.meta.url)));
function conformance(name,events){assert.deepEqual(events,oracle.find(r=>r.name===name)?.events,name)}
const next={id:'observed',label:'Record result',handler:'probe:done',payload:{}};
const event=m=>m.stack.at(-1)?.event;
function general(value=1,before=false){let m=fresh({dark:['1_194','1_285']});const source=pull(m,'dark','1_251','playing');force(m,'dark',3);m=phase(m,'deploy');
 if(value===null)for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else topDestiny(m,'dark',value===0?'1_285':'1_194');
 destiny.drawDestiny(m,'dark',source,'reinforcements',next);if(value===null)destiny.resolveDestiny(m,m.stack.pop());else if(!before)m=seek(m,x=>event(x)?.kind==='destiny-drawn');return{m,source,card:(before?m.players.dark.reserve[0]:m.players.dark.destiny[0])??null};
}
function finish(m){return seek(m,x=>!!x.data.observed)}
function trace(m,done=x=>!!x.data.observed,includeBefore=false){const seen=new Set(),events=[],drawn={dark:[],light:[]};
 for(let i=0;i<500&&!done(m);i++){
  const e=event(m),w=m.stack.at(-1);if(e&&!seen.has(w.serial)){
   seen.add(w.serial);let stage=includeBefore&&e.kind==='about-to-draw-destiny'?'before':['destiny-drawn','battle-destiny-drawn','weapon-destiny-drawn'].includes(e.kind)?'drawn':e.kind==='destiny-draw-complete'?'complete':e.kind==='destiny-total'?'total':null;
   if(stage){let side=e.side??(e.card?m.cards[e.card].owner:null);if(stage==='drawn')drawn[side].push(e.card);let value=stage==='before'?null:stage==='total'?e.total:stage==='complete'?e.value:e.value??board.printed(m,e.card,'destiny');events.push({stage,side,value,unresolved:drawn[side].filter(id=>m.cards[id].zone==='destiny').length,used:drawn[side].filter(id=>m.cards[id].zone==='used').length});}
  }
  const p=prompt(m);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id);
 }assert.ok(done(m));return{m,events};
}
for(const value of [0,1])test('general destiny '+value+' completes before Used placement and totals afterward',()=>{
 const f=general(value),t=trace(f.m);conformance('general-'+value,t.events);assert.deepEqual(t.events,[{stage:'drawn',side:'dark',value,unresolved:1,used:0},{stage:'complete',side:'dark',value,unresolved:1,used:0},{stage:'total',side:'dark',value,unresolved:0,used:1}]);assert.deepEqual(t.m.data.observed.draw,{card:f.card,value});assert.equal(t.m.data.observed.total,value);
});

test('empty and canceled draws never acquire completed-draw or total events',()=>{
 const f=general(null);assert.equal(event(f.m).kind,'destiny-failed');let t=trace(f.m);conformance('general-empty',t.events);assert.deepEqual(t.events,[]);assert.equal(t.m.data.observed.total,null);
 const g=general(1);g.m.stack.at(-2).cancelled=true;t=trace(g.m);assert.deepEqual(t.events.map(e=>e.stage),['drawn']);assert.equal(t.m.data.observed.draw.value,null);assert.equal(t.m.cards[g.card].zone,'used');
});

test('negative draw resets to zero on completion; total modifiers stay separate from individual draws',()=>{
 let {m,card}=general(1);m.stack.at(-2).action.payload.draw.value=-4;m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(event(m).value,0);assert.equal(m.cards[card].zone,'destiny');m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,0);m.stack.at(-2).action.payload.total=3;m=finish(m);assert.equal(m.data.observed.total,3);assert.deepEqual(m.data.observed.draws,[{card,value:0}]);assert.equal(m.data.observed.draw.value,3);
});

test('negative total modifiers floor at zero without turning a failed total into zero',()=>{
 let f=general(1),m=seek(f.m,x=>event(x)?.kind==='destiny-total');m.stack.at(-2).action.payload.total=-5;m=finish(m);assert.equal(m.data.observed.total,0);assert.equal(m.data.observed.draws[0].value,1);
 f=general(null);m=finish(f.m);assert.equal(m.data.observed.total,null);
});

test('moving a completed physical card to Lost preserves its value and does not return it to Used',()=>{
 const f=general();let m=seek(f.m,x=>event(x)?.kind==='destiny-draw-complete');state.moveCard(m,f.card,'lost');m=finish(m);assert.equal(m.data.observed.total,1);assert.equal(m.cards[f.card].zone,'lost');assert.ok(!m.players.dark.used.includes(f.card));
});

function battleFixture(){let m=fresh({light:['1_84','1_115','1_153','1_124'],dark:['1_186','1_194']});const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site),rebel=pull(m,'light','1_28','table',site),trooper=pull(m,'dark','1_194','table',site),droid=pull(m,'dark','1_186','table',site),dice=pull(m,'light','1_84','hand'),gun=pull(m,'light','1_153','table',site);m.cards[gun].attachedTo=luke;force(m,'dark',4);force(m,'light',6);m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');return{m,site,luke,rebel,trooper,droid,dice,gun}}

test('weapon zero totals zero; rifle adds one only to the hit comparison',()=>{
 const f=battleFixture();let m=priority(f.m,'light');topDestiny(m,'light','1_124');m=step(m,'fire:'+f.gun+':'+f.droid);m=seek(m,x=>event(x)?.kind==='weapon-destiny-drawn');const card=event(m).card;
 const t=trace(m,x=>event(x)?.kind==='weapon-fired');conformance('weapon-zero',t.events);assert.deepEqual(t.events,[{stage:'drawn',side:'light',value:0,unresolved:1,used:0},{stage:'complete',side:'light',value:0,unresolved:1,used:0},{stage:'total',side:'light',value:0,unresolved:0,used:1}]);assert.equal(combat.battle(t.m).shots[0].destiny,0);assert.equal(combat.battle(t.m).shots[0].total,0);assert.ok(combat.battle(t.m).hits.includes(f.droid));assert.equal(t.m.cards[card].zone,'used');
});

test('canceling weapon destiny leaves no hit even with a positive rifle bonus',()=>{
 const f=battleFixture();let m=priority(f.m,'light');topDestiny(m,'light','1_124');m=step(m,'fire:'+f.gun+':'+f.droid);m=seek(m,x=>event(x)?.kind==='weapon-destiny-drawn');const card=event(m).card;m.stack.at(-2).cancelled=true;const t=trace(m,x=>event(x)?.kind==='weapon-fired');assert.deepEqual(t.events.map(e=>e.stage),['drawn']);assert.equal(combat.battle(t.m).shots[0].total,null);assert.equal(combat.battle(t.m).shots[0].hit,false);assert.equal(t.m.cards[card].zone,'used');
});

test('battle destiny receives completed and total windows; Dice cannot target an already completed draw',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');topDestiny(m,'light','1_28');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');const card=event(m).card;assert.equal(m.cards[card].zone,'destiny');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('dice:')));m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(m.cards[card].zone,'used');m.stack.at(-2).action.payload.total=4;m=seek(m,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.light,4);assert.equal(combat.battle(m).destinyCards.light,card);
});

test('a canceled battle destiny is cleaned up without completion, total or attrition',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');const card=event(m).card;m.stack.at(-2).cancelled=true;const t=trace(m,x=>event(x)?.kind==='battle-damage');assert.deepEqual(t.events.map(e=>e.stage),['drawn']);assert.equal(combat.battle(t.m).destiny.light,null);assert.equal(combat.battle(t.m).attrition.dark,0);assert.equal(t.m.cards[card].zone,'used');
});

test('Han’s Dice canceled original has no completion trigger; only its replacement completes',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');const replacement=topDestiny(m,'light','1_115'),original=topDestiny(m,'light','1_28');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');m=step(m,'dice:'+f.dice+':'+f.luke);const t=trace(m,x=>event(x)?.kind==='battle-destiny-complete');conformance('battle-redraw',t.events);assert.deepEqual(t.events.map(e=>[e.stage,e.value]),[['drawn',1],['drawn',5],['complete',5],['total',5]]);assert.deepEqual(t.m.players.light.used.slice(0,3),[replacement,original,f.dice]);
});

test('completion and total continuations reject forged values and stale/opposing commands',()=>{
 let f=general(),m=seek(f.m,x=>event(x)?.kind==='destiny-draw-complete');const before=clone(m);assert.throws(()=>step(m,'pass','dark'),/Illegal/);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:'pass'}),/Stale/);assert.deepEqual(m,before);
 const bad=clone(m);bad.stack.at(-2).action.payload.draw.value=-1;assert.throws(()=>prompt(bad),/Invalid pending destiny/);m=seek(m,x=>event(x)?.kind==='destiny-total');const noTotal=clone(m);noTotal.stack.at(-2).action.payload.total=null;assert.throws(()=>prompt(noTotal),/Invalid destiny total/);
});


function duelFixture(dark=[1,1],light=[1,1]){
 let m=fresh({dark:['101_6','1_194','1_194'],light:['1_28','1_28']});const site=location(m,'light','1_129'),from=location(m,'dark','1_293'),vader=pull(m,'dark','101_5','table',from);pull(m,'light','101_2','table',site);const source=pull(m,'dark','101_6','hand');force(m,'dark',5);force(m,'light',5);m=phase(m,'move');
 for(const side of ['dark','light']){for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');for(const value of (side==='dark'?dark:light).slice().reverse()){const id=m.players[side].hand.find(id=>id!==source&&board.printed(m,id,'destiny')===value);assert.ok(id);state.moveCard(m,id,'reserve');}}
 m=step(m,'move:'+vader+':'+site);m=seek(m,x=>event(x)?.kind==='moved');m=priority(m,'dark');m=step(m,'duel:obsession:'+source);return{m,source};
}

test('a duel completes each draw before the next and exposes one combined total per player',()=>{
 const f=duelFixture();const t=trace(f.m,x=>event(x)?.kind==='duel-result');assert.deepEqual(t.events.map(e=>[e.stage,e.side,e.value,e.unresolved,e.used]),[
 ['drawn','dark',1,1,0],['complete','dark',1,1,0],['drawn','dark',1,1,1],['complete','dark',1,1,1],['total','dark',2,0,2],
 ['drawn','light',1,1,0],['complete','light',1,1,0],['drawn','light',1,1,1],['complete','light',1,1,1],['total','light',2,0,2]]);assert.deepEqual(t.m.data.duel.destinyTotals,{dark:2,light:2});assert.deepEqual(t.m.data.duel.total,{dark:6,light:4});
});

test('duel total modification changes the result without rewriting individual destiny history',()=>{
 let {m}=duelFixture();m=seek(m,x=>event(x)?.kind==='destiny-total'&&event(x).side==='light');m.stack.at(-2).action.payload.total=7;m=seek(m,x=>event(x)?.kind==='duel-result');assert.deepEqual(m.data.duel.draws.light.map(d=>d.value),[1,1]);assert.equal(m.data.duel.destinyTotals.light,7);assert.equal(m.data.duel.winner,'light');assert.equal(m.data.duel.difference,3);
});

test('partial duel draws retain their total; entirely failed draws generate no complete or total events',()=>{
 const t=trace(duelFixture([1],[]).m,x=>event(x)?.kind==='duel-result');assert.deepEqual(t.events.map(e=>[e.stage,e.side,e.value]),[['drawn','dark',1],['complete','dark',1],['total','dark',1]]);assert.deepEqual(t.m.data.duel.destinyTotals,{dark:1,light:null});assert.equal(t.m.data.duel.difference,null);
});

test('completed-draw response can finish a nested retrieval before the drawn card reaches Used',()=>{
 const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));const f=general();let m=seek(f.m,x=>event(x)?.kind==='destiny-draw-complete');const lost=pull(m,'dark','1_194','lost');
 // Exercise the response effect itself through the same serialized retrieval
 // subsystem; this is kernel coverage, not admission of a new response card.
 retrieval.retrieve(m,'dark',f.source,1);m=seek(m,x=>event(x)?.kind==='retrieval-complete');assert.equal(m.cards[f.card].zone,'destiny');assert.equal(m.cards[lost].zone,'used');m=finish(m);assert.deepEqual(m.players.dark.used.slice(0,2),[f.card,lost]);assert.equal(m.data.observed.total,1);
});


test('negative battle destiny is legal while unresolved and becomes zero at draw completion',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');combat.battle(m).destiny.light=-3;assert.doesNotThrow(()=>prompt(m));m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(event(m).value,0);assert.equal(combat.battle(m).destiny.light,0);m=seek(m,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.light,0);
});

test('the final unresolved card counts as Life Force through completed-draw responses',()=>{
 let {m,card}=general();for(const pile of ['reserve','force','used'])for(const id of [...m.players.dark[pile]])state.moveCard(m,id,'hand');assert.equal(state.lifeForce(m,'dark'),1);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(m.status,'playing');assert.equal(state.lifeForce(m,'dark'),1);state.moveCard(m,card,'lost');m=step(m,'pass');assert.equal(m.status,'finished');assert.deepEqual(m.result,{winner:'light',loser:'dark',reason:'life-force'});assert.equal(m.data.observed,undefined);
});

for(const bp of ['1_284','1_132'])test('location '+bp+' modifies each weapon draw before completion, separately from rifle hit bonus',()=>{
 let m=fresh({dark:['1_312','1_285'],light:['1_132']});const site=location(m,bp==='1_284'?'dark':'light',bp),trooper=pull(m,'dark','1_194','table',site),rebel=pull(m,'light','1_28','table',site),gun=pull(m,'dark','1_312','table',site);m.cards[gun].attachedTo=trooper;force(m,'dark',4);force(m,'light',4);m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'dark');topDestiny(m,'dark','1_285');m=step(m,'fire:'+gun+':'+rebel);const before=trace(m,x=>event(x)?.kind==='weapon-destiny-drawn',true);m=before.m;
 const t=trace(m,x=>event(x)?.kind==='weapon-fired');conformance('weapon-each-'+bp,t.events);assert.deepEqual([...before.events,...t.events],beforeOracle.find(r=>r.name==='weapon-each-'+bp).events);assert.deepEqual(t.events,[{stage:'drawn',side:'dark',value:1,unresolved:1,used:0},{stage:'complete',side:'dark',value:1,unresolved:1,used:0},{stage:'total',side:'dark',value:1,unresolved:0,used:1}]);assert.equal(combat.battle(t.m).shots[0].total,1);assert.equal(combat.battle(t.m).shots[0].hit,true);
});

test('ordinary battle destiny matches the GEMP completion and physical-zone sequence',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');topDestiny(m,'light','1_28');m=step(m,'draw-destiny');const t=trace(m,x=>event(x)?.kind==='battle-destiny-complete');conformance('battle-one',t.events);assert.equal(combat.battle(t.m).destiny.light,1);
});

test('Reserve emptied after firing initiation still resolves a failed shot and resumes the battle',()=>{
 const f=battleFixture();let m=priority(f.m,'light');m=step(m,'fire:'+f.gun+':'+f.droid);assert.equal(m.stack.at(-2).action.handler,'battle:fire');for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=seek(m,x=>event(x)?.kind==='weapon-destiny-failed');const t=trace(m,x=>event(x)?.kind==='weapon-fired');assert.deepEqual(t.events,[]);assert.equal(combat.battle(t.m).shots[0].total,null);assert.equal(combat.battle(t.m).shots[0].hit,false);assert.ok(!combat.battle(t.m).hits.includes(f.droid));
});


test('before-draw window keeps the physical card and its identity hidden until responses finish',()=>{
 const f=general(1,true);assert.equal(event(f.m).kind,'about-to-draw-destiny');assert.equal(event(f.m).side,'dark');assert.equal(event(f.m).card,undefined);
 assert.equal(f.m.cards[f.card].zone,'reserve');assert.equal(f.m.players.dark.destiny.length,0);
 for(const side of ['dark','light'])assert.ok(!JSON.stringify(runtime.project(f.m,rules,side)).includes(f.card));
 const m=seek(f.m,x=>event(x)?.kind==='destiny-drawn');assert.equal(event(m).card,f.card);
});
test('before-draw responses can change which card is on top without a stale captured draw',()=>{
 const f=general(1,true),replacement=topDestiny(f.m,'dark','1_285');const m=finish(f.m);
 assert.equal(m.data.observed.draw.card,replacement);assert.equal(m.data.observed.total,0);assert.equal(m.cards[f.card].zone,'reserve');
});
for(const prevent of [false,true])test('before-draw '+(prevent?'prevention':'Reserve depletion')+' yields failure with no physical draw',()=>{
 const f=general(1,true);
 if(prevent)f.m.stack.at(-2).cancelled=true;else for(const id of [...f.m.players.dark.reserve])state.moveCard(f.m,id,'hand');
 const t=trace(f.m,undefined,true);assert.deepEqual(t.events.map(e=>e.stage),['before']);assert.equal(t.m.data.observed.total,null);assert.deepEqual(t.m.data.observed.draw,{card:null,value:null});assert.equal(t.m.cards[f.card].zone,prevent?'reserve':'hand');
});
test('nested destiny completes before an outer pending draw chooses its top card',()=>{
 const f=general(1,true),second=f.m.players.dark.reserve[1];destiny.drawDestiny(f.m,'dark',f.source,'nested',next);
 let m=finish(f.m);assert.equal(m.data.observed.draw.card,f.card);assert.equal(event(m).kind,'about-to-draw-destiny');assert.equal(event(m).category,'reinforcements');
 delete m.data.observed;m=finish(m);assert.equal(m.data.observed.draw.card,second);assert.deepEqual(m.players.dark.used.slice(0,2),[second,f.card]);
});
test('battle draw depleted during its before window fails without fabricating a destiny card',()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');
 assert.equal(event(m).kind,'about-to-draw-destiny');for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');
 m=seek(m,x=>event(x)?.kind==='battle-destiny-failed');assert.equal(event(m).card,null);m=seek(m,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.light,null);assert.equal(combat.battle(m).destinyCards.light,null);
});
test('concession freezes before-draw work without revealing a Reserve card',()=>{
 const f=general(1,true),m=step(f.m,'concede','dark');assert.equal(m.status,'finished');assert.equal(m.cards[f.card].zone,'reserve');assert.equal(m.players.dark.destiny.length,0);assert.equal(runtime.prompt(m,rules,'light'),null);
});
test('malformed before-draw saves and stale/foreign passes reject without mutation',()=>{
 const f=general(1,true),before=clone(f.m);assert.throws(()=>step(f.m,'pass','dark'));assert.throws(()=>runtime.applyCommand(f.m,rules,'light',{revision:f.m.revision-1,choice:'pass'}));assert.deepEqual(f.m,before);
 for(const corrupt of [p=>p.modifier='1',p=>p.modifier={weapon:'missing'},p=>p.drawn={},p=>p.includeTotal=null]){const m=clone(f.m);corrupt(m.stack.at(-2).action.payload);assert.throws(()=>prompt(m),/Invalid destiny initiation/);}
});

const beforeOracle=JSON.parse(fs.readFileSync(new URL('./gemp/before-destiny-results.json',import.meta.url)));
for(const value of [0,1,null])test('before-draw GEMP trace: general '+value,()=>{
 const t=trace(general(value,true).m,undefined,true);assert.deepEqual(t.events,beforeOracle.find(r=>r.name===(value===null?'general-empty':'general-'+value)).events);
});
for(const redraw of [false,true])test('before-draw GEMP trace: battle '+(redraw?'redraw':'ordinary'),()=>{
 const f=battleFixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');topDestiny(m,'light','1_115');topDestiny(m,'light','1_28');m=step(m,'draw-destiny');
 const first=trace(m,x=>event(x)?.kind==='battle-destiny-drawn',true);m=first.m;
 if(redraw){m=priority(m,'light');m=step(m,'dice:'+f.dice+':'+f.luke);}
 const t=trace(m,x=>event(x)?.kind==='battle-destiny-complete',true);
 const events=[...first.events,...t.events];
 assert.deepEqual(events,beforeOracle.find(r=>r.name===(redraw?'battle-redraw':'battle-one')).events);
});
test('before-draw GEMP trace: rifle weapon zero',()=>{
 const f=battleFixture();let m=priority(f.m,'light');topDestiny(m,'light','1_124');m=step(m,'fire:'+f.gun+':'+f.droid);
 const t=trace(m,x=>event(x)?.kind==='weapon-fired',true);assert.deepEqual(t.events,beforeOracle.find(r=>r.name==='weapon-zero').events);
});
