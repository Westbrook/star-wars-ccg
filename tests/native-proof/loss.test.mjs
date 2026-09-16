import test from 'node:test';import assert from 'node:assert/strict';
import {paths,runPath,createScenario,step,ready,pick,prompt,until,project,clone,card,assertMatch,applyCommand} from './loss-paths.mjs';
for(const path of paths)test(path+' completes and preserves all physical cards',()=>{const {m}=runPath(path);assert.equal(m.engine,'native-proof-11');assert.equal(m.complete,true);assert.equal(Object.keys(m.cards).length,120)});
test('drain reduction uses Force without losing Life Force; full and excess X are legal',()=>{
 assert.equal(runPath('drain-pass').facts.lost.length,2);assert.equal(runPath('drain-one').facts.lost.length,1);assert.equal(runPath('drain-two').facts.lost.length,0);assert.equal(runPath('drain-overpay').facts.force,0);assert.equal(runPath('drain-overpay').m.lossStudy.reduced,2);
 assert.deepEqual(runPath('drain-after-loss').facts,runPath('drain-one').facts);assert.equal(runPath('drain-two-copies').facts.lost.length,1);assert.equal(runPath('drain-two-copies').m.lossStudy.reduced,1);assert.deepEqual(runPath('drain-two-copies').facts.used,['1_90','1_28','1_90','1_28','1_28']);
});
test('cost and pending Interrupt persist before the result; stale commands cannot pay twice',()=>{
 let m=until(createScenario('reduce-drain'),x=>!!pick(x,'reduce:'));const before=clone(m),p=prompt(m),choice=pick(m,'reduce:').id;
 m=step(m,choice);assert.equal(m.players.light.force.length,2);assert.equal(project(m,'light').lossStudy.remaining,2);assert.equal(project(m,'light').playing.length,1);assert.equal(m.lossStudy.reduced,0);
 assert.throws(()=>step(m,choice),/legal/);assert.throws(()=>applyCommand(m,'light',{choice,prompt:p.id}),/pending choice|stale/);
 const done=ready(m);assert.equal(done.lossStudy.reduced,1);assert.equal(project(done,'light').playing.length,0);assert.equal(before.players.light.force.length,3);
});
test('damage reduction never clears attrition, and updates after a forfeit',()=>{
 assert.equal(runPath('damage-pass').facts.damage,5);assert.equal(runPath('damage-four').facts.damage,1);assert.equal(runPath('damage-four').facts.attrition,3);assert.equal(runPath('damage-after-forfeit').facts.damage,2);assert.equal(runPath('damage-after-forfeit').facts.attrition,1);
});
test('Talz restores one or two hits; an ordinary forfeit does not restore the target',()=>{
 for(const path of ['rescue-healthy','rescue-hit','rescue-zero']){const r=runPath(path);assert.equal(r.facts.hits,0);assert.equal(r.facts.talzLost,true);assert.equal(r.facts.armedTrooperAlive,true);assert.equal(r.m.lossStudy.rescued.length,1)}
 assert.equal(runPath('rescue-ordinary').facts.hits,1);assert.equal(runPath('rescue-ordinary').m.lossStudy.rescued.length,0);
});
test('reduction is absent during initiation and invalid costs or targets fail closed',()=>{
 let m=createScenario('reduce-drain');assert.equal(pick(m,'reduce:'),undefined);m=step(m,'drain');assert.equal(pick(m,'reduce:'),undefined);m=until(m,x=>!!pick(x,'reduce:'));const id=card(m,'1_90','hand').id;
 for(const amount of [0,-1,4,1.5,999])assert.throws(()=>step(m,`reduce:${id}:${amount}`),/legal/);
 const bad=step(m,`reduce:${id}:1`);bad.stack.find(f=>f.kind==='interrupt').amount=0;assert.throws(()=>assertMatch(bad),/reduction/);
});
test('600 seeded routes reconstruct every decision and keep paired hands private',()=>{
 let seed=23319,states=0;const actions={reduce:0,rescue:0,fire:0,forfeit:0,lose:0};
 for(const scenario of ['reduce-drain','reduce-damage','talz-rescue'])for(let i=0;i<200;i++){
  let m=createScenario(scenario);m=until(m,x=>x.complete,x=>{states++;for(const side of ['light','dark']){assert.deepEqual(project(x,side),project(clone(x),side));assert.deepEqual(project(x,side).players[side==='light'?'dark':'light'].hand,[])}seed=(Math.imul(seed,1664525)+1013904223)>>>0;const choices=prompt(x).choices.filter(c=>c.id!=='stop');const c=choices[(seed>>>8)%choices.length],key=c.id.split(':')[0];if(key in actions)actions[key]++;return c.id});assert.equal(m.complete,true);
 }for(const n of Object.values(actions))assert.ok(n>0);console.log({lossStates:states,actions});
});
test('all fourteen executed GEMP outcomes match native loss results',async()=>{const {readFileSync}=await import('node:fs');const {branches}=JSON.parse(readFileSync(new URL('./gemp/loss-oracle-result.json',import.meta.url)));assert.equal(branches.length,14);for(const {name,...expected} of branches)assert.deepEqual(runPath(name).facts,expected,name)});
