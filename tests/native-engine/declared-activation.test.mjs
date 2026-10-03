import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=mod('runtime'),state=mod('state'),inserts=mod('reserve-inserts');
const {premiereRules}=mod('premiere-rules'),rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url))),clone=x=>JSON.parse(JSON.stringify(x));
const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)};
function step(m,id){const old=clone(m),next=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,old);for(const side of ['light','dark'])assert.deepEqual(runtime.project(next,rules,side),runtime.project(clone(next),rules,side));return next;}
function seek(m,check){for(let i=0;i<900;i++){if(check(m))return m;const p=prompt(m);assert.ok(p);m=step(m,p.mandatory?p.choices[0].id:'pass')}throw Error('Missing boundary');}
function pull(m,side,bp,zone='hand'){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,bp);state.moveCard(m,id,zone);return id;}
function fixture(mode='anger',depth=8,side='dark'){
 let m=runtime.createMatch('declared-activation',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['4_16','1_42']:['1_208','5_149','4_133']),...d.main].slice(0,60)})),rules);
 for(const s of ['light','dark']){const site=pull(m,s,s==='light'?'1_129':'1_284','table');m.locations.push(site);}
 const insert=pull(m,side==='dark'?'light':'dark',side==='light'?'1_208':mode==='tremor'?'1_42':'4_16'),telepathy=pull(m,'dark','5_149'),path=pull(m,'dark','4_133','table');
 m=runtime.startTurns(m,rules);m=seek(m,x=>x.turn.side===side&&x.turn.phase==='activate'&&x.stack.length===1&&x.stack[0].timing==='phase'&&prompt(x).side===side);
 state.insertCard(m,insert,side,()=>0);inserts.insertsIn(m,side)[0].position=depth;return {m,insert,telepathy,path};
}
function declare(m,count){m=step(m,'core:declare-activation');m=seek(m,x=>x.stack.at(-1)?.handler==='core:activation-amount');return step(m,'core:activation-amount:'+count);}
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/declared-activation-results.json',import.meta.url)));
for(const row of oracle)test('normal generation vs executed GEMP: '+JSON.stringify(row),()=>{
 const f=fixture(row.mode,row.depth);assert.equal(Math.floor(f.m.turn.generation),row.maximum);let m=declare(f.m,row.count),atReveal=-1;
 if(row.depth===1){atReveal=m.turn.activated;assert.equal(m.stack.at(-1).event.kind,'insert-revealed');if(row.mode==='cancel'){m=seek(m,x=>prompt(x).choices.some(c=>c.id.startsWith('telepathy:play:')));m=step(m,prompt(m).choices.find(c=>c.id.startsWith('telepathy:play:')).id);}}
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='activation-between');assert.equal(prompt(m).side,row.firstPhaseSide);assert.equal(prompt(m).side,'light');
 m=seek(m,x=>x.stack.length===1&&prompt(x).side==='dark');
 assert.equal(atReveal,row.revealedAt);assert.equal(m.cards[f.insert].zone==='lost',row.insertLost);assert.equal(m.cards[f.telepathy].zone==='used',row.telepathyUsed);
 const more=prompt(m).choices.some(c=>c.id==='core:activate');
 // AR p167 binds the declared total. GEMP does not enforce that ceiling;
 // it also stops its UI batch on an uncanceled Anger reveal.
 assert.equal(m.turn.activated,row.mode==='tremor'&&row.depth===1?1:row.count);
 if(row.depth===8){assert.equal(more,false);assert.equal(row.more,true);}else assert.equal(more,row.more);
 if(row.mode==='anger'&&row.depth===1&&row.count===2)assert.equal(row.activated,1);else assert.equal(m.turn.activated,row.activated);
 if(more){const before=m.turn.activated;m=step(m,'core:activate');m=seek(m,x=>x.stack.length===1);assert.equal(m.turn.activated,before+1);}
});
for(const side of ['light','dark'])test('each declared unit gives the opponent first opportunity: '+side,()=>{
 const f=fixture('anger',8,side),opponent=side==='dark'?'light':'dark';let m=declare(f.m,2);
 for(const n of [1,2]){m=seek(m,x=>x.turn.activated===n&&x.stack.at(-1)?.event?.kind==='activation-between');assert.equal(prompt(m).side,opponent);assert.equal(m.data.normalActivation.remaining,2-n);m=step(m,'pass');assert.equal(prompt(m).side,side);assert.ok(!prompt(m).choices.some(c=>c.id==='core:activate'||c.id==='core:declare-activation'));m=step(m,'pass');}
 m=seek(m,x=>x.stack.length===1);assert.equal(m.turn.activated,2);assert.equal(m.turn.phase,'activate');assert.equal(m.data.normalActivation.done,true);
});
test('a real Dark Path action between activations preserves the declared remainder through recovery',()=>{
 const f=fixture(),m0=declare(f.m,2);let m=seek(m0,x=>x.stack.at(-1)?.event?.kind==='activation-between');assert.equal(prompt(m).side,'light');m=step(m,'pass');m=step(m,'dark-path:peek:'+f.path);m=seek(m,x=>x.stack.at(-1)?.handler==='dark-path:select');assert.equal(m.data.normalActivation.remaining,1);const selected=prompt(m).choices[0].id;m=step(m,selected);assert.equal(m.turn.activated,1);m=step(m,prompt(m).choices[0].id);m=seek(m,x=>x.stack.length===1);assert.equal(m.turn.activated,2);assert.equal(m.players.dark.lost.length,2);assert.equal(inserts.insertsIn(m,'dark')[0].position,4);assert.equal(m.data.normalActivation.done,true);
});
test('concession during an activation interval freezes the remaining declaration',()=>{const f=fixture();const m=seek(declare(f.m,2),x=>x.stack.at(-1)?.event?.kind==='activation-between'),before=clone(m),done=step(m,'concede');assert.equal(done.result.winner,'dark');assert.deepEqual(done.stack,before.stack);assert.deepEqual(done.players,before.players);assert.deepEqual(done.data.normalActivation,before.data.normalActivation)});
test('activation conformance receipt retains normative differences and closed deck admission',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/declared-activation-provenance.json',import.meta.url)));for(const[file,hash]of Object.entries(p.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(premiereRules.supports('4_16'),false)});
