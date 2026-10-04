import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertReferenceAction} from './gemp-match-replay.mjs';
import {load} from '../native-proof/load-engine.mjs';
const read=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
const receipt=()=>JSON.parse(fs.readFileSync(new URL('./gemp/vehicle-match-provenance.json',import.meta.url)));
const bp=(record,id)=>record.decks[id.split('-')[0]][Number(id.split('-')[1])-1];
for(const name of ['ground-vehicles','ground-vehicle-reacts'])test('full custom vehicle match exactly replays: '+name,()=>{
 const record=read(name),before=JSON.stringify(record),result=replayGempMatch(record),provenance=receipt().fixtures.find(f=>f.fixture.endsWith('/'+name+'.json.gz'));
 assert.equal(JSON.stringify(record),before);assert.equal(result.state.status,'finished');assert.equal(result.state.result.reason,'life-force');assert.equal(result.state.result.winner,record.winner);assert.equal(result.state.turn.number,record.final.turn);assert.equal(result.commands,provenance.nativeCommands);assert.equal(result.checkpoints,provenance.comparedCheckpoints);
 assert.ok(record.trace.some(r=>r.semantic?.kind==='deploy'&&bp(record,r.semantic.card)==='3_69'));assert.ok(record.trace.some(r=>r.semantic?.kind==='deploy'&&bp(record,r.semantic.card)==='3_155'));
 assert.ok(record.trace.some(r=>r.semantic?.kind==='forfeit'&&r.state.battleLosses));
 assert.ok(record.trace.some(r=>r.state.table.some(c=>c.aboardRole==='passenger')));
 assert.ok(record.trace.some(r=>r.state.table.some(c=>c.vesselStats?.ability>0)));
 if(name==='ground-vehicle-reacts')assert.equal(record.trace.filter(r=>r.semantic?.kind==='vehicle-react').length,2);
 const rules=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules;
 for(const deck of Object.values(record.decks))for(const id of deck)assert.equal(rules.supports(id),false);
});
for(const field of ['power','ability','forfeit','aboardRole'])test('vehicle replay rejects altered '+field+' evidence',()=>{
 const record=read('ground-vehicles');
 const row=record.trace.find(r=>r.semantic?.kind==='activate'&&r.state.table.some(c=>field==='aboardRole'?c.aboardRole:c.vesselStats));
 assert.ok(row);const card=row.state.table.find(c=>field==='aboardRole'?c.aboardRole:c.vesselStats);
 if(field==='aboardRole')card.aboardRole='pilot';else card.vesselStats[field]++;
 assert.throws(()=>replayGempMatch(record),/Checkpoint/);
});
test('custom profile cannot silently admit changed decks or unverified profiles',()=>{
 const record=read('ground-vehicles');record.deckProfile='arbitrary';assert.throws(()=>replayGempMatch(record),/Unknown fixed/);
 record.deckProfile='hoth-vehicles-v1';record.decks.light[0]='3_69';assert.throws(()=>replayGempMatch(record));
});
test('a deployment reaction cannot masquerade as the recorded vehicle movement reaction',()=>{
 const row=read('ground-vehicle-reacts').trace.find(r=>r.semantic?.kind==='vehicle-react');assertReferenceAction(row);
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]="Deploy as a 'react'";assert.throws(()=>assertReferenceAction(row),/does not match/);
});
test('vehicle match evidence binds exact decks, complete receipts and executed source',()=>{
 const p=receipt(),hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(fs.readFileSync(new URL('../../'+p.deckManifest,import.meta.url))),p.deckManifestSha256);
 for(const f of p.fixtures){
  const compressed=fs.readFileSync(new URL('../../'+f.fixture,import.meta.url));assert.equal(hash(compressed),f.sha256);assert.equal(hash(gunzipSync(compressed)),f.jsonSha256);assert.equal(hash(fs.readFileSync(new URL('../../'+f.harness,import.meta.url))),f.harnessSha256);
  const r=JSON.parse(gunzipSync(compressed));assert.equal(r.finished,true);assert.equal(r.snapshotVersion,6);assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.final.turn,f.turns);
 }
});
