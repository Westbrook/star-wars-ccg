import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engine,load} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,assertMatch,project,life}=engine;
const {printed}=load(new URL('../../lib/native-proof/catalog.ts',import.meta.url));
const restore=m=>JSON.parse(JSON.stringify(m));
function step(m,choice){const p=prompt(m);const n=restore(applyCommand(restore(m),p.side,{prompt:p.id,choice}));assertMatch(n);return n}
function until(m,condition,select=p=>p.choices[0].id){let n=0;while(!m.complete&&!condition(m)){assert.ok(n++<120);m=step(m,select(prompt(m),m))}return m}
const playChoice=m=>prompt(m)?.choices.find(c=>c.id.startsWith('play:'));
const response=()=>until(createScenario('takeel'),m=>!!playChoice(m));
const full=m=>until(m,()=>false);

test('Takeel is manual only at the both-destiny response and private while in hand',()=>{
 let m=createScenario('takeel');assert.equal(m.engine,'native-proof-2');
 const id=m.players.dark.hand[0];
 assert.throws(()=>applyCommand(m,'dark',{choice:'play:'+id,prompt:prompt(m).id}),/not legal/);
 m=until(m,s=>s.stack.at(-1)?.event==='battle-destiny-complete');
 assert.equal(prompt(m).side,'light');assert.equal(prompt(m).automatic,true);assert.equal(playChoice(m),undefined);
 m=step(m,'pass');const p=prompt(m);
 assert.equal(p.side,'dark');assert.equal(p.automatic,false);assert.deepEqual(p.choices.map(c=>c.id),['play:'+id,'pass']);
 assert.deepEqual(p.choices[0].destinyPreview,{light:1,dark:3});
 const opponent=project(m,'light');assert.deepEqual(opponent.prompt.choices,[]);assert.deepEqual(opponent.players.dark.hand,[]);assert.deepEqual(opponent.playing,[]);
 assert.equal(JSON.stringify(opponent).includes('1_269'),false);assert.equal(JSON.stringify(opponent).includes(id),false);
 assert.deepEqual(project(restore(m),'dark'),project(m,'dark'));
 assert.throws(()=>applyCommand(m,'light',{choice:'play:'+id,prompt:p.id}),/seat/);
});

test('paid Interrupt restores before resolving, preserves physical destinies, and resets parent passes',()=>{
 let m=response();const before=restore(m),id=playChoice(m).card,paid=m.players.dark.force[0];
 const physical={light:[...m.players.light.used],dark:[...m.players.dark.used]};
 m=step(m,'play:'+id);
 assert.equal(m.players.dark.force.length,0);assert.equal(m.players.dark.used[0],paid);
 assert.equal(m.cards[id].zone,'playing');assert.equal(m.players.dark.hand.length,0);assert.equal(life(m,'dark'),life(before,'dark'));
 assert.deepEqual(m.battle.destiny,{light:3,dark:1});assert.deepEqual(m.battle.destinyBeforeSwitch,{light:3,dark:1});assert.equal(m.battle.destinySwitched,undefined);
 for(const side of ['light','dark'])assert.equal(project(m,side).playing[0].id,id);
 assert.equal(m.stack.at(-3).event,'battle-destiny-complete');assert.equal(m.stack.at(-3).passes,0);assert.equal(m.stack.at(-3).priority,'light');
 assert.equal(prompt(m).side,'light');m=step(m,'pass');assert.equal(prompt(m).side,'dark');assert.equal(m.cards[id].zone,'playing');
 m=step(m,'pass');assert.equal(m.cards[id].zone,'lost');assert.equal(m.players.dark.lost[0],id);assert.deepEqual(project(m,'light').playing,[]);
 assert.deepEqual(m.battle.destiny,{light:1,dark:3});assert.equal(m.battle.destinySwitched,true);
 assert.deepEqual(m.players.light.used,physical.light);assert.deepEqual(m.players.dark.used,[paid,...physical.dark]);
 assert.equal(prompt(m).side,'light');assert.equal(m.stack.at(-1).passes,0);assert.equal(m.stack.at(-1).event,'battle-destiny-complete');
 assert.throws(()=>applyCommand(m,'light',{prompt:prompt(m).id,choice:'play:'+id}),/not legal/);
 m=step(m,'pass');assert.equal(prompt(m).side,'dark');m=step(m,'pass');assert.equal(prompt(m).title,'Power segment actions');
 m=until(m,s=>!!project(s,'dark').losses);
 assert.deepEqual(m.battle.power,{light:5,dark:7});assert.deepEqual(m.battle.attrition,{light:3,dark:1});assert.deepEqual(m.battle.damage,{light:2,dark:0});
 assert.deepEqual(project(m,'light').losses.light,{attrition:3,damage:2,initialAttrition:3,initialDamage:2});
});

