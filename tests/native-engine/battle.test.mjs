import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load, engine as proof} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const oracle=JSON.parse(fs.readFileSync(new URL('../native-proof/gemp/weapon-oracle-result.json',import.meta.url)));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
const other=s=>s==='dark'?'light':'dark';
const battle=m=>combat.battle(m);
function fresh(){return runtime.createMatch('continuous-battle',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){const protectedCards=new Set(['1_317','1_312','1_152','1_153','1_269','1_90','1_249','1_105','1_182','1_12','1_194','1_28','1_6','1_31','1_181']);for(let i=0;i<n;i++){const id=m.players[side].reserve.find(id=>!protectedCards.has(m.cards[id].blueprint));assert.ok(id);state.moveCard(m,id,'force')}}
function stackEvent(m){return m.stack.at(-1)?.event?.kind}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id});assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
const ids=m=>prompt(m).choices.map(c=>c.id);
function seek(m,predicate,policy){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');const choice=policy?.(m,p)??(p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0]?.id);assert.ok(choice,JSON.stringify(p));m=step(m,choice)}throw Error('Boundary not reached')}
function phase(m,phase='battle',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===phase&&x.turn.side===side&&x.stack.length===1)}
function boundary(m,kind,side){return seek(m,x=>stackEvent(x)===kind&&(!side||prompt(x).side===side))}
function resolve(m){return seek(m,x=>x.stack.at(-1)?.kind==='decision'||['battle-weapons','battle-damage'].includes(stackEvent(x)))}
function start(m,site){m=phase(m);return boundary(step(m,'battle:'+site),'battle-weapons')}
function troops(m,side,site,count=4){return Array.from({length:count},()=>pull(m,side,side==='dark'?'1_194':'1_28','table',site))}
function top(m,side,bp){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id);state.moveCard(m,id,'reserve');return id}
function weapon(m,side,bp,host){const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;return id}
function drawPolicy(m,p){return p.choices.some(c=>c.id==='draw-destiny')?'draw-destiny':undefined}
function finish(m,policy){return seek(m,x=>battle(x)?.stage==='complete',policy)}
function basic(){let m=fresh();const site=location(m,'light','1_124'),dark=troops(m,'dark',site),light=troops(m,'light',site);force(m,'dark',8);force(m,'light',8);return {m,site,dark,light}}

test('battle requires eligible presence and Force, with one battle per site per turn',()=>{
 let {m,site,dark,light}=basic();m=phase(m);assert.ok(ids(m).includes('battle:'+site));m=step(m,'battle:'+site);assert.equal(m.players.dark.force.length,7);assert.equal(battle(m).participants.dark.length,4);assert.equal(ground.usage(m).drained.length,0);
 m=finish(m);m=seek(m,x=>x.stack.length===1);if(prompt(m).side==='light')m=step(m,'pass');assert.ok(!ids(m).includes('battle:'+site));
 m=seek(m,x=>x.turn.number===2&&x.turn.phase==='battle'&&x.stack.length===1);assert.ok(ids(m).includes('battle:'+site));
 const blocked=basic();blocked.m.data.ground={turn:1,moved:[],reacted:[],drained:[],barriers:Object.fromEntries(blocked.dark.map(id=>[id,1]))};m=phase(blocked.m);assert.ok(!ids(m).includes('battle:'+blocked.site));
 for(const id of [...m.players.dark.force])state.moveCard(m,id,'used');assert.ok(!ids(m).some(id=>id.startsWith('battle:')));
});

test('battle reactions join before destiny and do not stop after the first arriving character',()=>{
 let {m,site}=basic();const adjacent=location(m,'dark','1_284'),cz=pull(m,'light','1_6','table',adjacent),a=pull(m,'light','1_28','hand'),b=pull(m,'light','1_28','hand');
 m=phase(m);m=step(m,'battle:'+site);assert.ok(ids(m).includes('react-deploy:'+a+':'+site));m=step(m,'react-deploy:'+a+':'+site);m=seek(m,x=>x.stack.length===3&&x.stack.at(-2)?.action.handler==='battle:begin');if(prompt(m).side==='dark')m=step(m,'pass');assert.ok(ids(m).includes('react-deploy:'+b+':'+site));m=step(m,'react-deploy:'+b+':'+site);m=boundary(m,'battle-weapons');assert.equal(combat.participatingAbility(m,'light'),6);assert.ok(!battle(m).participants.light.includes(cz));
});

