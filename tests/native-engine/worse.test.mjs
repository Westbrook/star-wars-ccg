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
function fixture(mode='drain'){
 let m=fresh({light:['1_90','1_90','1_28','1_105'],dark:['1_252','1_252','1_252','1_194','1_194','1_194']});
 const site=location(m,'light','1_129'),reduce=pull(m,'light','1_90','hand'),secondReduce=pull(m,'light','1_90','hand'),card=pull(m,'dark','1_252','hand'),second=pull(m,'dark','1_252','hand');
 const units=[pull(m,'dark','1_194','table',site)];let light;
 if(mode==='battle'){units.push(pull(m,'dark','1_194','table',site),pull(m,'dark','1_194','table',site));light=pull(m,'light','1_28','table',site);}
 force(m,'dark',6);force(m,'light',6);m=phase(m,mode==='battle'?'battle':'control');
 if(mode==='battle'){m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');}
 else {m=step(m,'drain:'+site);m=seek(m,x=>event(x)?.kind==='force-loss');}
 return {m,card,second,reduce,secondReduce,site,units,light};
}
const pendingLoss=m=>m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='ground:force-loss')?.action.payload;
const reduction=(f,amount=2)=>step(f.m,(combat.battle(f.m)?'battle-reduce:':'reduce:')+f.reduce+':'+amount);
const cancel=(f,m,amount)=>step(priority(m,'dark'),'worse:cancel:'+f.card+':'+amount);
const disposed=(m,card)=>seek(m,x=>x.cards[card].zone==='lost');
const done=m=>seek(m,x=>x.stack.length===1);
const loseBattle=m=>seek(step(m,'battle-lose:reserve'),x=>event(x)?.kind==='force-lost');
for(const mode of ['drain','battle'])for(const amount of [0,1,5])test(mode+' cancellation adds '+amount+' to original loss and retains both costs',()=>{
 const f=fixture(mode),initial=mode==='drain'?pendingLoss(f.m).remaining:combat.battle(f.m).damage.light,lf=f.m.players.light.force.length,df=f.m.players.dark.force.length;
 let m=cancel(f,reduction(f),amount);assert.equal(m.players.light.force.length,lf-2);assert.equal(m.players.dark.force.length,df-amount);
 m=seek(m,x=>event(x)?.kind==='card-canceled');assert.equal(m.cards[f.reduce].zone,'lost');assert.equal(m.cards[f.card].zone,'playing');assert.ok(!ids(m).some(id=>id.startsWith('worse:')));
 m=disposed(m,f.card);assert.equal(mode==='drain'?pendingLoss(m).remaining:combat.battle(m).damage.light,initial+amount);assert.equal(mode==='drain'?pendingLoss(m).reductionUsed:combat.battle(m).reduced.light,false);
 m=seek(m,x=>mode==='drain'?x.stack.at(-1)?.handler==='ground:force-loss':event(x)?.kind==='battle-damage');
 assert.ok(!ids(m).some(id=>id.startsWith('react-')||id.startsWith('assault:')));assert.equal(m.cards[f.reduce].zone,'lost');
});
test('canceling It’s Worse preserves It Could Be Worse and refunds neither paid cost',()=>{
 for(const mode of ['drain','battle']){const f=fixture(mode);let m=cancel(f,reduction(f),3);m.stack.at(-2).cancelled=true;m=disposed(m,f.card);m=seek(m,x=>x.cards[f.reduce].zone==='used');assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-3);assert.equal(m.players.light.force.length,f.m.players.light.force.length-2);assert.equal(mode==='drain'?pendingLoss(m)?.remaining??0:combat.battle(m).damage.light,0);}
});
test('zero available Dark Force still permits cancellation for zero',()=>{
 const f=fixture();for(const id of [...f.m.players.dark.force])state.moveCard(f.m,id,'used');let m=reduction(f);assert.ok(ids(m).includes('worse:cancel:'+f.card+':0'));assert.ok(!ids(m).includes('worse:cancel:'+f.card+':1'));m=disposed(cancel(f,m,0),f.card);assert.equal(pendingLoss(m).remaining,1);
});
test('a canceled target cannot be canceled again or used for a new increase',()=>{
 const f=fixture();let m=reduction(f);m.stack.at(-2).cancelled=true;assert.ok(!ids(m).some(id=>id.startsWith('worse:')));
 m=cancel(f,reduction(f),3);const target=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='ground:reduce');target.cancelled=true;m=disposed(m,f.card);assert.equal(pendingLoss(m).remaining,1);assert.equal(m.players.dark.force.length,3);
});
test('cancellation result cleanup does not move a card retrieved during the result response',()=>{
 const f=fixture();let m=seek(cancel(f,reduction(f),1),x=>event(x)?.kind==='card-canceled');state.moveCard(m,f.reduce,'hand');m=disposed(m,f.card);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(m.cards[f.reduce].zone,'hand');assert.equal(pendingLoss(m),undefined);
});
test('second It Could Be Worse may resolve after the first was canceled',()=>{
 const f=fixture();let m=disposed(cancel(f,reduction(f),1),f.card);m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');m=step(m,'reduce:'+f.secondReduce+':3');m=done(m);assert.equal(m.cards[f.secondReduce].zone,'used');assert.equal(m.players.light.lost.length,1);assert.equal(m.cards[f.reduce].zone,'lost');
});
for(const remaining of [0,1])test('battle loss response restores payable damage when previous remaining is '+remaining,()=>{
 const f=fixture('battle');let m=f.m;while(combat.battle(m).damage.light>remaining){m=priority(m,'light');m=loseBattle(m);if(combat.battle(m).damage.light>remaining)m=seek(m,x=>event(x)?.kind==='battle-damage');}
 assert.equal(event(m).kind,'force-lost');assert.ok(ids(m).includes('worse:battle:'+f.card+':1'));m=disposed(step(m,'worse:battle:'+f.card+':1'),f.card);assert.equal(combat.battle(m).damage.light,remaining+1);assert.deepEqual(combat.battle(m).initialDamage,f.m.data.battle.initialDamage);
 m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');assert.ok(ids(m).includes('forfeit:'+f.light));m=step(m,'forfeit:'+f.light);m=done(m);assert.equal(combat.battle(m).damage.light,0);
});
test('multiple copies remain playable but cannot stack modifiers on the same battle loss',()=>{
 const f=fixture('battle');let m=loseBattle(f.m);m=disposed(step(m,'worse:battle:'+f.card+':1'),f.card);m=priority(m,'dark');assert.ok(ids(m).includes('worse:battle:'+f.second+':1'));const damage=combat.battle(m).damage.light;m=disposed(step(m,'worse:battle:'+f.second+':1'),f.second);assert.equal(combat.battle(m).damage.light,damage);
});
test('first applied increase survives across both It’s Worse functions and later payments',()=>{
 const f=fixture('battle');let m=disposed(cancel(f,reduction(f,1),2),f.card);m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');const amount=combat.battle(m).damage.light;m=loseBattle(m);m=disposed(step(m,'worse:battle:'+f.second+':1'),f.second);assert.equal(combat.battle(m).damage.light,amount-1);assert.equal(combat.battle(m).worseIncrease,2);
});
test('canceling multiple reductions adds only the first modifier to a nonbattle loss',()=>{
 const f=fixture();let m=disposed(cancel(f,reduction(f,1),1),f.card);m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');m=step(m,'reduce:'+f.secondReduce+':1');m=disposed(step(m,'worse:cancel:'+f.second+':3'),f.second);assert.equal(pendingLoss(m).remaining,2);assert.equal(pendingLoss(m).worseIncrease,1);assert.equal(m.cards[f.secondReduce].zone,'lost');
});
test('battle-only mode excludes drain loss, forfeiture and Dark-side losses',()=>{
 const f=fixture();let m=seek(f.m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('worse:battle:')));
 const b=fixture('battle');m=step(b.m,'forfeit:'+b.light);m=seek(m,x=>event(x)?.kind==='forfeited');m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('worse:battle:')));
});
test('a new battle resets noncumulative increase history',()=>{
 const f=fixture('battle');let m=loseBattle(f.m);m=disposed(step(m,'worse:battle:'+f.card+':1'),f.card);m=seek(m,x=>event(x)?.kind==='battle-damage');while(combat.battle(m).damage.light>0){m=priority(m,'light');m=loseBattle(m);m=seek(m,x=>event(x)?.kind==='battle-damage');}m=done(m);m=seek(m,x=>x.turn.number===2&&x.turn.phase==='battle'&&x.stack.length===1);m=step(m,'battle:'+f.site);assert.equal(combat.battle(m).worseIncrease,undefined);
});
test('a nested independent Force loss does not receive the original loss modifier',()=>{
 const f=fixture();let m=cancel(f,reduction(f),2);ground.queueForceLoss(m,{side:'dark',remaining:1,source:'fixture',site:null,reductionUsed:false});m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');m=disposed(m,f.card);assert.equal(pendingLoss(m).remaining,3);assert.equal(m.players.dark.lost.length,2);
});
test('wrong, stale, unaffordable and forged commands leave the match untouched',()=>{
 const f=fixture(),m=reduction(f),before=clone(m);for(const [side,rev,id] of [['light',m.revision,'worse:cancel:'+f.card+':1'],['dark',m.revision-1,'worse:cancel:'+f.card+':1'],['dark',m.revision,'worse:cancel:'+f.card+':7'],['dark',m.revision,'worse:battle:'+f.card+':1']]){assert.throws(()=>runtime.applyCommand(m,rules,side,{revision:rev,choice:id}));assert.deepEqual(m,before);}
 const n=cancel(f,m,1);for(const p of [{amount:-1},{target:'bogus'},{targetIndex:0},{lossIndex:999},{battleSite:f.site}]){const bad=clone(n);Object.assign(bad.stack.at(-2).action.payload,p);assert.throws(()=>runtime.prompt(bad,rules,'light'));}
});