test('passing spends nothing, keeps Takeel, and closes its timing opportunity',()=>{
 let m=response();const before=restore(m),id=playChoice(m).card;
 m=step(m,'pass');assert.equal(m.stack.at(-1).event,undefined);assert.equal(prompt(m).title,'Power segment actions');
 assert.deepEqual(m.players,before.players);assert.equal(m.cards[id].zone,'hand');
 assert.throws(()=>applyCommand(m,'dark',{prompt:prompt(m).id,choice:'play:'+id}),/not legal/);
 m=until(m,s=>!!project(s,'dark').losses);
 assert.deepEqual(m.battle.power,{light:7,dark:5});assert.deepEqual(m.battle.destiny,{light:3,dark:1});assert.equal(m.players.dark.force.length,1);
});

for(const draw of [{light:false,dark:true},{light:true,dark:false},{light:false,dark:false}])test('Takeel is unavailable when a player skips: '+JSON.stringify(draw),()=>{
 let offered=false;
 const m=until(createScenario('takeel'),()=>false,p=>{
  offered||=p.choices.some(c=>c.id.startsWith('play:'));
  return p.title==='Battle destiny'?(draw[p.side]?'draw-destiny':'skip-destiny'):p.choices[0].id;
 });
 assert.equal(offered,false);assert.equal(m.cards[m.players.dark.hand[0]].blueprint,'1_269');assert.equal(m.battle.destinySwitched,undefined);
});

test('Takeel requires available Force, while a zero destiny still counts as a draw',()=>{
 let m=response();const id=m.players.dark.force.shift();m.players.dark.reserve.push(id);m.cards[id].zone='reserve';assertMatch(m);
 assert.equal(playChoice(m),undefined);assert.equal(prompt(m).automatic,true);
 m=createScenario('takeel');const reserve=m.players.dark.reserve;const i=reserve.findIndex(id=>printed(m.cards[id].blueprint,'destiny')===0);assert.ok(i>=0);reserve.unshift(...reserve.splice(i,1));
 m=until(m,s=>!!playChoice(s));assert.equal(m.battle.destiny.dark,0);assert.equal(prompt(m).automatic,false);assert.deepEqual(playChoice(m).destinyPreview,{light:0,dark:3});
});

for(const play of [true,false])for(const forceFirst of [true,false])test('full Takeel branch play='+play+' Force first='+forceFirst,()=>{
 let totals;
 const result=until(createScenario('takeel'),()=>false,(p,m)=>{
  if(project(m,'dark').losses)totals={...m.battle.power};
  if(playChoice(m))return play?playChoice(m).id:'pass';
  if(forceFirst&&p.choices.some(c=>c.id==='lose:reserve'))return 'lose:reserve';
  return p.choices[0].id;
 });
 assert.deepEqual(totals,play?{light:5,dark:7}:{light:7,dark:5});
 assert.deepEqual(result.battle.attrition,{light:0,dark:0});assert.deepEqual(result.battle.damage,{light:0,dark:0});
 assert.equal(result.players.dark.hand.length,play?0:1);
 for(const side of ['light','dark'])assert.deepEqual(project(restore(result),side),project(result,side));
});

test('pending Interrupt conservation rejects orphaned or duplicate cards and wrong engine versions',()=>{
 let m=response();m=step(m,playChoice(m).id);const orphan=restore(m);orphan.stack=orphan.stack.filter(f=>f.kind!=='interrupt');assert.throws(()=>assertMatch(orphan),/preserved/);
 const duplicate=restore(m);duplicate.stack.push(duplicate.stack.find(f=>f.kind==='interrupt'));assert.throws(()=>assertMatch(duplicate),/pending/);
 const old=restore(m);old.engine='native-proof-1';assert.throws(()=>assertMatch(old),/version/);
 for(const scenario of ['activation','drain','battle','recirculation'])assert.equal(createScenario(scenario).engine,'native-proof-1');
});

test('native outcomes match all six recorded branches from the executed GEMP oracle',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/takeel-oracle-result.json',import.meta.url),'utf8'));
 assert.equal(oracle.failures+oracle.errors,0);
 for(const branch of oracle.branches){
  let m=createScenario('takeel');const card=m.players.dark.hand[0];
  if(branch.name==='insufficient-force'){
   const id=m.players.dark.force.shift();m.players.dark.reserve.push(id);m.cards[id].zone='reserve';
  }
  m=until(m,s=>!!project(s,'dark').losses,p=>{
   if(p.title==='Battle destiny')return branch[p.side+'Draws']===false?'skip-destiny':'draw-destiny';
   const play=p.choices.find(c=>c.id.startsWith('play:'));if(play)return branch.name==='play'?play.id:'pass';
   return p.choices[0].id;
  });
  assert.deepEqual(m.battle.power,branch.power,branch.name);
  for(const field of ['destiny','attrition','damage'])if(branch[field])assert.deepEqual(m.battle[field],branch[field],branch.name+' '+field);
  assert.equal(m.players.dark.force.length,branch.name==='play'||branch.name==='insufficient-force'?0:1);
  assert.equal(m.cards[card].zone,branch.name==='play'?'lost':'hand');
 }
});