test('Barrier on a battle react excludes its ability without removing the arriving card',()=>{
 let m=fresh(),site=location(m,'light','1_124');troops(m,'dark',site);troops(m,'light',site,3);pull(m,'light','1_6','table',site);const reinforcement=pull(m,'light','1_28','hand'),barrier=pull(m,'dark','1_249','hand');force(m,'dark',3);force(m,'light',1);m=phase(m);m=step(m,'battle:'+site);m=step(m,'react-deploy:'+reinforcement+':'+site);m=seek(m,x=>stackEvent(x)==='deployed');m=step(m,'barrier:'+barrier+':'+reinforcement);m=boundary(m,'battle-weapons');assert.equal(combat.participatingAbility(m,'light'),3);assert.equal(board.abilityAt(m,'light',site),4);m=boundary(m,'battle-damage');assert.equal(battle(m).destiny.light,null);
});

test('weapon deployment and transfer pay full cost and require a present own warrior',()=>{
 let {m,site,dark,light}=basic();const gun=pull(m,'dark','1_317','hand'),rifle=pull(m,'dark','1_312','hand'),guard=pull(m,'dark','1_181','table',site);m=phase(m,'deploy');
 assert.ok(!ids(m).includes('equip:'+gun+':'+light[0]));assert.ok(!ids(m).includes('equip:'+gun+':'+guard));m=step(m,'equip:'+gun+':'+dark[0]);m=seek(m,x=>x.stack.length===1);if(prompt(m).side==='light')m=step(m,'pass');m=step(m,'equip:'+rifle+':'+dark[1]);m=seek(m,x=>x.stack.length===1);if(prompt(m).side==='light')m=step(m,'pass');assert.equal(m.players.dark.force.length,5);
 m=step(m,'transfer:'+rifle+':'+dark[0]);m=seek(m,x=>x.stack.length===1);assert.equal(m.players.dark.force.length,3);assert.equal(m.cards[rifle].attachedTo,dark[0]);
});

for(const side of ['dark','light'])test(side+' weapon equality, hit return fire, and once-per-weapon/bearer restrictions',()=>{
 let {m,site,dark,light}=basic();const own=side==='dark'?dark:light,opp=side==='dark'?light:dark;
 const gun=weapon(m,side,side==='dark'?'1_317':'1_152',own[0]),rifle=weapon(m,side,side==='dark'?'1_312':'1_153',own[0]),returnGun=weapon(m,other(side),side==='dark'?'1_152':'1_317',opp[0]);top(m,side,side==='dark'?'1_194':'1_28');top(m,other(side),side==='dark'?'1_12':'1_182');m=start(m,site);if(prompt(m).side!==side)m=step(m,'pass');
 m=step(m,'fire:'+gun+':'+opp[0]);assert.equal(battle(m).shots[0].card,null);m=seek(m,x=>stackEvent(x)==='weapon-destiny-drawn');assert.equal(battle(m).hits.length,0);assert.equal(m.players[side].destiny.length,1);m=boundary(m,'battle-weapons');assert.equal(battle(m).shots[0].hit,false);assert.equal(battle(m).shots[0].destiny,1);assert.equal(battle(m).shots[0].bonus,0);
 m=step(m,'fire:'+returnGun+':'+own[0]);m=boundary(m,'battle-weapons');assert.ok(battle(m).hits.includes(own[0]));assert.ok(!ids(m).some(id=>id.startsWith('fire:'+rifle)));assert.ok(!ids(m).some(id=>id.startsWith('fire:'+gun)));assert.equal(combat.participatingAbility(m,side),4);
 const branch=oracle.branches.find(b=>b.name===side+'-basic-equality-miss');assert.equal(battle(m).shots[0].hit,branch.hit);
});

