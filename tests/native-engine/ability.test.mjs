import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const module=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=module('runtime'),state=module('state'),stats=module('ability'),board=module('board'),combat=module('battle'),effects=module('battle-effects'),destiny=module('battle-destiny'),cancel=module('cancellation');
const {premiereRules}=module('premiere-rules');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/ability-results.json',import.meta.url)));
const reference=name=>{const row=oracle.find(r=>r.name===name);assert.ok(row,'missing reference '+name);return row};
// Explicit component-only fixtures. Public full-match admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x)),other=s=>s==='light'?'dark':'light';
const fresh=()=>runtime.createMatch('ability-test',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_53','1_53','4_37','4_37','1_71','1_109','1_11','1_21','1_129','1_124','1_115','1_6','1_28','1_28','1_28','1_28']:['1_225','1_225','1_234','1_267','101_5','1_317','1_168','1_172','1_262','101_4','1_194','1_194','1_194','1_194']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m){const id=pull(m,'light','1_129');m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='battle',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.side===side&&x.turn.phase===p&&x.stack.length===1)}
const settled=m=>seek(m,x=>x.stack.length===1),priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
function basic(){let m=fresh();const site=location(m),light=Array.from({length:4},()=>pull(m,'light','1_28','table',site)),dark=Array.from({length:4},()=>pull(m,'dark','1_194','table',site));force(m,'dark',8);force(m,'light',8);return{m,site,light,dark}}
function start(f){let m=phase(f.m);return boundary(step(m,'battle:'+f.site),'battle-weapons')}
function abilityFixture(){const m=fresh(),site=location(m),target=pull(m,'light','1_21','table',site),source=pull(m,'light','1_53'),second=pull(m,'dark','1_225'),droid=pull(m,'light','1_6','table',site);return{m,site,target,source,second,droid}}
for(const mode of ['add','subtract','zero','fraction','double-add','reset','minimum-reset','droid','battle-add','battle-prevent'])test('current ability query '+mode,()=>{
 const f=abilityFixture(),{m,target,source,second,droid}=f;let expected=6;
 const add=(kind,n,src=source,t=target)=>stats.addAbilityModifier(m,src,t,kind,n);
 if(mode==='add'){add('add',2);expected=8}
 if(mode==='subtract'){add('add',-2);expected=4}
 if(mode==='zero'){add('add',-9);expected=0}
 if(mode==='fraction'){add('reset',0.5);expected=0.5}
 if(mode==='double-add'){add('base-double',1);add('add',2);expected=14}
 if(mode==='reset'){add('reset',2);add('add',8);add('base-double',1);expected=2}
 if(mode==='minimum-reset'){add('reset',4);add('reset',2,second);expected=2}
 if(mode==='droid'){add('reset',5,source,droid);add('add',2,second,droid);expected=0}
 if(mode.startsWith('battle-'))add('battle-add',2);if(mode==='battle-prevent')add('battle-prevent',1);
 stats.assertAbility(clone(m));const id=mode==='droid'?droid:target;assert.equal(stats.ability(clone(m),id),expected);
 const actual={name:'query-'+mode,ability:stats.ability(m,id),battleAbility:stats.abilityForBattleDestiny(m,id)};
 if(mode==='droid'){assert.deepEqual(reference(actual.name),{name:actual.name,ability:5,battleAbility:5});assert.deepEqual(actual,{name:actual.name,ability:0,battleAbility:0})}else assert.deepEqual(actual,reference(actual.name));
});
test('source and turn durations distinguish source loss, target return and a new turn',()=>{
 const {m,source,second,target}=abilityFixture();stats.addAbilityModifier(m,source,target,'add',2,{duration:'source'});stats.addAbilityModifier(m,second,target,'add',1);assert.equal(stats.ability(m,target),9);state.moveCard(m,source,'lost');assert.equal(stats.ability(m,target),7);state.moveCard(m,source,'table');assert.equal(stats.ability(m,target),7);m.turn.number++;assert.equal(stats.ability(m,target),6);stats.addAbilityModifier(m,source,target,'add',2);state.moveCard(m,target,'hand');state.moveCard(m,target,'table');assert.equal(stats.ability(m,target),6);
});
test('same noncumulative function is not doubled by duplicate sources, distinct and cumulative effects combine',()=>{
 const {m,source,target,second}=abilityFixture(),copy=pull(m,'light','1_53');stats.addAbilityModifier(m,source,target,'add',2);stats.addAbilityModifier(m,copy,target,'add',2);assert.equal(stats.ability(m,target),8);stats.addAbilityModifier(m,second,target,'add',1);assert.equal(stats.ability(m,target),9);stats.addAbilityModifier(m,copy,target,'add',2,{cumulative:true});assert.equal(stats.ability(m,target),11);
});
test('malformed saved modifiers cannot inject arbitrary stats or resurrect later instances',()=>{
 const {m,target,source}=abilityFixture();stats.addAbilityModifier(m,source,target,'add',2);
 for(const patch of [{amount:null},{amount:'2'},{kind:'power'},{turn:999},{duration:'always'},{cumulative:'yes'},{target:{id:target,zone:'table',version:999}}]){const bad=clone(m);Object.assign(bad.data.abilityModifiers[0],patch);assert.throws(()=>stats.assertAbility(bad),/modifier|reference/)}
});
test('highest selection uses current ability, exclusions and prevention without falling back from a prevented highest',()=>{
 const {m,target,source,second,site}=abilityFixture(),troop=pull(m,'light','1_28','table',site);assert.deepEqual(cancel.cancellationCharacters(m,'light'),[target]);stats.addAbilityModifier(m,source,target,'sense-prevent',1);assert.deepEqual(cancel.cancellationCharacters(m,'light'),[]);stats.addAbilityModifier(m,second,target,'highest-exclude',1);assert.deepEqual(cancel.cancellationCharacters(m,'light'),[troop]);stats.addAbilityModifier(m,second,troop,'reset',0);assert.deepEqual(cancel.cancellationCharacters(m,'light'),[]);
});
test('current ability controls free trooper deployment and fractional presence',()=>{
 const {m,site,target,source}=abilityFixture(),troop=pull(m,'light','1_28','hand');assert.deepEqual(board.deploymentPayment(m,troop,site),{light:0});stats.addAbilityModifier(m,source,target,'reset',0.5);assert.equal(board.presence(m,'light',site),false);assert.deepEqual(board.deploymentPayment(m,troop,site),{light:1});const ally=pull(m,'light','1_28','table',site);stats.addAbilityModifier(m,source,ally,'reset',0.5);assert.equal(board.presence(m,'light',site),true);
});
for(const side of ['light','dark'])for(const amount of [1,4])test(side+' trades '+amount+' ordinary ability for power without losing presence',()=>{
 const f=basic(),source=pull(f.m,side,side==='light'?'1_53':'1_225');let m=priority(start(f),side),before=m.players[side].force.length;m=step(m,'battle-effect:trade:'+source+':'+amount);m=boundary(m,'battle-weapons');assert.equal(m.players[side].force.length,before-amount);assert.equal(combat.participatingAbility(m,side),4);assert.equal(board.presence(m,side,f.site),true);assert.equal(effects.battleAbility(m,side),4-amount);assert.equal(destiny.battleDrawPolicy(m,side).count,0);m=priority(m,side);assert.ok(!ids(m).some(id=>id.startsWith('battle-effect:trade:'+source+':')));m=boundary(m,'battle-damage');assert.equal(combat.battle(m).power[side],4+amount);assert.equal(combat.battle(m).premature,false);assert.deepEqual({name:side+'-trade-'+amount,spent:before-m.players[side].force.length,ordinary:combat.participatingAbility(m,side),draws:destiny.battleDrawPolicy(m,side).count,power:combat.battle(m).power[side],reoffered:false},reference(side+'-trade-'+amount));
});
test('trade amount is bounded by current ordinary ability and available Force',()=>{
 const f=basic(),source=pull(f.m,'dark','1_225');stats.addAbilityModifier(f.m,source,f.dark[0],'reset',0.5);let m=start(f);while(m.players.dark.force.length>2)state.moveCard(m,m.players.dark.force[0],'used');assert.deepEqual(ids(m).filter(id=>id.startsWith('battle-effect:trade:')),['battle-effect:trade:'+source+':1','battle-effect:trade:'+source+':2']);assert.throws(()=>step(m,'battle-effect:trade:'+source+':3'),/Illegal/);
});
test('resolved battle trade survives source loss, but does not leak into the next battle',()=>{
 const f=basic(),source=pull(f.m,'dark','1_225');let m=boundary(step(start(f),'battle-effect:trade:'+source+':2'),'battle-weapons');state.moveCard(m,source,'lost');assert.equal(effects.tradedPower(m,'dark'),2);m=boundary(m,'battle-damage');assert.equal(combat.battle(m).power.dark,6);m=seek(m,x=>combat.battle(x)?.stage==='complete');m=phase(m,'battle','light');m=boundary(step(m,'battle:'+f.site),'battle-weapons');assert.equal(effects.tradedPower(m,'dark'),0);assert.equal(effects.battleAbility(m,'dark'),combat.participatingAbility(m,'dark'));
});
test('fractional total below one blocks initiation and ends a battle before damage',()=>{
 const f=basic(),source=pull(f.m,'dark','1_225');for(const id of f.dark)stats.addAbilityModifier(f.m,source,id,'reset',0.125);let m=phase(f.m);assert.ok(!ids(m).includes('battle:'+f.site));const g=basic();m=start(g);for(const id of g.dark)stats.addAbilityModifier(m,g.site,id,'reset',0.125);assert.ok(ids(m).includes('battle-premature-end'));m=step(m,'battle-premature-end');m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(combat.battle(m).premature,true);
});
for(const mode of ['pilot','vader','no-pilot'])test('Scramble '+mode+' separates normal ability, destiny ability and cancellation',()=>{
 const f=basic(),source=pull(f.m,'light','4_37'),pilot=mode==='no-pilot'?undefined:pull(f.m,'dark',mode==='vader'?'1_168':'1_172','table',f.site);let m=phase(f.m);m=settled(m);const id=pilot??f.dark[0];assert.deepEqual({name:'scramble-'+mode,sourceLost:m.cards[source].zone==='lost',ability:stats.ability(m,id),battleAbility:stats.abilityForBattleDestiny(m,id)},reference('scramble-'+mode));if(mode==='no-pilot'){assert.equal(m.cards[source].zone,'lost');return}
 assert.equal(m.cards[source].zone,'table');assert.equal(stats.abilityForBattleDestiny(m,pilot),mode==='vader'?6:0);assert.equal(stats.ability(m,pilot),mode==='vader'?6:2);m=boundary(step(m,'battle:'+f.site),'battle-weapons');assert.equal(effects.battleAbility(m,'dark'),mode==='vader'?10:4);assert.equal(combat.participatingAbility(m,'dark'),mode==='vader'?10:6);
 state.moveCard(m,pilot,'hand');m=seek(m,x=>x.cards[source].zone==='lost');assert.equal(m.cards[source].zone,'lost');
});
test('battle-only modifiers do not change Sense, presence, or ordinary ability',()=>{
 const {m,target,source,second}=abilityFixture();stats.addAbilityModifier(m,source,target,'battle-add',2);assert.equal(stats.abilityForBattleDestiny(m,target),8);stats.addAbilityModifier(m,second,target,'battle-prevent',1);assert.equal(stats.abilityForBattleDestiny(m,target),0);assert.equal(stats.ability(m,target),6);assert.deepEqual(cancel.cancellationCharacters(m,'light'),[target]);
});
for(const side of ['light','dark'])test(side+' Effect deploys for free, has response timing and obeys unique play limits',()=>{
 let m=fresh();location(m);const bp=side==='light'?'1_53':'1_225',source=pull(m,side,bp,'hand'),copy=pull(m,side,bp,'hand');m=phase(m,'deploy',side);const before=m.players[side].force.length;m=step(m,'battle-effect:deploy:'+source);assert.equal(m.cards[source].zone,'playing');m=settled(m);assert.equal(m.cards[source].zone,'table');assert.equal(m.players[side].force.length,before);m=priority(m,side);assert.ok(!ids(m).includes('battle-effect:deploy:'+copy));
});
for(const change of ['lower-target','raise-other'])test('Sense keeps its originally chosen character when ability changes: '+change,()=>{
 let m=fresh();const site=location(m),hero=pull(m,'light','1_21','table',site),troop=pull(m,'light','1_28','table',site),source=pull(m,'light','1_53'),sense=pull(m,'light','1_109','hand'),target=pull(m,'dark','1_262','hand');force(m,'dark',6);force(m,'light',6);m=phase(m,'control');const zero=pull(m,'light','1_124','hand');state.moveCard(m,zero,'reserve');m=step(m,'shuffle:'+target+':dark:reserve');m=step(m,'cancel:play:'+sense+':'+target+':'+hero);stats.addAbilityModifier(m,source,change==='lower-target'?hero:troop,'reset',change==='lower-target'?0.5:7);m=settled(m);assert.equal(m.cards[sense].zone,'used');assert.equal(m.cards[target].zone,'lost');assert.deepEqual({name:'sense-'+change,senseUsed:m.cards[sense].zone==='used',targetLost:m.cards[target].zone==='lost'},reference('sense-'+change));
});

test('Scramble stays while a Dark pilot is excluded from battle',()=>{
 const f=basic(),source=pull(f.m,'light','4_37'),pilot=pull(f.m,'dark','1_172','table',f.site);f.m.data.ground={turn:1,moved:[],reacted:[],drained:[],barriers:{[pilot]:1}};let m=start(f);assert.equal(m.cards[source].zone,'table');assert.equal(combat.members(m,'dark').includes(pilot),false);assert.equal(effects.battleAbility(m,'dark'),4);
});
test('Scramble deployment can be canceled by Alter before affecting pilots',()=>{
 let m=fresh();const site=location(m),pilot=pull(m,'dark','1_172','table',site),source=pull(m,'light','4_37','hand'),alter=pull(m,'dark','1_234','hand');m=phase(m,'deploy','light');const zero=pull(m,'dark','101_4','hand');state.moveCard(m,zero,'reserve');m=step(m,'battle-effect:deploy:'+source);assert.equal(stats.abilityForBattleDestiny(m,pilot),2);m=step(m,'cancel:play:'+alter+':'+source+':'+pilot);m=settled(m);assert.equal(m.cards[source].zone,'lost');assert.equal(m.cards[alter].zone,'used');assert.equal(stats.abilityForBattleDestiny(m,pilot),2);
});
test('Scramble offers no empty optional pass when it must cancel after deployment',()=>{
 let m=fresh();location(m);const source=pull(m,'light','4_37','hand');m=phase(m,'deploy','light');m=step(m,'battle-effect:deploy:'+source);m=seek(m,x=>x.cards[source].zone==='table');const choices=ids(m);assert.equal(choices.length,1);assert.ok(choices[0].startsWith('battle-effect:cancel:'));assert.equal(prompt(m).mandatory,true);m=settled(m);assert.equal(m.cards[source].zone,'lost');
});
test('saved trade records reject forged source, amount, side and duplicate usages',()=>{
 const f=basic(),source=pull(f.m,'dark','1_225');const m=boundary(step(start(f),'battle-effect:trade:'+source+':2'),'battle-weapons');
 for(const patch of [{amount:0},{amount:1.5},{side:'light'},{source:{id:source,zone:'table',version:999}},{applied:'yes'}]){const bad=clone(m);Object.assign(bad.data.battle.abilityTrades[0],patch);assert.throws(()=>prompt(bad),/trade|reference/)}
 const bad=clone(m);bad.data.battle.abilityTrades.push(clone(bad.data.battle.abilityTrades[0]));assert.throws(()=>prompt(bad),/trade/);
});
test('droids remain unmodifiable zero even for a trusted battle-ability grant',()=>{
 const {m,source,droid}=abilityFixture();stats.addAbilityModifier(m,source,droid,'battle-add',2);assert.equal(stats.abilityForBattleDestiny(m,droid),0);assert.equal(stats.ability(m,droid),0);
});

test('Light pilots do not prevent Scramble from canceling',()=>{
 let m=fresh();const site=location(m),source=pull(m,'light','4_37');pull(m,'light','1_11','table',site);m=phase(m);assert.equal(m.cards[source].zone,'lost');
});
test('weapon hit comparison reads current ability after destiny without using battle-destiny restrictions',()=>{
 const f=basic(),source=pull(f.m,'light','1_53'),gun=pull(f.m,'dark','1_317','table',f.site);f.m.cards[gun].attachedTo=f.dark[0];stats.addAbilityModifier(f.m,source,f.light[0],'battle-prevent',1);let m=start(f);const one=pull(m,'dark','1_194','hand');state.moveCard(m,one,'reserve');m=step(m,'fire:'+gun+':'+f.light[0]);m=boundary(m,'weapon-destiny-drawn');stats.addAbilityModifier(m,source,f.light[0],'reset',0.5);m=boundary(m,'battle-weapons');assert.equal(combat.battle(m).shots[0].defense,0.5);assert.equal(combat.battle(m).shots[0].hit,true);
});
