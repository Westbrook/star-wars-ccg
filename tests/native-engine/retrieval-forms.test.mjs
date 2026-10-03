import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const policy=load(new URL('../../lib/native-engine/retrieval-policy.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)};
function step(m,id,entropy=()=>0){const before=clone(m),n=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},entropy);assert.deepEqual(m,before);for(const seat of ['light','dark'])assert.deepEqual(runtime.project(n,rules,seat),runtime.project(clone(n),rules,seat));return n}
function seek(m,predicate,choose=p=>p.choices.find(c=>c.id==='pass')?.id??p.choices[0].id,entropy=()=>0){for(let i=0;i<600;i++){if(predicate(m))return m;const p=prompt(m);assert.ok(p);m=step(m,choose(p,m),entropy)}throw Error('Boundary not reached')}
const done=m=>m.stack.length===1;
function fixture({plans=false,empty=false}={}){let m=runtime.createMatch('retrieval-forms',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_28','1_28','1_28','1_115','1_115']:['13_86']),...d.main].slice(0,60)})),rules);
 const pull=(side,bp,zone)=>{const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id);state.moveCard(m,id,zone);return id};
 const source=pull('light','1_106','hand'),shield=pull('dark','13_86',plans?'table':'hand');
 const cards=['1_28','1_115','1_28','1_115','1_28'].map(bp=>pull('light',bp,'hand'));if(!empty)for(const id of cards.toReversed())state.moveCard(m,id,'lost');
 for(let i=0;i<6;i++)state.moveCard(m,m.players.light.reserve.at(-1),'force');m=runtime.startTurns(m,rules);return{m,source,shield,cards};
}
function begin(f,amount=3,options={},specific=false,destination='used'){retrieval.retrieve(f.m,'light',f.source,amount,specific?['1_28']:null,destination,undefined,options);return f.m}
for(const amount of [1,2,4])test('up-to chooses '+amount+' before modifiers and Secret Plans without capping by matching cards',()=>{
 const f=fixture({plans:true});let m=seek(begin(f,4,{upTo:true},true),x=>x.stack.at(-1)?.handler==='retrieval:amount');
 assert.deepEqual(prompt(m).choices.map(c=>c.id),[1,2,3,4].map(n=>'retrieve-amount:'+n));assert.equal(runtime.project(m,rules,'dark').prompt.choices.length,0);
 m=step(m,'retrieve-amount:'+amount);m=seek(m,x=>x.stack.at(-1)?.handler==='plans:choose');assert.match(prompt(m).choices[0].label,new RegExp('Use '+amount+' Force'));m=step(m,'plans:pay');m=seek(m,done);assert.equal(m.players.light.force.length,6-amount);assert.equal(m.players.light.used.filter(id=>f.cards.includes(id)).length,Math.min(3,amount));
});
test('chosen amount is modified after selection, and remains frozen during per-card responses',()=>{
 const f=fixture();let m=seek(begin(f,4,{upTo:true}),x=>x.stack.at(-1)?.handler==='retrieval:amount');policy.addRetrievalModifier(m,f.shield,'light','add',-1);m=step(m,'retrieve-amount:3');m=seek(m,x=>event(x)?.kind==='force-retrieved');policy.addRetrievalModifier(m,f.source,'light','add',10,{function:'late'});m=seek(m,done);assert.equal(m.players.light.lost.length,3);
});
test('empty Lost still permits choosing X but produces no retrieval or Secret Plans demand',()=>{const f=fixture({plans:true,empty:true});let m=seek(begin(f,4,{upTo:true},true),x=>x.stack.at(-1)?.handler==='retrieval:amount');m=seek(step(m,'retrieve-amount:4'),done);assert.equal(m.players.light.force.length,6);assert.equal(m.players.light.used.length,0)});
test('zero modified amount finishes without card or destination choices',()=>{const f=fixture();policy.addRetrievalModifier(f.m,f.source,'light','add',-5);let m=seek(begin(f,4,{upTo:true,mayTakeIntoHand:true}),x=>x.stack.at(-1)?.handler==='retrieval:amount');m=seek(step(m,'retrieve-amount:2'),done);assert.deepEqual(m.players.light.lost,f.cards)});
for(const destinations of [['hand','used','hand'],['used','used','used'],['hand','hand','hand']])test('per-card destination decisions preserve remaining Lost order: '+destinations,()=>{
 const f=fixture({plans:true});let m=seek(begin(f,3,{mayTakeIntoHand:true}),x=>x.stack.at(-1)?.handler==='plans:choose');m=step(m,'plans:pay');
 for(const destination of destinations){m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');m=step(m,'retrieve-to:'+destination)}
 m=seek(m,done);assert.equal(m.players.light.force.length,3);assert.deepEqual(m.players.light.lost,f.cards.slice(3));for(let i=0;i<3;i++)assert.equal(m.cards[f.cards[i]].zone,destinations[i]);
});
test('fixed hand retrieval does not ask an unnecessary destination question',()=>{const f=fixture();const m=seek(begin(f,2,{mayTakeIntoHand:true},false,'hand'),done);assert.ok(f.cards.slice(0,2).every(id=>m.cards[id].zone==='hand'));assert.deepEqual(m.players.light.lost,f.cards.slice(2))});
test('specific-card selection precedes destination and does not alter unmatched Lost cards',()=>{const f=fixture();let m=seek(begin(f,2,{mayTakeIntoHand:true},true),x=>x.stack.at(-1)?.handler==='retrieval:select');m=step(m,'retrieve:'+f.cards[4]);m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');m=step(m,'retrieve-to:hand');m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:select');m=step(m,'retrieve:'+f.cards[2]);m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');m=seek(step(m,'retrieve-to:used'),done);assert.deepEqual(m.players.light.lost,f.cards.filter((_,i)=>![2,4].includes(i)))});
for(const mode of ['leave','return','new-top'])test('selected physical retrieval target during responses: '+mode,()=>{
 const f=fixture();let m=seek(begin(f,1,{mayTakeIntoHand:true}),x=>event(x)?.kind==='about-to-retrieve');
 if(mode!=='new-top'){state.moveCard(m,f.cards[0],'hand');if(mode==='return')state.moveCard(m,f.cards[0],'lost')}else{const id=m.players.light.reserve.at(-1);state.moveCard(m,id,'lost')}
 m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');assert.equal(m.stack.at(-1).payload.card,mode==='leave'?f.cards[1]:f.cards[0]);m=seek(step(m,'retrieve-to:used'),done);assert.equal(m.players.light.used[0],mode==='leave'?f.cards[1]:f.cards[0]);
});
test('random retrieval shuffles per card and persists the first result across response refresh',()=>{
 const f=fixture();let calls=0,entropy=()=>{calls++;return 0};let m=seek(begin(f,3,{random:true}),x=>event(x)?.kind==='about-to-retrieve',undefined,entropy);assert.equal(calls,4);const chosen=m.stack.at(-2).action.payload.card,order=[...m.players.light.lost];assert.equal(chosen,f.cards[1]);
 for(let i=0;i<3;i++){m=clone(m);prompt(m);assert.deepEqual(m.players.light.lost,order)}assert.equal(calls,4);
 m=seek(m,done,undefined,entropy);assert.equal(calls,4+3+2);assert.deepEqual(m.players.light.used,[f.cards[0],f.cards[3],f.cards[1]]);assert.deepEqual(m.players.light.lost,[f.cards[2],f.cards[4]]);
});
test('canceled random retrieval keeps the performed shuffle but never retrieves',()=>{const f=fixture({plans:true});let m=seek(begin(f,3,{random:true}),x=>x.stack.at(-1)?.handler==='plans:choose');const order=[...m.players.light.lost];assert.notDeepEqual(order,f.cards);m=seek(step(m,'plans:cancel'),done);assert.deepEqual(m.players.light.lost,order);assert.equal(m.players.light.used.length,0)});
test('entropy failure rolls back the command and does not leave a partial shuffle',()=>{const f=fixture();let m=begin(f,2,{random:true});m=step(m,'pass');const before=clone(m);assert.throws(()=>step(m,'pass',()=>NaN),/entropy/);assert.deepEqual(m,before)});
for(const phase of ['amount','destination'])test('foreign/stale/invalid '+phase+' commands are rejected without state changes',()=>{const f=fixture();const m=seek(begin(f,2,phase==='amount'?{upTo:true}:{mayTakeIntoHand:true}),x=>x.stack.at(-1)?.handler==='retrieval:'+phase),before=clone(m);const choice=prompt(m).choices[0].id;assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision,choice}));assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice}));assert.throws(()=>step(m,phase==='amount'?'retrieve-amount:0':'retrieve-to:reserve'));assert.deepEqual(m,before)});
test('concession freezes an unfinished destination choice',()=>{const f=fixture();let m=seek(begin(f,2,{mayTakeIntoHand:true}),x=>x.stack.at(-1)?.handler==='retrieval:destination');m=step(m,'concede');assert.equal(m.result.winner,'dark');assert.deepEqual(m.players.light.lost,f.cards)});
test('retrieval continuation rejects unknown handlers, wrong actors, missing cards and malformed modes',()=>{
 const f=fixture(),m=seek(begin(f,3,{mayTakeIntoHand:true}),x=>event(x)?.kind==='about-to-retrieve');
 for(const mutate of [r=>r.actor='dark',r=>r.action.handler='retrieval:invented',r=>delete r.action.payload.card,r=>r.action.payload.random='yes',r=>r.action.payload.chosen=2,r=>r.action.payload.placement='hand']){
  const bad=clone(m);mutate(bad.stack.at(-2));if(bad.stack.at(-2).action.payload.placement)bad.stack.at(-2).action.payload.mayTakeIntoHand=false;assert.throws(()=>prompt(bad));
 }
 assert.throws(()=>begin(f,2,{random:true},true),/Invalid retrieval/);
});

