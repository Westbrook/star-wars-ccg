import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertReferenceAction,assertInterruptTarget} from './gemp-match-replay.mjs';

const load=name=>readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([side,list])=>list.map((blueprint,i)=>[side+'-'+(i+1),{blueprint}])));
const nextAction=(r,i)=>r.trace.slice(i+1).find(x=>x.semantic&&!['pass','interrupt-target'].includes(x.semantic.kind));

for(const kind of ['stun','dice','takeel'])test('full-match '+kind+' tag must match the selected reference action',()=>{
 const row=load('ground-battle-responses').trace.find(x=>x.semantic?.kind===kind);assertReferenceAction(row);
 row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Pass';
 assert.throws(()=>assertReferenceAction(row),/does not match/);
});

test('explicit Interrupt target checks the actual reference answer, identity and selectable entry',()=>{
 const r=load('ground-battle-responses'),i=r.trace.findIndex(x=>x.semantic?.kind==='stun'),row=r.trace[i],target=r.trace[row.targetObservation.afterDecision];
 assert.equal(assertInterruptTarget(r.trace,i,cards(r)),row.semantic.target);
 const answer=target.answer;target.answer='unknown';assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)),/Chosen target differs/);target.answer=answer;
 target.parameters.selectable=target.parameters.cardId.map(()=> 'false');assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)));
 delete target.parameters.selectable;row.targetObservation.blueprint='unknown';assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)),/Target blueprint differs/);
});

test('single-target shortcut still requires an observed target present at initiation',()=>{
 const r=load('ground-battle-responses'),i=r.trace.findIndex(x=>x.semantic?.kind==='dice'),row=r.trace[i];
 assert.equal(row.targetObservation.afterDecision,i);assertInterruptTarget(r.trace,i,cards(r));
 const observation=row.targetObservation;delete row.targetObservation;assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)),/Missing actual target/);row.targetObservation=observation;
 row.state.table=row.state.table.filter(c=>c.id!==row.semantic.target);assert.throws(()=>assertInterruptTarget(r.trace,i,cards(r)),/Target must be on table/);
});

test('recorded Stun succeeds on Luke and separately leaves an equipped target intact on failure',()=>{
 const success=load('ground-battle-responses'),i=success.trace.findIndex(x=>x.semantic?.kind==='stun'),id=success.trace[i].semantic.target;
 assert.ok(success.trace[i].state.table.some(c=>c.id===id));
 const after=nextAction(success,i).state;assert.ok(after.players.light.hand.includes(id));assert.ok(!after.table.some(c=>c.id===id));
 const failed=load('ground-redraws'),j=failed.trace.findIndex(x=>x.semantic?.kind==='stun'),target=failed.trace[j].semantic.target;
 const attachments=failed.trace[j].state.table.filter(c=>c.attachedTo===target);assert.equal(attachments.length,5);
 const kept=nextAction(failed,j).state;assert.ok(kept.table.some(c=>c.id===target));
 for(const c of attachments)assert.deepEqual(kept.table.find(v=>v.id===c.id),c);
});

test('reused Hans Dice finalizes one replacement draw, including a real zero distinct from no draw',()=>{
 const r=load('ground-redraws'),indices=r.trace.flatMap((x,i)=>x.semantic?.kind==='dice'?[i]:[]);assert.equal(indices.length,2);
 assert.equal(r.trace[indices[0]].semantic.card,r.trace[indices[1]].semantic.card);
 const destinies=indices.map(i=>nextAction(r,i).state.battleDestinies);
 assert.deepEqual(destinies.map(d=>d.light),[{total:1,cards:['light-18'],values:[1]},{total:0,cards:['light-53'],values:[0]}]);
 assert.deepEqual(destinies[1].dark,{total:0,cards:[],values:[]});
});

test('Takeel switches unequal totals while the drawn cards retain their owners',()=>{
 const r=load('ground-destiny-switch'),i=r.trace.findIndex(x=>x.semantic?.kind==='takeel'),destiny=nextAction(r,i).state.battleDestinies;
 assert.deepEqual(destiny,{dark:{cards:['dark-20'],values:[1],total:0},light:{cards:['light-47'],values:[0],total:1}});
});

for(const field of ['attrition','total','cards','values','missing'])test('version 5 replay rejects altered '+field+' evidence',()=>{
 const r=load('ground-destiny-switch'),row=r.trace.find(x=>x.semantic?.kind==='forfeit'&&x.state.battleDestinies);
 if(field==='attrition')row.state.battleLosses.light.attrition++;
 else if(field==='missing')delete row.state.battleDestinies;
 else if(field==='cards')row.state.battleDestinies.light.cards=['dark-20'];
 else if(field==='values')row.state.battleDestinies.light.values=[7];
 else row.state.battleDestinies.light.total++;
 assert.throws(()=>replayGempMatch(r),/Checkpoint/);
});

test('full response games are bound to their exact executed source and recorded bytes',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/battle-response-match-provenance.json',import.meta.url)));
 const bytes=p=>fs.readFileSync(new URL('../../'+p,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(receipt.unchangedProductionFiles,6820);assert.equal(receipt.fixtures.length,3);
 for(const f of receipt.fixtures){
  const raw=bytes(f.fixture);assert.equal(sha(raw),f.sha256);assert.equal(sha(gunzipSync(raw)),f.jsonSha256);assert.equal(sha(bytes(f.harness)),f.harnessSha256);
  const r=JSON.parse(gunzipSync(raw));assert.equal(r.trace.length,f.referenceDecisions);assert.equal(r.final.turn,f.turns);assert.equal(r.winner,f.winner);assert.equal(r.finished,true);
 }
 assert.equal(sha(bytes('tests/native-engine/gemp/NativeEngineBattleResponseMatchOracleTests.java')),receipt.fixtures.at(-1).harnessSha256);
});
