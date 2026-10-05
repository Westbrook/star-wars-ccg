import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {captureRecord,captureMatchFixtures,resumeCaptureMatch} from './capture-match-fixture.mjs';
import {replayGempMatch} from './gemp-match-replay.mjs';

test('complete capture game reaches Life Force victory through exact legal command replay',()=>{
 const record=captureRecord(),before=JSON.stringify(record),result=replayGempMatch(record);
 assert.equal(JSON.stringify(record),before,'Reference observations cannot be rewritten during replay');
 assert.equal(result.state.status,'finished');assert.equal(result.state.result.reason,'life-force');assert.equal(result.state.result.winner,record.winner);assert.equal(result.commands,1677);assert.equal(result.checkpoints,162);assert.equal(result.state.turn.number,28);
 assert.ok(result.transcript.some(c=>c.choice.startsWith('tractor:use:')));
 assert.ok(result.transcript.some(c=>c.choice.startsWith('prisoner:ship-play:')));
 assert.ok(record.trace.some(r=>r.state.table.some(c=>c.capturedShip)));
 assert.ok(record.trace.some(r=>r.state.table.some(c=>c.captivity)));
 assert.ok(record.trace.some(r=>r.state.table.some(c=>c.id.startsWith('light-')&&c.owner==='dark')),'The captured ship must actually be stolen');
});

test('captured ship and crew custody survive persisted continuation through victory',()=>{
 const {result,checkpoints}=captureMatchFixtures();
 for(const [label,predicate] of [
  ['captured ship',m=>Object.values(m.cards).some(c=>c.capturedShip)],
  ['escorted captive',m=>Object.values(m.cards).some(c=>c.captivity)],
  ['stolen ship',m=>Object.values(m.cards).some(c=>c.originalOwner==='light'&&c.owner==='dark')],
 ]){
  const checkpoint=checkpoints.find(c=>predicate(c.match));assert.ok(checkpoint,label+' boundary must occur naturally');
  const before=JSON.stringify(checkpoint.match),resumed=resumeCaptureMatch(checkpoint.match,result.transcript);
  assert.equal(JSON.stringify(checkpoint.match),before,'Resume cannot mutate its saved input');
  assert.deepEqual(resumed,result.state,label+' resumed final state differs');
 }
});

for(const field of ['zone','owner','capturedShip','captivity'])test('capture replay rejects corrupted '+field+' evidence',()=>{
 const record=captureRecord(),row=record.trace.find(r=>r.semantic&&!['pass'].includes(r.semantic.kind)&&r.state.table.some(c=>field==='captivity'?c.captivity:c.capturedShip));
 assert.ok(row,'A compared custody boundary is required');
 const card=row.state.table.find(c=>field==='captivity'?c.captivity:c.capturedShip);
 if(field==='zone')card.zone='table';if(field==='owner')card.owner='dark';if(field==='capturedShip')card.capturedShip.host='dark-999';if(field==='captivity')card.captivity.escort='dark-999';
 assert.throws(()=>replayGempMatch(record),/Checkpoint/);
});

test('capture receipt binds unmodified reference engine, exact decks and executed source',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/capture-space-provenance.json',import.meta.url)));
 const bytes=f=>fs.readFileSync(new URL('../../'+f,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),record=captureRecord();
 assert.equal(hash(bytes(p.fixture)),p.sha256);assert.equal(hash(gunzipSync(bytes(p.fixture))),p.jsonSha256);assert.equal(hash(bytes(p.harness)),p.harnessSha256);assert.equal(hash(bytes(p.deckManifest)),p.deckManifestSha256);
 assert.equal(p.productionFilesChanged,0);assert.equal(p.productionFilesCompared,6820);assert.equal(record.trace.length,p.referenceDecisions);assert.equal(record.snapshotVersion,10);assert.equal(record.finished,true);assert.equal(record.winner,p.winner);assert.equal(record.final.turn,p.turns);
 assert.equal(record.final.players.light.reserve.length+record.final.players.light.force.length+record.final.players.light.used.length,0);
});

test('theft timing evidence retains intermediate raw custody and only skips empty response windows',async()=>{
 const {assertCaptureTheftTiming}=await import('./gemp-match-replay.mjs');
 const record=captureRecord(),before=JSON.stringify(record),review=assertCaptureTheftTiming(record);assert.equal(JSON.stringify(record),before);assert.equal(review.recordedCases.length,2);
 for(const evidence of review.recordedCases){
  assert.ok(evidence.beforePlacement.attachedTo);assert.equal(evidence.settled.attachedTo,undefined);
  for(const window of evidence.emptyStolenWindows){
   const altered=structuredClone(record);altered.trace[window.row].parameters.actionId=['real-response'];altered.trace[window.row].parameters.actionText=['Respond to theft'];
   assert.throws(()=>assertCaptureTheftTiming(altered),/Nonempty stolen response/);
  }
 }
});
