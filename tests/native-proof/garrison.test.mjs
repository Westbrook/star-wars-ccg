import test from 'node:test';
import assert from 'node:assert/strict';
import {engine,load} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,project,assertMatch}=engine;
const rules=load(new URL('../../lib/native-proof/character-rules.ts',import.meta.url));
const clone=m=>JSON.parse(JSON.stringify(m));
const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
function step(m,id){const p=prompt(m),n=applyCommand(clone(m),p.side,{prompt:p.id,choice:id});assertMatch(n);for(const side of ['light','dark']){assert.deepEqual(project(n,side),project(clone(n),side));assert.deepEqual(project(n,side).players[side==='light'?'dark':'light'].hand,[])}return n}
const fallback=m=>pick(m,'pass')?.id||pick(m,'recirculate')?.id||pick(m,'lose:reserve')?.id||prompt(m).choices[0].id;
function until(m,done,select=fallback){for(let i=0;i<350;i++){if(done(m))return m;assert.equal(m.complete,false);m=step(m,select(m))}throw Error('Exceeded continuation bound')}
const ready=(m,stage='deploy')=>until(m,x=>x.turn?.stage===stage&&x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
const card=(m,b)=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone==='hand');
function deploy(m,b,site=m.locations[0]){m=ready(m);return step(m,'deploy:'+card(m,b).id+':'+site)}
const finish=m=>until(m,x=>x.complete);
for(const scenario of ['guard-post','rebel-post']){
 const active=scenario==='guard-post'?'dark':'light',opponent=active==='dark'?'light':'dark',guard=active==='dark'?'1_181':'1_26';
 test(scenario+': guard costs 2, has presence at power 0, attacks without defensive bonus and cannot move',()=>{
  let m=createScenario(scenario);assert.equal(m.engine,'native-proof-8');const id=card(m,guard).id;
  m=ready(deploy(m,guard));assert.equal(m.players[active].force.length,4);assert.equal(project(m,active).table.find(c=>c.id===id).rulesView.power,0);
  m=ready(m,'battle');assert.ok(pick(m,'battle:'));m=step(m,'battle:'+m.locations[0]);assert.deepEqual(m.battle.power,{[active]:0,[opponent]:4});
  assert.equal(project(m,active).table.find(c=>c.id===id).rulesView.power,0);assert.equal(project(m,active).table.find(c=>c.side===opponent&&c.type==='Character').rulesView.power,4);
  m=until(m,x=>!!project(x,active).losses);assert.equal(m.battle.damage[active],4);assert.equal(m.battle.attrition[active],0);
  // Lose Force instead of forfeiting to demonstrate the immobile surviving guard.
  m=ready(m,'move');assert.equal(pick(m,'move:'+id),undefined);assert.equal(project(m,active).table.find(c=>c.id===id).rulesView.power,0);
  m=finish(m);assert.equal(m.cards[id].zone,'table');assert.equal(project(m,active).table.find(c=>c.id===id).rulesView.canMove,false);
 });
 test(scenario+': paid Barrier accepts a guard, expires, but printed immobility persists',()=>{
  let m=createScenario(scenario),id=card(m,guard).id;m=deploy(m,guard);assert.ok(pick(m,'play:'));m=step(m,pick(m,'play:').id);assert.equal(m.turn.restrictions.length,0);assert.equal(m.players[opponent].force.length,0);
  m=ready(m,'battle');assert.equal(m.turn.restrictions[0].target,id);assert.equal(pick(m,'battle:'),undefined);m=finish(m);
  assert.equal(m.turn.restrictions.length,0);assert.equal(m.turn.expired[0].target,id);assert.equal(project(m,active).table.find(c=>c.id===id).rulesView.canMove,false);
 });
 test(scenario+': forfeit uses guard printed 1 and keeps remaining damage visible',()=>{
  let m=ready(deploy(createScenario(scenario),guard),'battle');m=step(m,'battle:'+m.locations[0]);m=until(m,x=>!!pick(x,'forfeit:'));
  const c=pick(m,'forfeit:');assert.equal(c.lossPreview.value,1);assert.equal(c.lossPreview.damage,3);m=step(m,c.id);assert.equal(m.battle.damage[active],3);m=finish(m);assert.equal(m.complete,true);
 });
}
test('Death Star Trooper pays 2, battles for 2 and forfeits for 3; normal movement remains available',()=>{
 let m=createScenario('guard-post'),id=card(m,'1_170').id;m=ready(deploy(m,'1_170'));assert.equal(m.players.dark.force.length,4);
 m=ready(m,'battle');m=step(m,'battle:'+m.locations[0]);assert.deepEqual(m.battle.power,{light:4,dark:2});m=until(m,x=>!!pick(x,'forfeit:'));assert.equal(pick(m,'forfeit:').lossPreview.value,3);
 m=ready(m,'move');assert.ok(pick(m,'move:'+id+':'+m.locations[1]));m=step(m,'move:'+id+':'+m.locations[1]);assert.equal(m.players.dark.force.length,2);m=ready(m,'move');assert.equal(pick(m,'move:'+id),undefined);m=finish(m);
 assert.equal(m.cards[id].location,m.locations[1]);
});
test('Death Star location restriction and away-site power modifier are explicit; guards have no Warrior icon',()=>{
 let m=createScenario('guard-post');const id=card(m,'1_170').id;assert.equal(rules.characterCanDeploy(m,'1_170',m.locations[0]),true);
 // Pure handler diagnostic on another catalog site; this board is not admitted as a playable study.
 m.cards[m.locations[0]].blueprint='1_129';m.cards[id].location=m.locations[0];assert.equal(rules.characterCanDeploy(m,'1_170',m.locations[0]),false);assert.equal(rules.characterPower(m,id,'dark'),1);
 const {definition}=load(new URL('../../lib/native-proof/catalog.ts',import.meta.url));for(const b of ['1_26','1_181'])assert.equal(definition(b).icons.includes('Warrior'),false);
});
test('new garrison guards reject corrupt board, unsupported hand and moved guard',()=>{
 const m=createScenario('guard-post');let n=clone(m);n.cards[n.locations[0]].blueprint='1_129';assert.throws(()=>assertMatch(n),/garrison board/);
 n=clone(m);n.turn.moved.push(card(n,'1_181').id);assert.throws(()=>assertMatch(n),/action history/);
});
function weapons(rifle=false){let m=createScenario('corridor-crossfire');const w=card(m,rifle?'1_312':'1_317'),host=Object.values(m.cards).find(c=>c.blueprint==='1_194'&&c.zone==='table');m=step(m,'equip:'+w.id+':'+host.id);m=until(m,x=>!!pick(x,'battle'));m=step(m,'battle');return until(m,x=>!!pick(x,'fire:'))}
for(const rifle of [false,true])test('Corridor '+(rifle?'Rifle':'Blaster')+': additive Dark bonus, raw destiny, paid and revealed recovery',()=>{
 let m=weapons(rifle);const shot=pick(m,'fire:');assert.equal(shot.weaponPreview.bonus,rifle?2:1);m=step(m,shot.id);assert.equal(m.battle.shots[0].status,'pending');m=until(m,x=>x.battle.shots[0].status==='drawn');assert.equal(m.battle.shots[0].destiny,1);assert.equal(m.cards[m.battle.shots[0].target].hit,undefined);
 m=until(m,x=>x.battle.shots[0].status==='resolved');assert.equal(m.battle.shots[0].hit,true);assert.equal(m.battle.shots[0].bonus,rifle?2:1);
 m=until(m,x=>prompt(x).side==='light'&&!!pick(x,'fire:'));const light=pick(m,'fire:');assert.equal(light.weaponPreview.bonus,0);m=step(m,light.id);m=until(m,x=>x.battle.shots.length===2&&x.battle.shots[1].status==='resolved');assert.equal(m.battle.shots[1].hit,false);m=finish(m);
 assert.equal(m.complete,true);assert.equal(m.battle.shots[0].destiny,1);
});
test('300 seeded routes cover batch choices with reconstruction after every command',()=>{
 let seed=7717;const counts={deploy:0,battle:0,move:0,play:0,fire:0,forfeit:0,transfer:0};
 for(const scenario of ['guard-post','rebel-post','corridor-crossfire'])for(let route=0;route<100;route++){
  let m=createScenario(scenario);m=until(m,x=>x.complete,x=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const choices=prompt(x).choices,c=choices[seed%choices.length];const key=c.id.split(':')[0];if(key in counts)counts[key]++;return c.id});assert.equal(m.complete,true);
 }
 for(const n of Object.values(counts))assert.ok(n>0);console.log('Garrison batch seeded actions:',counts);
});