function observe(mode){
 const upTo=mode.startsWith('up-to')||mode==='empty',random=mode.startsWith('random'),hand=mode==='hand-mixed'||mode==='hand-used',identity=['leave','return','new-top'].includes(mode);
 const f=fixture({plans:upTo||hand||mode==='random-canceled',empty:mode==='empty'});
 if(mode==='up-to-modifier')policy.addRetrievalModifier(f.m,f.shield,'light','add',-1);
 let m=begin(f,upTo?4:identity?1:3,{upTo,random,mayTakeIntoHand:hand},upTo,mode==='hand-fixed'?'hand':'used');const seen=new Set(),order=[];let quantityChoices=0,paymentChoices=0,destinationChoices=0,initiated=0,about=0;
 for(let i=0;i<600&&!done(m);i++){
  const frame=m.stack.at(-1),e=event(m);
  if(e&&!seen.has(frame.serial)){
   seen.add(frame.serial);if(e.kind==='retrieval-initiated')initiated++;
   if(e.kind==='about-to-retrieve'){about++;if(identity){if(mode==='new-top')state.moveCard(m,m.players.light.reserve.at(-1),'lost');else{state.moveCard(m,f.cards[0],'hand');if(mode==='return')state.moveCard(m,f.cards[0],'lost')}}}
   if(e.kind==='force-retrieved')order.push(''+f.cards.indexOf(e.card));
  }
  const p=prompt(m);
  if(frame.handler==='retrieval:amount'){quantityChoices++;m=step(m,'retrieve-amount:'+(mode==='up-to-one'?1:mode==='up-to-modifier'?3:4))}
  else if(frame.handler==='plans:choose'){paymentChoices++;m=step(m,mode==='random-canceled'?'plans:cancel':'plans:pay')}
  else if(frame.handler==='retrieval:destination'){const toHand=mode==='hand-mixed'&&destinationChoices!==1;destinationChoices++;m=step(m,toHand?'retrieve-to:hand':'retrieve-to:used')}
  else m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id);
 }
 assert.ok(done(m));return {name:mode,quantityChoices,paymentChoices,destinationChoices,spent:6-m.players.light.force.length,initiated,about,retrieved:order.length,...(random?{remaining:m.players.light.lost.length}:{order,zones:f.cards.map(id=>m.cards[id].zone),lostOrder:m.players.light.lost.map(id=>f.cards.indexOf(id))})};
}
// The reference RNG is independent. Compare quantity/response invariants for
// random cases; ordered fixtures compare exact cards, destinations and order.
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/retrieval-forms-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP retrieval forms: '+row.name,()=>assert.deepEqual(observe(row.name),row));
test('retrieval forms provenance identifies the executed inputs',async()=>{const {createHash}=await import('node:crypto'),p=JSON.parse(fs.readFileSync(new URL('./gemp/retrieval-forms-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(oracle.length,p.observations)});

test('nested optional retrieval can take the selected parent card without repeating either payment',()=>{
 const f=fixture({plans:true});let m=seek(begin(f,3),x=>event(x)?.kind==='about-to-retrieve');retrieval.retrieve(m,'light',f.source,1,null,'hand',undefined,{upTo:true});
 m=seek(m,done);assert.equal(m.players.light.force.length,2);assert.equal(m.cards[f.cards[0]].zone,'hand');assert.deepEqual(m.players.light.lost,[f.cards[4]]);assert.ok(f.cards.slice(1,4).every(id=>m.cards[id].zone==='used'));
});
test('random retrieval also permits independent per-card hand destinations',()=>{const f=fixture();let m=begin(f,2,{random:true,mayTakeIntoHand:true});m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');const first=m.stack.at(-1).payload.card;m=step(m,'retrieve-to:hand');m=seek(m,x=>x.stack.at(-1)?.handler==='retrieval:destination');const second=m.stack.at(-1).payload.card;assert.notEqual(second,first);m=seek(step(m,'retrieve-to:used'),done);assert.equal(m.cards[first].zone,'hand');assert.equal(m.cards[second].zone,'used');assert.equal(m.players.light.lost.length,3)});
