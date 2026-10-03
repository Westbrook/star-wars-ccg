import test from 'node:test';
import assert from 'node:assert/strict';
import {runStarterMatch,replayStarterMatch,starterDecks,auditRules} from './match-runner.mjs';
import {load} from '../native-proof/load-engine.mjs';
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
for(const size of [40,60])for(const seed of [1,8,20])test(`shuffled ${size}-card starter integration reaches normal victory, seed ${seed}`,()=>{
 const checkpoints=[];let scanSnapshot=null;
 const run=runStarterMatch({seed,size,onStep:(m,entry)=>{if(m.revision%500===0)checkpoints.push({snapshot:clone(m),offset:m.revision});if(!scanSnapshot&&m.stack.at(-1)?.handler==='scan:peek')scanSnapshot=clone(m)}});
 assert.equal(run.state.status,'finished');assert.equal(run.result.reason,'life-force');assert.equal(state.lifeForce(run.state,run.result.loser),0);assert.ok(state.lifeForce(run.state,run.result.winner)>0);assert.ok(run.turns>2);assert.ok(run.commands>100);
 assert.ok(run.handlers['ground:deploy']>0);assert.ok(run.handlers['ground:drain']>0);assert.ok(run.handlers['battle:begin']>0);assert.ok(run.handlers['core:activate']>0);assert.ok(run.handlers['core:draw']>0);
 assert.equal(run.transcript.some(e=>e.command?.choice==='concede'),false);
 // Replay the same whole match and also resume its last saved command boundary.
 assert.deepEqual(replayStarterMatch(run),run.state);
 assert.ok(checkpoints.length);assert.deepEqual(replayStarterMatch(run,checkpoints.at(-1)),run.state);
 if(size===40&&seed===1){
  assert.ok(scanSnapshot,'full match must reach a timed Scanning Crew decision');
  const deadline=scanSnapshot.stack.at(-1).payload.expiresAt,entry={time:deadline,entropy:123,revision:scanSnapshot.revision};
  const timed={...run,transcript:[entry]},resumed=replayStarterMatch(timed,{snapshot:scanSnapshot});
  assert.equal(resumed.revision,scanSnapshot.revision+1);assert.notEqual(resumed.stack.at(-1)?.handler,'scan:peek');
  assert.deepEqual(resumed,runtime.advanceTime(clone(scanSnapshot),auditRules,deadline,()=>123));
  assert.throws(()=>replayStarterMatch({...timed,transcript:[{...entry,revision:entry.revision-1}]},{snapshot:scanSnapshot}),/Stale replay timer/);
 }

 for(const seat of ['dark','light'])assert.equal(runtime.project(run.state,auditRules,seat).prompt,null);
 assert.throws(()=>runtime.applyCommand(run.state,auditRules,run.result.winner,{revision:run.state.revision,choice:'pass'}),/cannot act/);
});
test('Open-40 audit decks preserve every starter definition and production admission stays closed',()=>{
 const sixty=starterDecks(60),forty=starterDecks(40);
 for(let i=0;i<2;i++){assert.equal(forty[i].cards.length,40);assert.deepEqual(new Set(forty[i].cards),new Set(sixty[i].cards));assert.ok(forty[i].cards.every(bp=>!premiereRules.supports(bp)))}
 assert.throws(()=>runtime.createMatch('not-admitted',60,sixty,premiereRules),/Unimplemented card behavior/);
});
test('audit budget failures preserve exact reproducible pending commands instead of conceding or skipping',()=>{
 let failure;try{runStarterMatch({seed:1,maxCommands:10})}catch(e){failure=e}
 assert.match(failure.message,/budget exhausted/);assert.equal(failure.audit.transcript.length,10);assert.notEqual(failure.audit.state.status,'finished');assert.deepEqual(replayStarterMatch(failure.audit),failure.audit.state);
 const tampered=clone(failure.audit);tampered.transcript[0].command.choice='made-up';assert.throws(()=>replayStarterMatch(tampered),/Illegal/);
});
