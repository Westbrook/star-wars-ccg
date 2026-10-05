import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,step,prompt,runtime,rules} from './starter-timing-reachability-barrier-fixture.mjs';
import {seek} from './noble-fixture.mjs';
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const definitions=load(new URL('../../lib/native-engine/definitions.ts',import.meta.url));
const receipts=JSON.parse(fs.readFileSync(new URL('./gemp/starter-timing-reachability-barrier-results.json',import.meta.url)));
for(const extra of [false,true])test('played Barrier then Friendly Fire: '+(extra?'two active plus barred':'one active plus barred'),()=>{
 const f=fixture(extra);let m=JSON.parse(JSON.stringify(f.m));
 const receipt=receipts.find(r=>r.case===(extra?'two-active-plus-barred':'one-active-plus-barred'));
 assert.ok(receipt.actualBattleInitiatedResponse);
 assert.equal(m.cards[f.barrier].zone,'used');
 assert.equal(m.stack.at(-2)?.action.handler,'battle:begin');
 const participants=combat.members(m,'dark').filter(id=>definitions.cardDefinition(m,id).type==='Character');
 assert.equal(participants.length,receipt.darkParticipantsBeforeAccident);
 assert.ok(!participants.includes(f.storm));
 const offered=prompt(m).choices.some(c=>c.id==='accident:play:'+f.accident);
 assert.equal(offered,receipt.friendlyFireOffered);
 let barredSelectable=false,activeSelectable=false;
 if(offered){
  m=step(m,'accident:play:'+f.accident);
  m=seek(m,x=>x.stack.at(-1)?.handler==='accident:select');
  const choices=prompt(m).choices.map(c=>c.id);
  barredSelectable=choices.includes('accident-lose:'+f.storm);
  activeSelectable=choices.includes('accident-lose:'+f.second);
  assert.deepEqual(new Set(choices),new Set([f.raider,f.second].map(id=>'accident-lose:'+id)));
  // The pending casualty survives a save/reload with both players' views intact.
  const saved=JSON.parse(JSON.stringify(m));
  for(const side of ['light','dark'])assert.deepEqual(runtime.project(saved,rules,side),runtime.project(m,rules,side));
  m=step(saved,'accident-lose:'+f.second);
  m=seek(m,x=>x.cards[f.accident].zone==='lost');
  assert.equal(m.cards[f.second].zone,'lost');
 }
 assert.equal(barredSelectable,receipt.barredSelectable);
 assert.equal(activeSelectable,receipt.activeSelectable);
 assert.equal(m.cards[f.storm].zone==='table'&&m.cards[f.storm].location===f.site,receipt.barredStillAtSite);
 assert.equal(m.cards[f.accident].zone==='lost',receipt.interruptLost);
});

test('Barrier conformance receipt binds executed inputs and keeps full admission closed',()=>{
 const review=JSON.parse(fs.readFileSync(new URL('./gemp/starter-timing-reachability-barrier-review.json',import.meta.url)));
 assert.equal(review.status,'verified-no-divergence');assert.equal(review.productionAdmission,'closed');
 assert.equal(review.productionVerification.verifiedFiles,6820);assert.equal(review.productionVerification.allUnchanged,true);
 assert.equal(review.execution.junitTests,1);assert.equal(review.execution.failures,0);assert.equal(review.execution.errors,0);assert.equal(receipts.length,2);
 for(const [path,expected] of Object.entries(review.fingerprints))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url))).digest('hex'),expected,path);
});
