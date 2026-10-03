import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const activation=load(new URL('../../lib/native-engine/activation.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const modifiers=load(new URL('../../lib/native-engine/combat-modifiers.ts',import.meta.url));
const stats=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 automatic:(m,w)=>[...premiereRules.automatic(m,w),...(w.event?.kind==='force-activated'?[{id:'probe:'+w.serial,label:'Observe activation',handler:'probe:activation',payload:w.event,actor:w.event.side}]:[])],
 resolve:(m,r,c)=>{if(r.action.handler==='probe:activation')(m.data.trace??=[]).push(r.action.payload.card.id);else premiereRules.resolve(m,r,c)}};
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
function prompt(m,r=rules){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,id,r=rules,side=prompt(m,r).side){const before=clone(m),n=runtime.applyCommand(clone(m),r,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const s of ['light','dark'])assert.deepEqual(runtime.project(n,r,s),runtime.project(clone(n),r,s));return n}
function seek(m,predicate,r=rules){for(let i=0;i<700;i++){if(predicate(m))return m;const p=prompt(m,r);assert.ok(p);m=step(m,p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.mandatory?p.choices[0].id:p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id,r)}throw Error('Missing boundary')}
function pull(m,side,bp,zone='table',site){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,bp);state.moveCard(m,id,zone);if(site)m.cards[id].location=site;return id}
function fixture(r=rules){let m=runtime.createMatch('activation-battle',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_72','2_14','1_37']:[]),...d.main].slice(0,60)})),r);const site=pull(m,'light','1_129'),remote=pull(m,'dark','1_284');m.locations.push(site,remote);const source=pull(m,'light','1_72','hand');m=runtime.startTurns(m,r);return {m,site,remote,source}}
function phase(m,name='battle'){return seek(m,x=>x.turn.phase===name&&x.stack.length===1)}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function begin(f,amount){runtime.activateForce(f.m,'light',f.source,amount);runtime.openWindow(f.m,'response','dark');return f.m}
const finished=m=>m.stack.length===1;
for(const amount of [0,0.14159,0.49,0.5,1.49,1.5,2.6])test('card-effect activation rounds once and preserves per-card order: '+amount,()=>{
 const f=fixture(),reserve=[...f.m.players.light.reserve],count=Math.round(amount);const m=seek(begin(f,amount),finished);
 assert.deepEqual(m.data.trace??[],reserve.slice(0,count));assert.deepEqual(m.players.light.force,reserve.slice(0,count).reverse());assert.equal(activation.activatedThisPhase(m,'light'),count);assert.equal(m.turn.activated,0);
});
for(const amount of [0.14159,0.5,1.49,1.5,2.6])test('ordinary generation is an up-to bound: '+amount,()=>{
 const r={...rules,generation:()=>amount};let {m}=fixture(r);m=seek(m,x=>x.turn.phase==='activate'&&x.stack.length===1&&x.stack[0].timing==='phase',r);assert.equal(m.turn.generation,amount);
 for(let i=0;i<Math.floor(amount);i++){m=seek(m,x=>prompt(x,r).choices.some(c=>c.id==='core:activate'),r);m=step(m,'core:activate',r);m=seek(m,x=>x.stack.length===1,r)}
 assert.equal(m.turn.activated,oracle.find(row=>row.kind==='generation'&&row.amount===amount).limit);assert.ok(!prompt(m,r).choices.some(c=>c.id==='core:activate'));
});
for(const mode of ['blocked','mid-block','source-leaves','changed-top','short'])test('activation checks the live state after every card: '+mode,()=>{
 const f=fixture();if(mode==='short')for(const id of f.m.players.light.reserve.slice(1))state.moveCard(f.m,id,'used');const reserve=[...f.m.players.light.reserve];if(mode==='blocked')activation.preventActivation(f.m,f.source,'light');let m=begin(f,3);
 if(!['blocked','short'].includes(mode)){m=seek(m,x=>event(x)?.kind==='force-activated');assert.equal(m.players.light.force.length,1);if(mode==='mid-block')activation.preventActivation(m,f.source,'light');if(mode==='source-leaves')state.moveCard(m,f.source,'lost');if(mode==='changed-top')state.moveCard(m,reserve.at(-1),'reserve');}
 m=seek(m,finished);const expected=['blocked'].includes(mode)?[]:['short','mid-block'].includes(mode)?reserve.slice(0,1):mode==='changed-top'?[reserve[0],reserve.at(-1),reserve[1]]:reserve.slice(0,3);assert.deepEqual(m.data.trace??[],expected);assert.equal(m.turn.activated,0);
});
test('a prohibition stops ordinary activation before costs and after initiation responses',()=>{
 let {m,source}=fixture();m=seek(m,x=>x.stack.length===1&&x.stack[0].timing==='phase');activation.preventActivation(m,source,'dark');assert.ok(!prompt(m).choices.some(c=>c.id==='core:activate'));
 const f=fixture();m=seek(f.m,x=>x.stack.length===1&&x.stack[0].timing==='phase');m=step(m,'core:activate');activation.preventActivation(m,f.source,'dark');m=seek(m,finished);assert.equal(m.turn.activated,0);assert.equal(m.players.dark.force.length,0);
});
for(const duration of ['turn','source'])test('activation restriction lifetime: '+duration,()=>{
 const {m,site}=fixture(),provider=pull(m,'light','101_2','table',site);activation.preventActivation(m,provider,'light',duration);assert.equal(activation.mayActivate(m,'light'),false);assert.equal(activation.mayActivate(m,'dark'),true);
 state.moveCard(m,provider,'hand');assert.equal(activation.mayActivate(m,'light'),duration==='source');state.moveCard(m,provider,'table');assert.equal(activation.mayActivate(m,'light'),duration==='source');m.turn.number++;assert.equal(activation.mayActivate(m,'light'),true);
});
test('mid-batch concession freezes activated units and pending remainder',()=>{
 const f=fixture();let m=seek(begin(f,2.6),x=>event(x)?.kind==='force-activated');const before=clone(m);m=step(m,'concede',rules,'light');assert.equal(m.result.winner,'dark');assert.deepEqual(m.players,before.players);assert.deepEqual(m.stack,before.stack);
});
test('activation batch state rejects corrupt counts, source, actor and identity before mutations',()=>{
 const f=fixture(),m=seek(begin(f,2.6),x=>event(x)?.kind==='force-activated');
 for(const change of [f=>f.actor='dark',f=>f.action.payload.remaining=0.5,f=>f.action.payload.count=4,f=>f.action.payload.requested=NaN,f=>f.action.payload.source.id='missing',f=>f.action.id='invented',f=>f.action.payload.id='activation-999999',f=>f.action.payload.remaining=4]){const bad=clone(m);change(bad.stack.find(f=>f.action?.handler==='core:activate-batch'));assert.throws(()=>prompt(bad));}
 for(const n of [NaN,Infinity,-1,null,'3']){const g=fixture(),before=clone(g.m);assert.throws(()=>runtime.activateForce(g.m,'light',g.source,n));assert.deepEqual(g.m,before);}
 for(const change of [x=>x.duration='forever',x=>x.turn=0,x=>x.side='both',x=>x.source.version++]){const g=fixture();activation.preventActivation(g.m,g.source,'light');change(g.m.data.activationRestrictions[0]);assert.throws(()=>prompt(g.m));}
});
test('activation projections conceal cards, batch quantities and restriction registry',()=>{
 const f=fixture();let m=seek(begin(f,2.6),x=>event(x)?.kind==='force-activated');const moved=m.players.light.force[0];for(const side of ['light','dark']){const text=JSON.stringify(runtime.project(m,rules,side));assert.ok(!text.includes('"'+moved+'"'));assert.ok(!text.includes('activationRestrictions'));assert.ok(!text.includes('requested'));}
});
function battleFixture(damage,fv){const f=fixture();const luke=pull(f.m,'light','101_2','table',f.site),vader=pull(f.m,'dark','101_5','table',f.site);state.moveTop(f.m,'dark','reserve','force');modifiers.addCombatModifier(f.m,f.site,vader,'power-add',damage-2);if(fv)stats.addStatModifier(f.m,f.site,luke,'forfeit','reset',fv);let m=phase(f.m);m=step(priority(m,'dark'),'battle:'+f.site);m=seek(m,x=>event(x)?.kind==='battle-damage');return {...f,m,luke,vader}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.00001,`${a} != ${b}`);
function battleOutcome(damage,fv){let {m,luke}=battleFixture(damage,fv);near(combat.battleDamage(m,'light'),damage);const remainder=[];let cardsLost=0,forfeited=false;
 for(let i=0;i<350&&combat.battle(m).stage!=='complete';i++){
  const p=prompt(m);if(event(m)?.kind==='battle-damage'&&p.side==='light'&&combat.battleDamage(m,'light')>0){assert.ok(!p.choices.some(c=>c.id==='pass'));remainder.push(combat.battleDamage(m,'light'));if(fv&&!forfeited){m=step(m,'forfeit:'+luke);forfeited=true;}else{cardsLost++;m=step(m,'battle-lose:reserve');}}else m=step(m,p.mandatory?p.choices[0].id:'pass');
 }
 assert.equal(combat.battle(m).stage,'complete');return {cardsLost,remainder,characterLost:m.cards[luke].zone==='lost'};
}
for(const damage of [0.14159,0.49,0.5,1.49,1.5,3.14])for(const forfeit of [false,true])test('battle loss retains exact fractional remainder '+damage+' / forfeit '+forfeit,()=>{
 const fv=forfeit?(damage<1?0.1:damage<2?0.5:3):0,result=battleOutcome(damage,fv);assert.equal(result.cardsLost,Math.ceil(damage-fv));assert.equal(result.characterLost,forfeit);
 const row=JSON.parse(fs.readFileSync(new URL('./gemp/activation-battle-results.json',import.meta.url))).find(r=>r.kind==='battle'&&r.damage===damage&&r.characterLost===forfeit);assert.equal(result.cardsLost,row.cardsLost);assert.equal(result.remainder.length,row.remainder.length);result.remainder.forEach((n,i)=>near(n,row.remainder[i]));
});
test('fractional attrition cannot be satisfied by rounding or losing Force',()=>{
 let {m,luke,vader}=battleFixture(1.49,0.5);const b=combat.battle(m);b.attrition.light=0.14159;b.initialAttrition.light=0.14159;m=priority(m,'light');m=step(m,'battle-lose:reserve');m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');m=step(m,'battle-lose:reserve');m=seek(m,x=>event(x)?.kind==='battle-damage');m=priority(m,'light');assert.equal(combat.battleDamage(m,'light'),0);assert.equal(combat.battle(m).attrition.light,0.14159);assert.ok(!prompt(m).choices.some(c=>c.id==='pass'));m=step(m,'forfeit:'+luke);m=seek(m,x=>combat.battle(x).stage==='complete');assert.equal(combat.battle(m).attrition.light,0);assert.equal(m.cards[vader].zone,'table');
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/activation-battle-results.json',import.meta.url)));
for(const row of oracle.filter(r=>r.kind==='activation'))test('executed GEMP activation sequence: '+row.name,()=>{
 const f=fixture();if(row.name==='short')for(const id of f.m.players.light.reserve.slice(1))state.moveCard(f.m,id,'used');const reserve=[...f.m.players.light.reserve];if(row.name==='blocked')activation.preventActivation(f.m,f.source,'light');let m=begin(f,row.count);
 if(['mid-block','source-leaves','changed-top'].includes(row.name)){m=seek(m,x=>event(x)?.kind==='force-activated');if(row.name==='mid-block')activation.preventActivation(m,f.source,'light');if(row.name==='source-leaves')state.moveCard(m,f.source,'lost');if(row.name==='changed-top')state.moveCard(m,reserve.at(-1),'reserve');}
 m=seek(m,finished);assert.equal(m.data.trace?.length??0,row.activated);assert.equal(m.turn.activated,row.generationActivated);
 const normalize=(n,count)=>row.name==='changed-top'&&n===count-1?'last':n;assert.deepEqual((m.data.trace??[]).map(id=>normalize(reserve.indexOf(id),reserve.length)),row.order.map(n=>normalize(n,row.reserveCount)));
});
test('normal generation keeps its numeric value across recovery but rejects an extra fractional-unit activation',()=>{
 const r={...rules,generation:()=>1.5};let {m}=fixture(r);m=seek(m,x=>x.stack.length===1&&x.stack[0].timing==='phase',r);m=step(m,'core:activate',r);m=seek(m,x=>x.stack.length===1,r);assert.equal(runtime.project(clone(m),r,'dark').turn.generation,1.5);assert.throws(()=>step(m,'core:activate',r,'dark'));const bad=clone(m);bad.turn.activated=2;assert.throws(()=>prompt(bad,r));
});
test('activation and battle evidence fingerprints unchanged reference and keeps admission closed',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/activation-battle-provenance.json',import.meta.url)));for(const [file,hash]of[[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.junitTests,3);assert.equal(p.unchangedProductionFiles,6820);assert.equal(premiereRules.supports('1_72'),false);
});

test('nested activation completes before the suspended batch resumes',()=>{
 const r={...rules,resolve:(m,resolution,context)=>{
  rules.resolve(m,resolution,context);
  if(resolution.action.handler==='probe:activation'&&m.data.trace.length===1)
   runtime.activateForce(m,'dark',resolution.action.payload.card.id,1);
 }};
 const f=fixture(r),light=[...f.m.players.light.reserve],dark=[...f.m.players.dark.reserve];
 const m=seek(begin(f,2),finished,r);assert.deepEqual(m.data.trace,[light[0],dark[0],light[1]]);assert.equal(m.turn.activated,0);
});
