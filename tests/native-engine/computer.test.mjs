import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
function view(choices,mandatory=false){return {id:'policy-test',revision:1,status:'playing',turn:{side:'dark'},table:[],players:{dark:{hand:[],lost:[],destiny:[],lifeForce:10},light:{hand:[],lost:[],destiny:[],lifeForce:10}},prompt:{side:'dark',timing:'phase',mandatory,choices:choices.map(id=>({id,label:id}))}}}
test('computer refuses another seat, finished games and concession-only prompts',()=>{
 const v=view(['pass']);assert.equal(chooseComputerAction(v,'light'),null);assert.equal(chooseComputerAction({...v,status:'finished'},'dark'),null);assert.equal(chooseComputerAction(view(['concede']),'dark'),null);
});
test('computer preserves final Life Force, caps hand growth and passes unknown optional actions',()=>{
 const v=view(['core:draw','pass']);assert.equal(chooseComputerAction(v,'dark'),'core:draw');v.players.dark.lifeForce=1;assert.equal(chooseComputerAction(v,'dark'),'pass');assert.equal(chooseComputerAction(view(['unknown:action','pass']),'dark'),'pass');assert.equal(chooseComputerAction(view(['unknown:action'],true),'dark'),'unknown:action');
});
test('party selection confirms rather than repeatedly toggling and never voluntarily skips destiny',()=>{
 assert.equal(chooseComputerAction(view(['toggle:a','confirm','cancel'],true),'dark'),'confirm');assert.equal(chooseComputerAction(view(['skip-destiny','draw-destiny'],true),'dark'),'draw-destiny');
});
for(const [size,seed] of [[40,1],[40,8],[60,1],[60,8]])test(`projected CPU self-play finishes ${size} cards seed ${seed} without privileged state`,()=>{
 let m=runtime.createMatch('cpu-match-'+size+'-'+seed,size,starterDecks(size),auditRules);const entropy=seeded(seed);let now=1_800_000_000_000;
 for(let i=0;i<18000&&m.status!=='finished';i++){
  now+=1000;m=runtime.advanceTime(m,auditRules,now,entropy);
  if(m.status==='finished')break;
  let v=runtime.project(m,auditRules,'dark',now),side='dark';if(!v.prompt?.choices.length){side='light';v=runtime.project(m,auditRules,side,now)}
  const before=clone(v),choice=chooseComputerAction(v,side);assert.ok(choice,`missing decision at ${m.turn.number}`);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');assert.deepEqual(v,before);
  assert.equal(chooseComputerAction(clone(v),side),choice);
  m=runtime.applyCommand(clone(m),auditRules,side,{revision:m.revision,choice},entropy,now);
 }
 assert.equal(m.status,'finished',`budget exhausted at turn ${m.turn.number}`);assert.equal(m.result.reason,'life-force');
});

