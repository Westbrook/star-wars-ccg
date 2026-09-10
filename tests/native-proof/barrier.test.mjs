import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engine} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,assertMatch,project}=engine;
const copy=m=>JSON.parse(JSON.stringify(m));
const other=s=>s==='light'?'dark':'light';
function step(m,id){const p=prompt(m);const n=copy(applyCommand(copy(m),p.side,{prompt:p.id,choice:id}));assertMatch(n);return n}
function until(m,predicate,choose=()=> 'pass'){let n=0;while(!m.complete&&!predicate(m)){assert.ok(n++<160,'bounded continuation');m=step(m,choose(prompt(m),m))}assert.ok(predicate(m),'checkpoint reached');return m}
const choice=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
const resume=m=>until(m,s=>s.stack.at(-1)?.kind==='turn'&&prompt(s).side===s.active);
const phase=(m,stage)=>until(m,s=>s.turn.stage===stage);
function deploy(m,index=0,site=m.locations[0]){m=resume(m);return step(m,'deploy:'+m.players[m.active].hand[index]+':'+site)}
function resolve(m){m=step(m,choice(m,'play:').id);return step(step(m,'pass'),'pass')}
const complete=m=>until(m,s=>s.complete,p=>p.choices.some(c=>c.id==='recirculate')?'recirculate':'pass');

