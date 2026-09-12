import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engine,load} from './load-engine.mjs';
const {createScenario,applyCommand,assertMatch,project,prompt}=engine;
const {setupSites}=load(new URL('../../lib/native-proof/setup-rules.ts',import.meta.url));
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/setup-oracle-result.json',import.meta.url),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const start=()=>createScenario('opening-table');
function step(m,choice,side=prompt(m).side){const p=project(m,side).prompt;const n=applyCommand(clone(m),side,{choice,prompt:p.id});assertMatch(clone(n));for(const seat of ['dark','light'])assert.deepEqual(project(n,seat),project(clone(n),seat));return n}
const pick=(m,side,blueprint,exclude=[])=>project(m,side).setup.candidates.find(c=>c.blueprint===blueprint&&!exclude.includes(c.id)).id;
function select(m,dark,light,first='dark'){m=step(m,'select:'+m.players[first].reserve.find(id=>m.cards[id].blueprint===(first==='dark'?dark:light)),first);const second=first==='dark'?'light':'dark';m=step(m,'select:'+pick(m,second,second==='dark'?dark:light),second);return step(m,'reveal')}
function finish(m){for(let n=0;!m.complete&&n<80;n++){const p=prompt(m);m=step(m,p.choices[0].id)}assert.equal(m.complete,true);return m}
function reject(m){m=step(m,'decline-conversion');return step(m,'decline-conversion')}

test('all 18 physical starting cards are legal and either side may commit first without leaking its choice',()=>{
 const m=start();assert.equal(m.engine,'native-proof-6');assert.equal(m.locations.length,0);
 for(const side of ['dark','light']){
  const other=side==='dark'?'light':'dark',choices=project(m,side).prompt.choices;
  assert.equal(choices.length,9);assert.equal(new Set(choices.map(c=>c.card)).size,9);
  const a=step(m,choices[0].id,side),b=step(m,choices.at(-1).id,side);
  assert.deepEqual(project(a,other),project(b,other));assert.deepEqual(project(a,other,true),project(b,other,true));
  assert.equal(a.players[side].reserve.length,60);assert.equal(a.locations.length,0);assert.equal(project(a,other).setup.selected[side],null);
  assert.equal(project(a,side).setup.selected[side].id,choices[0].card);assert.throws(()=>step(a,choices[1].id,side),/seat/);
 }
});

test('both choices stay private through commitment and reveal together without changing card zones',()=>{
 let m=start();m=step(m,'select:'+pick(m,'dark','1_285'),'dark');m=step(m,'select:'+pick(m,'light','1_124'),'light');
 assert.equal(m.setup.stage,'reveal');assert.equal(project(m,'dark').setup.selected.light,null);assert.equal(project(m,'light').setup.selected.dark,null);assert.equal(m.locations.length,0);
 m=step(m,'reveal');assert.equal(m.setup.stage,'collision');for(const seat of ['dark','light'])assert.ok(project(m,seat).setup.selected.dark&&project(m,seat).setup.selected.light);
 assert.deepEqual([m.players.dark.reserve.length,m.players.light.reserve.length],[60,60]);assert.equal(prompt(m).side,'dark');
});

test('all 81 physical pairs complete, with both conversion outcomes and legal site orientation',()=>{
 const initial=start(),dark=project(initial,'dark').setup.candidates,light=project(initial,'light').setup.candidates;let pairs=0,collisions=0;
 for(const d of dark)for(const l of light){
  let m=step(step(start(),'select:'+d.id,'dark'),'select:'+l.id,'light');m=step(m,'reveal');pairs++;
  const clash=m.setup.stage==='collision';if(clash)collisions++;
  for(const accept of clash?['dark','light']:['none']){
   let branch=clone(m);if(accept==='light')branch=step(branch,'decline-conversion');if(clash)branch=step(branch,'accept-conversion');
   for(const place of prompt(branch).choices){
    const end=finish(step(branch,place.id));assert.equal(end.active,'dark');assert.equal(end.phase,'Activate');assert.equal(end.locations.length,clash?1:2);assert.equal(project(end,'dark').table.length,0);
    for(const side of ['dark','light']){assert.equal(end.players[side].hand.length,8);assert.equal(end.players[side].reserve.length,51);assert.equal(end.setup.generation[side],1+end.locations.reduce((n,id)=>n+setupSites[end.cards[id].blueprint].icons[side],0));}
    if(clash){assert.equal(end.cards[end.setup.covered].owner,accept);assert.equal(end.cards[end.setup.covered].coveredBy,end.locations[0]);assert.deepEqual(end.setup.generation,{dark:2,light:2});}
   }
  }
 }
 assert.equal(pairs,81);assert.equal(collisions,6);
});

