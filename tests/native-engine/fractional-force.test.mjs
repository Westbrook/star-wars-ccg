import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const policy=load(new URL('../../lib/native-engine/retrieval-policy.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const loss=load(new URL('../../lib/native-engine/loss.ts',import.meta.url));
const {wholeForce}=load(new URL('../../lib/native-engine/force-quantity.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)};
function step(m,id){const before=clone(m),n=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const side of ['light','dark'])assert.deepEqual(runtime.project(n,rules,side),runtime.project(clone(n),rules,side));return n}
function settle(m,predicate=x=>x.stack.length===1){for(let i=0;i<400;i++){if(predicate(m))return m;const p=prompt(m);assert.ok(p);m=step(m,p.choices.find(c=>c.id==='pass')?.id??p.choices.find(c=>c.id==='lose:reserve')?.id??p.choices[0].id)}throw Error('Missing boundary')}
function fixture(plans=false){let m=runtime.createMatch('fractional-force',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?Array(5).fill('1_28'):['13_86']),...d.main].slice(0,60)})),rules);
 const pull=(side,bp,zone)=>{const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id);state.moveCard(m,id,zone);return id};
 const source=pull('light','1_106','hand'),shield=pull('dark','13_86',plans?'table':'hand'),cards=Array.from({length:4},()=>pull('light','1_28','hand'));for(const id of cards.toReversed())state.moveCard(m,id,'lost');for(let i=0;i<6;i++)state.moveCard(m,m.players.light.reserve.at(-1),'force');m=runtime.startTurns(m,rules);return {m,source,shield,cards};
}
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/fractional-force-results.json',import.meta.url)));
for(const row of oracle.filter(r=>['retrieve','loss','plans'].includes(r.kind)))test('official whole-Force '+row.kind+' '+row.amount+'; executed GEMP difference retained',()=>{
 const f=fixture(row.kind==='plans');let m=f.m,paymentChoices=0;const count=Math.round(row.amount);
 if(row.kind==='loss')ground.queueForceLoss(m,{side:'light',remaining:row.amount,source:f.source,site:null,reductionUsed:false});else retrieval.retrieve(m,'light',f.source,row.amount);
 m=settle(m,x=>x.stack.length===1||x.stack.at(-1)?.handler==='plans:choose');if(m.stack.at(-1)?.handler==='plans:choose'){paymentChoices++;m=settle(step(m,'plans:pay'));}
 const observed={retrieved:Math.max(0,4-m.players.light.lost.length),lost:Math.max(0,m.players.light.lost.length-4),spent:6-m.players.light.force.length,paymentChoices};
 assert.deepEqual(observed,{retrieved:row.kind==='loss'?0:count,lost:row.kind==='loss'?count:0,spent:row.kind==='plans'?count:0,paymentChoices:row.kind==='plans'&&count>0?1:0});
 const gempCount=Math.ceil(row.amount);assert.deepEqual({retrieved:row.retrieved,lost:row.lost,spent:row.spent,paymentChoices:row.paymentChoices},{retrieved:row.kind==='loss'?0:gempCount,lost:row.kind==='loss'?gempCount:0,spent:row.kind==='plans'?gempCount:0,paymentChoices:row.kind==='plans'?1:0});
 if(count===gempCount)assert.deepEqual(observed,{retrieved:row.retrieved,lost:row.lost,spent:row.spent,paymentChoices:row.paymentChoices});
});
test('retrieval modifiers combine before one final rounding, including resets and Secret Plans',()=>{
 const f=fixture(true);policy.addRetrievalModifier(f.m,f.source,'light','add',0.3);policy.addRetrievalModifier(f.m,f.shield,'light','add',0.3);retrieval.retrieve(f.m,'light',f.source,1.1);let m=settle(f.m,x=>x.stack.at(-1)?.handler==='plans:choose');assert.equal(m.stack.at(-1).payload.amount,2);m=settle(step(m,'plans:pay'));assert.equal(m.players.light.lost.length,2);assert.equal(m.players.light.force.length,4);
 const g=fixture();policy.addRetrievalModifier(g.m,g.source,'light','reset',1.49);policy.addRetrievalModifier(g.m,g.shield,'light','reset',1.5);assert.equal(policy.retrievalAmount(g.m,'light',g.source,10),1);
});
test('fractional retrieval amount freezes before first-card responses and survives refresh',()=>{
 const f=fixture();retrieval.retrieve(f.m,'light',f.source,1.49);let m=settle(f.m,x=>event(x)?.kind==='about-to-retrieve');assert.equal(m.stack.at(-2).action.payload.initial,1.49);assert.equal(m.stack.at(-2).action.payload.amount,1);policy.addRetrievalModifier(m,f.shield,'light','add',1);m=settle(m);assert.deepEqual(m.players.light.lost,f.cards.slice(1));assert.deepEqual(m.players.light.used,[f.cards[0]]);
});
test('fractional up-to upper bounds never offer an integer above the stated maximum',()=>{
 const f=fixture();retrieval.retrieve(f.m,'light',f.source,2.6,null,'used',undefined,{upTo:true});let m=settle(f.m,x=>x.stack.at(-1)?.handler==='retrieval:amount');assert.deepEqual(prompt(m).choices.map(c=>c.id),['retrieve-amount:1','retrieve-amount:2']);m=settle(step(m,'retrieve-amount:2'));assert.equal(m.players.light.lost.length,2);
});
test('specific, random and hand retrieval use the same rounded quantity',()=>{
 for(const mode of ['specific','random','hand']){const f=fixture();retrieval.retrieve(f.m,'light',f.source,1.49,mode==='specific'?['1_28']:null,mode==='hand'?'hand':'used',undefined,{random:mode==='random'});const m=settle(f.m);assert.equal(m.players.light.lost.length,3);assert.equal(f.cards.filter(id=>m.cards[id].zone===(mode==='hand'?'hand':'used')).length,1);}
});
test('fractional loss rounds after modifiers and never re-rounds the paid remainder',()=>{
 const {m}=fixture();const l=loss.lossLedger(2.1,'effect');l.increase=0.2;l.reduction=0.6;assert.equal(loss.lossTotal(m,'light',l),2);l.paid=1;assert.equal(loss.lossRemaining(m,'light',l),1);l.paid=2;assert.equal(loss.lossRemaining(m,'light',l),0);
 const b=loss.lossLedger(Math.PI,'battle');b.paid=0.5;loss.assertLedger(b);assert.equal(loss.lossRemaining(m,'light',b),Math.PI-0.5,'forfeit-value accounting is not a whole-card effect');
 m.data.doomed={turn:m.turn.number,sources:[]};const d=loss.lossLedger(2.1,'effect');assert.equal(loss.lossTotal(m,'light',d),2,'explicit round-up halving applies before generic whole-card rounding');
});
test('rounded-zero loss opens no payment decision and does not lose a last Life Force',()=>{
 const f=fixture();const keep=f.m.players.light.reserve[0];for(const pile of ['reserve','force','used'])for(const id of [...f.m.players.light[pile]])if(id!==keep)state.moveCard(f.m,id,'hand');ground.queueForceLoss(f.m,{side:'light',remaining:0.14159,source:f.source,site:null,reductionUsed:false});const m=settle(f.m);assert.equal(m.status,'playing');assert.equal(m.cards[keep].zone,'reserve');
});
test('invalid numeric amounts and saved fractional counts reject before mutation',()=>{
 for(const amount of [NaN,Infinity,-0.1,Number.MAX_VALUE,null,'2']){const f=fixture(),before=clone(f.m);assert.throws(()=>retrieval.retrieve(f.m,'light',f.source,amount));assert.deepEqual(f.m,before);assert.throws(()=>wholeForce(amount));}
 const f=fixture();retrieval.retrieve(f.m,'light',f.source,1.49);const m=settle(f.m,x=>event(x)?.kind==='about-to-retrieve');for(const mutate of [p=>p.remaining=0.5,p=>p.initial=null,p=>p.amount=1.49]){const bad=clone(m);mutate(bad.stack.at(-2).action.payload);assert.throws(()=>prompt(bad));}
 for(const amount of [NaN,Infinity,null,'1']){const g=fixture();assert.throws(()=>policy.addRetrievalModifier(g.m,g.source,'light','add',amount));}
});
test('fractional evidence fingerprints unchanged reference and keeps admission closed',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/fractional-force-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(premiereRules.supports('5_59'),false);
});
