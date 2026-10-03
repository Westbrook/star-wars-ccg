import test from 'node:test';
import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch,shuffleEntropy,normalizedCheckpoint,assertReferenceAction} from './gemp-match-replay.mjs';
import {load} from '../native-proof/load-engine.mjs';
const {shuffled}=load(new URL('../../lib/native-engine/random.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const loadMatch=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));

for(const name of ['ground-a','ground-b'])test('complete GEMP introductory match replays with exact checkpoints: '+name,()=>{
 const reference=loadMatch(name),before=JSON.stringify(reference),result=replayGempMatch(reference);
 assert.equal(JSON.stringify(reference),before,'reference fixture must stay immutable');
 assert.equal(result.state.result.winner,reference.winner);
 assert.equal(result.state.turn.number,reference.final.turn);
 assert.ok(result.checkpoints>=100);
 assert.ok(reference.trace.filter(r=>r.semantic?.kind==='battle').length>=3);
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='forfeit'&&r.state.battleLosses));
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='lose'));
 assert.ok(reference.trace.some(r=>r.semantic?.kind==='drain'));
 assert.equal(result.state.deckSize,60);
 for(const deck of Object.values(reference.decks))for(const bp of deck)assert.equal(premiereRules.supports(bp),false,'a matching path must not admit a whole deck');
});
test('recorded setup permutation is replayed through the real shuffle, preserving the input',()=>{
 const before=['one','two','three','four','five'],after=['five','two','one','three','four'],values=shuffleEntropy(before,after);let i=0;
 assert.deepEqual(shuffled(before,()=>values[i++]),after);assert.equal(i,4);assert.deepEqual(before,['one','two','three','four','five']);
 assert.throws(()=>shuffleEntropy(before,[...after.slice(1),'unknown']));
});
test('checkpoint normalization preserves within-system adjacency and every ordered pile',()=>{
 const cards={a:{blueprint:'1_129'},b:{blueprint:'1_130'},c:{blueprint:'101_1'},d:{blueprint:'101_4'}};
 const source={locations:['a','b','c','d'],players:{dark:{hand:['2','1'],reserve:['4','3'],force:['6','5'],used:['8','7'],lost:['0','9']}}};
 const normalize=locations=>normalizedCheckpoint({...source,locations},cards);
 assert.deepEqual(normalize(['c','d','a','b']),normalize(['a','b','c','d']));
 assert.notDeepEqual(normalize(['b','a','c','d']),normalize(['a','b','c','d']));
 const result=normalize(source.locations);assert.deepEqual(result.players.dark.hand,['1','2']);
 for(const pile of ['reserve','force','used','lost'])assert.deepEqual(result.players.dark[pile],source.players.dark[pile]);
});
test('an incomplete or wrong-deck reference cannot count as complete-match evidence',()=>{
 const record=loadMatch('ground-a');record.finished=false;assert.throws(()=>replayGempMatch(record),/Reference match must finish/);
 record.finished=true;record.decks.dark.pop();assert.throws(()=>replayGempMatch(record));
});
test('altering a reference pile order is caught at the checkpoint, not accepted because counts match',()=>{
 const record=loadMatch('ground-a');const row=record.trace.find(r=>r.semantic?.kind==='activate');row.state.players.dark.reserve.reverse();
 assert.throws(()=>replayGempMatch(record),/Checkpoint/);
});
test('altering the final winner is rejected even after all intermediate checkpoints match',()=>{
 const record=loadMatch('ground-a');record.winner=record.winner==='dark'?'light':'dark';
 assert.throws(()=>replayGempMatch(record));
});
test('an Interrupt drawing destiny cannot be mislabeled as an ordinary draw',()=>{
 const record=loadMatch('ground-a'),row=record.trace.find(r=>r.semantic?.kind==='draw');
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Draw destiny to retrieve troopers';
 assert.throws(()=>assertReferenceAction(row),/does not match/);
});
