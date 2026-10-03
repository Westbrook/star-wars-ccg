import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';
function fixture({initiator='dark',light=1,dark=4,han=false}={}){
 let m=fresh({light:['1_129','1_130','1_26','1_120','101_3','1_77','1_77','1_77','1_91','1_91','1_11','1_90','1_5',...Array(7).fill('1_28')],dark:['1_279','1_279','1_279','1_252',...Array(8).fill('1_194')]});
 const site=location(m,'light','1_129'),remote=location(m,'light','1_130');const chances={light:[],dark:[]};for(const side of ['light','dark'])for(let i=0;i<3;i++)chances[side].push(pull(m,side,side==='light'?'1_77':'1_279','hand'));
 const feeling=pull(m,'light','1_91','hand'),secondFeeling=pull(m,'light','1_91','hand'),reduce=pull(m,'light','1_90','hand'),worse=pull(m,'dark','1_252','hand'),hanId=pull(m,'light','1_11',han?'table':'hand',han?site:undefined),troopers={light:[],dark:[]};
 for(let i=0;i<light;i++)troopers.light.push(pull(m,'light','1_28','table',site));for(let i=0;i<dark;i++)troopers.dark.push(pull(m,'dark','1_194','table',site));force(m,'light',6);force(m,'dark',6);m=phase(m,'battle');if(initiator==='light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);
 m=step(m,'battle:'+site);return {m,site,remote,chances,feeling,secondFeeling,reduce,worse,han:hanId,troopers};
}
const pending=m=>m.stack.at(-2);
const kind=m=>event(m)?.kind;
const opening=m=>pending(m)?.action?.handler==='battle:begin';
const damage=m=>seek(m,x=>kind(x)==='battle-damage');
const finish=m=>seek(m,x=>combat.battle(x)?.stage==='complete'&&x.stack.length===1);
const play=(f,side)=>step(priority(f.m,side),'stakes:play:'+f.chances[side][0]);
for(const initiator of ['dark','light'])for(const loser of ['dark','light'])test('Chances triples eventual '+loser+' loss after '+initiator+' initiation',()=>{
 const f=fixture({initiator,light:loser==='light'?1:4,dark:loser==='dark'?1:4});let m=play(f,other(initiator));m=damage(m);assert.equal(combat.battle(m).damage[loser],9);assert.equal(combat.battle(m).damage[other(loser)],0);assert.equal(m.cards[f.chances[other(initiator)][0]].zone,'lost');
});
test('only defender can play Chances at initiation, never in later segments',()=>{
 const f=fixture();let m=f.m;assert.ok(ids(m).includes('stakes:play:'+f.chances.light[0]));m=priority(m,'dark');assert.ok(!ids(m).some(x=>x.startsWith('stakes:play:')));m=seek(m,x=>kind(x)==='battle-weapons');for(const side of ['dark','light']){m=priority(m,side);assert.ok(!ids(m).some(x=>x.startsWith('stakes:')));}
});
for(const initiator of ['dark','light'])test('opposing Chances triples pending result for ninefold damage: '+initiator,()=>{
 const f=fixture({initiator});let m=play(f,other(initiator));m=step(m,'stakes:boost:'+f.chances[initiator][0]);m=damage(m);assert.equal(combat.battle(m).damage.light,27);assert.equal(combat.battle(m).damageMultipliers[0].factor,9);
});
test('nested boost discrepancy is guarded atomically instead of inventing damage',()=>{
 const f=fixture();let m=play(f,'light');m=step(m,'stakes:boost:'+f.chances.dark[0]);m=step(m,'stakes:boost:'+f.chances.light[1]);m=seek(m,x=>pending(x)?.action.handler==='stakes:boost'&&pending(x).action.payload.boost===3&&x.stack.at(-1).passes===1);const before=clone(m);assert.throws(()=>step(m,'pass'),/verified rule adjudication/);assert.deepEqual(m,before);assert.equal(combat.battle(m).damageMultipliers,undefined);
});
test('repeated boosts on the same pending result do not stack',()=>{
 const f=fixture();let m=play(f,'light');m=step(m,'stakes:boost:'+f.chances.dark[0]);m=seek(m,x=>m!==x&&pending(x)?.action.source===f.chances.light[0]);m=priority(m,'dark');m=step(m,'stakes:boost:'+f.chances.dark[1]);m=damage(m);assert.equal(combat.battle(m).damage.light,27);
});
test('repeated base copies do not stack and source leaving Lost does not revoke duration',()=>{
 const f=fixture();let m=seek(play(f,'light'),opening);state.moveCard(m,f.chances.light[0],'hand');m=priority(m,'light');m=step(m,'stakes:play:'+f.chances.light[1]);m=damage(m);assert.equal(combat.battle(m).damage.light,9);assert.equal(combat.battle(m).damageMultipliers.length,1);
});
test('canceled base and canceled boost leave no unintended modifier',()=>{
 let f=fixture(),m=play(f,'light');pending(m).cancelled=true;m=damage(m);assert.equal(combat.battle(m).damage.light,3);assert.equal(m.cards[f.chances.light[0]].zone,'lost');
 f=fixture();m=step(play(f,'light'),'stakes:boost:'+f.chances.dark[0]);pending(m).cancelled=true;m=damage(m);assert.equal(combat.battle(m).damage.light,9);
});
test('canceling original while boost is pending makes that boost harmless',()=>{
 const f=fixture();let m=step(play(f,'light'),'stakes:boost:'+f.chances.dark[0]);m.stack.find(x=>x.kind==='resolution'&&x.action.source===f.chances.light[0]).cancelled=true;m=damage(m);assert.equal(combat.battle(m).damage.light,3);
});
test('Forfeit and unit payments subtract credit after multiplying original damage',()=>{
 const f=fixture();let m=priority(damage(play(f,'light')),'light');m=seek(step(m,'battle-lose:reserve'),x=>kind(x)==='force-lost');assert.equal(combat.battle(m).damage.light,8);m=priority(seek(m,x=>kind(x)==='battle-damage'),'light');const credit=board.forfeit(m,f.troopers.light[0]);m=step(m,'forfeit:'+f.troopers.light[0]);m=seek(m,x=>kind(x)==='battle-damage');assert.equal(combat.battle(m).damage.light,8-credit);assert.equal(combat.battle(m).damageLedger.light.paid,credit+1);
});
test('It Could Be Worse reduces multiplied damage; It’s Worse adds afterward',()=>{
 const f=fixture();let m=priority(damage(play(f,'light')),'light');m=step(m,'battle-reduce:'+f.reduce+':2');m=step(m,'worse:cancel:'+f.worse+':2');m=seek(m,x=>m!==x&&x.cards[f.worse].zone==='lost');assert.equal(combat.battle(m).damage.light,11);assert.equal(combat.battle(m).damageLedger.light.base,3);
});
function withDestiny(f,light='101_3',dark='1_194'){
 // Fixture-controlled Reserve order, not a substitute-destiny card effect.
 topDestiny(f.m,'light',light);topDestiny(f.m,'dark',dark);return f;
}
function drawBoth(m){return seekDrawing(m,x=>kind(x)==='battle-damage');}
function seekDrawing(m,predicate){for(let i=0;i<300;i++){if(predicate(m))return m;const p=prompt(m);m=step(m,p.choices.some(x=>x.id==='draw-destiny')?'draw-destiny':p.choices.some(x=>x.id==='pass')?'pass':p.choices[0].id);}throw Error('no damage');}
test('multipliers leave destiny, power and attrition unchanged',()=>{
 const f=withDestiny(fixture({light:4,dark:4}));let m=drawBoth(play(f,'light'));const b=combat.battle(m);assert.equal(b.destiny.light,6);assert.equal(b.destiny.dark,1);assert.equal(b.damage.dark,15);assert.equal(b.attrition.dark,6);assert.equal(b.attrition.light,1);assert.equal(b.power.light,10);assert.equal(b.power.dark,5);
});
function bad(f){let m=priority(f.m,'light');const id=ids(m).find(x=>x.startsWith('stakes:feeling:'+f.feeling));assert.ok(id);return step(m,id);}
for(const han of [false,true])test('Bad Feeling doubles/triples victorious underdog damage; Han='+han,()=>{
 const f=withDestiny(fixture({initiator:'light',light:han?1:4,dark:5,han}));let m=drawBoth(bad(f));const b=combat.battle(m);assert.equal(b.damage.dark,han?12:8);assert.equal(b.damage.light,0);assert.equal(b.attrition.dark,6);assert.equal(m.cards[f.feeling].zone,'used');
});
for(const [light,dark] of [[5,5],[6,5]])test('Bad Feeling requires strictly lower power: '+light+'/'+dark,()=>{
 const f=fixture({initiator:'light',light,dark});const m=priority(f.m,'light');assert.ok(!ids(m).some(x=>x.startsWith('stakes:feeling:')));
});
test('Bad Feeling is unavailable to defender and in weapons segment',()=>{
 let f=fixture({light:1,dark:5});assert.ok(!ids(f.m).some(x=>x.startsWith('stakes:feeling:')));f=fixture({initiator:'light',light:4,dark:5});let m=seek(f.m,x=>kind(x)==='battle-weapons');m=priority(m,'light');assert.ok(!ids(m).some(x=>x.startsWith('stakes:feeling:')));
});
test('Bad Feeling does not multiply Light damage if its underdog still loses',()=>{
 const f=fixture({initiator:'light',light:1,dark:4});const m=damage(bad(f));assert.equal(combat.battle(m).damage.light,3);assert.equal(combat.battle(m).damage.dark,0);
});
test('Bad Feeling and opposing Chances combine across distinct card titles',()=>{
 const f=withDestiny(fixture({initiator:'light',light:4,dark:5}));let m=seek(bad(f),opening);m=priority(m,'dark');m=step(m,'stakes:play:'+f.chances.dark[0]);m=drawBoth(m);assert.equal(combat.battle(m).damage.dark,24);
});
test('duplicate Bad Feeling copies do not multiply again',()=>{
 const f=withDestiny(fixture({initiator:'light',light:4,dark:5}));let m=seek(bad(f),opening);m=priority(m,'light');m=step(m,'stakes:feeling:'+f.secondFeeling);m=drawBoth(m);assert.equal(combat.battle(m).damage.dark,8);
});
test('Han must remain a valid target through response; resolved bonus is then fixed',()=>{
 let f=fixture({initiator:'light',light:1,dark:5,han:true}),m=bad(f);state.moveCard(m,f.han,'hand');m=seek(m,opening);assert.equal(combat.battle(m).damageMultipliers?.length??0,0);
 f=fixture({initiator:'light',light:1,dark:5,han:true});m=seek(bad(f),opening);state.moveCard(m,f.han,'hand');m=damage(m);assert.equal(combat.battle(m).damageMultipliers[0].factor,3);
});
test('a later Han arrival does not upgrade the selected double result',()=>{
 const f=fixture({initiator:'light',light:4,dark:5});let m=bad(f);state.moveCard(m,f.han,'table');m.cards[f.han].location=f.site;m=damage(m);assert.equal(combat.battle(m).damageMultipliers[0].factor,2);
});
test('canceling Bad Feeling sends Used Interrupt Lost',()=>{const f=fixture({initiator:'light',light:4,dark:5});let m=bad(f);pending(m).cancelled=true;m=damage(m);assert.equal(m.cards[f.feeling].zone,'lost');assert.equal(combat.battle(m).damageMultipliers?.length??0,0);});
for(const droid of [false,true])test('Doomed rounding applies before multiplication: droid='+droid,()=>{
 const f=fixture();const card=Object.values(f.m.cards).find(c=>c.blueprint==='1_120');assert.ok(card);f.m.data.doomed={turn:f.m.turn.number,sources:[card.id]};
 // Fixture-only droid identity; this is not admitting its full card text.
 if(droid){const c=Object.values(f.m.cards).find(c=>c.blueprint==='1_5');assert.ok(c);state.moveCard(f.m,c.id,'table');f.m.cards[c.id].location=f.remote;}
 const m=damage(play(f,'light'));assert.equal(combat.battle(m).damage.light,droid?3:6);
});
test('battle modifiers expire before the next battle, preserving history',()=>{
 const f=fixture();let m=finish(play(f,'light'));const previous=clone(combat.battle(m));m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);pull(m,'light','1_28','table',f.site);m=step(m,'battle:'+f.site);assert.equal(combat.battle(m).damageMultipliers,undefined);assert.equal(previous.damageMultipliers[0].factor,3);
});
test('invalid nested targets, modifiers, stale/foreign choices are rejected atomically',()=>{
 const f=fixture(),before=clone(f.m);assert.throws(()=>runtime.applyCommand(f.m,rules,'dark',{revision:f.m.revision,choice:'stakes:play:'+f.chances.light[0]}));assert.throws(()=>runtime.applyCommand(f.m,rules,'light',{revision:f.m.revision-1,choice:'stakes:play:'+f.chances.light[0]}));assert.deepEqual(f.m,before);
 let m=step(play(f,'light'),'stakes:boost:'+f.chances.dark[0]);for(const corrupt of [x=>pending(x).action.payload.targetIndex=999,x=>pending(x).action.payload.target=f.chances.light[1],x=>pending(x).action.payload.factor=-3,x=>pending(x).action.payload.boost=2]){const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.prompt(bad,rules,'light'));}
 m=damage(play(f,'light'));const bad=clone(m);combat.battle(bad).damageLedger.light.multiplier=2;assert.throws(()=>runtime.prompt(bad,rules,'light'));
});