test('increase persists through successive unit losses without reopening original drain responses',()=>{
 const f=fixture();let m=disposed(cancel(f,reduction(f),3),f.card);for(const remaining of [3,2,1,0]){m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');m=step(m,'lose:reserve');assert.equal(event(m).source,'drain');assert.equal(pendingLoss(m)?.remaining??0,remaining);if(remaining)assert.equal(pendingLoss(m).worseIncrease,3);assert.ok(!ids(m).some(id=>id.startsWith('react-')||id.startsWith('assault:')));}m=done(m);assert.equal(m.players.light.lost.length,5);
});
test('zero increase does not prevent a later positive modifier',()=>{
 const f=fixture();let m=disposed(cancel(f,reduction(f,1),0),f.card);m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');m=step(m,'reduce:'+f.secondReduce+':1');m=disposed(step(m,'worse:cancel:'+f.second+':2'),f.second);assert.equal(pendingLoss(m).remaining,3);assert.equal(pendingLoss(m).worseIncrease,2);
});
test('the same cancellation applies to a non-drain Force loss without changing its source',()=>{
 const f=fixture();f.m=done(f.m);ground.queueForceLoss(f.m,{side:'light',remaining:3,source:'duel',site:null,reductionUsed:false});let m=disposed(cancel(f,reduction(f,1),2),f.card);assert.equal(pendingLoss(m).remaining,5);assert.equal(pendingLoss(m).source,'duel');assert.equal(pendingLoss(m).site,null);
});
test('terminal Life Force loss ends the game before an It’s Worse response',()=>{
 const f=fixture('battle');for(const id of [...f.m.players.light.reserve.slice(1),...f.m.players.light.force,...f.m.players.light.used])state.moveCard(f.m,id,'hand');let m=step(f.m,'battle-lose:reserve');m=seek(m,x=>x.status==='finished');assert.equal(m.result.winner,'dark');assert.equal(m.result.reason,'life-force');assert.equal(m.cards[f.card].zone,'hand');assert.equal(prompt(m),null);
});
test('Dark battle Force loss does not offer the opponent-only function',()=>{
 const f=fixture('battle');combat.battle(f.m).damage={dark:1,light:0};combat.battle(f.m).damageLedger.dark.base=1;combat.battle(f.m).damageLedger.light.base=0;f.m.stack.at(-1).passes=0;f.m=priority(f.m,'dark');const m=loseBattle(f.m);assert.equal(event(m).side,'dark');assert.ok(!worseChoices(m).length);
 function worseChoices(m){const module=load(new URL('../../lib/native-engine/worse.ts',import.meta.url));return module.worseActions(m,m.stack.at(-1),'dark');}
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/worse-results.json',import.meta.url)));
for(const expected of oracle)test('pinned GEMP It’s Worse outcome: '+expected.name,()=>{
 const mode=expected.name.startsWith('battle')?'battle':'drain',f=fixture(mode);let m;
 if(expected.name.includes('-cancel-')){
  const amount=Number(expected.name.split('-').at(-1));m=disposed(cancel(f,reduction(f),amount),f.card);
  assert.deepEqual({name:expected.name,remaining:mode==='drain'?pendingLoss(m).remaining:combat.battle(m).damage.light,darkCost:f.m.players.dark.force.length-m.players.dark.force.length,lightCost:f.m.players.light.force.length-m.players.light.force.length,reduceLost:m.cards[f.reduce].zone==='lost',sourceLost:m.cards[f.card].zone==='lost'},expected);
 }else if(expected.name.startsWith('battle-after-')){
  const payments=Number(expected.name.split('-').at(-1));m=f.m;for(let n=0;n<payments;n++){if(n){m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');}m=loseBattle(m);}
  m=disposed(step(m,'worse:battle:'+f.card+':1'),f.card);assert.equal(combat.battle(m).damage.light,expected.remaining);assert.equal(m.cards[f.card].zone,'lost');m=priority(m,'dark');m=disposed(step(m,'worse:battle:'+f.second+':1'),f.second);assert.equal(m.cards[f.second].zone,'lost');
  // GEMP BattleDamageModifier is cumulative; AR pp28–29/147 says copies
  // cannot stack modifiers on the original loss. Retain the actual discrepancy.
  assert.equal(combat.battle(m).damage.light,expected.remaining);assert.equal(expected.repeatedRemaining,expected.remaining+1);
 }else{
  m=disposed(cancel(f,reduction(f),1),f.card);m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');m=step(m,'reduce:'+f.secondReduce+':2');m=disposed(step(m,'worse:cancel:'+f.second+':3'),f.second);assert.deepEqual({name:expected.name,remaining:pendingLoss(m).remaining,lightLost:m.players.light.lost.length,darkLost:m.players.dark.lost.length},expected);
 }
});

test('canceling the battle-loss function applies no increase or cost',()=>{
 const f=fixture('battle');let m=loseBattle(f.m),damage=combat.battle(m).damage.light,force=m.players.dark.force.length;m=step(m,'worse:battle:'+f.card+':1');m.stack.at(-2).cancelled=true;m=disposed(m,f.card);assert.equal(combat.battle(m).damage.light,damage);assert.equal(combat.battle(m).worseIncrease,undefined);assert.equal(m.players.dark.force.length,force);
});
test('concession during cancellation leaves an immutable terminal state',()=>{
 const f=fixture(),m=cancel(f,reduction(f),3),before=clone(m);const end=runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'concede'});assert.deepEqual(m,before);assert.equal(end.result.winner,'dark');assert.equal(pendingLoss(end).remaining,1);assert.equal(end.cards[f.reduce].zone,'playing');assert.throws(()=>runtime.applyCommand(end,rules,'dark',{revision:end.revision,choice:'pass'}));
});
