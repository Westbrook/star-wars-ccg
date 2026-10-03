import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Controlled table components, not deck/shield admission or shield setup.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture({force=3,lost=3,shield=true,side='light'}={}){
 let m=runtime.createMatch('secret-plans',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['13_86']:[]),...d.main].slice(0,60)})),rules);
 const card=Object.values(m.cards).find(c=>c.blueprint==='13_86').id;
 if(shield)state.moveCard(m,card,'table');
 const source=m.players[side].reserve.at(-1);state.moveCard(m,source,'hand');
 for(let n=0;n<force;n++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 for(let n=0;n<lost;n++)state.moveCard(m,m.players[side].reserve.at(-1),'lost');
 m=runtime.startTurns(m,rules);
 return {m,card,source,side};
}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,id){const before=clone(m),p=prompt(m);m=runtime.applyCommand(clone(m),rules,p.side,{revision:m.revision,choice:id},()=>0);state.assertState(m);rules.validate(m);for(const s of ['light','dark'])assert.deepEqual(runtime.project(m,rules,s),runtime.project(clone(m),rules,s));assert.notEqual(m,before);return m}
function seek(m,predicate,choose='plans:pay') {for(let n=0;n<300;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p);const ids=p.choices.map(c=>c.id);m=step(m,ids.includes('pass')?'pass':ids.includes(choose)?choose:ids[0]);}throw Error('No boundary');}
const finished=m=>!m.stack.some(f=>f.kind==='resolution'?f.action.handler.startsWith('retrieval:')||f.action.handler.startsWith('plans:'):f.kind==='decision'?f.handler.startsWith('retrieval:')||f.handler.startsWith('plans:'):f.event?.kind?.startsWith('retrieval')||f.event?.kind==='force-retrieved'||f.event?.kind==='about-to-retrieve');
const choice=m=>m.stack.at(-1)?.handler==='plans:choose';
function run(options,amount,choose='plans:pay') {let f=fixture(options);const before=clone(f.m.players[f.side]);retrieval.retrieve(f.m,f.side,f.source,amount);f.m=seek(f.m,finished,choose);return {...f,before};}
for(const [label,options,amount,select,spent,retrieved] of [
 ['full payment',{force:3,lost:3},3,'plans:pay',3,3],
 ['full amount despite small Lost Pile',{force:3,lost:1},3,'plans:pay',3,1],
 ['unaffordable full amount',{force:2,lost:1},3,'plans:pay',0,0],
 ['decline',{force:3,lost:3},2,'plans:cancel',0,0],
 ['empty Lost Pile',{force:3,lost:0},3,'plans:pay',0,0],
 ['zero retrieval',{force:3,lost:3},0,'plans:pay',0,0],
 ['shield absent',{force:3,lost:3,shield:false},2,'plans:pay',0,2],
 ['owners own retrieval',{force:3,lost:3,side:'dark'},2,'plans:pay',0,2],
])test('Secret Plans: '+label,()=>{const {m,before,side}=run(options,amount,select);assert.equal(before.force.length-m.players[side].force.length,spent);assert.equal(before.lost.length-m.players[side].lost.length,retrieved);assert.deepEqual(m.players[side].used.slice(0,retrieved+spent),[...before.lost.slice(0,retrieved).reverse(),...before.force.slice(0,spent).reverse()]);});

test('only retrieving player sees the payment decision; no hidden pile identities leak',()=>{let {m,source}=fixture();retrieval.retrieve(m,'light',source,2);m=seek(m,choice);assert.deepEqual(prompt(m).choices.map(c=>c.id),['plans:pay','plans:cancel']);assert.deepEqual(runtime.prompt(m,rules,'dark').choices,[]);assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision,choice:'plans:cancel'},()=>0));for(const side of ['dark','light']){const view=JSON.stringify(runtime.project(m,rules,side));for(const id of m.players.light.force)assert.ok(!view.includes('"'+id+'"'));}});