test('a tied battle has zero multiplied damage',()=>{const f=fixture({light:1,dark:1});let m=damage(play(f,'light'));assert.deepEqual(combat.battle(m).damage,{light:0,dark:0});});
test('a canceled battle never creates multiplied loss and continues its phase',()=>{
 const f=fixture();let m=seek(play(f,'light'),opening);pending(m).cancelled=true;m=finish(m);assert.equal(combat.battle(m).premature,true);assert.deepEqual(combat.battle(m).damage,{light:0,dark:0});assert.equal(m.turn.phase,'battle');
});
test('end of game stops pending multipliers without exposing new legal actions',()=>{
 const f=fixture();const m=step(play(f,'light'),'concede','dark');assert.equal(m.status,'finished');assert.equal(m.result.winner,'light');assert.equal(runtime.prompt(m,rules,'light'),null);assert.equal(combat.battle(m).damageMultipliers,undefined);
});
test('Han ground deployment does not grant complete character admission',()=>{
 const f=fixture();assert.equal(premiereRules.supports('1_11'),false);assert.deepEqual(board.deploymentPayment(f.m,f.han,f.site),{light:3});
});
test('ordinary reduction subtracts after tripling, without changing initial damage',()=>{
 const f=fixture();let m=priority(damage(play(f,'light')),'light');m=step(m,'battle-reduce:'+f.reduce+':2');m=seek(m,x=>x.cards[f.reduce].zone==='used');assert.equal(combat.battle(m).initialDamage.light,9);assert.equal(combat.battle(m).damage.light,7);
});
test('Bad Feeling strict power condition uses defending guard modifiers',()=>{
 const f=fixture({initiator:'light',light:4,dark:1});const guard=pull(f.m,'dark','1_181','table',f.site);combat.syncBattle(f.m);const m=priority(f.m,'light');assert.ok(ids(m).some(x=>x.startsWith('stakes:feeling:')));assert.ok(board.power(m,guard,true)>board.power(m,guard,false));
});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/stakes-results.json',import.meta.url)));
for(const result of oracle)test('GEMP battle stakes: '+result.name,()=>{
 const n=result.name;let f,m;
 if(n.startsWith('chance-')){const [,initiator,loser]=n.split('-');f=fixture({initiator,light:loser==='light'?1:4,dark:loser==='dark'?1:4});m=damage(play(f,other(initiator)));}
 else if(n.startsWith('bad-')){
  const mode=n.slice(4),han=mode==='han';f=withDestiny(fixture({initiator:'light',light:han?1:4,dark:5,han}));m=seek(bad(f),opening);if(mode==='combined'){m=priority(m,'dark');m=step(m,'stakes:play:'+f.chances.dark[0]);}if(mode==='repeat'){m=priority(m,'light');m=step(m,'stakes:feeling:'+f.secondFeeling);}m=drawBoth(m);
 }else if(n.startsWith('doomed-')){
  f=fixture();const c=Object.values(f.m.cards).find(c=>c.blueprint==='1_120');f.m.data.doomed={turn:f.m.turn.number,sources:[c.id]};if(n==='doomed-true'){const d=Object.values(f.m.cards).find(c=>c.blueprint==='1_5');state.moveCard(f.m,d.id,'table');f.m.cards[d.id].location=f.remote;}m=damage(play(f,'light'));
 }else{
  f=fixture();m=play(f,'light');
  if(n==='repeat-base'){m=seek(m,opening);m=priority(m,'light');m=step(m,'stakes:play:'+f.chances.light[1]);}
  else{m=step(m,'stakes:boost:'+f.chances.dark[0]);if(n==='chain'){
   assert.equal(result.lightDamage,27);m=step(m,'stakes:boost:'+f.chances.light[1]);m=seek(m,x=>pending(x)?.action.handler==='stakes:boost'&&pending(x).action.payload.boost===3&&x.stack.at(-1).passes===1);const before=clone(m);assert.throws(()=>step(m,'pass'),/verified rule adjudication/);assert.deepEqual(m,before);return;
  }if(n==='repeat-boost'){m=seek(m,x=>pending(x)?.action.source===f.chances.light[0]);m=priority(m,'dark');m=step(m,'stakes:boost:'+f.chances.dark[1]);}}
  m=damage(m);
 }
 const b=combat.battle(m);assert.deepEqual({name:n,lightDamage:b.damage.light,darkDamage:b.damage.dark,lightAttrition:b.attrition.light,darkAttrition:b.attrition.dark},result);
});
