import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {assertCanceledSearch,assertSearchEvidence,readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/search-cancel.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
const canceled=r=>r.trace.findIndex(x=>x.searchOutcome?.canceled);
test('observed reference cancellation prevents inspection and preserves the paid cost',()=>{
 const r=record(),i=canceled(r),p=assertCanceledSearch(r.trace,i,cards(r),r.final);assert.equal(p.canceled,true);assert.ok(p.cancellationIndex>i);assert.equal(r.trace[p.cancellationIndex].semantic.target,p.source);
 const later=r.trace.flatMap((row,index)=>row.semantic?.kind==='mentor-search'&&index>i?[assertSearchEvidence(r.trace,index,cards(r),r.final)]:[]);assert.equal(later.length,2);assert.ok(later[0].selected);assert.equal(later[1].verificationIndices.length,2);
});
for(const mode of ['flag','source','owner','bound-source','early','late','selection','private-choice','unrelated-action','missing-cancel','cancel-source','cancel-side','cancel-owner','cancel-target','cancel-answer','cancel-label','cancel-observation','reserve-order','reserve-membership','hand','refunded','used-order','not-lost'])test('canceled search evidence rejects '+mode,()=>{
 const r=record(),i=canceled(r),row=r.trace[i],map=cards(r),proof=assertCanceledSearch(r.trace,i,map,r.final),cancel=r.trace[proof.cancellationIndex],after=r.trace[row.searchOutcome.afterDecision+1].state.players.light;
 if(mode==='flag')row.searchOutcome.canceled=false;if(mode==='source')map[row.semantic.card].blueprint='1_11';if(mode==='owner')map[row.semantic.card].owner='dark';if(mode==='bound-source')row.searchOutcome.source='dark-1';if(mode==='early')row.searchOutcome.afterDecision=i;if(mode==='late')row.searchOutcome.afterDecision=r.trace.length;if(mode==='selection')row.selection={card:'light-60'};if(mode==='private-choice')r.trace[i+1].semantic={kind:'search-selection'};if(mode==='unrelated-action')r.trace[i+1].semantic={kind:'draw'};if(mode==='missing-cancel')delete cancel.semantic;if(mode==='cancel-source')map[cancel.semantic.card].blueprint='1_11';if(mode==='cancel-side')cancel.semantic.side='light';if(mode==='cancel-owner')map[cancel.semantic.card].owner='light';if(mode==='cancel-target')cancel.semantic.target='light-60';if(mode==='cancel-answer')cancel.answer='missing';if(mode==='cancel-label')cancel.parameters.actionText[cancel.parameters.actionId.indexOf(cancel.answer)]='Cancel a different card';if(mode==='cancel-observation')cancel.targetObservation.afterDecision++;if(mode==='reserve-order')row.searchOutcome.reserve.reverse();if(mode==='reserve-membership')row.searchOutcome.reserve[0]='dark-1';if(mode==='hand')row.searchOutcome.hand.push('light-60');if(mode==='refunded')after.force.unshift(after.used.shift());if(mode==='used-order')after.used.push('dark-1');if(mode==='not-lost')after.lost=after.lost.filter(id=>id!==row.semantic.card);
 assert.throws(()=>assertCanceledSearch(r.trace,i,map,r.final));
});
test('continuous canceled-search match reaches the same victory with no cancellation entropy',()=>{
 const checkpoints=[],r=replayGempMatch(record(),{onCheckpoint:c=>checkpoints.push(c)});assert.equal(r.commands,2484);assert.equal(r.checkpoints,278);assert.equal(r.state.turn.number,40);assert.deepEqual(r.state.result,{winner:'dark',loser:'light',reason:'life-force'});assert.equal(r.transcript.filter(c=>c.entropy).length,2);
 const start=checkpoints.find(c=>c.row.searchOutcome?.canceled),end=checkpoints.find(c=>c.index>start.row.searchOutcome.afterDecision);assert.ok(end);assert.ok(r.transcript.filter(c=>c.revision>=start.match.revision&&c.revision<end.match.revision).every(c=>!c.entropy));assert.deepEqual(end.match.players.light.reserve,start.match.players.light.reserve);assert.equal(end.match.cards[start.row.semantic.card].zone,'lost');
});
test('cancellation receipt binds the exact executed source and completed game',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/search-cancel-provenance.json',import.meta.url))),bytes=f=>fs.readFileSync(new URL('../../'+f,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),r=record();
 assert.equal(hash(bytes(p.fixture)),p.sha256);assert.equal(hash(gunzipSync(bytes(p.fixture))),p.jsonSha256);assert.equal(hash(bytes(p.harness)),p.harnessSha256);assert.equal(hash(bytes(p.profile)),p.profileSha256);assert.equal(hash(fs.readFileSync(new URL('./gemp/NativeEngineSearchCancelMatchOracleTests.java',import.meta.url))),p.harnessSha256);assert.equal(p.referenceDecisions,r.trace.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.junitTests,1);assert.equal(r.finished,true);
});
