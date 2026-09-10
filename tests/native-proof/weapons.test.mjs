import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engine,load} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,assertMatch,project}=engine;
const {weaponRules}=load(new URL('../../lib/native-proof/weapon-rules.ts',import.meta.url));
const copy=m=>JSON.parse(JSON.stringify(m));
const other=s=>s==='light'?'dark':'light';
function step(m,id){const p=prompt(m),n=copy(applyCommand(copy(m),p.side,{prompt:p.id,choice:id}));assertMatch(n);return n}
const first=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
const defaults=p=>p.choices.find(c=>c.id==='pass')?.id||p.choices[0].id;
function until(m,done,choose=defaults){let n=0;while(!m.complete&&!done(m)){assert.ok(n++<200);m=step(m,choose(prompt(m),m))}assert.ok(done(m),'checkpoint reached');return m}
const at=(m,kind)=>until(m,x=>x.stack.at(-1)?.kind===kind);
const armory=m=>until(m,x=>x.stack.at(-1)?.kind==='armory'&&prompt(x).side===x.active);
const firing=(m,side)=>until(m,x=>x.stack.at(-1)?.kind==='weapons'&&prompt(x).side===side);
const weapon=(m,side,cost)=>Object.values(m.cards).find(c=>c.owner===side&&weaponRules[c.blueprint]?.fire===cost&&['hand','table'].includes(c.zone));
function equip(m,cost,user=m.battle.participants[m.active][cost-1]){m=armory(m);return step(m,'equip:'+weapon(m,m.active,cost).id+':'+user)}
function battle(m){m=until(m,x=>x.stack.at(-1)?.kind==='battle'&&x.stack.at(-1).stage==='start');m=step(m,'battle');return at(m,'weapons')}
function armed(scenario,same=false){let m=createScenario(scenario),user=m.battle.participants[m.active][0];m=equip(m,1,user);m=equip(m,2,same?user:undefined);return battle(m)}
function fire(m,cost,target){const side=prompt(m).side;return step(m,'fire:'+weapon(m,side,cost).id+':'+(target||m.battle.participants[other(side)][0]))}
const full=m=>until(m,x=>x.complete,p=>p.choices.find(c=>c.id==='skip-destiny')?.id||p.choices.find(c=>c.id==='pass')?.id||p.choices[0].id);

