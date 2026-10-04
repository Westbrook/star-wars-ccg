import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertReferenceAction} from './gemp-match-replay.mjs';
const read=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
const provenance=JSON.parse(fs.readFileSync(new URL('./gemp/armed-space-match-provenance.json',import.meta.url)));
for(const f of provenance.fixtures)test('complete armed space game exactly replays: '+f.fixture,()=>{
 const r=read(f.fixture.split('/').at(-1).replace('.json.gz','')),before=JSON.stringify(r),result=replayGempMatch(r);
 assert.equal(JSON.stringify(r),before);assert.equal(result.state.status,'finished');assert.equal(result.state.result.reason,'life-force');assert.equal(result.state.result.winner,f.winner);
 assert.equal(result.commands,f.nativeCommands);assert.equal(result.checkpoints,f.comparedCheckpoints);
 const shots={};for(const row of r.trace)if(row.semantic?.kind==='fire'){const [side,n]=row.semantic.card.split('-'),b=r.decks[side][Number(n)-1];shots[b]=(shots[b]??0)+1;}
 assert.deepEqual(shots,f.firedBlueprints);
 assert.equal(r.trace.filter(row=>row.semantic?.kind==='maneuver').length,f.actions.maneuver??0);
});
for(const field of ['armor','maneuver','hyperspeed'])test('armed replay rejects altered ship '+field,()=>{
 const r=read('armed-space-ion'),row=r.trace.find(t=>t.semantic?.kind==='activate'&&t.state.table.some(c=>Number.isFinite(c.vesselStats?.[field])));
 assert.ok(row);row.state.table.find(c=>Number.isFinite(c.vesselStats?.[field])).vesselStats[field]++;
 assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});
test('maneuver requires the exact offered reference action',()=>{
 const row=read('armed-space-ion').trace.find(t=>t.semantic?.kind==='maneuver');assertReferenceAction(row);
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Fire weapon';assert.throws(()=>assertReferenceAction(row),/does not match/);
});
test('maneuver rejects a target differing from the actual observed target',()=>{
 const r=read('armed-space-ion'),row=r.trace.find(t=>t.semantic?.kind==='maneuver');row.targetObservation.card='light-1';
 assert.throws(()=>replayGempMatch(r),/light-1|dark-16/);
});
test('armed game profile requires the exact retained decks',()=>{
 const r=read('armed-space-ion');r.decks.light[0]='1_173';assert.throws(()=>replayGempMatch(r));
});
test('armed reference receipts bind lists and exact executed harnesses',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const f of provenance.fixtures){
  const compressed=fs.readFileSync(new URL('../../'+f.fixture,import.meta.url)),raw=gunzipSync(compressed),r=JSON.parse(raw);
  assert.equal(hash(compressed),f.sha256);assert.equal(hash(raw),f.jsonSha256);
  assert.equal(hash(fs.readFileSync(new URL('../../'+f.harness,import.meta.url))),f.harnessSha256);
  assert.equal(hash(fs.readFileSync(new URL('../../'+f.deckManifest,import.meta.url))),f.deckManifestSha256);
  assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.snapshotVersion,8);assert.equal(r.final.turn,f.turns);
 }
});
