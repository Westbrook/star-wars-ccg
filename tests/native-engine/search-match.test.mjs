import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {assertSearchEvidence,readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/search-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
const first=(r,failed=false)=>r.trace.findIndex(x=>x.semantic?.kind==='mentor-search'&&!!x.selection!==failed);
test('actual searches bind both retrieved physical cards and both failed-search acknowledgments',()=>{
 const r=record(),map=cards(r),proofs=[];
 for(let i=0;i<r.trace.length;i++)if(r.trace[i].semantic?.kind==='mentor-search')proofs.push(assertSearchEvidence(r.trace,i,map,r.final));
 assert.deepEqual(proofs.map(p=>p.selected),['light-59','light-60',undefined]);assert.equal(proofs[2].verificationIndices.length,2);
 for(const p of proofs.slice(0,2))assert.ok(r.trace.slice(p.afterDecision+1).some(x=>x.semantic?.kind==='equip'&&x.semantic.card===p.selected));
 const fires=r.trace.filter(x=>x.semantic?.kind==='fire');assert.equal(fires.length,8);assert.ok(fires.every(x=>x.semantic.card===proofs[0].selected));
});
for(const mode of ['source','owner','completion-source','early-boundary','late-boundary','cross-action','selection-card','selection-side','selection-index','selection-answer','selection-blueprint','packet','packet-pile','initiation','prompt','answer','selectable','extra-selectable','minimum','shuffle-membership','hand','immediate-shuffle','not-lost'])test('successful search evidence rejects '+mode,()=>{
 const r=record(),i=first(r),row=r.trace[i],map=cards(r),choice=r.trace[row.selection.atDecision],after=r.trace[row.searchOutcome.afterDecision+1];
 if(mode==='source')map[row.semantic.card].blueprint='1_11';if(mode==='owner')map[row.semantic.card].owner='dark';if(mode==='completion-source')row.searchOutcome.source='dark-1';if(mode==='early-boundary')row.searchOutcome.afterDecision=i-1;if(mode==='late-boundary')row.searchOutcome.afterDecision=r.trace.length;if(mode==='cross-action')r.trace[i+1].semantic={kind:'draw'};
 if(mode==='selection-card')choice.semantic.card='dark-1';if(mode==='selection-side')choice.semantic.side='dark';if(mode==='selection-index')row.selection.atDecision++;if(mode==='selection-answer')row.selection.answer='missing';if(mode==='selection-blueprint')row.selection.blueprint='1_11';if(mode==='packet')choice.parameters.blueprintId.pop();if(mode==='packet-pile')choice.state.players.light.reserve.reverse();if(mode==='initiation')choice.semantic.initiation=0;if(mode==='prompt')choice.text='Choose a different card';if(mode==='answer')choice.answer='missing';if(mode==='selectable')choice.parameters.selectable[choice.parameters.cardId.indexOf(choice.answer)]='false';if(mode==='extra-selectable')choice.parameters.selectable[choice.parameters.selectable.indexOf('false')]='true';if(mode==='minimum')choice.parameters.min=['0'];if(mode==='shuffle-membership')row.searchOutcome.reserve[0]='dark-1';if(mode==='hand')row.searchOutcome.hand.push('dark-1');if(mode==='immediate-shuffle')after.state.players.light.reserve.reverse();if(mode==='not-lost')after.state.players.light.lost=after.state.players.light.lost.filter(id=>id!==row.semantic.card);
 assert.throws(()=>assertSearchEvidence(r.trace,i,map,r.final));
});
for(const mode of ['missing-ack','duplicate-side','eligible-card','source','prompt','answer','selectable','minimum'])test('failed search evidence rejects '+mode,()=>{
 const r=record(),i=first(r,true),row=r.trace[i],map=cards(r),ack=r.trace.find(x=>x.semantic?.kind==='search-verify'&&x.semantic.initiation===i);
 if(mode==='missing-ack')delete ack.semantic;if(mode==='duplicate-side')ack.semantic.side=ack.semantic.side==='light'?'dark':'light';if(mode==='eligible-card')map[row.state.players.light.reserve[0]].blueprint='1_155';if(mode==='source')ack.semantic.card='dark-1';if(mode==='prompt')ack.text='Unrelated verification';if(mode==='answer')ack.answer='1';if(mode==='selectable')ack.parameters.selectable[0]='true';if(mode==='minimum')ack.parameters.min=['1'];assert.throws(()=>assertSearchEvidence(r.trace,i,map,r.final));
});
test('continuous game supplies entropy only for actual setup and three search shuffles',()=>{
 const r=replayGempMatch(record());assert.equal(r.commands,2864);assert.equal(r.checkpoints,316);assert.equal(r.state.turn.number,35);assert.deepEqual(r.state.result,{winner:'dark',loser:'light',reason:'life-force'});
 const shuffles=r.transcript.filter(c=>c.entropy);assert.equal(shuffles.length,3,'Three post-setup search shuffles; setup entropy is supplied separately');assert.ok(shuffles.every(c=>c.entropy.length>0));
});
test('continuous replay rejects a changed post-search Force payment',()=>{
 const r=record(),i=first(r),row=r.trace[i],after=r.trace[row.searchOutcome.afterDecision+1];after.state.players.light.force.push(after.state.players.light.used.shift());assert.throws(()=>replayGempMatch(r));
});
test('receipt fingerprints actual executed reference, decks and completed game',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/search-match-provenance.json',import.meta.url))),bytes=f=>fs.readFileSync(new URL('../../'+f,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),r=record();
 assert.equal(hash(bytes(p.fixture)),p.sha256);assert.equal(hash(gunzipSync(bytes(p.fixture))),p.jsonSha256);assert.equal(hash(bytes(p.harness)),p.harnessSha256);assert.equal(hash(bytes(p.profile)),p.profileSha256);assert.equal(hash(fs.readFileSync(new URL('./gemp/NativeEngineSearchMatchOracleTests.java',import.meta.url))),p.harnessSha256);assert.equal(p.referenceDecisions,r.trace.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.junitTests,1);assert.equal(r.finished,true);
});