const character=(id,blueprint,owner='dark')=>({id,blueprint,owner,zone:'table',location:'site'});
function combatView(choices,{damage=0,attrition=0,hits=[]}={}){
 const v=view(choices);v.table=[character('trooper','1_194'),character('vader','101_5')];
 v.rules={battle:{stage:'damage',hits,damage:{dark:damage,light:0},attrition:{dark:attrition,light:0}},values:{characters:{trooper:{power:1,ability:1,forfeit:2},vader:{power:6,ability:6,forfeit:7}},sites:{}}};return v;
}
test('computer uses modified public attack and defense totals instead of printed estimates',()=>{
 const v=view(['battle:site','pass']);v.table=[character('a','1_194'),character('b','1_28','light')];
 v.rules={values:{characters:{},sites:{site:{dark:{power:8},light:{power:2,defendingPower:9}}}}};assert.equal(chooseComputerAction(v,'dark'),'pass');
 v.rules.values.sites.site.dark.power=10;assert.equal(chooseComputerAction(v,'dark'),'battle:site');
});
test('computer satisfies hit losses before spending cards on damage already covered',()=>{
 const v=combatView(['forfeit:trooper','forfeit:vader','battle-reduce:i:1','battle-reduce:i:2','battle-lose:used'],{damage:2,hits:['trooper']});assert.equal(chooseComputerAction(v,'dark'),'forfeit:trooper');
});
test('computer chooses enough reduction for uncovered damage without overpaying',()=>{
 const v=combatView(['forfeit:trooper','battle-reduce:i:1','battle-reduce:i:2','battle-reduce:i:3','battle-reduce:i:4','battle-lose:used'],{damage:3});assert.equal(chooseComputerAction(v,'dark'),'battle-reduce:i:3');
 v.rules.battle.attrition.dark=2;assert.equal(chooseComputerAction(v,'dark'),'battle-reduce:i:1');
 v.rules.battle.attrition.dark=3;assert.equal(chooseComputerAction(v,'dark'),'forfeit:trooper');
 v.rules.battle.attritionProtected=[{id:'trooper'}];assert.equal(chooseComputerAction(v,'dark'),'battle-reduce:i:3');
});
test('computer values current forfeiture credit and avoids sacrificing a valuable character for one Force',()=>{
 const v=combatView(['forfeit:trooper','forfeit:vader','battle-lose:used'],{damage:4,attrition:4});v.rules.values.characters.trooper.forfeit=5;assert.equal(chooseComputerAction(v,'dark'),'forfeit:trooper');
 v.prompt.choices=v.prompt.choices.filter(c=>c.id!=='forfeit:trooper');v.rules.battle.damage.dark=1;v.rules.battle.attrition.dark=0;assert.equal(chooseComputerAction(v,'dark'),'battle-lose:used');
});
test('computer rescues a more valuable hit character and orders mine victims by retained value',()=>{
 const v=combatView(['rescue:trooper:vader','forfeit:vader'],{hits:['vader']});assert.equal(chooseComputerAction(v,'dark'),'rescue:trooper:vader');
 v.prompt.choices=['lose-mine:vader','lose-mine:trooper'].map(id=>({id,label:id}));assert.equal(chooseComputerAction(v,'dark'),'lose-mine:trooper');
});
test('computer uses offered recovery actions only when they have a useful public result',()=>{
 const v=view(['revival:kintan:i','pass']);assert.equal(chooseComputerAction(v,'dark'),'pass');
 v.players.dark.lost=[{id:'t',blueprint:'1_194',owner:'dark',zone:'lost'}];assert.equal(chooseComputerAction(v,'dark'),'revival:kintan:i');
 v.prompt.choices=[{id:'revival:old-ben:i:t',label:'Revive'},{id:'pass',label:'Pass'}];assert.equal(chooseComputerAction(v,'dark'),'revival:old-ben:i:t');
});

test('public values contain current modifiers for visible characters and reveal no hidden cards',()=>{
 const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
 const rules={...auditRules,starting:undefined,setupComplete:()=>true};
 let m=runtime.createMatch('public-values',60,starterDecks(60),rules);
 const pull=(side,bp,zone)=>{const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c);state.moveCard(m,c.id,zone);return c.id;};
 const site=pull('light','1_130','table');m.locations.push(site);const troop=pull('light','1_28','table'),belt=pull('light','1_40','table'),secret=pull('dark','1_194','hand');m.cards[troop].location=site;m.cards[belt].location=site;m.cards[belt].attachedTo=troop;
 m=runtime.startTurns(m,rules);
 const light=runtime.project(m,rules,'light'),dark=runtime.project(m,rules,'dark'),values=light.rules.values;
 assert.deepEqual(values,dark.rules.values);assert.deepEqual(Object.keys(values.characters),[troop]);assert.equal(values.characters[troop].power,3);assert.equal(values.characters[troop].forfeit,4);assert.equal(values.sites[site].light.power,3);assert.ok(!JSON.stringify(values).includes(secret));
 const before=clone(values);m.players.dark.reserve.reverse();state.moveCard(m,secret,'reserve');assert.deepEqual(runtime.project(m,rules,'light').rules.values,before);
 state.moveCard(m,belt,'lost');const bare=runtime.project(m,rules,'light').rules.values;assert.equal(bare.characters[troop].power,1);assert.equal(bare.characters[troop].forfeit,2);
 // An adjacent Luke still contributes to this character's forfeit during a
 // battle he is not participating in. The public value must match the payable value.
 const far=pull('dark','1_291','table'),luke=pull('light','101_2','table'),enemy=pull('dark','1_194','table');m.locations.push(far);m.cards[luke].location=far;m.cards[enemy].location=site;state.moveTop(m,'dark','reserve','force');
 const advance=choice=>{const p=runtime.prompt(m,rules,'dark');const side=p?.choices.length?'dark':'light';m=runtime.applyCommand(m,rules,side,{revision:m.revision,choice});};
 for(let i=0;i<100&&!runtime.prompt(m,rules,'dark')?.choices.some(c=>c.id==='battle:'+site);i++)advance('pass');
 advance('battle:'+site);for(let i=0;i<100&&m.data.battle.stage!=='weapons';i++)advance('pass');
 assert.equal(m.data.battle.stage,'weapons');assert.ok(!m.data.battle.participants.light.includes(luke));assert.equal(runtime.project(m,rules,'light').rules.values.characters[troop].forfeit,3);
});
