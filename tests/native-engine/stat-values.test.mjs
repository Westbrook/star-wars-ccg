import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=mod('runtime'),state=mod('state'),board=mod('board'),battle=mod('battle'),weapon=mod('weapon-state'),immunity=mod('combat-modifiers');
const rules={...mod('premiere-rules').premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(){return runtime.createMatch('sabers',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_155','1_155','1_157','14_9','1_21','101_2','9_24','1_19','1_19','1_152','1_31','1_6','1_105','1_115','1_115','1_109','1_129','1_132','1_124','1_109']:['1_262','1_262','1_324','1_168','101_5','1_267','1_267','1_317','1_284','1_285','1_317']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',location){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);if(location)c.location=location;return c.id}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m);const r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,f){for(let n=0;n<500;n++){if(f(m))return m;const p=prompt(m);assert.ok(p,'no prompt');const cs=p.choices.map(c=>c.id);m=step(m,cs.includes('pass')?'pass':cs.includes('skip-destiny')?'skip-destiny':cs[0])}throw Error('unreached boundary')}
const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
const priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
function fixture(bp='1_324',phase='battle',armed=true,siteBp='1_129'){
 let m=fresh();const side=bp==='1_324'?'dark':'light',site=pull(m,'light',siteBp);m.locations.push(site);
 const host=pull(m,side,side==='dark'?'1_168':'1_21','table',site),target=pull(m,side==='dark'?'light':'dark',side==='dark'?'1_19':'101_5','table',site),saber=pull(m,side,bp,armed?'table':'hand');
 if(armed){m.cards[saber].attachedTo=host;m.cards[saber].location=site}
 for(const s of ['light','dark'])for(let i=0;i<10;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=runtime.startTurns(m,rules);m=seek(m,x=>x.turn.side===side&&x.turn.phase===phase&&x.stack.length===1);return{m,side,site,host,target,saber};
}
function drawCards(f,values){const m=f.m;for(const id of [...m.players[f.side].reserve])state.moveCard(m,id,'hand');for(const v of [...values].reverse()){const bp=f.side==='dark'?({0:'1_285',1:'1_194',3:'1_317',5:'1_262'})[v]:({0:'1_124',1:'1_28',2:'1_155',3:'1_109',4:'1_105',5:'1_115'})[v];const c=Object.values(m.cards).find(c=>c.owner===f.side&&c.blueprint===bp&&c.zone==='hand');assert.ok(c,'draw '+v);state.moveCard(m,c.id,'reserve')}}
function fire(f,values){drawCards(f,values);let m=boundary(step(f.m,'battle:'+f.site),'battle-weapons');m=priority(m,f.side);m=step(m,'saber:fire:'+f.saber+':'+f.target);return boundary(m,'weapon-fired')}

const stats=mod('stat-modifiers'),defense=mod('defense'),ability=mod('ability');
const cases=JSON.parse(fs.readFileSync(new URL('./gemp/stat-cases.json',import.meta.url)));
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/stat-results.json',import.meta.url)));
for(const c of cases)test('executed statistic query '+c.name,()=>{
 const f=fixture(),m=f.m;let hero=f.target;if(c.droid||c.blueprint){state.moveCard(m,hero,'hand');hero=pull(m,'light',c.blueprint??'1_6','table',f.site)}
 for(const op of c.ops){const source=op.source==='hero'?hero:f.host;stats.addStatModifier(m,source,hero,op.stat,op.kind,op.amount,op.by?{by:op.by}:{});
  if(op.kind==='base-double'){ability.addAbilityModifier(m,source,hero,'base-double',1);stats.addStatModifier(m,source,hero,'armor','base-double',1);stats.addStatModifier(m,source,hero,'maneuver','base-double',1);}
 }
 const row={name:c.name,defense:defense.defenseValue(m,hero),ability:ability.ability(m,hero),armor:stats.characterAttribute(m,hero,'armor'),maneuver:stats.characterAttribute(m,hero,'maneuver'),forfeit:board.forfeit(m,hero)};
 assert.deepEqual(row,oracle.find(r=>r.name===c.name));stats.assertStatModifiers(clone(m));
});
for(const late of [false,true])test('forfeit protection before/after lightsaber hit '+late,()=>{const f=fixture();if(!late)stats.addStatModifier(f.m,f.site,f.target,'forfeit','prevent-reduce',1);let m=fire(f,[3,3]);if(late)stats.addStatModifier(m,f.site,f.target,'forfeit','prevent-reduce',1);const protectedValue=board.forfeit(m,f.target);m.data.statModifiers=[];assert.deepEqual({name:late?'protection-after-hit':'protection-before-hit',hit:battle.battle(m).hits.includes(f.target),protected:protectedValue,after:board.forfeit(m,f.target)},oracle.find(r=>r.name===(late?'protection-after-hit':'protection-before-hit')))});
test('defense increase changes lightsaber result without changing ability or Force-drain presence',()=>{const f=fixture();stats.addStatModifier(f.m,f.site,f.target,'defense','add',3);const m=fire(f,[3,3]);assert.equal(battle.battle(m).saberShots[0].defense,7);assert.equal(battle.battle(m).hits.includes(f.target),false);assert.equal(ability.ability(m,f.target),4);assert.equal(board.presence(m,'light',f.site),true)});
test('blasters compare current defense after response modifiers, not only ability',()=>{const f=fixture();const gun=pull(f.m,'dark','1_317');f.m.cards[gun].attachedTo=f.host;f.m.cards[gun].location=f.site;drawCards(f,[5]);let m=step(priority(boundary(step(f.m,'battle:'+f.site),'battle-weapons'),'dark'),'fire:'+gun+':'+f.target);stats.addStatModifier(m,f.site,f.target,'defense','add',2);m=boundary(m,'weapon-fired');assert.equal(battle.battle(m).shots[0].defense,6);assert.equal(battle.battle(m).hits.includes(f.target),false);assert.equal(ability.ability(m,f.target),4)});
test('forfeit modifiers affect actual payment of damage and attrition',()=>{const f=fixture();stats.addStatModifier(f.m,f.site,f.target,'forfeit','reset',2);let m=boundary(step(f.m,'battle:'+f.site),'battle-destiny-complete');battle.battle(m).destiny.dark=5;battle.battle(m).destiny.light=0;m=boundary(m,'battle-damage');const before=clone(battle.battle(m));m=seek(step(priority(m,'light'),'forfeit:'+f.target),x=>x.cards[f.target].zone==='lost');assert.equal(battle.battle(m).damage.light,Math.max(0,before.damage.light-2));assert.equal(battle.battle(m).attrition.light,Math.max(0,before.attrition.light-2))});
test('ordinary Luke forfeiture bonus is suppressed by prevention of increases',()=>{const f=fixture();state.moveCard(f.m,f.target,'hand');pull(f.m,'light','101_2','table',f.site);const troop=pull(f.m,'light','1_28','table',f.site);assert.equal(board.forfeit(f.m,troop),3);stats.addStatModifier(f.m,f.site,troop,'forfeit','prevent-increase',1);assert.equal(board.forfeit(f.m,troop),2)});
test('turn grants survive source departure while source grants expire; target return never retains either',()=>{const f=fixture(),m=f.m;stats.addStatModifier(m,f.saber,f.target,'defense','add',2);stats.addStatModifier(m,f.host,f.target,'forfeit','add',2,{duration:'source'});state.moveCard(m,f.saber,'hand');assert.equal(defense.defenseValue(m,f.target),6);state.moveCard(m,f.host,'hand');assert.equal(board.forfeit(m,f.target),7);state.moveCard(m,f.target,'hand');state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;assert.equal(defense.defenseValue(m,f.target),4)});
test('same-function duplicate modifiers do not stack; explicit cumulative grants do',()=>{const f=fixture(),m=f.m;const a=pull(m,'light','1_28','hand'),b=pull(m,'light','1_28','hand');stats.addStatModifier(m,a,f.target,'defense','add',2);stats.addStatModifier(m,b,f.target,'defense','add',2);assert.equal(defense.defenseValue(m,f.target),6);stats.addStatModifier(m,b,f.target,'defense','add',2,{cumulative:true});assert.equal(defense.defenseValue(m,f.target),8);m.turn.number++;assert.equal(defense.defenseValue(m,f.target),4)});
test('invalid statistic combinations, durations, player scopes and saved targets are rejected',()=>{const f=fixture();for(const args of [['armor','prevent-reduce',1],['defense','reset',-1],['forfeit','prevent-increase',2]])assert.throws(()=>stats.addStatModifier(f.m,f.site,f.target,...args),/statistic/);assert.throws(()=>stats.addStatModifier(f.m,f.site,f.target,'forfeit','prevent-reduce',1,{by:'dark'}),/statistic/);stats.addStatModifier(f.m,f.site,f.target,'defense','add',1);const bad=clone(f.m);bad.data.statModifiers[0].target.id=f.site;assert.throws(()=>prompt(bad),/statistic/);assert.ok(!JSON.stringify(runtime.project(f.m,rules,'light')).includes('statModifiers'))});
