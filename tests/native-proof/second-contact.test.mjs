import test from 'node:test';import assert from 'node:assert/strict';
import {load} from './load-engine.mjs';
import {runPath,setup,step,phase,activate,deploy,ready,byBlueprint,pick,until,fallback,project,assertMatch,createScenario,clone,prompt} from './second-contact-paths.mjs';
const {secondContactSafe}=load(new URL('../../lib/native-proof/opening-rules.ts',import.meta.url));
for(const path of ['pass','draw','reengage','guards','rifle','drains','pressure','maximum-loss'])test('four-turn '+path+' path preserves legal actions, card pool and endpoint',()=>{
 const {m,records}=runPath(path);assert.equal(m.engine,'native-proof-9');assert.equal(m.turn.number,5);assert.equal(m.turn.stage,'activate');assert.equal(m.active,'dark');assert.equal(m.cycle.generation,3);assert.equal(m.cycle.history.length,4);assert.equal(records.length,5);assert.equal(m.battle,null);assert.deepEqual(m.turn.moved,[]);assert.deepEqual(m.turn.battled,[]);assert.deepEqual(m.drained,[]);
 for(const side of ['dark','light']){const p=project(m,side);assert.deepEqual(p.players[side==='dark'?'light':'dark'].hand,[]);assert.equal(Object.keys(m.cards).length,120);}
});
test('broader eight-card hands and safe Reserve prefixes have explicit reachable behavior',()=>{
 const m=setup();for(const side of ['dark','light']){assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].reserve.length,51);const count=side==='dark'?14:10;for(const id of [...m.players[side].hand,...m.players[side].reserve.slice(0,count)])assert.ok(secondContactSafe(side).includes(m.cards[id].blueprint));assert.equal(secondContactSafe(side).includes(m.cards[m.players[side].reserve[count]].blueprint),false);}
 assert.ok(byBlueprint(m,'1_170'));assert.ok(byBlueprint(m,'1_181'));assert.ok(byBlueprint(m,'1_26'));assert.ok(byBlueprint(m,'1_153'));assert.ok(byBlueprint(m,'1_312'));
});
test('same weapon fires in three successive battles while hits, losses and Force carry between turns',()=>{
 const {m,battles}=runPath('reengage');assert.equal(battles.length,3);assert.deepEqual(battles.map(b=>b.shots[0].hit),[false,true,true]);assert.equal(new Set(battles.map(b=>b.shots[0].weapon)).size,1);assert.ok(battles.every(b=>b.resolved&&b.shots.length===1));assert.equal(m.players.light.lost.length,2);assert.equal(m.players.dark.force.length,0);
});
test('guards change from defending to attacking, Barrier expiry does not erase printed immobility',()=>{
 const {m,battles}=runPath('guards');assert.deepEqual(battles.map(b=>b.power),[{dark:2,light:4},{dark:2,light:0}]);assert.equal(m.turn.expired.length,1);assert.equal(m.turn.expired[0].expiresTurn,2);assert.deepEqual(m.cycle.history.map(h=>h.expired),[0,1,0,0]);
});
test('Rifle and location bonus remain correct in second-turn battle after entering the Corridor',()=>{
 const {m,battles}=runPath('rifle');const shot=battles[0].shots[0];assert.equal(shot.cost,2);assert.equal(shot.bonus,2);assert.equal(shot.hit,true);assert.equal(m.cards[shot.weapon].attachedTo,shot.user);assert.equal(m.cards[shot.weapon].location,m.locations[1]);assert.equal(m.players.light.lost.length,1);
});
test('second turns establish real control drains using each side’s printed location text',()=>{
 const {m}=runPath('drains');assert.equal(m.players.light.lost.length,1);assert.equal(m.players.dark.lost.length,2);assert.equal(m.players.dark.force.length,4);assert.equal(m.players.light.force.length,2);
});
test('guard cannot receive weapons; carried Force pays a second-turn Barrier once',()=>{
 let m=activate(setup());m=ready(deploy(m,'1_181'));const guard=byBlueprint(m,'1_181','table').id;assert.equal(prompt(m).choices.some(c=>c.id.startsWith('equip:')&&c.id.endsWith(':'+guard)),false);
 m=activate(phase(m,2,'activate'));m=activate(phase(m,3,'activate'));m=deploy(m,'1_170');assert.ok(pick(m,'play:'));m=step(m,pick(m,'play:').id);assert.equal(m.turn.restrictions.length,0);m=ready(m);assert.equal(m.turn.restrictions[0].expiresTurn,3);m=phase(m,4,'activate');assert.equal(m.turn.restrictions.length,0);assert.equal(m.turn.expired[0].expiresTurn,3);assert.equal(m.players.light.force.length,1);
});
test('old First contact remains version 7 and ends before third-turn activation',()=>{
 let m=createScenario('first-contact');m=until(m,x=>x.complete);assert.equal(m.engine,'native-proof-7');assert.equal(m.turn.number,3);assert.equal(m.cycle.history.length,2);
});
test('400 seeded routes reconstruct every decision and keep all drawable cards supported',()=>{
 let seed=40401;const counts={activate:0,deploy:0,equip:0,battle:0,fire:0,move:0,draw:0,play:0,drain:0};let states=0;
 for(let route=0;route<400;route++){let m=createScenario('second-contact');m=until(m,x=>x.complete,x=>{for(const side of ['dark','light']){assert.deepEqual(project(x,side),project(clone(x),side));if(!x.setup)for(const id of [...x.players[side].hand,...x.players[side].force])assert.ok(secondContactSafe(side).includes(x.cards[id].blueprint));}states++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const options=prompt(x).choices,c=options[(seed>>>8)%options.length],key=c.id.split(':')[0];if(key in counts)counts[key]++;return c.id});assert.equal(m.turn.number,5);}
 for(const kind of ['activate','deploy','equip','battle','move','draw','play','drain'])assert.ok(counts[kind]>0,kind);console.log({secondContactStates:states,actions:counts});
});
test('future turn and unsupported hand fail closed',()=>{
 let m=setup();m.turn.number=6;assert.throws(()=>assertMatch(m),/continuous turn/);m=setup();const id=m.players.dark.hand[0];m.cards[id].blueprint='1_268';assert.throws(()=>assertMatch(m),/Unsupported card/);
});

