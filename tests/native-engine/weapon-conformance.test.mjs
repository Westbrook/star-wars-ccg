import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,engine as proof} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
const other=s=>s==='dark'?'light':'dark';
const event=m=>m.stack.at(-1)?.event?.kind;
function createScenario(scenario){
 // Copy only the original oracle's physical input board/piles, never its rule
 // implementation, decisions or expected battle calculations.
 const fixture=proof.createScenario(scenario);
 const m=runtime.createMatch('gemp-weapon-comparison',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),rules);
 m.cards=clone(fixture.cards);m.players=clone(fixture.players);m.locations=[...fixture.locations];m.status='playing';m.turn.side=fixture.active;m.turn.phase='deploy';m.serial=1;
 m.stack=[{kind:'window',serial:1,timing:'phase',priority:fixture.active,passes:0,completed:[]}];return m;
}
const participants=(m,s)=>combat.battle(m)?.participants[s]??board.atSite(m,m.locations[0]).filter(c=>c.owner===s).map(c=>c.id);
function prompt(m){const p=runtime.prompt(m,rules,'dark');if(!p)return null;const real=runtime.prompt(m,rules,p.side);return {...real,title:m.stack.at(-1)?.handler==='battle:destiny'?'Battle destiny':event(m)==='battle-damage'?'Satisfy battle losses':'Other'}}
function command(m,id){const p=prompt(m),before=clone(m),next=runtime.applyCommand(clone(m),rules,p.side,{revision:m.revision,choice:id});assert.deepEqual(m,before);state.assertState(next);return next}
function step(m,id){m=command(m,id);for(let i=0;i<100;i++){const f=m.stack.at(-1);if(f.kind==='decision'||f.timing==='phase'||['battle-weapons','battle-damage'].includes(event(m)))return m;m=command(m,'pass')}throw Error('Unsettled')}
const first=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
const defaults=p=>p.choices.find(c=>c.id==='pass')?.id||p.choices[0].id;
function until(m,done,choose=defaults){for(let n=0;n<300;n++){if(done(m))return m;m=step(m,choose(prompt(m),m))}throw Error('Comparison boundary missing')}
const armory=m=>until(m,x=>x.stack.at(-1)?.timing==='phase'&&prompt(x).side===x.turn.side);
const firing=(m,side)=>until(m,x=>event(x)==='battle-weapons'&&prompt(x).side===side);
const weapon=(m,side,cost)=>Object.values(m.cards).find(c=>c.owner===side&&combat.weapons[c.blueprint]?.fire===cost&&['hand','table'].includes(c.zone));
function equip(m,cost,user=participants(m,m.turn.side)[cost-1]){m=armory(m);return step(m,'equip:'+weapon(m,m.turn.side,cost).id+':'+user)}
function begin(m){m=until(m,x=>x.turn.phase==='battle'&&x.stack.length===1&&prompt(x).side===x.turn.side);m=step(m,'battle:'+m.locations[0]);return firing(m,m.turn.side)}
function armed(scenario,same=false){let m=createScenario(scenario),user=participants(m,m.turn.side)[0];m=equip(m,1,user);m=equip(m,2,same?user:undefined);return begin(m)}
function fire(m,cost,target){const side=prompt(m).side;return step(m,'fire:'+weapon(m,side,cost).id+':'+(target||participants(m,other(side))[0]))}

