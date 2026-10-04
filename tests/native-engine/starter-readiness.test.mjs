import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
const manifest=read('data/native-proof/manifest.json'),inventory=read('data/native-engine/starter-coverage.json'),audit=read('data/native-engine/starter-readiness.json');
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
test('starter readiness is tied to the exact authored pair and preserves closed admission',()=>{
 assert.equal(audit.productionAdmission,'closed');assert.equal(inventory.productionAdmission,'closed');assert.equal(audit.definitionCount,manifest.cards.length);
 assert.deepEqual(new Set(inventory.cards.map(c=>c.gempId)),new Set(manifest.decks.flatMap(d=>d.main)));
 for(const d of manifest.decks){const row=audit.decks.find(r=>r.id===d.id);assert.equal(row.sha256,createHash('sha256').update(JSON.stringify(d.main)).digest('hex'));assert.equal(row.count,d.main.length);assert.deepEqual(row.copies,Object.fromEntries([...new Set(d.main)].sort().map(bp=>[bp,d.main.filter(v=>v===bp).length])));for(const bp of d.main)assert.equal(premiereRules.supports(bp),false);}
});
test('deferred branches have real evidence, explicit scope and no silent certification',()=>{
 for(const row of audit.branches){assert.ok(row.reason);for(const p of [...row.implementation,...row.evidence])assert.ok(fs.existsSync(new URL('../../'+p,import.meta.url)),p);for(const bp of row.cards)assert.ok(manifest.cards.some(c=>c.gempId===bp));}
 const union=new Set(manifest.decks.flatMap(d=>d.main));for(const bp of audit.broaderCatalog.absentProviders)assert.ok(!union.has(bp),bp);
 for(const type of audit.broaderCatalog.absentPrintedTypes)assert.ok(!manifest.cards.some(c=>c.type===type));
 assert.equal(audit.decks.find(d=>d.side==='light').copies['1_77'],1);assert.equal(audit.decks.find(d=>d.side==='dark').copies['1_279'],1);
 assert.equal(audit.branches.find(b=>b.id==='obsession-failed-total').classification,'starter-blocker');
});
test('recorded native match evidence accounts for both sizes without claiming GEMP parity',()=>{
 const records=read(audit.nativeIntegration.records);assert.equal(records.engineBaseCommit,audit.baseCommit);assert.equal(records.runs.length,40);assert.equal(new Set(records.runs.map(r=>r.size+':'+r.seed)).size,40);
 assert.equal(records.runs.reduce((n,r)=>n+r.commands,0),audit.nativeIntegration.commands);
 for(const r of records.runs){assert.ok([40,60].includes(r.size));assert.ok(r.seed>=101&&r.seed<=120);assert.equal(r.result.reason,'life-force');assert.match(r.transcriptSha256,/^[a-f0-9]{64}$/);assert.match(r.finalStateSha256,/^[a-f0-9]{64}$/);}
 assert.equal(audit.nativeIntegration.handlers['duel:obsession']??0,0,'No duel coverage claimed from these runs');
});
