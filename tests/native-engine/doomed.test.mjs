import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
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
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const losses=load(new URL('../../lib/native-engine/loss.ts',import.meta.url));
function life(m,side,n){while(state.lifeForce(m,side)>n){const id=m.players[side].reserve.at(-1)??m.players[side].force.at(-1)??m.players[side].used.at(-1);state.moveCard(m,id,'hand');}}
function fixture({droid=null,lifeCount=14}={}){
 let m=fresh({light:['1_120','1_120','1_5','2_14','1_90','1_90','1_28'],dark:['1_252','1_194','1_194','1_194','1_194']});const site=location(m,'light','1_129'),remote=location(m,'light','1_130');const card=pull(m,'light','1_120','hand'),second=pull(m,'light','1_120','hand'),reduce=pull(m,'light','1_90','hand'),worse=pull(m,'dark','1_252','hand'),droidId=droid?pull(m,'light',droid,'table',remote):null;
 const unit=pull(m,'dark','1_194','table',site);force(m,'light',5);force(m,'dark',6);life(m,'light',lifeCount);m=phase(m,'control');m=priority(m,'light');return {m,card,second,reduce,worse,droidId,site,remote,unit};
}
const play=f=>seek(step(f.m,'doomed:'+f.card),m=>m.cards[f.card].zone==='used'&&m.stack.length===1);
function queue(m,base,kind='effect',side='light',irreducible=false){ground.queueForceLoss(m,{side,remaining:base,source:kind==='drain'?'drain':'fixture',site:null,reductionUsed:false,ledger:losses.lossLedger(base,kind,irreducible)});return m;}
const remaining=m=>{const f=[...m.stack].reverse().find(f=>f.kind==='resolution'&&f.action.handler==='ground:force-loss'||f.kind==='decision'&&f.handler==='ground:force-loss');return f?ground.remainingForceLoss(m,f.kind==='resolution'?f.action.payload:f.payload):0;};
const complete=m=>seek(m,x=>x.stack.length===1);
const view=m=>runtime.project(m,rules,'light').rules;
for(const droid of [null,'1_5','2_14'])for(const amount of [1,2,5])test('We’re Doomed loss '+amount+' with '+droid,()=>{
 const f=fixture({droid});let m=play(f);assert.equal(view(m).doomed.rounding,droid?'down':'up');const start=m.players.light.lost.length;m=queue(m,amount);assert.equal(remaining(m),droid?Math.floor(amount/2):Math.ceil(amount/2));m=complete(m);assert.equal(m.players.light.lost.length-start,droid?Math.floor(amount/2):Math.ceil(amount/2));assert.equal(m.cards[f.card].zone,'used');
});
test('strict Life Force threshold is checked when played, not continuously afterward',()=>{
 let f=fixture({lifeCount:15});assert.ok(!ids(f.m).includes('doomed:'+f.card));f=fixture();assert.equal(state.lifeForce(f.m,'light'),14);const m=play(f);assert.equal(state.lifeForce(m,'light'),15);assert.equal(view(m).doomed.rounding,'up');
});
test('only opponent Control ordinary actions, never a drain response or own turn',()=>{
 const f=fixture();f.m.stack.at(-1).passes=0;let m=priority(f.m,'dark');m=step(m,'drain:'+f.site);assert.ok(!ids(m).some(x=>x.startsWith('doomed:')));m=complete(m);m=seek(m,x=>x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');assert.ok(!ids(m).some(x=>x.startsWith('doomed:')));m=seek(m,x=>x.turn.number===2&&x.turn.phase==='control'&&x.stack.length===1);assert.ok(!ids(m).some(x=>x.startsWith('doomed:')));
});
test('canceling We’re Doomed has no ongoing effect and sends the source Lost',()=>{
 const f=fixture();let m=step(f.m,'doomed:'+f.card);m.stack.at(-2).cancelled=true;m=complete(m);assert.equal(m.cards[f.card].zone,'lost');assert.equal(view(m).doomed,null);m=queue(m,3);assert.equal(remaining(m),3);
});
test('repeated copies halve once and remain active if the original source leaves Used',()=>{
 const f=fixture({lifeCount:13});let m=play(f);m=priority(m,'light');m=seek(step(m,'doomed:'+f.second),x=>x.cards[f.second].zone==='used');state.moveCard(m,f.card,'lost');state.moveCard(m,f.second,'hand');m=queue(m,5);assert.equal(remaining(m),3);assert.equal(m.data.doomed.sources.length,2);
});
test('dynamic rounding rechecks droid departure after a paid unit without re-halving the remaining loss',()=>{
 const f=fixture({droid:'1_5'});let m=queue(play(f),5);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');assert.equal(remaining(m),1);state.moveCard(m,f.droidId,'lost');assert.equal(remaining(m),2);m=complete(m);assert.equal(m.players.light.lost.length,4); // three units plus Threepio
});
test('rounding can reopen a just-satisfied loss during its final unit response',()=>{
 const f=fixture({droid:'1_5'});let m=queue(play(f),3);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');assert.equal(remaining(m),0);state.moveCard(m,f.droidId,'hand');assert.equal(remaining(m),1);m=complete(m);assert.equal(m.players.light.lost.length,2);
});
test('droid arrival after payment reduces total, retaining the amount already paid',()=>{
 const f=fixture();let m=play(f);const droid=Object.values(m.cards).find(c=>c.blueprint==='1_5');state.moveCard(m,droid.id,'hand');m=queue(m,5);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');state.moveCard(m,droid.id,'table');m.cards[droid.id].location=f.remote;assert.equal(remaining(m),1);m=complete(m);assert.equal(m.players.light.lost.length,2);
});
for(const kind of ['drain','effect'])test('It’s Worse increase with halving for '+kind,()=>{
 const f=fixture();let m=queue(play(f),3,kind);m=priority(m,'light');m=step(m,'reduce:'+f.reduce+':1');m=step(m,'worse:cancel:'+f.worse+':2');m=seek(m,x=>x.cards[f.worse].zone==='lost');assert.equal(remaining(m),kind==='drain'?3:4);m=complete(m);assert.equal(m.players.light.lost.length,kind==='drain'?4:5);
});
test('ordinary reduction is applied after halving and keeps excess reduction credit',()=>{
 const f=fixture({droid:'1_5'});let m=queue(play(f),5);m=step(m,'reduce:'+f.reduce+':3');m=seek(m,x=>x.cards[f.reduce].zone==='used');state.moveCard(m,f.droidId,'hand');assert.equal(remaining(m),0);m=complete(m);assert.equal(m.players.light.lost.length,0);
});
test('Force payments and irreducible losses are not halved; specific card losses stay separate',()=>{
 const f=fixture({droid:'1_5'});let m=play(f),before=m.players.light.force.length;state.useForce(m,{light:3});assert.equal(m.players.light.force.length,before-3);m=queue(m,3,'effect','light',true);assert.equal(remaining(m),3);assert.ok(!ids(m).some(x=>x.startsWith('reduce:')));m=complete(m);assert.equal(m.players.light.lost.length,3);
});
test('Dark losses are not reduced',()=>{const f=fixture();const m=queue(play(f),5,'effect','dark');assert.equal(remaining(m),5);});
test('duration includes end-of-turn responses but expires at the next start window',()=>{
 const f=fixture();let m=play(f);m=seek(m,x=>x.stack.at(-1)?.timing==='end');m=queue(m,3);assert.equal(remaining(m),2);m=seek(m,x=>x.turn.number===2);assert.equal(view(m).doomed,null);m=queue(m,3);assert.equal(remaining(m),3);
});
function battleFixture(droid=null){const f=fixture({droid});let m=play(f);for(let n=0;n<3;n++)pull(m,'dark','1_194','table',f.site);const trooper=Object.values(m.cards).find(c=>c.owner==='light'&&c.blueprint==='1_28'&&c.zone==='hand');assert.ok(trooper);state.moveCard(m,trooper.id,'table');m.cards[trooper.id].location=f.site;m=seek(m,x=>x.turn.phase==='battle'&&x.stack.length===1);m=step(m,'battle:'+f.site);m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');return {...f,m,trooper:trooper.id};}
for(const droid of [null,'1_5'])test('battle loss is halved once with '+droid+' while attrition stays separate',()=>{
 const f=battleFixture(droid),b=combat.battle(f.m);assert.equal(b.damageLedger.light.base,3);assert.equal(b.damage.light,droid?1:2);let m=seek(step(f.m,'battle-lose:reserve'),x=>event(x)?.kind==='force-lost');assert.equal(combat.battle(m).damage.light,droid?0:1);assert.equal(combat.battle(m).damageLedger.light.paid,1);
 m=seek(step(m,'worse:battle:'+f.worse+':1'),x=>x.cards[f.worse].zone==='lost');assert.equal(combat.battle(m).damage.light,droid?1:2);m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');m=step(m,'forfeit:'+f.trooper);m=complete(m);assert.equal(combat.battle(m).damage.light,0);
});
test('battle live view and legal actions re-evaluate rounding without mutating the save',()=>{
 const f=battleFixture('1_5');let m=seek(step(f.m,'battle-lose:reserve'),x=>event(x)?.kind==='force-lost');assert.equal(combat.battle(m).damage.light,0);state.moveCard(m,f.droidId,'hand');const before=clone(m);assert.equal(view(m).battle.damage.light,1);assert.deepEqual(m,before);m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');assert.ok(ids(m).includes('battle-lose:reserve'));
});
test('R2-D2 ground components do not grant complete native admission',()=>{assert.equal(premiereRules.supports('2_14'),false);assert.equal(board.definition('2_14').status,'component-coverage-only')});
test('invalid duration, loss accounting and stale commands are rejected atomically',()=>{
 const f=fixture(),before=clone(f.m);assert.throws(()=>runtime.applyCommand(f.m,rules,'dark',{revision:f.m.revision,choice:'doomed:'+f.card}));assert.throws(()=>runtime.applyCommand(f.m,rules,'light',{revision:f.m.revision-1,choice:'doomed:'+f.card}));assert.deepEqual(f.m,before);
 const m=queue(play(f),5);for(const corrupt of [x=>x.data.doomed.turn++,x=>x.data.doomed.sources.push('bogus'),x=>x.stack.at(-2).action.payload.ledger.paid=-1,x=>x.stack.at(-2).action.payload.ledger.base=NaN,x=>x.stack.at(-2).action.payload.ledger.kind='battle']){const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.prompt(bad,rules,'light'));}
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/doomed-results.json',import.meta.url)));
for(const result of oracle)test('GEMP observation: '+result.name,()=>{
 const parts=result.name.split('-');
 if(parts[0]==='drain'){
  const f=fixture({droid:parts[2]==='none'?null:parts[2]==='r2'?'2_14':'1_5'});let m=play(f);const start=m.players.light.lost.length;m=complete(queue(m,Number(parts[1]),'drain'));
  assert.deepEqual({name:result.name,lost:m.players.light.lost.length-start,interruptUsed:m.cards[f.card].zone==='used'},result);
 }else if(parts[0]==='depart'||parts[0]==='arrive'){
  const arrival=parts[0]==='arrive',base=Number(parts[1]),f=fixture({droid:arrival?null:'1_5'});let m=play(f);const droid=Object.values(m.cards).find(c=>c.blueprint==='1_5');if(arrival)state.moveCard(m,droid.id,'hand');m=queue(m,base,'drain');m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');
  // GEMP auto-settles the final payment before returning control to the fixture.
  // With base three/round down, its intervention is after the whole loss ended.
  // Native's separate final-unit response is tested above, not claimed as parity.
  if(!arrival&&base===3)m=complete(m);
  state.moveCard(m,droid.id,arrival?'table':'hand');if(arrival)m.cards[droid.id].location=f.remote;
  const pending=remaining(m);m=complete(m);assert.deepEqual({name:result.name,pending,lost:m.players.light.lost.length},result);
 }else if(parts[0]==='increase'){
  const f=fixture({droid:parts[2]==='none'?null:'1_5'});let m=queue(play(f),3,'drain');m=priority(m,'light');m=step(m,'reduce:'+f.reduce+':1');m=step(m,'worse:cancel:'+f.worse+':2');m=seek(m,x=>x.cards[f.worse].zone==='lost');
  assert.deepEqual({name:result.name,remaining:remaining(m),reduceLost:m.cards[f.reduce].zone==='lost',worseLost:m.cards[f.worse].zone==='lost'},result);
 }else{
  const f=battleFixture(parts[1]==='none'?null:'1_5');let m=f.m;const initial=combat.battle(m).damage.light;m=seek(step(m,'battle-lose:reserve'),x=>event(x)?.kind==='force-lost');const afterPayment=combat.battle(m).damage.light;m=seek(step(m,'worse:battle:'+f.worse+':1'),x=>x.cards[f.worse].zone==='lost');
  assert.deepEqual({name:result.name,initial,afterPayment,afterIncrease:combat.battle(m).damage.light},result);
 }
});