test('continuous battle engine matches all eighteen recorded GEMP weapon branches',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('../native-proof/gemp/weapon-oracle-result.json',import.meta.url),'utf8'));
 assert.equal(oracle.failures+oracle.errors,0);assert.equal(oracle.branches.length,18);
 const resolved=m=>until(m,x=>combat.battle(x).shots.at(-1)?.hit!==null && event(x)==='battle-weapons');
 const damage=m=>until(m,x=>prompt(x)?.title==='Satisfy battle losses',p=>p.title==='Battle destiny'?'draw-destiny':defaults(p));
 const lost=(m,s)=>m.players[s].lost.map(id=>m.cards[id].blueprint);
 function transfer(m,cost,index){m=armory(m);return step(m,'transfer:'+weapon(m,m.turn.side,cost).id+':'+participants(m,m.turn.side)[index])}
 function forfeit(m,s,index,weaponFirst=false){
  m=until(m,x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side===s);
  const id=participants(m,s)[index];m=step(m,'forfeit:'+id);
  if(m.stack.at(-1).handler==='table:lost-order'){const idToPlace=weaponFirst?m.stack.at(-1).payload.remaining.find(x=>x!==id):id;m=step(m,'place-lost:'+idToPlace)}return m;
 }
 for(const expected of oracle.branches){
  const scenario=expected.name.startsWith('dark')?'weapons':'rebel-weapons';let m=createScenario(scenario);const s=m.turn.side,o=other(s),name=expected.name;
  if(name.endsWith('rifle-equality-miss')||name.endsWith('rifle-once')){
   m=equip(m,2);if(name.endsWith('equality-miss'))m.players[s].reserve.unshift(...m.players[s].reserve.splice(2,1));m=begin(m);m=resolved(fire(m,2));
   if(expected.hit!==undefined){assert.equal(combat.battle(m).shots[0].hit,expected.hit);assert.equal(combat.battle(m).shots[0].destiny,expected.weaponDestiny);assert.equal(m.players[s].force.length,expected.forceAfterFire)}
   else{m=firing(m,s);assert.equal(m.players[s].force.length,expected.force);assert.equal(!!first(m,'fire:'),expected.repeatAvailable)}
  }else if(name.endsWith('basic-equality-miss')){
   m=equip(m,1);m=equip(m,2);assert.equal(m.players[s].force.length,expected.forceAfterDeploy);m=begin(m);assert.equal(m.players[s].force.length,expected.forceAfterBattle);m=resolved(fire(m,1));assert.equal(combat.battle(m).shots[0].hit,expected.hit);assert.equal(m.players[s].force.length,expected.forceAfterFire);assert.equal(m.players[s].used.length,expected.usedAfterFire);
  }else if(name.endsWith('transfer-same-bearer')){
   m=equip(m,1);m=equip(m,2,participants(m,s)[0]);for(const index of [1,0])m=transfer(m,1,index);m=transfer(m,2,1);m=transfer(m,1,1);assert.equal(m.players[s].force.length,expected.forceAfterTransfers);
   m=armed(scenario,true);m=fire(m,1);m=firing(m,s);assert.equal(m.players[s].force.length,expected.forceWhenUseLimitChecked);assert.equal(!!first(m,'fire:'),expected.sameBearerDifferentWeaponAvailable);
  }else if(name.endsWith('crossfire-zero-losses')){
   m=armed(scenario);m=fire(m,2,participants(m,o)[0]);m=firing(m,o);m=fire(m,1,participants(m,s)[0]);m=firing(m,s);m=fire(m,1,participants(m,o)[1]);m=firing(m,o);m=fire(m,2,participants(m,s)[1]);m=damage(m);
   assert.deepEqual(combat.battle(m).power,{light:expected.powerBoth,dark:expected.powerBoth});assert.deepEqual(combat.battle(m).destiny,{light:expected.battleDestinyBoth,dark:expected.battleDestinyBoth});assert.equal(m.players[s].force.length,expected.activeForce);assert.equal(m.players[o].force.length,expected.opponentForce);
   m=forfeit(m,s,1,true);m=forfeit(m,o,0,false);m=forfeit(m,o,1,true);assert.deepEqual(lost(m,s),expected.activeLost);assert.deepEqual(lost(m,o),expected.opponentLost);
  }else if(name.endsWith('healthy-first')||name.endsWith('hit-first')){
   m=armed(scenario);m=damage(fire(m,2));assert.equal(combat.battle(m).power[s],expected.activePower);assert.equal(combat.battle(m).power[o],expected.opponentPower);assert.equal(combat.battle(m).attrition[o],expected.opponentInitialAttrition);assert.equal(combat.battle(m).damage[o],expected.opponentInitialDamage);
   m=forfeit(m,s,2);const hitFirst=name.endsWith('hit-first');m=forfeit(m,o,hitFirst?0:2);assert.equal(combat.battle(m).attrition[o],expected.afterFirstForfeitAttrition);assert.equal(combat.battle(m).damage[o],expected.afterFirstForfeitDamage);assert.equal(m.players[o].lost.length,expected.afterFirstForfeitLost);
   m=forfeit(m,o,hitFirst?2:0);assert.deepEqual(lost(m,o),expected.finalOpponentLost);
  }else if(name.endsWith('two-attachments-loss-order')){
   m=armed(scenario,true);m=step(m,'pass');m=damage(fire(m,2,participants(m,s)[0]));assert.equal(combat.battle(m).attrition[s],expected.initialAttrition);assert.equal(combat.battle(m).damage[s],expected.initialDamage);
   const basic=weapon(m,s,1).id,host=participants(m,s)[0];m=step(m,'forfeit:'+host);m=step(m,'place-lost:'+basic);m=step(m,'place-lost:'+host);assert.deepEqual(lost(m,s),expected.lostOrder);assert.equal(combat.battle(m).attrition[s],expected.afterHostForfeitAttrition);assert.equal(combat.battle(m).damage[s],expected.afterHostForfeitDamage);
  }else if(name.endsWith('affordability-and-hit-target')){
   m=equip(m,1);m=equip(m,2);for(const index of [2,0,2])m=transfer(m,1,index);m=begin(m);assert.equal(m.players[s].force.length,expected.forceAtFireChoice);assert.equal(!!first(m,'fire:'+weapon(m,s,1).id+':'),expected.basicAvailable);assert.equal(!!first(m,'fire:'+weapon(m,s,2).id+':'),expected.rifleAvailable);m=resolved(fire(m,1));assert.equal(m.players[s].force.length,expected.forceAfterBasic);
   m=armed(scenario);const target=participants(m,o)[0];m=fire(m,2,target);m=firing(m,s);assert.equal(prompt(m).choices.some(c=>c.id==='fire:'+weapon(m,s,1).id+':'+target),expected.alreadyHitTargetLegal);m=resolved(fire(m,1,target));assert.equal(combat.battle(m).hits.filter(id=>m.cards[id].owner===o).length,1);
  }else assert.fail('Unmapped oracle branch '+name);
 }
});
