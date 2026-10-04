import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertReferenceAction,assertInterruptTarget,assertReferenceMove} from './gemp-match-replay.mjs';
const load=()=>readGempMatch(new URL('./gemp/complete-matches/ground-travel-responses.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([side,list])=>list.map((blueprint,i)=>[side+'-'+(i+1),{blueprint}])));

test('complete movement game includes two Luke runs and separately paid Escape moves',()=>{
 const r=load(),runs=r.trace.filter(x=>x.semantic?.kind==='run-luke');assert.equal(runs.length,2);
 assert.deepEqual(runs.map(x=>x.state.turn),[12,18]);assert.equal(runs[0].semantic.target,runs[1].semantic.target);
 const moves=r.trace.flatMap((x,i)=>x.semantic?.kind==='escape-card'?[i]:[]);assert.equal(moves.length,2);
 assert.deepEqual(moves.map(i=>r.trace[i].state.players.light.force.length),[2,1]);
 for(const i of moves){
  const row=r.trace[i],to=assertReferenceMove(r.trace,i,cards(r),r.final),after=r.trace[row.movementObservation.afterDecision+1].state;
  assert.equal(after.players.light.force.length,row.state.players.light.force.length-1);
  assert.equal(after.table.find(c=>c.id===row.semantic.card).location,to);
  assert.deepEqual(after.players.light.used,[row.state.players.light.force[0],...row.state.players.light.used]);
 }
});

for(const kind of ['run-luke','escape'])test('movement Interrupt action and target observations remain bound: '+kind,()=>{
 const r=load(),i=r.trace.findIndex(x=>x.semantic?.kind===kind),row=r.trace[i];assertReferenceAction(row);assertInterruptTarget(r.trace,i,cards(r));
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Pass';assert.throws(()=>assertReferenceAction(row),/does not match/);
 row.targetObservation.card='unknown';assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)));
});

for(const field of ['answer','origin','destination','boundary','arrival'])test('move-away observation rejects a changed '+field,()=>{
 const r=load(),i=r.trace.findIndex(x=>x.semantic?.kind==='escape-card'),row=r.trace[i],o=row.movementObservation;
 if(field==='answer')row.answer='unknown';
 if(field==='origin')row.state.table.find(c=>c.id===o.card).location=o.to;
 if(field==='destination')o.to='unknown';
 if(field==='boundary')o.afterDecision=r.trace.findIndex((x,j)=>j>i&&x.semantic?.kind==='escape-card');
 if(field==='arrival')r.trace[o.afterDecision+1].state.table.find(c=>c.id===o.card).location=o.from;
 assert.throws(()=>assertReferenceMove(r.trace,i,cards(r),r.final));
});

test('full replay detects an extra payment during Escape',()=>{
 const r=load(),moves=r.trace.filter(x=>x.semantic?.kind==='escape-card');moves[1].state.players.light.force=[];
 assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});

test('movement evidence fingerprints exact executed source, trace and finished game',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/travel-match-provenance.json',import.meta.url))),f=receipt.fixtures[0];
 const bytes=p=>fs.readFileSync(new URL('../../'+p,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),raw=bytes(f.fixture),r=load();
 assert.equal(sha(raw),f.sha256);assert.equal(sha(gunzipSync(raw)),f.jsonSha256);assert.equal(sha(bytes(f.harness)),f.harnessSha256);
 assert.equal(sha(bytes('tests/native-engine/gemp/NativeEngineTravelMatchOracleTests.java')),f.harnessSha256);
 assert.equal(receipt.unchangedProductionFiles,6820);assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.final.turn,f.turns);assert.equal(r.winner,f.winner);assert.equal(r.finished,true);
});