for(const scenario of ['barrier','imperial-barrier']){
 test(scenario+': fixture, legal deployment and hidden opponent hand',()=>{
  let m=createScenario(scenario);const s=m.active,o=other(s),id=m.players[s].hand[0],hidden=m.players[o].hand[0];
  assert.equal(m.engine,'native-proof-3');assert.equal(Object.keys(m.cards).length,120);
  assert.equal(m.players[s].force.length,5);assert.equal(prompt(m).automatic,false);
  assert.equal(prompt(m).choices.filter(c=>c.id.startsWith('deploy:')).length,s==='dark'?4:2);
  assert.equal(project(m,s).turn.deploymentSites[1].allowed,s==='dark');
  assert.equal(JSON.stringify(project(m,s)).includes(hidden),false);
  assert.equal(JSON.stringify(project(m,s)).includes(m.cards[hidden].blueprint),false);
  assert.deepEqual(project(m,o).prompt.choices,[]);
  assert.throws(()=>step(m,'play:'+hidden),/not legal/);
  if(s==='light')assert.throws(()=>step(m,'deploy:'+id+':'+m.locations[1]),/not legal/);
  m=deploy(m);assert.equal(m.cards[id].zone,'table');assert.equal(m.cards[id].location,m.locations[0]);
  assert.equal(m.players[s].force.length,4);assert.equal(m.players[s].used.length,1);assert.equal(project(m,s).playing.length,0);
  assert.equal(prompt(m).side,o);assert.equal(prompt(m).automatic,false);assert.equal(choice(m,'play:').barrierTarget,id);
  assert.deepEqual(project(m,s).prompt.choices,[]);
  assert.throws(()=>applyCommand(m,s,{choice:'play:'+hidden,prompt:prompt(m).id}),/seat/);
 });
 test(scenario+': paid Barrier restores, applies once, keeps presence and uses correct disposition',()=>{
  let m=deploy(createScenario(scenario));const s=m.active,o=other(s),target=m.stack.at(-1).target,card=choice(m,'play:').card,paid=m.players[o].force[0];
  m=step(m,'play:'+card);assert.equal(m.players[o].force.length,0);assert.deepEqual(m.players[o].used,[paid]);
  assert.equal(m.cards[card].zone,'playing');assert.equal(m.turn.restrictions.length,0);assert.equal(project(m,s).playing[0].id,card);
  const restored=copy(m);for(const seat of [s,o])assert.deepEqual(project(m,seat),project(restored,seat));
  m=step(m,'pass');assert.equal(m.turn.restrictions.length,0);m=step(m,'pass');
  assert.deepEqual(m.players[o].used,[card,paid]);assert.equal(m.cards[card].zone,'used');assert.equal(m.cards[target].zone,'table');
  assert.deepEqual(m.turn.restrictions,[{target,source:card,expiresTurn:1}]);
  assert.equal(project(m,s).turn.deploymentSites[0].allowed,true);
  m=resume(m);assert.equal(m.turn.restrictions.length,1);assert.throws(()=>step(m,'play:'+card),/not legal/);
  m=phase(m,'battle');assert.equal(choice(m,'battle:'),undefined);assert.equal(prompt(m).automatic,true);
  m=phase(m,'move');assert.equal(choice(m,'move:'),undefined);assert.equal(prompt(m).automatic,true);
  m=phase(m,'draw');assert.equal(prompt(m).automatic,false);
  m=phase(m,'end');const before=copy(m.players);assert.equal(m.turn.restrictions.length,1);
  m=step(m,'recirculate');assert.equal(m.turn.restrictions.length,1);assert.equal(m.active,s);
  assert.deepEqual(m.players[s].reserve,[...before[s].reserve,...before[s].used]);
  m=step(m,'recirculate');assert.equal(m.turn.restrictions.length,0);assert.equal(m.turn.expired[0].target,target);assert.equal(m.active,o);assert.equal(m.turn.number,2);
  assert.deepEqual(m.players[o].reserve,[...before[o].reserve,...before[o].used]);
  for(const side of [s,o])assert.deepEqual(m.players[side].force,before[side].force);
  assert.equal(prompt(m),null);assert.equal(m.cards[target].zone,'table');
 });
 for(const targetIndex of [0,1])test(scenario+': Barrier target '+(targetIndex+1)+' excluded while another trooper battles and moves',()=>{
  let m=createScenario(scenario);const s=m.active,o=other(s);const ids=[m.players[s].hand[0]];
  m=deploy(m);if(targetIndex===0)m=resolve(m);else m=step(m,'pass');
  m=resume(m);ids.push(m.players[s].hand[0]);m=deploy(m);if(targetIndex===1)m=resolve(m);
  m=phase(m,'battle');const restricted=ids[targetIndex],eligible=ids[1-targetIndex];
  assert.equal(m.turn.restrictions[0].target,restricted);assert.equal(m.players[s].force.length,3);
  m=step(m,choice(m,'battle:').id);assert.equal(m.players[s].force.length,2);
  assert.deepEqual(m.battle.participants[s],[eligible]);assert.equal(m.battle.participants[o].length,1);
  m=until(m,x=>x.battle.resolved);assert.deepEqual(m.battle.power,{light:1,dark:1});assert.deepEqual(m.battle.damage,{light:0,dark:0});assert.deepEqual(m.battle.attrition,{light:0,dark:0});
  assert.equal(m.battle.destiny.light,null);assert.equal(m.battle.destiny.dark,null);
  m=resume(m);assert.equal(choice(m,'battle:'),undefined);
  m=phase(m,'move');assert.equal(choice(m,'move:').card,eligible);assert.equal(prompt(m).choices.filter(c=>c.id.startsWith('move:')).length,1);
  assert.throws(()=>step(m,'move:'+restricted+':'+m.locations[1]),/not legal/);
  m=step(m,choice(m,'move:').id);m=resume(m);assert.equal(m.players[s].force.length,1);assert.equal(m.cards[eligible].location,m.locations[1]);
  assert.equal(choice(m,'move:'),undefined);assert.equal(m.cards[restricted].location,m.locations[0]);
  m=phase(m,'draw');const draw=m.players[s].force[0];m=step(m,'draw');assert.equal(m.cards[draw].zone,'hand');assert.equal(m.players[s].force.length,0);
  m=complete(m);assert.equal(m.turn.expired.length,1);assert.equal(m.cards[restricted].zone,'table');
 });
 for(const loss of ['force','forfeit'])test(scenario+': passing Barrier allows 2 vs 1 battle; '+loss+' pays the one damage',()=>{
  let m=createScenario(scenario);const s=m.active,o=other(s),barrier=m.players[o].hand[0];
  m=step(deploy(m),'pass');m=deploy(m);assert.ok(choice(m,'play:'));m=step(m,'pass');m=phase(m,'battle');m=step(m,choice(m,'battle:').id);
  m=until(m,x=>prompt(x)?.title==='Satisfy battle losses');assert.equal(prompt(m).side,o);assert.equal(m.battle.power[s],2);assert.equal(m.battle.power[o],1);assert.equal(m.battle.damage[o],1);assert.equal(m.battle.attrition[o],0);
  assert.equal(prompt(m).choices.some(c=>c.id==='lose:hand:'+barrier),true);
  m=step(m,loss==='force'?'lose:reserve':choice(m,'forfeit:').id);m=until(m,x=>x.battle.resolved);
  assert.equal(m.battle.damage[o],0);assert.equal(m.cards[barrier].zone,'hand');assert.equal(m.players[o].force.length,1);
  m=complete(m);assert.equal(m.turn.expired.length,0);
 });
 test(scenario+': insufficient Force and closed deployment timing reject Barrier',()=>{
  let m=createScenario(scenario),s=m.active,o=other(s);const card=m.players[o].hand[0];
  const paid=m.players[o].force.shift();m.players[o].reserve.push(paid);m.cards[paid].zone='reserve';assertMatch(m);
  m=deploy(m);assert.equal(choice(m,'play:'),undefined);assert.equal(prompt(m).automatic,true);assert.throws(()=>step(m,'play:'+card),/not legal/);
  m=phase(m,'move');assert.throws(()=>step(m,'play:'+card),/not legal/);
  const moved=choice(m,'move:').card;m=step(m,choice(m,'move:').id);assert.equal(choice(m,'play:'),undefined);m=resume(m);assert.equal(choice(m,'move:'+moved),undefined);
  m=phase(m,'draw');while(choice(m,'draw')){m=step(m,'draw');m=resume(m)}
  assert.equal(m.players[s].force.length,0);assert.equal(prompt(m).automatic,true);m=complete(m);
 });
 test(scenario+': skip all optional actions preserves hand and Force; invalid pending state rejected',()=>{
  let m=createScenario(scenario),initial=copy(m.players);m=complete(m);
  for(const s of ['light','dark'])assert.deepEqual(m.players[s],initial[s]);
  m=deploy(createScenario(scenario));m=step(m,choice(m,'play:').id);m.stack=m.stack.filter(f=>f.kind!=='interrupt');assert.throws(()=>assertMatch(m),/preserved/);
 });
}