test('only rejected physical copies are excluded: unused duplicate remains legal under the official rule',()=>{
 let m=select(start(),'1_285','1_124');const rejected=[m.setup.selected.dark,m.setup.selected.light];m=reject(m);
 assert.equal(m.setup.round,2);assert.equal(m.setup.rejected.length,1);assert.equal(project(m,'dark').setup.candidates.some(c=>c.id===rejected[0]),false);
 const duplicate=pick(m,'dark','1_285');assert.notEqual(duplicate,rejected[0]);m=step(m,'select:'+duplicate,'dark');m=step(m,'select:'+pick(m,'light','1_132'),'light');m=finish(step(m,'reveal'));
 for(const id of rejected)assert.ok(['reserve','hand'].includes(m.cards[id].zone));assert.equal(m.cards[duplicate].zone,'table');assert.deepEqual(m.setup.generation,{dark:3,light:4});
 assert.equal(oracle.branches.find(b=>b.name==='both-decline-reselect').gempExcludesAllCopiesOfPreviouslyDeclinedTitle,true);
});

test('all 81 starting pairs match independent executed GEMP generation, cover and pile counts',()=>{
 assert.equal(oracle.allInitialPairs.length,81);assert.equal(new Set(oracle.allInitialPairs.map(b=>b.name)).size,81);
 for(const b of oracle.allInitialPairs){
  let m=step(step(start(),'select:'+b.chosen.dark,'dark'),'select:'+b.chosen.light,'light');m=finish(step(m,'reveal'));
  assert.deepEqual(m.setup.generation,b.generation);assert.equal(m.active,b.active);assert.equal(m.phase.toUpperCase(),b.phase);
  const table=m.locations.map(id=>({id,blueprint:m.cards[id].blueprint,under:Object.values(m.cards).filter(c=>c.coveredBy===id).map(c=>c.id)})).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(table,[...b.table].sort((a,b)=>a.id.localeCompare(b.id)));
  for(const side of ['dark','light'])for(const pile of ['hand','reserve'])assert.equal(m.players[side][pile].length,b.counts[side][pile]);
 }
});

test('three declined collisions return all six cards before the opening draw',()=>{
 let m=start();for(const [d,l] of [['1_285','1_124'],['1_291','1_129'],['1_292','1_131']]){m=select(m,d,l);m=reject(m)}
 assert.equal(m.setup.round,4);assert.equal(project(m,'dark').setup.candidates.length,6);assert.equal(project(m,'light').setup.candidates.length,6);
 const rejected=m.setup.rejected.flat();m=select(m,'101_4','101_1');m=finish(m);for(const id of rejected)assert.ok(['reserve','hand'].includes(m.cards[id].zone));assert.equal(Object.keys(m.cards).length,120);
});

test('simultaneous eight-card draw uses actual saved order and private hands; owner study reveals hands only',()=>{
 let m=select(start(),'1_291','1_124');m=step(m,'place');m=step(m,'prepare');const before=clone(m.players);
 m=step(m,'draw-opening');assert.equal(m.setup.stage,'start');assert.equal(m.setup.generation,null);
 for(const side of ['dark','light']){
  const p=m.players[side],other=side==='dark'?'light':'dark';assert.deepEqual(p.hand,before[side].reserve.slice(0,8));assert.deepEqual(p.reserve,before[side].reserve.slice(8));
  const v=project(m,other);assert.deepEqual(v.players[side].hand,[]);assert.equal(v.setup.openingHands,undefined);assert.equal(v.setup.shuffleOrder,undefined);
  for(const id of p.hand)assert.equal(JSON.stringify(v).includes('"id":"'+id+'"'),false);
  const study=project(m,other,true);assert.deepEqual(study.setup.openingHands[side].map(c=>c.id),p.hand);for(const id of p.reserve)assert.equal(JSON.stringify(study).includes('"id":"'+id+'"'),false);
 }
 m=step(m,'pass');assert.equal(m.complete,false);assert.equal(prompt(m).side,'light');m=step(m,'pass');assert.equal(m.complete,true);assert.equal(prompt(m),null);assert.throws(()=>applyCommand(m,'dark',{choice:'activate',prompt:m.engine+':'+m.revision}),/seat/);
});