test('initiated mandatory trigger still resolves after Secret Plans leaves table',()=>{let {m,source,card}=fixture();retrieval.retrieve(m,'light',source,2);m=seek(m,x=>x.stack.some(f=>f.kind==='resolution'&&f.action.handler==='plans:check'));state.moveCard(m,card,'lost');m=seek(m,choice);m=seek(step(m,'plans:pay'),finished);assert.equal(m.players.light.force.length,1);assert.equal(m.players.light.lost.length,1);});

test('specific retrieval pays once, even across multiple target choices',()=>{let {m,source}=fixture();const before=clone(m.players.light);retrieval.retrieve(m,'light',source,2,[...new Set(before.lost.map(id=>m.cards[id].blueprint))]);m=seek(m,finished);assert.equal(m.players.light.force.length,1);assert.equal(m.players.light.lost.length,1);});

test('nested retrieval by the same source has distinct identity; cancellation targets only the nested action',()=>{let {m,source}=fixture({force:4,lost:3});retrieval.retrieve(m,'light',source,2);m=seek(m,choice);const outer=m.stack.at(-1).payload.retrieval;retrieval.retrieve(m,'light',source,1);m=seek(m,x=>choice(x)&&x.stack.at(-1).payload.retrieval!==outer);const inner=m.stack.at(-1).payload.retrieval;assert.notEqual(inner,outer);m=step(m,'plans:cancel');assert.equal(retrieval.pendingRetrieval(m,inner).cancelled,true);assert.equal(retrieval.pendingRetrieval(m,outer).cancelled,false);m=seek(m,x=>choice(x)&&x.stack.at(-1).payload.retrieval===outer);m=seek(step(m,'plans:pay'),finished);assert.equal(m.players.light.force.length,2);assert.equal(m.players.light.lost.length,1);});

test('canceling the exact parent during a nested retrieval leaves nested cards retrievable',()=>{let {m,source,card}=fixture({shield:false});retrieval.retrieve(m,'light',source,2);const outer=m.stack.at(-2).action.payload.id;retrieval.retrieve(m,'light',source,1);const inner=m.stack.at(-2).action.payload.id;assert.equal(retrieval.cancelRetrieval(m,outer,card),true);assert.equal(retrieval.cancelRetrieval(m,outer,card),false);assert.equal(retrieval.pendingRetrieval(m,inner).cancelled,false);m=seek(m,finished);assert.equal(m.players.light.lost.length,2);assert.equal(retrieval.cancelRetrieval(m,outer,card),false);});

test('cancellation after one retrieved card preserves it and stops the remainder',()=>{let {m,source,card}=fixture({shield:false});retrieval.retrieve(m,'light',source,3);const id=m.stack.at(-2).action.payload.id;m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-retrieved');assert.equal(retrieval.cancelRetrieval(m,id,card),true);m=seek(m,finished);assert.equal(m.players.light.lost.length,2);assert.equal(m.players.light.used.length,1);});

test('saved-state validator rejects forged retrieval identity and Secret Plans payment',()=>{let {m,source}=fixture();retrieval.retrieve(m,'light',source,2);m=seek(m,choice);for(const field of ['amount','retrieval','card']){const bad=clone(m);bad.stack.at(-1).payload[field]=field==='amount'?1:'invalid';assert.throws(()=>rules.validate(bad),/Secret Plans/);}const bad=clone(m),frame=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler.startsWith('retrieval:'));bad.stack.unshift(clone(frame));assert.throws(()=>retrieval.assertRetrieval(bad),/pending retrieval/);delete frame.action.payload.id;assert.throws(()=>retrieval.assertRetrieval(bad),/pending retrieval/);});

test('canceling Reinforcements retrieval still disposes the Interrupt and preserves its initial cost/destiny',()=>{
 let {m}=fixture({force:3,lost:0});
 const pull=(side,bp,zone)=>{const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);return c.id};
 const interrupt=pull('light','1_106','hand'),trooper=pull('light','1_28','lost'),site=pull('dark','1_284','table'),storm=pull('dark','1_194','table');m.locations.push(site);m.cards[storm].location=site;
 const destiny=pull('light','1_115','hand');state.moveCard(m,destiny,'reserve');
 m=seek(m,x=>prompt(x).choices.some(c=>c.id==='reinforce:'+interrupt));m=step(m,'reinforce:'+interrupt);
 m=seek(m,x=>x.cards[interrupt].zone==='lost'); // No full five-Force payment available: automatic cancellation.
 assert.equal(m.cards[interrupt].zone,'lost');assert.equal(m.cards[trooper].zone,'lost');assert.equal(m.cards[destiny].zone,'used');assert.equal(m.players.light.force.length,2);
});

