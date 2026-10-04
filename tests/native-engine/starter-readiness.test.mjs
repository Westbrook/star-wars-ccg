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
test('movement reachability audit covers every exact starter card and expires when reviewed inputs change',()=>{
 const analysis=read('data/native-engine/starter-travel-reachability.json');
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
 assert.equal(analysis.classification,'outside-current-pair');
 const cards=analysis.groups.flatMap(g=>g.cards);assert.equal(new Set(cards).size,cards.length);
 assert.deepEqual([...cards].sort(),manifest.cards.map(c=>c.gempId).sort());
 for(const c of manifest.cards)assert.equal(hash(JSON.stringify(canonical(c))),analysis.cardFingerprints[c.gempId],c.gempId+' printed definition changed: review reachability');
 for(const d of manifest.decks)assert.equal(hash(JSON.stringify(d.main)),analysis.deckFingerprints[d.id],d.id+' changed: review reachability');
 assert.deepEqual(Object.keys(analysis.sourceFingerprints).sort(),fs.readdirSync(new URL('../../lib/native-engine',import.meta.url)).filter(f=>f.endsWith('.ts')).map(f=>'lib/native-engine/'+f).sort(),'New engine providers require reachability review');
 for(const [p,sha]of Object.entries(analysis.sourceFingerprints))assert.equal(hash(fs.readFileSync(new URL('../../'+p,import.meta.url))),sha,p+' changed: review reachability');
 for(const g of analysis.groups){assert.ok(g.reason);assert.ok(g.implementation.length);for(const f of g.implementation)assert.ok(analysis.sourceFingerprints['lib/native-engine/'+f]);}
 for(const p of analysis.evidence)assert.ok(fs.existsSync(new URL('../../'+p,import.meta.url)));
 const branch=audit.branches.find(b=>b.id==='returning-travel-target');assert.equal(branch.classification,analysis.classification);
 assert.ok(branch.evidence.includes('data/native-engine/starter-travel-reachability.json'));assert.equal(premiereRules.supports('1_98'),false);
});
test('movement response receipt retains actual reference source and all twenty-six decisions',()=>{
 const p=read('tests/native-engine/gemp/travel-response-provenance.json'),rows=read('tests/native-engine/gemp/travel-response-results.json');
 for(const [f,sha]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+f,import.meta.url))).digest('hex'),sha);
 assert.deepEqual(rows.map(r=>r.mode),['run','run-light','escape']);assert.equal(rows.flatMap(r=>r.windows).length,p.responseWindows);
 for(const row of rows){assert.ok(row.before.length);assert.equal(row.lukeMoved,true);for(const w of row.windows)assert.deepEqual(w.actions,[]);}
 const source=fs.readFileSync(new URL('./gemp/NativeEngineTravelResponseOracleTests.java',import.meta.url),'utf8');
 for(const c of manifest.cards.filter(c=>c.type==='Interrupt'))assert.ok(source.includes('"'+c.gempId+'"'),c.gempId+' must be available in reference inventory');
});
