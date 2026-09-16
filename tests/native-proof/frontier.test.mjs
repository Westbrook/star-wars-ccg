import test from 'node:test';import assert from 'node:assert/strict';
import {load} from './load-engine.mjs';
import {paths,runPath,createScenario,prompt,project,step,until,ready,phase,deploy,card,pick,balances,observe} from './frontier-paths.mjs';
const {assertMatch,applyCommand,concedeGame}=load(new URL('../../lib/native-proof/engine.ts',import.meta.url));
const {jawaPayment,destinyRequirement}=load(new URL('../../lib/native-proof/frontier-rules.ts',import.meta.url));
for(const path of paths)test(path+' preserves a complete recoverable checkpoint',()=>{const {m}=runPath(path);assert.equal(m.complete,true);assert.equal(m.engine,'native-proof-15');assert.equal(Object.keys(m.cards).length,120);for(const side of ['dark','light'])assert.deepEqual(project(m,side).players[side==='dark'?'light':'dark'].hand,[])});
test('Jawa deployment pays both owners, while only Light receives the Camp exception',()=>{
 assert.deepEqual(runPath('light-camp').facts,{lightForce:2,darkForce:1,lightUsed:1,darkUsed:0,barred:0,campAvailable:true,duneAvailable:true});
 assert.deepEqual(runPath('light-dune').facts,{lightForce:2,darkForce:0,lightUsed:1,darkUsed:1,barred:0,campAvailable:true,duneAvailable:false});
 assert.deepEqual(runPath('dark-camp').facts,runPath('dark-dune').facts);
 assert.deepEqual(runPath('dark-camp').facts,{lightForce:1,darkForce:4,lightUsed:1,darkUsed:1});
});
test('last opponent Force cannot be double-spent on Jawa and Barrier; own zero Force blocks Camp',()=>{
 let m=deploy(createScenario('jawa-bargain'),'1_12','l051');assert.equal(pick(m,'play:'),undefined);
 m=ready(m);const cs=prompt(m).choices.filter(c=>c.card&&m.cards[c.card].blueprint==='1_12');assert.equal(cs.length,1);assert.equal(cs[0].deployPayment.dark,0);
 m=ready(deploy(m,'1_28',m.locations[0]));m=ready(deploy(m,'1_12',m.locations[0]));assert.equal(m.players.light.force.length,0);
 const f=runPath('camp-barrier').facts;assert.equal(f.darkForce,0);assert.equal(f.darkUsed,2);assert.equal(f.duneAvailable,false);assert.equal(f.campAvailable,true);
});
test('Dune Sea is six for Dark, four for Light, and Barriered ability is excluded',()=>{
 for(const n of [4,5])assert.equal(runPath('ability-'+n).facts.darkDestiny,null);
 assert.equal(runPath('ability-6').facts.darkDestiny,3);assert.equal(runPath('ability-6').facts.darkPower,9);
 const b=runPath('ability-barrier').facts;assert.equal(b.darkParticipants,5);assert.equal(b.darkDestiny,null);assert.equal(b.lightDestiny,3);
 let m=createScenario('dune-sea');m=phase(m,'battle');m=step(m,'battle:'+m.locations[1]);assert.equal(destinyRequirement(m,'dark'),6);m.battle.site=m.locations[0];assert.equal(destinyRequirement(m,'dark'),4);
});
test('two full turns carry costs, reset limits, recirculate and expire turn-two Barrier',()=>{
 const {m,facts}=runPath('patrol');assert.equal(facts.generation,3);assert.equal(facts.barred,1);assert.equal(facts.darkJawaAtCamp,true);
 assert.equal(m.turn.number,3);assert.equal(m.active,'dark');assert.equal(m.phase,'Activate');assert.equal(m.cycle.history.length,2);assert.deepEqual(m.cycle.history.map(x=>x.generation),[3,3]);assert.equal(m.turn.restrictions.length,0);assert.equal(m.cycle.history[1].expired,1);assert.deepEqual(m.drained,[]);assert.deepEqual(m.turn.moved,[]);
});
test('wrong seat, stale payment and corrupted playable card pool are rejected',()=>{
 const m=createScenario('jawa-bargain'),p=prompt(m),c=p.choices[0].id;
 assert.throws(()=>applyCommand(m,'dark',{prompt:p.id,choice:c}));const next=step(m,c);assert.throws(()=>applyCommand(next,p.side,{prompt:p.id,choice:c}));assert.deepEqual(balances(m),{lightForce:3,darkForce:1,lightUsed:0,darkUsed:0});
 const bad=createScenario('desert-patrol');bad.cards[bad.players.light.hand[0]].blueprint='1_30';assert.throws(()=>assertMatch(bad));
});
test('450 seeded routes restore every choice and allow concession without rewriting state',()=>{
 let seed=77119,count=0;const kinds={};for(const scenario of ['jawa-bargain','dune-sea','desert-patrol'])for(let n=0;n<150;n++){
  let m=createScenario(scenario);m=until(m,x=>x.complete,x=>{count++;const p=prompt(x);assert.deepEqual(project(x,p.side),project(JSON.parse(JSON.stringify(x)),p.side));seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=p.choices[(seed>>>8)%p.choices.length];kinds[c.id.split(':')[0]]=(kinds[c.id.split(':')[0]]||0)+1;return c.id});
  assertMatch(m);
 }assert.ok(kinds.deploy>0&&kinds.play>0&&kinds.move>0&&kinds['draw-destiny']>0&&kinds.drain>0);console.log({frontierDecisions:count,kinds});
 const initial=createScenario('desert-patrol'),terminal=concedeGame(initial,'light',initial.engine+':0');assert.equal(project(terminal,'dark').winner,'dark');assert.deepEqual(terminal.players,initial.players);
});

test('ten executed GEMP outcomes and both complete-turn pile orders match',()=>{
 const {branches}=load(new URL('./gemp/frontier-oracle-result.json',import.meta.url));assert.equal(branches.length,11);
 for(const {name,...expected} of branches){if(name!=='patrol-finish'){assert.deepEqual(runPath(name).facts,expected,name);continue;}
  const m=runPath('patrol').m;for(const side of ['light','dark'])for(const zone of ['reserve','force','used','lost','hand'])assert.deepEqual(zone==='hand'?[...m.players[side][zone]].sort():m.players[side][zone],zone==='hand'?[...expected[side][zone]].sort():expected[side][zone],side+' '+zone);
 }
});