test('Secret Plans payment uses response windows for each Force unit and never repeats after reload',()=>{
 const observed={...rules,automatic:(m,w)=>[...rules.automatic(m,w),...(['before-force-use','force-used'].includes(w.event?.kind)?[{id:'observe:'+w.serial,label:'Observe payment',handler:'observe',payload:w.event,actor:'light'}]:[])],
 initiate:(m,r,c)=>{if(r.action.handler!=='observe')rules.initiate(m,r,c)},
 resolve:(m,r,c)=>{if(r.action.handler==='observe')(m.data.trace??=[]).push({kind:r.action.payload.kind,remaining:r.action.payload.remaining??null,force:m.players.light.force.length});else rules.resolve(m,r,c)}};
 let {m,source}=fixture();retrieval.retrieve(m,'light',source,3);
 for(let n=0;n<300&&!finished(m);n++){const p=runtime.prompt(m,observed,'dark'),owned=runtime.prompt(m,observed,p.side),ids=owned.choices.map(c=>c.id);m=runtime.applyCommand(clone(m),observed,p.side,{revision:m.revision,choice:ids.includes('pass')?'pass':ids.includes('plans:pay')?'plans:pay':ids[0]},()=>0);}
 assert.ok(finished(m));assert.deepEqual(m.data.trace,[{kind:'before-force-use',remaining:null,force:3},{kind:'force-used',remaining:2,force:2},{kind:'force-used',remaining:1,force:1},{kind:'force-used',remaining:0,force:0}]);assert.equal(m.players.light.lost.length,0);
});

test('if selected retrieval card leaves Lost during tax choice, the paid retrieval selects the current next card',()=>{
 let {m,source}=fixture({force:3,lost:3});const original=[...m.players.light.lost];retrieval.retrieve(m,'light',source,2);m=seek(m,choice);state.moveCard(m,original[0],'hand');m=seek(step(m,'plans:pay'),finished);assert.equal(m.players.light.force.length,1);assert.equal(m.cards[original[0]].zone,'hand');assert.deepEqual(m.players.light.used.slice(0,2),original.slice(1).reverse());
});

for(const ref of JSON.parse(fs.readFileSync(new URL('./gemp/secret-plans-results.json',import.meta.url))))test('fresh GEMP outcome and Used order: '+ref.name,()=>{
 let {m,source,card}=fixture({force:ref.force,lost:ref.lost});const before=clone(m.players.light);retrieval.retrieve(m,'light',source,ref.amount);let decisions=0;
 for(let n=0;n<300&&!finished(m);n++){if(choice(m)){decisions++;if(ref.name==='depart')state.moveCard(m,card,'hand');m=step(m,ref.name==='decline'?'plans:cancel':'plans:pay');}else {const p=prompt(m),ids=p.choices.map(c=>c.id);m=step(m,ids.includes('pass')?'pass':ids[0]);}}
 assert.ok(finished(m));assert.equal(decisions,ref.decisions);assert.equal(before.force.length-m.players.light.force.length,ref.spent);assert.equal(before.lost.length-m.players.light.lost.length,ref.retrieved);assert.deepEqual(m.players.light.used.map(id=>before.force.includes(id)?'force-'+before.force.indexOf(id):'lost-'+before.lost.indexOf(id)),ref.usedOrder);
});

 test('duplicate or reordered Secret Plans continuations cannot pay twice after reload',()=>{let {m,source}=fixture();retrieval.retrieve(m,'light',source,2);m=seek(m,choice);const duplicate=clone(m);duplicate.stack.push(clone(duplicate.stack.at(-1)));assert.throws(()=>rules.validate(duplicate),/Secret Plans/);const reordered=clone(m);reordered.stack.unshift(reordered.stack.pop());assert.throws(()=>rules.validate(reordered),/Secret Plans/);});
