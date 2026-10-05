import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertReferenceAction,deployedCrewRole,followingTarget} from './gemp-match-replay.mjs';
const read=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
const provenance=JSON.parse(fs.readFileSync(new URL('./gemp/space-match-provenance.json',import.meta.url)));
for(const name of ['space-journeys','space-crew'])test('complete space match exactly replays: '+name,()=>{
 const r=read(name),before=JSON.stringify(r),result=replayGempMatch(r),p=provenance.fixtures.find(f=>f.fixture.endsWith('/'+name+'.json.gz'));
 // Keep historical receipt counts intact. The journeys replay has one
 // premature end (turn 12): GEMP skips its battle-ending window, removing two
 // obsolete passes. Crew has none. All state checkpoints remain unchanged.
 const prematureEnds=result.transcript.filter(x=>x.choice==='battle-premature-end').length;
 assert.equal(prematureEnds,name==='space-journeys'?1:0);
 assert.equal(JSON.stringify(r),before);assert.equal(result.state.status,'finished');assert.equal(result.state.result.reason,'life-force');assert.equal(result.state.result.winner,p.winner);assert.equal(result.commands,p.nativeCommands-2*prematureEnds);assert.equal(result.checkpoints,p.comparedCheckpoints);
 assert.ok(r.trace.some(t=>t.semantic?.kind==='hyperspace'));
 if(name==='space-crew'){
  assert.ok(r.trace.some(t=>t.state.table.some(c=>c.aboardRole==='pilot')));
  assert.ok(r.trace.some(t=>t.state.table.some(c=>c.vesselStats?.power>8)));
  assert.ok(r.trace.some(t=>t.semantic?.kind==='forfeit'&&t.state.table.some(c=>c.attachedTo===t.semantic.card&&c.aboardRole)));
 }
});
for(const field of ['power','ability','forfeit'])test('space replay rejects altered ship '+field,()=>{
 const r=read('space-crew'),row=r.trace.find(t=>t.semantic?.kind==='activate'&&t.state.table.some(c=>c.vesselStats));row.state.table.find(c=>c.vesselStats).vesselStats[field]++;assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});
test('forced passenger role comes from this completed deployment, not a later assignment',()=>{
 const r=read('space-crew');let found=false;
 for(let i=0;i<r.trace.length;i++){
  const row=r.trace[i];if(row.semantic?.kind!=='deploy')continue;
  const target=followingTarget(r.trace,i,'deploy-target');
  const after=r.trace.slice(r.trace.indexOf(target)+1).find(t=>t.semantic&&t.semantic.kind!=='pass');
  if(after?.semantic.kind==='crew-capacity')continue;
  const id=row.semantic.card,placed=r.trace.slice(i+1).flatMap(t=>t.state.table.filter(c=>c.id===id)).find(c=>c.attachedTo===target.semantic.card);
  if(placed?.aboardRole!=='passenger'||r.decks[id.split('-')[0]][Number(id.split('-')[1])-1]!=='1_173')continue;
  assert.equal(deployedCrewRole(r.trace,i,id,target.semantic.card),'passenger');
  const changed=structuredClone(r.trace.slice(i,i+2));changed.push({state:{table:[]},semantic:{kind:'hyperspace'}});
  assert.throws(()=>deployedCrewRole(changed,0,id,target.semantic.card),/before the next/);found=true;break;
 }
 assert.equal(found,true);
});
test('hyperspace semantic tag must be backed by its exact reference action',()=>{
 const row=read('space-crew').trace.find(t=>t.semantic?.kind==='hyperspace');assertReferenceAction(row);row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Move using landspeed';assert.throws(()=>assertReferenceAction(row),/does not match/);
});
test('space reference fixtures bind exact lists and executed harnesses',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const f of provenance.fixtures){const compressed=fs.readFileSync(new URL('../../'+f.fixture,import.meta.url)),raw=gunzipSync(compressed),r=JSON.parse(raw);assert.equal(hash(compressed),f.sha256);assert.equal(hash(raw),f.jsonSha256);assert.equal(hash(fs.readFileSync(new URL('../../'+f.harness,import.meta.url))),f.harnessSha256);assert.equal(hash(fs.readFileSync(new URL('../../'+f.deckManifest,import.meta.url))),f.deckManifestSha256);assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.snapshotVersion,7);assert.equal(r.final.turn,f.turns);}
});