test('a hit bearer fires back; repeated targeting does not duplicate the hit obligation',()=>{
 let {m,site,dark,light}=basic();const darkGun=weapon(m,'dark','1_317',dark[0]),darkRifle=weapon(m,'dark','1_312',dark[1]),lightGun=weapon(m,'light','1_152',light[0]);top(m,'dark','1_182');top(m,'light','1_12');m=start(m,site);m=boundary(step(m,'fire:'+darkGun+':'+light[0]),'battle-weapons');assert.ok(ids(m).includes('fire:'+lightGun+':'+dark[0]));m=boundary(step(m,'fire:'+lightGun+':'+dark[0]),'battle-weapons');assert.ok(ids(m).includes('fire:'+darkRifle+':'+light[0]));m=boundary(step(m,'fire:'+darkRifle+':'+light[0]),'battle-weapons');assert.equal(battle(m).hits.filter(id=>id===light[0]).length,1);
});

test('both dark weapon-destiny site modifiers apply on arbitrary battle boards',()=>{
 for(const bp of ['1_284','1_132']){let m=fresh(),site=location(m,bp==='1_284'?'dark':'light',bp),dark=troops(m,'dark',site),light=troops(m,'light',site),gun=weapon(m,'dark','1_317',dark[0]);force(m,'dark',3);top(m,'dark','1_194');m=start(m,site);m=boundary(step(m,'fire:'+gun+':'+light[0]),'battle-weapons');assert.equal(battle(m).shots[0].bonus,1);assert.equal(battle(m).shots[0].hit,true)}
});

test('battle destiny is optional, ordered by initiator, and unresolved cards remain Life Force',()=>{
 let {m,site}=basic();top(m,'dark','1_182');top(m,'light','1_12');m=start(m,site);m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny');assert.equal(prompt(m).side,'dark');const life=state.lifeForce(m,'dark');m=step(m,'draw-destiny');assert.equal(state.lifeForce(m,'dark'),life);assert.equal(m.players.dark.destiny.length,1);assert.equal(runtime.project(m,rules,'light').players.dark.destiny.length,1);
 m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny');assert.equal(prompt(m).side,'light');assert.equal(m.players.dark.destiny.length,0);m=step(m,'skip-destiny');m=boundary(m,'battle-damage');assert.equal(battle(m).destiny.dark,3);assert.equal(battle(m).destiny.light,null);assert.deepEqual(battle(m).initialAttrition,{dark:0,light:3});
});