test('native batch matches eight retained outcomes from five executed GEMP tests',()=>{
 const g=load(new URL('./gemp/garrison-oracle-result.json',import.meta.url)).branches;
 const w=load(new URL('./gemp/corridor-oracle-result.json',import.meta.url)).branches;
 for(const scenario of ['guard-post','rebel-post']){
  const b=g.find(x=>x.name===scenario);let m=createScenario(scenario),side=m.active,other=side==='dark'?'light':'dark',guard=side==='dark'?'1_181':'1_26';
  m=ready(deploy(m,guard));assert.equal(m.players[side].force.length,b.forceAfterDeploy);m=ready(m,'battle');m=step(m,'battle:'+m.locations[0]);m=until(m,x=>!!pick(x,'forfeit:'));
  assert.equal(m.players[side].force.length,b.forceAfterBattle);assert.equal(m.battle.power[side],b.attackingPower);assert.equal(m.battle.power[other],b.defendingPower);assert.equal(m.battle.damage[side],b.damage);m=step(m,pick(m,'forfeit:').id);assert.equal(m.battle.damage[side],b.afterGuardForfeitDamage);
  m=createScenario(scenario);const id=card(m,guard).id;m=deploy(m,guard);m=step(m,pick(m,'play:').id);m=finish(m);const e=g.find(x=>x.name===(side==='dark'?'imperial':'rebel')+'-barrier-expired');assert.equal(!m.turn.restrictions.length,e.barrierExpired);assert.equal(project(m,side).table.find(c=>c.id===id).rulesView.canMove,e.guardMayMove);assert.equal(m.players[side].force.length,e.force);
 }
 const d=g.find(x=>x.name==='death-star-trooper');let m=createScenario('guard-post'),id=card(m,'1_170').id;m=ready(deploy(m,'1_170'));assert.equal(6-m.players.dark.force.length,d.deployCost);assert.equal(rules.characterPower(m,id,'dark'),d.powerOnDeathStar);
 m=ready(m,'battle');m=step(m,'battle:'+m.locations[0]);m=until(m,x=>!!pick(x,'forfeit:'));assert.equal(m.battle.damage.dark,d.damageAgainstGuard);assert.equal(pick(m,'forfeit:').lossPreview.value,d.forfeit);m=ready(m,'move');const before=m.players.dark.force.length;m=step(m,'move:'+id+':'+m.locations[1]);assert.equal(before-m.players.dark.force.length,d.regularMoveCost);m.cards[m.locations[1]].blueprint='1_129';assert.equal(rules.characterPower(m,id),d.powerElsewhere);
 for(const rifle of [false,true]){
  m=weapons(rifle);m=step(m,pick(m,'fire:').id);m=until(m,x=>prompt(x).side==='light'&&!!pick(x,'fire:'));m=step(m,pick(m,'fire:').id);m=until(m,x=>x.battle.shots[1].status==='resolved');const b=w.find(x=>x.name==='corridor-'+(rifle?'rifle':'basic'));
  for(const side of ['light','dark']){assert.equal(m.players[side].force.length,b[side+'Force']);assert.equal(m.players[side].used.length,b[side+'Used']);const shot=m.battle.shots.find(x=>x.side!==side);assert.equal(!!m.cards[shot.target].hit,b[side+'Hit'])}assert.equal(m.battle.shots[0].destiny,b.printedDestiny);
 }
 m=weapons(true);const p=m.players.dark.reserve,zero=p.findIndex(id=>m.cards[id].blueprint==='1_291');p.unshift(...p.splice(zero,1));m=step(m,pick(m,'fire:').id);m=until(m,x=>x.battle.shots[0].status==='resolved');const z=w.find(x=>x.name==='corridor-rifle-zero');assert.equal(m.battle.shots[0].destiny,z.destiny);assert.equal(m.battle.shots[0].bonus,z.modifier);assert.equal(m.battle.shots[0].hit,z.hit);
});

test('Corridor saves reject a changed board or a changed paid modifier',()=>{
 let m=weapons();m=step(m,pick(m,'fire:').id);const n=clone(m);n.battle.shots[0].bonus=0;assert.throws(()=>assertMatch(n),/Corridor modifier/);m.cards[m.locations[0]].blueprint='1_124';assert.throws(()=>assertMatch(m),/Corridor board/);
});