for(const scenario of ['weapons','rebel-weapons']){
 test(scenario+': legal deployment/transfer, printed costs, opposing hand privacy',()=>{
  let m=createScenario(scenario);const s=m.active,o=other(s),initial=copy(m);assert.equal(m.engine,'native-proof-4');assert.equal(m.players[s].force.length,8);assert.equal(m.players[o].force.length,4);
  assert.deepEqual(m.players[s].reserve.slice(0,3).map(id=>m.cards[id].blueprint),s==='dark'?['1_194','1_182','1_291']:['1_28','1_12','1_129']);
  assert.equal(prompt(m).choices.filter(c=>c.id.startsWith('equip:')).length,8);
  for(const id of m.players[s].hand)assert.equal(JSON.stringify(project(m,o)).includes(id),false);
  const w=weapon(m,s,1).id,a=m.battle.participants[s][0],b=m.battle.participants[s][1];
  assert.throws(()=>step(m,'equip:'+w+':'+m.battle.participants[o][0]),/not legal/);
  m=equip(m,1,a);assert.equal(m.cards[w].attachedTo,a);assert.equal(m.players[s].force.length,7);m=armory(m);
  assert.equal(prompt(m).choices.some(c=>c.id==='transfer:'+w+':'+a),false);
  m=step(m,'transfer:'+w+':'+b);assert.equal(m.players[s].force.length,6);assert.equal(m.cards[w].attachedTo,b);
  m=armory(m);m=equip(m,2,b);assert.equal(m.players[s].force.length,4);assert.equal(Object.values(m.cards).filter(c=>c.attachedTo===b).length,2);
  assert.equal(Object.keys(m.cards).length,Object.keys(initial.cards).length);
 });
 for(const cost of [1,2])test(scenario+': saved paid '+cost+'-Force shot, revealed destiny and strict threshold',()=>{
  let m=armed(scenario);const s=m.active,o=other(s),target=m.battle.participants[o][0],before=copy(m),id=weapon(m,s,cost).id;
  assert.equal(prompt(m).automatic,false);m=fire(m,cost,target);
  assert.equal(m.players[s].force.length,before.players[s].force.length-cost);assert.equal(m.cards[target].hit,undefined);assert.equal(m.battle.shots[0].status,'pending');
  assert.deepEqual(m.players[s].reserve,before.players[s].reserve);for(const seat of [s,o])assert.deepEqual(project(m,seat),project(copy(m),seat));
  m=step(step(m,'pass'),'pass');assert.equal(m.battle.shots[0].status,'drawn');assert.equal(m.battle.shots[0].destiny,1);assert.equal(m.players[s].destiny.length,1);assert.equal(m.cards[target].hit,undefined);
  m=step(step(m,'pass'),'pass');assert.equal(m.battle.shots[0].status,'resolved');assert.equal(m.battle.shots[0].hit,cost===2);assert.equal(!!m.cards[target].hit,cost===2);assert.equal(m.players[s].destiny.length,0);
  assert.equal(m.players[s].used[0],before.players[s].reserve[0]);m=firing(m,s);assert.equal(prompt(m).choices.some(c=>c.id.startsWith('fire:'+id+':')),false);
  assert.equal(m.battle.power[o],4);assert.equal(m.battle.participants[o].length,4);
 });
 test(scenario+': rifle equality misses; no Force or Reserve cannot fire',()=>{
  let m=armed(scenario),s=m.active;
  const r=m.players[s].reserve;r.unshift(...r.splice(2,1));m=fire(m,2);m=until(m,x=>x.battle.shots[0].status==='resolved');assert.equal(m.battle.shots[0].destiny,0);assert.equal(m.battle.shots[0].hit,false);
  for(const pile of ['force','reserve']){m=armed(scenario);s=m.active;const ids=m.players[s][pile].splice(0);for(const id of ids){m.cards[id].zone='used';m.players[s].used.push(id)}assertMatch(m);assert.equal(first(m,'fire:'),undefined);assert.equal(prompt(m).automatic,true)}
 });
 test(scenario+': a warrior carrying both weapons may use only one different weapon',()=>{
  let m=armed(scenario,true),s=m.active;m=fire(m,1);m=firing(m,s);assert.equal(first(m,'fire:'),undefined);assert.equal(prompt(m).automatic,true);
 });
 test(scenario+': hit trooper returns fire and contributes ability; zero totals still require hit forfeits',()=>{
  let m=armed(scenario);const s=m.active,o=other(s),activeHit=m.battle.participants[s][0],opponentHit=m.battle.participants[o][0];
  m=fire(m,2,opponentHit);m=firing(m,o);assert.equal(m.cards[opponentHit].hit,true);
  const reply=first(m,'fire:'+weapon(m,o,1).id+':');assert.ok(reply);m=step(m,reply.id);m=firing(m,s);m=fire(m,1,opponentHit);m=firing(m,o);m=fire(m,2,activeHit);
  m=until(m,x=>prompt(x)?.title==='Battle destiny');assert.equal(prompt(m).choices.some(c=>c.id==='draw-destiny'),true);
  m=until(m,x=>prompt(x)?.title==='Satisfy battle losses',p=>p.title==='Battle destiny'?'draw-destiny':defaults(p));
  assert.deepEqual(m.battle.power,{light:4,dark:4});assert.deepEqual(m.battle.attrition,{light:0,dark:0});assert.deepEqual(m.battle.damage,{light:0,dark:0});
  for(const side of [s,o])assert.equal(project(m,side).weaponStudy.hits[side].length,1);
  assert.equal(prompt(m).automatic,false);assert.equal(prompt(m).choices.length,1);assert.equal(prompt(m).choices[0].id,'forfeit:'+activeHit);
  m=full(m);assert.equal(Object.values(m.cards).some(c=>c.zone==='table'&&c.hit),false);assert.equal(m.players[s].lost.length,2);assert.equal(m.players[o].lost.length,2);
 });
 test(scenario+': optional losses may precede a hit; only host forfeit credits numeric debts',()=>{
  let m=armed(scenario),s=m.active,o=other(s);m=fire(m,2);m=until(m,x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side===o,p=>p.title==='Battle destiny'?'draw-destiny':defaults(p));
  assert.equal(prompt(m).side,o);assert.equal(m.battle.attrition[o],3);assert.equal(m.battle.damage[o],2);
  const hit=m.battle.participants[o][0],healthy=m.battle.participants[o][2];assert.ok(first(m,'forfeit:'+healthy));assert.ok(first(m,'lose:reserve'));
  m=step(m,'forfeit:'+hit);assert.equal(m.battle.attrition[o],1);assert.equal(m.battle.damage[o],0);assert.equal(m.stack.at(-1).kind,'lost-order');
  assert.equal(m.stack.at(-1).remaining.length,2);assert.equal(m.cards[hit].zone,'leaving');assert.equal(m.players[o].lost.length,0);
  const q=copy(m);q.stack.pop();assert.throws(()=>assertMatch(q),/preserved/);
  m=until(m,x=>x.complete,p=>p.choices.find(c=>c.id==='forfeit:'+healthy)?.id||defaults(p));assert.equal(m.players[o].lost.length,3);
 });
 test(scenario+': owner chooses all six orders for a host and two attached weapons',()=>{
  let m=armed(scenario,true),s=m.active,o=other(s),host=m.battle.participants[s][0];
  m=step(m,'pass');m=fire(m,2,host);m=until(m,x=>prompt(x)?.title==='Satisfy battle losses',p=>p.title==='Battle destiny'?'skip-destiny':defaults(p));
  m=step(m,'forfeit:'+host);const ids=[...m.stack.at(-1).remaining];assert.equal(ids.length,3);
  for(const a of ids)for(const b of ids.filter(id=>id!==a)){
   let n=step(m,'place-lost:'+a);assert.equal(n.cards[a].zone,'lost');assert.equal(n.stack.at(-1).remaining.length,2);
   n=step(n,'place-lost:'+b);const last=ids.find(id=>id!==a&&id!==b);assert.deepEqual(n.players[s].lost.slice(0,3),[last,b,a]);
   assert.equal(n.stack.some(f=>f.kind==='lost-order'),false);for(const id of ids)assert.equal(n.cards[id].attachedTo,undefined);
  }
  assert.deepEqual(project(m,o).prompt.choices,[]);assert.equal(project(m,o).weaponStudy.lostOrder.remaining.length,3);
 });
 test(scenario+': passes preserve weapons and no shot consumes destiny; exhausted deployment cannot initiate battle',()=>{
  let m=armed(scenario);m=until(m,x=>prompt(x)?.title==='Battle destiny');assert.equal(m.battle.shots.length,0);
  assert.equal(m.players[m.active].reserve[0],createScenario(scenario).players[m.active].reserve[0]);m=full(m);assert.equal(m.battle.shots.length,0);
  m=createScenario(scenario);m=equip(m,1);m=armory(m);while(first(m,'transfer:')){m=step(m,first(m,'transfer:').id);m=armory(m)}
  m=until(m,x=>prompt(x)?.title==='Initiate battle');assert.equal(m.players[m.active].force.length,0);assert.equal(first(m,'battle'),undefined);m=step(m,'stop');assert.equal(m.complete,true);
 });
}

