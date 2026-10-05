import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertForceMatchAction,assertStartingSetupEvidence} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/force-effects-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
test('ordinary full game binds both Force Effect starts, both boosts and a consequential Jedi exclusion',()=>{
 const r=record(),map=cards(r),setup=assertStartingSetupEvidence(r,map);assert.equal(map[setup.effects.light[0]].blueprint,'102_1');assert.equal(map[setup.effects.dark[0]].blueprint,'102_6');
 for(const [i,row]of r.trace.entries())if(['assault','sense','force-boost','force-exclude'].includes(row.semantic?.kind))assertForceMatchAction(r.trace,i,map);
 assert.equal(r.trace.filter(x=>x.semantic?.kind==='assault').length,3);assert.deepEqual(r.trace.filter(x=>x.semantic?.kind==='force-boost').map(x=>x.side).sort(),['dark','light']);
 const index=r.trace.findIndex(x=>x.semantic?.kind==='force-exclude'),x=r.trace[index];assert.equal(x.targetEvidence.length,1);assert.equal(map[x.targetEvidence[0].card].blueprint,'1_21');
 // The reference Sense finishes Used while its Assault target is still playing:
 // excluding the only Light character actually prevents this cancellation.
 assert.deepEqual(x.state.table.filter(c=>map[c.id].owner==='light'&&c.stats).map(c=>c.id),[x.targetEvidence[0].card]);
 const sense=r.trace.slice(0,index).findLast(t=>t.semantic?.kind==='sense'),assault=sense.targetEvidence.find(t=>t.blueprint==='1_238').card;
 const after=r.trace.slice(index+1).find(t=>t.state.players.light.used.includes(x.sense));assert.ok(after);assert.ok(!Object.values(after.state.players).some(p=>Object.values(p).some(pile=>pile.includes(assault))));
});
for(const kind of ['assault','sense','force-boost','force-exclude'])for(const mode of ['source','owner','answer','action-binding'])test(kind+' full-game evidence rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind===kind),x=r.trace[i];if(mode==='source')x.semantic.card='light-60';if(mode==='owner')x.semantic.side=x.side==='light'?'dark':'light';if(mode==='answer')x.answer='invalid';if(mode==='action-binding')x.actionEvidence.referenceCardId='forged';assert.throws(()=>assertForceMatchAction(r.trace,i,map));
});
for(const kind of ['assault','force-boost','force-exclude'])for(const mode of ['amount','payment-order'])test(kind+' payment rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind===kind),x=r.trace[i],side=x.side,before=x.state.players[side],after=r.trace.slice(i+1).find(y=>JSON.stringify(y.state.players[side].force)!==JSON.stringify(before.force)).state.players[side];if(mode==='amount')after.force.unshift(before.force[0]);else after.used[0]=before.force[1];assert.throws(()=>assertForceMatchAction(r.trace,i,map));
});
for(const kind of ['sense','force-exclude'])for(const mode of ['target','blueprint','observation'])test(kind+' targets reject '+mode,()=>{const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind===kind),x=r.trace[i];if(mode==='target')x.targetEvidence[0].card='light-60';if(mode==='blueprint')x.targetEvidence[0].blueprint='1_194';if(mode==='observation')x.targetsObservedAt=i-1;assert.throws(()=>assertForceMatchAction(r.trace,i,map));});
for(const kind of ['assault','force-boost','force-exclude'])test(kind+' refuses a borrowed suspended action',()=>{const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind===kind),x=r.trace[i];x[kind==='assault'?'drainSite':kind==='force-boost'?'assault':'sense']='dark-60';assert.throws(()=>assertForceMatchAction(r.trace,i,map));});
test('native replay matches all157 exact checkpoints through turn22 Life Force victory',()=>{const result=replayGempMatch(record());assert.equal(result.commands,1592);assert.equal(result.checkpoints,157);assert.equal(result.state.turn.number,22);assert.deepEqual(result.state.result,{winner:'light',loser:'dark',reason:'life-force'});assert.equal(result.transcript.filter(c=>c.choice.startsWith('force-effect:boost:')).length,2);assert.equal(result.transcript.filter(c=>c.choice.startsWith('force-effect:exclude:')).length,1);assert.equal(result.transcript.filter(c=>c.choice==='force-effect:confirm').length,1);assert.equal(result.transcript.filter(c=>c.choice.startsWith('cancel:play:')).length,1);});
test('full-match receipt binds exact exporter, decks, trace and unchanged production reference',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/force-effects-match-provenance.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');for(const [name,sha]of Object.entries(p.files))assert.equal(hash(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))),sha);assert.equal(hash(gunzipSync(fs.readFileSync(new URL('./gemp/complete-matches/force-effects-battle.json.gz',import.meta.url)))),p.jsonSha256);assert.equal(p.referenceDecisions,1077);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);});

for(const kind of ['sense','force-exclude'])for(const mode of ['future','physical-choice'])test(kind+' observation rejects '+mode,()=>{const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind===kind),x=r.trace[i];if(mode==='future')x.targetsObservedAt=r.trace.length;else{const choice=r.trace.slice(i+1,x.targetsObservedAt+1).find(y=>y.semantic?.kind===(kind==='sense'?'ability-selection':'exclude-selection'));assert.ok(choice);choice.answer='forged';}assert.throws(()=>assertForceMatchAction(r.trace,i,map));});