test('native Barrier outcomes match all fifteen recorded GEMP oracle branches',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/barrier-oracle-result.json',import.meta.url),'utf8'));
 assert.equal(oracle.failures+oracle.errors,0);assert.equal(oracle.branches.length,15);
 for(const branch of oracle.branches){
  let m=createScenario(branch.active==='dark'?'barrier':'imperial-barrier');const s=m.active,o=other(s),card=m.players[o].hand[0];
  const target=m.players[s].hand[0];
  if(branch.name.includes('insufficient')){const id=m.players[o].force.shift();m.players[o].reserve.push(id);m.cards[id].zone='reserve'}
  m=deploy(m,0,branch.destination?m.locations.find(id=>m.cards[id].blueprint===branch.destination):m.locations[0]);
  if(branch.forceAfterDeploy!==undefined)assert.equal(m.players[s].force.length,branch.forceAfterDeploy,branch.name);
  if(branch.barrierAvailable!==undefined)assert.equal(!!choice(m,'play:'),branch.barrierAvailable,branch.name);
  if(branch.name.includes('barrier-sole')||branch.barredTrooper===1||branch.barrierPlayed)m=resolve(m);else m=step(m,'pass');
  if(branch.forceAfterTwoDeploys!==undefined){m=deploy(m);if(branch.barredTrooper===2)m=resolve(m);else m=step(m,'pass');assert.equal(m.players[s].force.length,branch.forceAfterTwoDeploys)}
  m=phase(m,'battle');if(branch.canInitiateBattle!==undefined)assert.equal(!!choice(m,'battle:'),branch.canInitiateBattle);
  if(branch.participants){
   m=step(m,choice(m,'battle:').id);assert.equal(m.players[s].force.length,branch.forceAfterBattle);
   assert.equal(m.battle.participants[s].length,branch.participants.active);assert.equal(m.battle.participants[o].length,branch.participants.opponent);
   m=until(m,x=>!!project(x,s).losses);
   const normalize=v=>v.active!==undefined?{[s]:v.active,[o]:v.opponent}:v;
   for(const field of ['power','attrition','damage'])assert.deepEqual(m.battle[field],normalize(branch[field]),branch.name+' '+field);
   assert.deepEqual(Object.fromEntries(['light','dark'].map(side=>[side,m.battle.destiny[side]??0])),branch.destiny);
   if(branch.payment){m=until(m,x=>prompt(x)?.title==='Satisfy battle losses');m=step(m,branch.payment==='reserve'?'lose:reserve':choice(m,'forfeit:').id)}
   m=until(m,x=>!!x.battle.resolved);
   if(branch.afterPayment){assert.equal(m.players[o].lost.length,branch.afterPayment.opponentLost);assert.equal(m.cards[card].zone,branch.afterPayment.barrierZone);assert.equal(m.players[o].force.length,branch.afterPayment.opponentForce)}
  }
  m=phase(m,'move');
  if(branch.canMove!==undefined)assert.equal(!!choice(m,'move:'),branch.canMove);
  if(branch.canMoveTarget!==undefined)assert.equal(prompt(m).choices.some(c=>c.id.startsWith('move:'+target+':')),branch.canMoveTarget);
  const movement=branch.move||branch.unbarredTrooperMove;
  if(movement){const moving=choice(m,'move:').card;m=step(m,choice(m,'move:').id);m=resume(m);assert.equal(m.players[s].force.length,movement.forceAfter);assert.equal(m.cards[m.cards[moving].location].blueprint,movement.to);assert.equal(!!choice(m,'move:'+moving+':'),movement.repeatRegularMove)}
  if(branch.afterRecirculation){m=complete(m);assert.equal(m.players[s].force.length,branch.afterRecirculation.activeForce);assert.equal(m.players[o].force.length,branch.afterRecirculation.opponentForce);assert.equal(m.cards[card].zone,branch.afterRecirculation.barrierZone);assert.equal(m.turn.restrictions.some(r=>r.target===target),branch.afterRecirculation.targetRestricted)}
 }
});
