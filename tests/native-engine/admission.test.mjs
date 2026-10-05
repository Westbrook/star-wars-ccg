import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks} from './match-runner.mjs';
const a=load(new URL('../../lib/native-engine/admission.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const clone=v=>JSON.parse(JSON.stringify(v));
const decks=starterDecks(60), counts=Object.fromEntries(decks.map(d=>[d.side,a.deckCounts(d.cards)]));
const profile=(overrides={})=>({id:'intro-pair-test',rulesVersion:auditRules.id,evidenceVersion:'test-only-1',enabled:true,format:'open',deckSize:60,decks:clone(counts),...overrides});
const rules=(profiles=[profile()])=>({...auditRules,supports:()=>false,admissionProfiles:a.defineAdmissionProfiles(profiles)});

test('production and absent/disabled profile admission remain closed',()=>{
 assert.deepEqual(a.noAdmissionProfiles,[]);assert.ok(Object.isFrozen(a.noAdmissionProfiles));
 for(const r of [premiereRules,{...auditRules,supports:()=>false},rules([profile({enabled:false})])]){
  for(const d of decks)assert.equal(a.admitsDeck(r,d,60),false);
  assert.throws(()=>runtime.createMatch('admission-closed',60,decks,r),/Unimplemented card behavior/);
 }
});
test('exact pair accepts permutation without enabling card-level or arbitrary copy admission',()=>{
 const r=rules(),reversed=decks.map(d=>({...d,cards:[...d.cards].reverse()}));
 assert.ok(decks.every(d=>d.cards.every(bp=>r.supports(bp)===false)));
 const m=runtime.createMatch('admission-exact',60,reversed,r);assert.equal(m.data.nativeAdmission.profileId,'intro-pair-test');runtime.project(clone(m),r,'light',0);
 const bad=clone(decks);bad[0].cards[0]=bad[0].cards.find(bp=>bp!==bad[0].cards[0]);
 assert.throws(()=>runtime.createMatch('admission-copies',60,bad,r),/Unimplemented/);
 assert.throws(()=>runtime.createMatch('admission-forty',40,starterDecks(40),r),/Unimplemented/);
 assert.throws(()=>runtime.createMatch('admission-sealed',60,decks,r,'otsd'),/Unimplemented/);
 assert.throws(()=>runtime.createMatch('admission-seats',60,[decks[0],decks[0]],r),/Invalid admission/);
});
test('profile configuration is copied and deeply frozen with strict version/counts',()=>{
 const p=profile(),list=a.defineAdmissionProfiles([p]);p.decks.light[decks.find(d=>d.side==='light').cards[0]]=99;p.enabled=false;
 assert.equal(list[0].enabled,true);assert.ok(Object.isFrozen(list[0].decks.light));assert.ok(Object.isFrozen(list[0]));
 assert.throws(()=>a.defineAdmissionProfiles([profile(),profile()]),/Invalid/);
 assert.throws(()=>a.defineAdmissionProfiles([profile({deckSize:40})]),/Invalid/);
 assert.throws(()=>a.defineAdmissionProfiles([profile({decks:{dark:counts.dark,light:{'1_28':59}}})]),/Invalid/);
 assert.throws(()=>a.admissionCandidates(rules([profile({rulesVersion:'different-rules'})]),decks[0],60),/configuration/);
});
test('pair eligibility cannot mix the independently eligible halves of separate profiles',()=>{
 const alternate=clone(decks);for(const d of alternate)d.cards[0]=d.cards.find(bp=>bp!==d.cards[0]);
 const altCounts=Object.fromEntries(alternate.map(d=>[d.side,a.deckCounts(d.cards)]));const r=rules([profile(),profile({id:'alternate-pair',decks:altCounts})]);
 assert.ok(a.admitsDeck(r,decks[0],60));assert.ok(a.admitsDeck(r,alternate[1],60));
 assert.throws(()=>a.pairAdmission(r,[decks[0],alternate[1]],60),/no verified exact-pair/);
});
test('recovery binds original physical decks, profile, evidence and rules version',()=>{
 const r=rules(),m=runtime.createMatch('admission-recover',60,decks,r);a.assertMatchAdmission(clone(m),r);
 for(const edit of [v=>delete v.data.nativeAdmission,v=>v.data.nativeAdmission.evidenceVersion='forged',v=>v.data.nativeAdmission.rulesVersion='forged',v=>v.data.nativeAdmission.profileId='forged',v=>v.data.nativeAdmission.extra=true,v=>v.cards['light-1'].blueprint='1_28',v=>v.data.nativeAdmission.decks.light['1_28']++]){
  const bad=clone(m);edit(bad);assert.throws(()=>a.assertMatchAdmission(bad,r));
 }
 assert.throws(()=>a.assertMatchAdmission(m,rules([profile({evidenceVersion:'test-only-2'})])),/original admission/);
 assert.throws(()=>a.assertMatchAdmission(m,rules([profile({enabled:false})])),/original admission/);
 const stolen=clone(m);stolen.cards['light-1'].originalOwner='light';stolen.cards['light-1'].owner='dark';a.assertMatchAdmission(stolen,r);
});
test('waiting snapshot binds exact owner deck and rejects forged or duplicated candidates',()=>{
 const r=rules(),d=decks[0],c=a.admissionCandidates(r,d,60);a.assertAdmissionCandidates(r,c,d,60);
 assert.throws(()=>a.assertAdmissionCandidates(r,[],d,60));assert.throws(()=>a.assertAdmissionCandidates(r,[...c,...c],d,60));
 const changed=clone(d);changed.cards[0]=changed.cards.find(bp=>bp!==changed.cards[0]);assert.throws(()=>a.assertAdmissionCandidates(r,c,changed,60));
});
test('fully supported rules retain existing unprofiled open40/60 and sealed behavior',()=>{
 for(const size of [40,60])for(const format of ['open','otsd']){
  const m=runtime.createMatch('admission-general',size,starterDecks(size),auditRules,format);assert.equal(m.data.nativeAdmission,undefined);runtime.project(m,auditRules,'dark',0);
 }
});