test('early battle damage can consume four Reserve cards before the second activation',()=>{const {m,records}=runPath('pressure');assert.equal(records[2].lightLost,4);assert.equal(records[2].lightReserve,47);assert.equal(m.players.light.force.length,2);assert.equal(m.players.light.reserve.length,45);});

test('seven executed GEMP paths match all 35 exact turn-boundary pile snapshots',()=>{const g=load(new URL('./gemp/second-contact-oracle-result.json',import.meta.url)).branches;let count=0;for(const path of ['pass','reengage','guards','rifle','drains','pressure','maximum-loss'])for(const record of runPath(path).records){assert.deepEqual(record,g.find(r=>r.name===record.name));count++;}assert.equal(count,35);});

test('combined early and second-turn damage stays inside the last supported activation',()=>{const {m,battles}=runPath('maximum-loss');assert.deepEqual(battles.map(b=>b.power),[{dark:3,light:1},{dark:5,light:1}]);assert.equal(m.players.light.lost.length,6);for(const id of m.players.light.force)assert.ok(secondContactSafe('light').includes(m.cards[id].blueprint));});

test('altered setup order and saved shot modifiers fail closed',()=>{let m=createScenario('second-contact');const a=m.setup.shuffleOrder.dark;[a[0],a[1]]=[a[1],a[0]];assert.throws(()=>assertMatch(m),/four-turn recorded order/);m=activate(setup());m=deploy(m,'1_194',m.locations[1]);m=ready(m);m=step(m,'equip:'+byBlueprint(m,'1_312').id+':'+byBlueprint(m,'1_194','table').id);m=activate(phase(m,2,'activate'));m=deploy(m,'1_28');m=phase(m,2,'move');m=step(m,'move:'+byBlueprint(m,'1_28','table').id+':'+m.locations[1]);m=activate(phase(m,3,'activate'));m=phase(m,3,'battle');m=step(m,pick(m,'battle:').id);m=until(m,x=>!!pick(x,'fire:'));m=step(m,pick(m,'fire:').id);m.battle.shots[0].bonus=0;assert.throws(()=>assertMatch(m),/four-turn saved weapon modifier/);});