test('different systems are separate groups and supporting locations do not add icons',()=>{
 const distinct=finish(select(start(),'1_295','1_124'));assert.equal(project(distinct,'dark').setup.groups.length,2);assert.equal(distinct.setup.generation.dark,4);
 let m=select(start(),'1_285','1_124');m=step(m,'decline-conversion');m=finish(m);const v=project(m,'dark');assert.equal(v.locations.length,1);assert.equal(v.setup.covered.side,'light');assert.equal(v.table.length,0);assert.deepEqual(m.setup.generation,{dark:2,light:2});
});

test('stale, wrong-seat, illegal gameplay and corrupt setup states fail closed',()=>{
 const m=start(),p=project(m,'dark').prompt;const n=step(m,p.choices[0].id,'dark');assert.throws(()=>applyCommand(n,'light',{choice:project(n,'light').prompt.choices[0].id,prompt:p.id}),/stale/);
 assert.throws(()=>step(m,'activate','dark'),/not legal/);assert.throws(()=>step(m,'select:l046','dark'),/not legal/);
 const corrupt=[x=>delete x.setup,x=>x.setup.shuffleOrder.dark[0]=x.setup.shuffleOrder.dark[1],x=>x.setup.selected.dark='l046',x=>x.setup.revealed=true,x=>x.setup.startPasses=2,x=>x.complete=true,x=>x.setup.generation={dark:3,light:3}];
 for(const change of corrupt){const x=clone(m);change(x);assert.throws(()=>assertMatch(x))}
 let end=finish(select(start(),'1_285','1_124'));let bad=clone(end);delete bad.cards[bad.setup.covered].coveredBy;assert.throws(()=>assertMatch(bad));bad=clone(end);bad.players.dark.hand.reverse();assert.throws(()=>assertMatch(bad),/order/);
});

for(const b of oracle.branches)test('recorded GEMP setup outcome: '+b.name,()=>{
 let m=start();
 // Normalize GEMP's bottom draw and second shuffle into one equivalent
 // recorded top-eight outcome. This compares draw/conservation/placement,
 // not RNG algorithms. The shipped study uses its own immutable order.
 for(const side of ['dark','light']){
  const placed=Object.keys(b.zones).filter(id=>m.cards[id].owner===side&&['LOCATIONS','CONVERTED_LOCATIONS'].includes(b.zones[id]));
  m.setup.shuffleOrder[side]=[...b.hands[side],...b.reserve[side],...placed];
  assert.deepEqual(project(m,side).setup.candidates.map(c=>c.id).sort(),b.initialChoices[side].map(c=>c.id).sort());
 }
 if(b.name==='distinct-locations')m=select(m,'1_291','1_124');
 else{
  m=select(m,'1_285','1_124');
  if(b.name==='light-allows-conversion')m=step(m,'decline-conversion');
  else if(b.name==='both-decline-reselect'){m=reject(m);m=select(m,'1_291','1_132')}
 }
 m=finish(m);assert.deepEqual(m.setup.generation,b.generation);assert.equal(m.active,b.active);assert.equal(m.phase.toUpperCase(),b.phase);
 for(const side of ['dark','light']){assert.deepEqual(m.players[side].hand,b.hands[side]);assert.deepEqual(m.players[side].reserve,b.reserve[side]);}
 const table=m.locations.map(id=>({id,blueprint:m.cards[id].blueprint,under:Object.values(m.cards).filter(c=>c.coveredBy===id).map(c=>c.id)}));
 if(project(m,'dark').setup.groups.length>1){table.sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(table,[...b.table].sort((a,b)=>a.id.localeCompare(b.id)))}else assert.deepEqual(table,b.table);
});
