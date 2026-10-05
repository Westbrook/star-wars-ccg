import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {assertObiOutcome,assertReferenceAction,assertInterruptTargets,readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/mentor-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
const first=(r,lost=false)=>r.trace.findIndex(x=>x.semantic?.kind==='obi-use'&&x.obiOutcome.lost===lost);
test('full match binds eleven Obi-Wan targets, both outcomes and both turns',()=>{
 const r=record(),map=cards(r),outcomes=[],turns=new Set();
 for(let i=0;i<r.trace.length;i++)if(r.trace[i].semantic?.kind==='obi-use'){const p=assertObiOutcome(r.trace,i,map,r.final);outcomes.push(p.outcome.lost);turns.add(r.trace[i].state.side);assert.ok(p.choiceIndex>i);assert.ok(r.trace[i].targetObservation.afterDecision>i,'Actual targeting choice, not shortcut');}
 assert.equal(outcomes.length,11);assert.equal(outcomes.filter(Boolean).length,5);assert.deepEqual([...turns].sort(),['dark','light']);
});
test('successful and canceled Mentor follow normal Obi-Wan deployment',()=>{
 const r=record(),map=cards(r),uses=r.trace.flatMap((x,i)=>x.semantic?.kind==='battle-add'&&map[x.semantic.card].blueprint==='1_82'?[i]:[]);assert.equal(uses.length,2);
 for(const i of uses){const row=r.trace[i],targets=assertInterruptTargets(r.trace,i,map);assert.deepEqual(targets.map(id=>map[id].blueprint),['101_2','1_21']);const deployment=r.trace.slice(0,i).find(x=>x.semantic?.kind==='deploy'&&x.semantic.card===targets[1]);assert.ok(deployment,'Obi-Wan must have been legally deployed');}
 const next=i=>r.trace.slice(i+1).find(x=>x.semantic&&!['pass','interrupt-target'].includes(x.semantic.kind));assert.notEqual(next(uses[0]).semantic.kind,'named-cancel');assert.equal(next(uses[1]).semantic.kind,'named-cancel');
 const loss=i=>r.trace.slice(i+1).find(x=>x.state.battleDestinies).state.battleDestinies.light;assert.equal(loss(uses[0]).cards.length,3);assert.equal(loss(uses[1]).cards.length,1);
});
for(const mode of ['source','target','ability','origin','outcome-target','outcome-time','outcome-future','cross-action','choice-actor','choice-source','choice-action','choice-answer','choice-options','choice-prompt','destination','immediate-result'])test('Obi-Wan reference evidence rejects '+mode,()=>{
 const r=record(),i=first(r),row=r.trace[i],map=cards(r),choice=r.trace.find(x=>x.semantic?.kind==='obi-choice'&&x.semantic.initiation===i),after=r.trace[row.obiOutcome.afterDecision+1];
 if(mode==='source')map[row.semantic.card].blueprint='1_11';if(mode==='target')row.semantic.target=row.semantic.card;if(mode==='ability')row.state.table.find(c=>c.id===row.semantic.target).stats.ability=2;if(mode==='origin')row.obiOutcome.from=row.semantic.card;
 if(mode==='outcome-target')row.obiOutcome.card=row.semantic.card;if(mode==='outcome-time')row.obiOutcome.afterDecision=i-1;if(mode==='outcome-future')row.obiOutcome.afterDecision=r.trace.length;if(mode==='cross-action')r.trace[i+3].semantic={kind:'draw'};
 if(mode==='choice-actor')choice.semantic.side='light';if(mode==='choice-source')choice.semantic.source=row.semantic.target;if(mode==='choice-action')choice.semantic.initiation=0;if(mode==='choice-answer')choice.answer='1';if(mode==='choice-options')choice.parameters.results.reverse();if(mode==='choice-prompt')choice.text='Do you want to draw battle destiny?';
 if(mode==='destination')row.obiOutcome.to=row.obiOutcome.from;if(mode==='immediate-result')after.state.table.find(c=>c.id===row.semantic.target).location=row.obiOutcome.from;
 assert.throws(()=>assertObiOutcome(r.trace,i,map,r.final));
});
test('loss outcome must show the exact target immediately in Lost',()=>{const r=record(),i=first(r,true),row=r.trace[i],after=r.trace[row.obiOutcome.afterDecision+1];after.state.players.dark.lost=after.state.players.dark.lost.filter(id=>id!==row.semantic.target);assert.throws(()=>assertObiOutcome(r.trace,i,cards(r),r.final));});
test('reference action must actually be the Obi-Wan battle trigger',()=>{const r=record(),row=r.trace[first(r)],j=row.parameters.actionId.indexOf(row.answer);row.parameters.actionText[j]='Draw card';assert.throws(()=>assertReferenceAction(row));row.parameters.actionText[j]='Make a character move away or be lost';row.text='Choose Battle action or Pass';assert.throws(()=>assertReferenceAction(row));});
// Synthetic explicit-destination dialog exercises verifier rejection. The actual
// recorded game shortcuts all eleven movement/loss choices' destination handling.
for(const altered of [false,true])test('synthetic explicit destination validates its actual answer '+altered,()=>{
 const r=record(),i=first(r),row=r.trace[i],proof=assertObiOutcome(r.trace,i,cards(r),r.final),index=proof.choiceIndex+1,d=r.trace[index],to=row.obiOutcome.to;
 d.semantic={kind:'obi-destination',side:'dark',card:to};d.type='CARD_SELECTION';d.text='Choose where to move';d.parameters={cardId:['destination'],blueprintId:[cards(r)[to].blueprint],selectable:['true']};d.answer=altered?'different':'destination';
 if(altered)assert.throws(()=>assertObiOutcome(r.trace,i,cards(r),r.final));else assertObiOutcome(r.trace,i,cards(r),r.final);
});
test('normal setup through victory matches without later state corrections',()=>{
 const r=replayGempMatch(record());
 // GEMP BattleEffect skips battle-ending on premature completion. This replay
 // has one such end (turn 21); removing that obsolete window removes two passes.
 // Restoring only that window reproduces the historical 2,273-command transcript.
 assert.equal(r.transcript.filter(x=>x.choice==='battle-premature-end').length,1);
 assert.equal(r.commands,2271);assert.equal(r.checkpoints,253);assert.equal(r.state.turn.number,23);assert.deepEqual(r.state.result,{winner:'light',loser:'dark',reason:'life-force'});
});
for(const mode of ['missing-choice','paid-force','destiny'])test('continuous replay rejects altered '+mode,()=>{const r=record(),i=first(r),row=r.trace[i];if(mode==='missing-choice')delete r.trace.find(x=>x.semantic?.kind==='obi-choice'&&x.semantic.initiation===i).semantic;if(mode==='paid-force'){const choice=r.trace.find(x=>x.semantic?.kind==='obi-choice'&&x.semantic.initiation===i);choice.state.players.light.force.push(choice.state.players.light.used.shift());}if(mode==='destiny')r.trace.find(x=>x.state.battleDestinies).state.battleDestinies.light.values[0]++;assert.throws(()=>replayGempMatch(r));});
test('reference receipt fingerprints exact executed source, decks and game',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/mentor-match-provenance.json',import.meta.url))),bytes=f=>fs.readFileSync(new URL('../../'+f,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),r=record();
 assert.equal(hash(bytes(p.fixture)),p.sha256);assert.equal(hash(gunzipSync(bytes(p.fixture))),p.jsonSha256);assert.equal(hash(bytes(p.harness)),p.harnessSha256);assert.equal(hash(bytes(p.profile)),p.profileSha256);assert.equal(hash(fs.readFileSync(new URL('./gemp/NativeEngineMentorMatchOracleTests.java',import.meta.url))),p.harnessSha256);assert.equal(p.referenceDecisions,r.trace.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.junitTests,1);assert.equal(r.finished,true);
});
