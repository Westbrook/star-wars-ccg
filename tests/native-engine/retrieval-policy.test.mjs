import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const policy=load(new URL('../../lib/native-engine/retrieval-policy.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x));
// Fixture grants retrieval directly; no source card or full deck admission.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
function fixture({source='1_99',provider,shield=false,force=8,lost=8}={}) {
 let m=runtime.createMatch('retrieval-policy',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_99','1_101','5_59']:['13_86','8_108','8_114']),...d.main].slice(0,60)})),rules);
 const pull=(bp,zone)=>{const c=Object.values(m.cards).find(c=>c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);return c.id};
 const card=pull(source,'hand'),plans=pull('13_86',shield?'table':'hand');
 const modifier=provider?pull(provider,'table'):plans;
 if(provider){const site=pull('1_284','table');m.locations.push(site);m.cards[modifier].location=site;}
 for(let i=0;i<force;i++)state.moveTop(m,'light','reserve','force');for(let i=0;i<lost;i++)state.moveTop(m,'light','reserve','lost');
 m=runtime.startTurns(m,rules);return {m,card,plans,modifier};
}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,choice){const before=clone(m);const r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice},()=>0);assert.deepEqual(m,before);for(const seat of ['light','dark'])assert.deepEqual(runtime.project(r,rules,seat),runtime.project(clone(r),rules,seat));return r}
const done=m=>!m.stack.some(f=>f.kind==='resolution'?f.action.handler.startsWith('retrieval:')||f.action.handler.startsWith('plans:'):f.kind==='decision'?f.handler.startsWith('retrieval:')||f.handler.startsWith('plans:'):['retrieval-initiated','retrieval-complete','force-retrieved','about-to-retrieve','retrieval-canceled'].includes(f.event?.kind));
function seek(m,pred,choose='plans:pay'){for(let n=0;n<500;n++){if(pred(m))return m;const ids=prompt(m).choices.map(c=>c.id);m=step(m,ids.includes('pass')?'pass':ids.includes(choose)?choose:ids[0]);}throw Error('Boundary missing');}
const window=m=>m.stack.at(-1)?.event;
function start(f,amount,options){retrieval.retrieve(f.m,'light',f.card,amount,null,'used',undefined,options);return f.m;}
const add=(f,kind,amount,options)=>policy.addRetrievalModifier(f.m,f.modifier,'light',kind,amount,options);
for(const [title,mods,expected] of [
 ['additions',[['add',2]],7],['reductions',[['add',-2]],3],['floor at zero',[['add',-9]],0],
 ['opposing modifiers',[['add',2],['add',-3]],4],['reset overrides additions',[['add',9],['reset',2]],2],
 ['lowest reset',[['reset',3],['reset',1]],1],['reset prevents retrieval',[['add',9],['reset',0]],0],
])test('retrieval quantity: '+title,()=>{const f=fixture();mods.forEach(([kind,amount],i)=>add(f,kind,amount,{function:'fixture-'+i}));const m=seek(start(f,5),done);assert.equal(m.players.light.lost.length,8-expected);});

test('quantity is finalized after initiation responses and before Secret Plans payment',()=>{const f=fixture({shield:true});let m=start(f,5);assert.equal(window(m).kind,'retrieval-initiated');policy.addRetrievalModifier(m,f.modifier,'light','add',-3);m=seek(m,x=>x.stack.at(-1)?.handler==='plans:choose');assert.match(prompt(m).choices[0].label,/Use 2 Force/);m=seek(step(m,'plans:pay'),done);assert.equal(m.players.light.force.length,6);assert.equal(m.players.light.lost.length,6);});

test('frozen amount does not change when a continuous source leaves during per-card responses',()=>{const f=fixture({provider:'8_114'});let m=start(f,5);m=seek(m,x=>window(x)?.kind==='force-retrieved');assert.equal(m.players.light.lost.length,7);state.moveCard(m,f.modifier,'lost');m=seek(m,done);assert.equal(m.players.light.lost.length,6);});

test('new modifier after first card affects only a subsequent retrieval',()=>{const f=fixture();let m=start(f,3);m=seek(m,x=>window(x)?.kind==='force-retrieved');policy.addRetrievalModifier(m,f.modifier,'light','add',-3);m=seek(m,done);assert.equal(m.players.light.lost.length,5);retrieval.retrieve(m,'light',f.card,3);m=seek(m,done);assert.equal(m.players.light.lost.length,5);});

for(const [provider,source,expected] of [['8_108','1_101',2],['8_108','5_59',2],['8_108','1_99',5],['8_114','1_99',2],['8_114','1_101',5]])test('actual table modifier '+provider+' for '+source,()=>{const f=fixture({provider,source});const m=seek(start(f,5),done);assert.equal(m.players.light.lost.length,8-expected);});

test('registered source instance cannot regain its effect by leaving and returning',()=>{const f=fixture({provider:'8_108',source:'1_99'});add(f,'add',-2,{duration:'source'});let m=start(f,5);state.moveCard(m,f.modifier,'hand');state.moveCard(m,f.modifier,'table');m.cards[f.modifier].location=m.locations[0];m=seek(m,done);assert.equal(m.players.light.lost.length,3);});