test('Takeel swaps totals, not physical cards, and cannot be used after a skipped draw',()=>{
 for(const skip of [false,true]){let {m,site}=basic();const takeel=pull(m,'dark','1_269','hand');top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-destiny-complete',(m,p)=>p.side==='dark'||!skip?drawPolicy(m,p):undefined);if(prompt(m).side==='light')m=step(m,'pass');assert.equal(ids(m).includes('takeel:'+takeel),!skip);if(skip)continue;const original={...battle(m).destinyCards};m=step(m,'takeel:'+takeel);m=boundary(m,'battle-damage');assert.deepEqual(battle(m).destiny,{dark:1,light:3});assert.deepEqual(battle(m).destinyCards,original);for(const side of ['dark','light'])assert.equal(m.cards[original[side]].owner,side);assert.equal(m.cards[takeel].zone,'lost')}
});

test('battle losses keep both balances public and disallow passing until obligations are met',()=>{
 let {m,site,dark,light}=basic();top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-damage',drawPolicy);assert.deepEqual(battle(m).initialAttrition,{dark:1,light:3});assert.deepEqual(battle(m).initialDamage,{dark:0,light:2});assert.ok(!ids(m).includes('pass'));assert.throws(()=>step(m,'pass'),/Illegal/);
 m=boundary(step(m,'forfeit:'+dark[0]),'battle-damage');m=boundary(step(m,'forfeit:'+light[0]),'battle-damage');assert.equal(battle(m).damage.light,0);assert.equal(battle(m).attrition.light,1);assert.equal(runtime.project(m,rules,'dark').rules.battle.damage.light,0);m=step(m,'pass');assert.ok(!ids(m).includes('pass'));m=boundary(step(m,'forfeit:'+light[1]),'battle-damage');m=finish(m);assert.equal(battle(m).totalsReady,true);assert.equal(m.status,'playing');assert.equal(m.turn.phase,'battle');
});

test('a Force loss pays damage only; empty participants can ignore remaining attrition',()=>{
 let {m,site,dark,light}=basic();top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-damage',drawPolicy);m=boundary(step(m,'forfeit:'+dark[0]),'battle-damage');m=boundary(step(m,'battle-lose:reserve'),'battle-damage');assert.equal(battle(m).damage.light,1);assert.equal(battle(m).attrition.light,3);
 for(const id of light)state.moveCard(m,id,'lost');m=step(m,'pass');m=boundary(step(m,'battle-lose:reserve'),'battle-damage');assert.equal(battle(m).damage.light,0);m=finish(m);assert.equal(battle(m).attrition.light,3);assert.equal(m.status,'playing');
});

const permutations=a=>a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[x,...p])):[[]];
test('all six host/attachment Lost orders survive refresh and only credit the host',()=>{
 for(const order of permutations([0,1,2])){let {m,site,dark,light}=basic();const a=weapon(m,'light','1_152',light[0]),b=weapon(m,'light','1_153',light[0]),lost=[light[0],a,b];top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-damage',drawPolicy);m=boundary(step(m,'forfeit:'+dark[0]),'battle-damage');m=step(m,'forfeit:'+light[0]);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(battle(m).damage.light,0);assert.equal(battle(m).attrition.light,1);assert.equal(combat.members(m,'light').length,3);assert.ok(lost.every(id=>m.cards[id].zone==='leaving'));m=step(clone(m),'place-lost:'+lost[order[0]]);m=step(clone(m),'place-lost:'+lost[order[1]]);m=boundary(m,'battle-damage');assert.deepEqual(m.players.light.lost.slice(0,3),order.toReversed().map(i=>lost[i]));}
});

test('hit forfeits remain required at zero damage and attrition, including a healthy-first route',()=>{
 let {m,site,dark,light}=basic();const gun=weapon(m,'dark','1_317',dark[0]);top(m,'dark','1_182');m=start(m,site);m=boundary(step(m,'fire:'+gun+':'+light[0]),'battle-weapons');m=boundary(m,'battle-damage');assert.equal(battle(m).damage.light,0);assert.equal(battle(m).attrition.light,0);m=step(m,'pass');assert.ok(ids(m).includes('forfeit:'+light[0]));assert.ok(!ids(m).includes('forfeit:'+light[1]));assert.ok(!ids(m).includes('pass'));m=boundary(step(m,'forfeit:'+light[0]),'battle-damage');m=finish(m);assert.equal(m.status,'playing');
});

test('Talz rescue forfeits for both debts and restores the hit without losing its attachments',()=>{
 let {m,site,dark,light}=basic();const talz=pull(m,'light','1_31','table',site),gun=weapon(m,'dark','1_317',dark[0]),savedWeapon=weapon(m,'light','1_152',light[0]);top(m,'dark','1_182');m=start(m,site);m=boundary(step(m,'fire:'+gun+':'+light[0]),'battle-weapons');m=boundary(m,'battle-damage');if(prompt(m).side==='dark')m=boundary(step(m,'forfeit:'+dark[1]),'battle-damage');m=step(m,'rescue:'+talz+':'+light[0]);m=boundary(m,'battle-damage');assert.equal(m.cards[talz].zone,'lost');assert.equal(m.cards[savedWeapon].attachedTo,light[0]);assert.ok(!battle(m).hits.includes(light[0]));assert.equal(battle(m).damage.light,0);m=finish(m);assert.equal(m.cards[light[0]].zone,'table');
});

test('battle damage reduction is noncumulative and does not remove attrition',()=>{
 let {m,site,dark}=basic();const a=pull(m,'light','1_90','hand'),b=pull(m,'light','1_90','hand');top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-damage',drawPolicy);m=boundary(step(m,'forfeit:'+dark[0]),'battle-damage');m=boundary(step(m,'battle-reduce:'+a+':1'),'battle-damage');m=step(m,'pass');m=boundary(step(m,'battle-reduce:'+b+':1'),'battle-damage');assert.equal(battle(m).damage.light,1);assert.equal(battle(m).attrition.light,3);assert.equal(m.players.light.force.length,6);
});

test('loss of presence before damage ends the battle and loses hit cards; during damage it does not',()=>{
 let {m,site,dark,light}=basic();const gun=weapon(m,'dark','1_317',dark[0]);top(m,'dark','1_182');m=start(m,site);m=boundary(step(m,'fire:'+gun+':'+light[0]),'battle-weapons');for(const id of dark.slice(1))state.moveCard(m,id,'lost');state.moveCard(m,gun,'lost');state.moveCard(m,dark[0],'lost');assert.ok(ids(m).includes('battle-premature-end'));m=step(m,'battle-premature-end');m=finish(m);assert.equal(battle(m).premature,true);assert.equal(m.cards[light[0]].zone,'lost');assert.equal(m.status,'playing');
});

test('battle damage can end the match on the last Life Force without consuming cards from hand',()=>{
 let {m,site}=basic();top(m,'dark','1_182');top(m,'light','1_28');m=start(m,site);m=seek(m,x=>stackEvent(x)==='battle-damage',drawPolicy);m=resolve(step(m,ids(m).find(id=>id.startsWith('forfeit:'))));for(const pile of ['reserve','force','used'])for(const id of [...m.players.light[pile]])state.moveCard(m,id,'lost');const last=m.players.light.lost[0];state.moveCard(m,last,'reserve');const hand=pull(m,'dark','1_249','hand');m=step(m,'battle-lose:reserve');m=seek(m,x=>x.status==='finished');assert.equal(m.result.winner,'dark');assert.equal(m.cards[hand].zone,'hand');
});

test('Talz pays forfeiture before restoration responses and does not refund it on cancellation',()=>{
 let {m,site,dark,light}=basic();const talz=pull(m,'light','1_31','table',site),gun=weapon(m,'dark','1_317',dark[0]);top(m,'dark','1_182');m=start(m,site);m=boundary(step(m,'fire:'+gun+':'+light[0]),'battle-weapons');m=boundary(m,'battle-damage');m=boundary(step(m,'forfeit:'+dark[1]),'battle-damage');m=step(m,'rescue:'+talz+':'+light[0]);assert.equal(m.cards[talz].zone,'lost');assert.ok(battle(m).hits.includes(light[0]));assert.equal(stackEvent(m),'forfeited');m=step(step(m,'pass'),'pass');assert.equal(m.stack.at(-2).action.handler,'battle:rescue');
 // A synthetic cancellation exercises the engine contract; no unsupported
 // cancellation card is admitted by the production deck gate.
 m.stack.at(-2).cancelled=true;m=boundary(m,'battle-damage');assert.equal(m.cards[talz].zone,'lost');assert.ok(battle(m).hits.includes(light[0]));
});

test('weapon hit timing exposes draw, about-to-hit, hit and fired in order',()=>{
 let {m,site,dark,light}=basic();const gun=weapon(m,'dark','1_317',dark[0]);top(m,'dark','1_182');m=start(m,site);m=step(m,'fire:'+gun+':'+light[0]);m=seek(m,x=>stackEvent(x)==='weapon-destiny-drawn');assert.ok(!battle(m).hits.includes(light[0]));m=seek(m,x=>stackEvent(x)==='about-to-hit');assert.ok(!battle(m).hits.includes(light[0]));assert.equal(m.players.dark.destiny.length,0);m=seek(m,x=>stackEvent(x)==='hit');assert.ok(battle(m).hits.includes(light[0]));m=seek(m,x=>stackEvent(x)==='weapon-fired');assert.ok(battle(m).hits.includes(light[0]));
});
