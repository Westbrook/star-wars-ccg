import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertPhaseMatchEvidence,assertStartingSetupEvidence} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/phase-effects-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
test('ordinary game proves two penalties, a qualifying deployment and Effect self-loss',()=>{
 const r=record(),map=cards(r),setup=assertStartingSetupEvidence(r,map),e=assertPhaseMatchEvidence(r,map);
 assert.equal(map[setup.effects.dark[0]].blueprint,'5_110');assert.equal(map[setup.interrupts.dark].blueprint,'6_160');
 assert.deepEqual(e.penalties.map(p=>p.turn),[2,4]);assert.deepEqual(e.avoided.map(p=>p.turn),[6]);assert.equal(e.removals.length,1);assert.equal(r.trace[e.removals[0].index].state.turn,8);
 assert.deepEqual(e.penalties.flatMap(p=>p.indices.map(i=>r.trace[i].lossZone)),['HAND','HAND','TOP_OF_FORCE_PILE','TOP_OF_RESERVE_DECK']);
});
for(const mode of ['source','blueprint','amount','side','phase','observed-deployment','card','answer','zone','payment-order','missing-payment','missing-observation','phantom-observation'])test('phase match evidence rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.phaseLoss&&x.semantic?.kind==='lose'),x=r.trace[i];
 if(mode==='source')x.phaseLoss.source='dark-4';if(mode==='blueprint')x.phaseLoss.blueprint='102_6';if(mode==='amount')x.phaseLoss.remaining=3;if(mode==='side')x.semantic.side='dark';if(mode==='phase')x.state.phase='battle';if(mode==='observed-deployment')x.phaseEffects[0].deployedAbilityObserved=true;if(mode==='card')x.semantic.card='dark-50';if(mode==='answer')x.answer='forged';if(mode==='zone')x.lossZone='table';if(mode==='missing-observation')delete x.phaseEffects;if(mode==='phantom-observation')x.phaseEffects.push({source:'dark-4',deployedAbilityObserved:false});
 if(mode==='payment-order'){const after=r.trace.slice(i+1).find(t=>t.state.players.light.lost.includes(x.semantic.card));after.state.players.light.lost.reverse();}
 if(mode==='missing-payment')x.semantic.kind='pass';
 assert.throws(()=>assertPhaseMatchEvidence(r,map));
});
test('Effect self-loss cannot be justified by equal ability-card counts',()=>{const r=record(),map=cards(r),e=assertPhaseMatchEvidence(r,map),prior=r.trace[e.removals[0].index-1];prior.state.table.find(c=>c.id.startsWith('light-')&&c.stats).stats.ability=0;assert.throws(()=>assertPhaseMatchEvidence(r,map));});
test('qualifying observation requires a real deployment during that same turn',()=>{const r=record(),map=cards(r),e=assertPhaseMatchEvidence(r,map);r.trace[e.avoided[0].deployIndex].state.turn-=2;assert.throws(()=>assertPhaseMatchEvidence(r,map));});
test('native replay matches176 exact checkpoints through turn24 Life Force victory',()=>{const result=replayGempMatch(record());assert.equal(result.commands,1752);assert.equal(result.checkpoints,176);assert.equal(result.state.turn.number,24);assert.deepEqual(result.state.result,{winner:'light',loser:'dark',reason:'life-force'});assert.equal(result.transcript.filter(c=>c.choice.startsWith('phase-effect:loss:')).length,2);assert.equal(result.transcript.filter(c=>c.choice.startsWith('phase-effect:lost:')).length,1);});
test('phase match receipt binds exporter, actual trace and separate unresolved carry probe',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/phase-effects-match-provenance.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');for(const [name,sha]of Object.entries(p.files))assert.equal(hash(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))),sha);assert.equal(hash(gunzipSync(fs.readFileSync(new URL('./gemp/complete-matches/phase-effects-battle.json.gz',import.meta.url)))),p.jsonSha256);assert.equal(p.referenceDecisions,1222);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.differences[0].status,'open');});