test('resolved turn modifier survives source departure but expires on the next turn',()=>{const f=fixture();add(f,'add',-2);state.moveCard(f.m,f.modifier,'lost');assert.equal(policy.retrievalAmount(f.m,'light',f.card,5),3);f.m.turn.number++;assert.equal(policy.retrievalAmount(f.m,'light',f.card,5),5);});

test('modifier selector applies only to its side and source blueprints',()=>{const f=fixture();add(f,'add',-2,{blueprints:['1_101']});assert.equal(policy.retrievalAmount(f.m,'light',f.card,5),5);add(f,'add',-4,{function:'other',blueprints:['1_99']});assert.equal(policy.retrievalAmount(f.m,'light',f.card,5),1);assert.equal(policy.retrievalAmount(f.m,'dark',f.card,5),5);});

test('duplicate noncumulative modifiers do not stack; cumulative registrations do',()=>{for(const cumulative of [false,true]){const f=fixture();add(f,'add',-2,{cumulative});add(f,'add',-2,{cumulative});assert.equal(policy.retrievalAmount(f.m,'light',f.card,5),cumulative?1:3);}});

test('Secret Plans immunity suppresses payment without making other retrievals immune',()=>{const f=fixture({shield:true});add(f,'secret-plans-immunity',1,{blueprints:['1_99']});let m=seek(start(f,3),done);assert.equal(m.players.light.force.length,8);assert.equal(m.players.light.lost.length,5);const other=Object.values(m.cards).find(c=>c.blueprint==='1_101');retrieval.retrieve(m,'light',other.id,1);m=seek(m,done);assert.equal(m.players.light.force.length,7);});

test('an initiated Secret Plans trigger is not erased by later immunity',()=>{const f=fixture({shield:true});let m=start(f,3);m=seek(m,x=>x.stack.at(-1)?.handler==='plans:choose');policy.addRetrievalModifier(m,f.modifier,'light','secret-plans-immunity',1);m=seek(step(m,'plans:pay'),done);assert.equal(m.players.light.force.length,5);});

for(const force of [0,8])test('uncancelable retrieval survives Secret Plans refusal/insufficient Force '+force,()=>{const f=fixture({shield:true,force});const m=seek(start(f,3,{uncancelable:true}),done,'plans:cancel');assert.equal(m.players.light.lost.length,5);assert.equal(m.players.light.force.length,force);});

test('prevented cancellation emits no false cancellation event and preserves retrieval',()=>{const f=fixture();let m=start(f,3,{uncancelable:true});const id=m.stack.at(-2).action.payload.id,before=clone(m);assert.equal(retrieval.cancelRetrieval(m,id,f.modifier),false);assert.deepEqual(m,before);m=seek(m,done);assert.equal(m.players.light.lost.length,5);});

test('invalid modifiers and inconsistent frozen amounts are rejected',()=>{const f=fixture();for(const [kind,value] of [['add',Infinity],['reset',-1],['secret-plans-immunity',2],['invalid',1]])assert.throws(()=>add(f,kind,value),/modifier/);add(f,'add',-2);const bad=clone(f.m);bad.data.retrievalModifiers[0].source.version=999;assert.throws(()=>rules.validate(bad),/reference/);let m=start(f,5);m=seek(m,x=>window(x)?.kind==='about-to-retrieve');const frame=m.stack.find(f=>f.kind==='resolution'&&f.action.handler.startsWith('retrieval:'));frame.action.payload.amount++;assert.throws(()=>rules.validate(m),/retrieval/);});

for(const ref of JSON.parse(fs.readFileSync(new URL('./gemp/retrieval-policy-results.json',import.meta.url))))test('fresh GEMP retrieval policy outcome: '+ref.name,()=>{
 const f=fixture({source:ref.source,shield:true,provider:ref.name.startsWith('fenson')?'8_108':ref.name.startsWith('tarl')?'8_114':undefined});
 if(ref.name==='add')add(f,'add',2);
 if(ref.name==='subtract')add(f,'add',-2);
 if(ref.name==='zero')add(f,'add',-9);
 if(ref.name==='reset'){add(f,'add',9);add(f,'reset',2);}
 if(ref.name==='minimum-reset'){add(f,'reset',3,{function:'reset1'});add(f,'reset',1,{function:'reset2'});}
 if(ref.name==='immune')add(f,'secret-plans-immunity',1,{blueprints:[ref.source]});
 const before=clone(f.m.players.light);let m=start(f,5,{uncancelable:ref.name==='uncancelable'}),decisions=0;
 for(let n=0;n<500&&!done(m);n++){if(m.stack.at(-1)?.handler==='plans:choose'){decisions++;m=step(m,ref.name==='uncancelable'?'plans:cancel':'plans:pay');}else {const ids=prompt(m).choices.map(c=>c.id);m=step(m,ids.includes('pass')?'pass':ids[0]);}}
 assert.ok(done(m));assert.equal(before.force.length-m.players.light.force.length,ref.spent);assert.equal(before.lost.length-m.players.light.lost.length,ref.retrieved);assert.equal(decisions,ref.decisions);assert.deepEqual(m.players.light.used.map(id=>before.force.includes(id)?'force-'+before.force.indexOf(id):'lost-'+before.lost.indexOf(id)),ref.usedOrder);
});