test('native weapon outcomes match all eighteen recorded GEMP branches',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/weapon-oracle-result.json',import.meta.url),'utf8'));
 assert.equal(oracle.failures+oracle.errors,0);assert.equal(oracle.branches.length,18);
 const resolved=m=>until(m,x=>x.battle.shots.at(-1)?.status==='resolved');
 const damage=m=>until(m,x=>prompt(x)?.title==='Satisfy battle losses',p=>p.title==='Battle destiny'?'draw-destiny':defaults(p));
 const lost=(m,s)=>m.players[s].lost.map(id=>m.cards[id].blueprint);
 function transfer(m,cost,index){m=armory(m);return step(m,'transfer:'+weapon(m,m.active,cost).id+':'+m.battle.participants[m.active][index])}
 function forfeit(m,s,index,weaponFirst=false){
  m=until(m,x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side===s);
  const id=m.battle.participants[s][index];m=step(m,'forfeit:'+id);
  if(m.stack.at(-1).kind==='lost-order'){const idToPlace=weaponFirst?m.stack.at(-1).remaining.find(x=>x!==id):id;m=step(m,'place-lost:'+idToPlace)}return m;
 }
 for(const expected of oracle.branches){
  const scenario=expected.name.startsWith('dark')?'weapons':'rebel-weapons';let m=createScenario(scenario);const s=m.active,o=other(s),name=expected.name;
  if(name.endsWith('rifle-equality-miss')||name.endsWith('rifle-once')){
   m=equip(m,2);if(name.endsWith('equality-miss'))m.players[s].reserve.unshift(...m.players[s].reserve.splice(2,1));m=battle(m);m=resolved(fire(m,2));
   if(expected.hit!==undefined){assert.equal(m.battle.shots[0].hit,expected.hit);assert.equal(m.battle.shots[0].destiny,expected.weaponDestiny);assert.equal(m.players[s].force.length,expected.forceAfterFire)}
   else{m=firing(m,s);assert.equal(m.players[s].force.length,expected.force);assert.equal(!!first(m,'fire:'),expected.repeatAvailable)}
  }else if(name.endsWith('basic-equality-miss')){
   m=equip(m,1);m=equip(m,2);assert.equal(m.players[s].force.length,expected.forceAfterDeploy);m=battle(m);assert.equal(m.players[s].force.length,expected.forceAfterBattle);m=resolved(fire(m,1));assert.equal(m.battle.shots[0].hit,expected.hit);assert.equal(m.players[s].force.length,expected.forceAfterFire);assert.equal(m.players[s].used.length,expected.usedAfterFire);
  }else if(name.endsWith('transfer-same-bearer')){
   m=equip(m,1);m=equip(m,2,m.battle.participants[s][0]);for(const index of [1,0])m=transfer(m,1,index);m=transfer(m,2,1);m=transfer(m,1,1);assert.equal(m.players[s].force.length,expected.forceAfterTransfers);
   m=armed(scenario,true);m=fire(m,1);m=firing(m,s);assert.equal(m.players[s].force.length,expected.forceWhenUseLimitChecked);assert.equal(!!first(m,'fire:'),expected.sameBearerDifferentWeaponAvailable);
  }else if(name.endsWith('crossfire-zero-losses')){
   m=armed(scenario);m=fire(m,2,m.battle.participants[o][0]);m=firing(m,o);m=fire(m,1,m.battle.participants[s][0]);m=firing(m,s);m=fire(m,1,m.battle.participants[o][1]);m=firing(m,o);m=fire(m,2,m.battle.participants[s][1]);m=damage(m);
   assert.deepEqual(m.battle.power,{light:expected.powerBoth,dark:expected.powerBoth});assert.deepEqual(m.battle.destiny,{light:expected.battleDestinyBoth,dark:expected.battleDestinyBoth});assert.equal(m.players[s].force.length,expected.activeForce);assert.equal(m.players[o].force.length,expected.opponentForce);
   m=forfeit(m,s,1,true);m=forfeit(m,o,0,false);m=forfeit(m,o,1,true);assert.deepEqual(lost(m,s),expected.activeLost);assert.deepEqual(lost(m,o),expected.opponentLost);
  }else if(name.endsWith('healthy-first')||name.endsWith('hit-first')){
   m=armed(scenario);m=damage(fire(m,2));assert.equal(m.battle.power[s],expected.activePower);assert.equal(m.battle.power[o],expected.opponentPower);assert.equal(m.battle.attrition[o],expected.opponentInitialAttrition);assert.equal(m.battle.damage[o],expected.opponentInitialDamage);
   m=forfeit(m,s,2);const hitFirst=name.endsWith('hit-first');m=forfeit(m,o,hitFirst?0:2);assert.equal(m.battle.attrition[o],expected.afterFirstForfeitAttrition);assert.equal(m.battle.damage[o],expected.afterFirstForfeitDamage);assert.equal(m.players[o].lost.length,expected.afterFirstForfeitLost);
   m=forfeit(m,o,hitFirst?2:0);assert.deepEqual(lost(m,o),expected.finalOpponentLost);
  }else if(name.endsWith('two-attachments-loss-order')){
   m=armed(scenario,true);m=step(m,'pass');m=damage(fire(m,2,m.battle.participants[s][0]));assert.equal(m.battle.attrition[s],expected.initialAttrition);assert.equal(m.battle.damage[s],expected.initialDamage);
   const basic=weapon(m,s,1).id,host=m.battle.participants[s][0];m=step(m,'forfeit:'+host);m=step(m,'place-lost:'+basic);m=step(m,'place-lost:'+host);assert.deepEqual(lost(m,s),expected.lostOrder);assert.equal(m.battle.attrition[s],expected.afterHostForfeitAttrition);assert.equal(m.battle.damage[s],expected.afterHostForfeitDamage);
  }else if(name.endsWith('affordability-and-hit-target')){
   m=equip(m,1);m=equip(m,2);for(const index of [2,0,2])m=transfer(m,1,index);m=battle(m);assert.equal(m.players[s].force.length,expected.forceAtFireChoice);assert.equal(!!first(m,'fire:'+weapon(m,s,1).id+':'),expected.basicAvailable);assert.equal(!!first(m,'fire:'+weapon(m,s,2).id+':'),expected.rifleAvailable);m=resolved(fire(m,1));assert.equal(m.players[s].force.length,expected.forceAfterBasic);
   m=armed(scenario);const target=m.battle.participants[o][0];m=fire(m,2,target);m=firing(m,s);assert.equal(prompt(m).choices.some(c=>c.id==='fire:'+weapon(m,s,1).id+':'+target),expected.alreadyHitTargetLegal);m=resolved(fire(m,1,target));assert.equal(project(m,s).weaponStudy.hits[o].length,1);
  }else assert.fail('Unmapped oracle branch '+name);
 }
});
