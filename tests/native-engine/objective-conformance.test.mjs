import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mod,state} from './prisoner-fixture.mjs';
import {objectiveStart,finishObjectiveSetup,objectiveFixture,objectiveSeek,objectivePrompt,objectiveStep,tableCard} from './objective-fixture.mjs';
const rows=JSON.parse(readFileSync(new URL('./gemp/isb-objective-results.json',import.meta.url)));
for(const row of rows)test('Executed ISB Objective observation: '+row.mode,()=>{
 const f=row.mode==='missing'?(()=>{const m=finishObjectiveSetup(objectiveStart({missing:true}));const pick=bp=>Object.values(m.cards).find(c=>c.blueprint===bp).id;return {m,pick,objective:pick('7_299')};})():objectiveFixture();let m=f.m;
 const traits=mod('characteristics'),record=mod('objectives').objectiveRecord(m,f.objective),veers=f.pick('104_6');
 const actual={mode:row.mode,objectiveZone:m.cards[f.objective].zone==='table'?'SIDE_OF_TABLE':'OUT_OF_PLAY',complete:record.complete,openingDark:m.players.dark.hand.length,openingLight:m.players.light.hand.length,veersSpy:traits.hasCharacteristic(m,veers,'SPY'),veersAgent:traits.hasCharacteristic(m,veers,'ISB_AGENT')};
 if(['setup','missing'].includes(row.mode)){assert.deepEqual(actual,row);return;}
 const a=tableCard(m,f.pick('3_63')),b=tableCard(m,f.pick('3_144')),system=tableCard(m,f.pick('3_143'));
 if(row.mode==='veers-restriction'){state.moveCard(m,veers,'hand');actual.coruscantAllowed=mod('board').deploymentPayment(m,veers,f.coruscant)!==null;assert.deepEqual(actual,row);return;}
 if(row.mode==='two-bases'){tableCard(m,f.pick('8_114'),a);tableCard(m,f.pick('106_11'),b);}else for(const bp of ['8_114','106_11','1_166','104_6'])tableCard(m,f.pick(bp),row.mode==='drains'?a:f.coruscant);
 m=objectiveSeek(m,x=>x.cards[f.objective].face==='back');actual.flipped=true;actual.darkDrainAtAgent=mod('board').drainAmount(m,'dark',row.mode==='drains'?a:f.coruscant);actual.lightDrainRelatedSite=mod('board').drainAmount(m,'light',b);actual.lightDrainRelatedSystem=mod('board').drainAmount(m,'light',system);
 if(row.mode==='four-agents'){for(const bp of ['8_114','106_11','1_166','104_6'])state.moveCard(m,f.pick(bp),'hand');m=objectiveSeek(m,x=>x.cards[f.objective].face===undefined);actual.flippedBack=true;actual.remainderSpy=traits.hasCharacteristic(m,veers,'SPY');}
 if(row.mode==='retrieve'){state.moveCard(m,veers,'lost');m=objectiveSeek(m,x=>x.turn.phase==='draw'&&x.turn.side==='dark'&&objectivePrompt(x).side==='dark'&&x.stack.at(-1)?.timing==='phase');m=objectiveStep(m,'objective:retrieve:'+f.objective);m=objectiveSeek(m,x=>x.stack.at(-1)?.handler==='retrieval:select');m=objectiveStep(m,'retrieve:'+veers);m=objectiveSeek(m,x=>x.cards[veers].zone==='used');actual.retrievedToUsed=true;}
 assert.deepEqual(actual,row);
});
test('ISB receipt binds executed reference results and immutable reviewed lore',async()=>{const {createHash}=await import('node:crypto'),root=new URL('./gemp/',import.meta.url),p=JSON.parse(readFileSync(new URL('isb-objective-provenance.json',root)));for(const field of ['harness','results','log'])assert.equal(createHash('sha256').update(readFileSync(new URL(p[field],root))).digest('hex'),p[field+'Sha256']);assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.execution.exitCode,0);assert.equal(p.execution.observedCases,rows.length);const lore=JSON.parse(readFileSync(new URL('objective-lore-provenance.json',root)));assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+lore.registry,import.meta.url))).digest('hex'),lore.registrySha256);assert.equal(mod('premiere-rules').premiereRules.supports('7_299'),false);});
test('ISB source receipt confirms unchanged production and keeps unsupported Tarl closed',()=>{const p=JSON.parse(readFileSync(new URL('./gemp/isb-objective-provenance.json',import.meta.url)));assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(mod('definitions').definition('8_114').status,'metadata-only');const tarkin=mod('definitions').definition('102_11');assert.equal(tarkin.text,'');assert.equal(tarkin.status,'pending-verification');});
