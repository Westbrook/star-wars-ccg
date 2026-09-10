import assert from 'node:assert/strict';
import test from 'node:test';
import {engine} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,assertMatch,project,life}=engine;
const roundtrip=state=>{const restored=JSON.parse(JSON.stringify(state));assertMatch(restored);assert.deepEqual(prompt(restored),prompt(state));return restored};
function step(state,id){const p=prompt(state);return roundtrip(applyCommand(roundtrip(state),p.side,{choice:id,prompt:p.id}))}
function finish(state,select=p=>p.choices[0].id,observe=()=>{}){let steps=0;while(!state.complete){assert.ok(++steps<120);observe(state);state=step(state,select(prompt(state),state))}return state}

test('exact authored card pool, no hidden pile identities and wrong-seat/stale commands rejected',()=>{
 const state=createScenario('drain');const view=project(state,'dark');assert.equal(Object.keys(state.cards).length,120);assert.equal(view.players.light.counts.hand,1);assert.deepEqual(view.players.light.hand,[]);assert.ok(!('cards' in view));assert.ok(!('stack' in view));assert.equal(view.players.light.counts.reserve,56);
 const p=prompt(state);assert.throws(()=>applyCommand(state,'light',{choice:'drain',prompt:p.id}),/seat/);assert.throws(()=>applyCommand(state,'dark',{choice:'drain',prompt:'old'}),/stale/);assert.throws(()=>applyCommand(state,'dark',{choice:'deploy',prompt:p.id}),/legal/);
 assert.equal(state.revision,0);assert.throws(()=>createScenario('full-game'),/Unknown/);
});
test('activation preserves top-to-top order and response priority after reload',()=>{
 let state=createScenario('activation');const original=[...state.players.dark.reserve];state=step(state,'activate');assert.equal(prompt(state).side,'light');assert.equal(state.players.dark.force[0],original[0]);state=finish(state);assert.deepEqual(state.players.dark.force,original.slice(0,2).reverse());assert.equal(life(state,'dark'),60);assert.equal(state.players.dark.reserve.length,58);
 const declined=finish(createScenario('activation'),()=> 'pass');assert.equal(declined.players.dark.force.length,0);
});
for(const zone of ['reserve','force','used','hand'])test('drain loss from '+zone+' survives every decision reload',()=>{
 const initial=createScenario('drain');const expected=initial.players.light[zone][0];const state=finish(initial,p=>p.choices.find(c=>c.id.startsWith('lose:'+zone))?.id||p.choices[0].id);
 assert.equal(state.players.light.lost.length,1);assert.equal(state.players.light.lost[0],expected);assert.equal(state.drained.length,1);assert.ok(state.complete);
});
for(const drawLight of [true,false])for(const drawDark of [true,false])for(const forceFirst of [true,false])test(`battle L:${drawLight} D:${drawDark} Force first:${forceFirst}`,()=>{
 let maxDestiny=0,totals;const initial=createScenario('battle');const initialForce=initial.players.dark.force[0];
 const state=finish(initial,(p,m)=>{
  if(p.title==='Battle destiny')return (p.side==='light'?drawLight:drawDark)?'draw-destiny':'skip-destiny';
  if(forceFirst){const loss=p.choices.find(c=>c.id==='lose:reserve');if(loss)return loss.id}
  return p.choices[0].id;
 },m=>{maxDestiny=Math.max(maxDestiny,m.players.dark.destiny.length+m.players.light.destiny.length);if(m.battle.power.light!==4||m.battle.power.dark!==4)totals={...m.battle.power};if(m.players.light.destiny.length)assert.equal(life(m,'light'),55)});
 assert.equal(state.players.dark.force.length,0);assert.ok(state.players.dark.used.includes(initialForce));assert.equal(state.players.dark.destiny.length+state.players.light.destiny.length,0);assert.deepEqual(state.battle.damage,{light:0,dark:0});assert.deepEqual(state.battle.attrition,{light:0,dark:0});assert.equal(maxDestiny,drawLight||drawDark?1:0);
 if(drawLight&&drawDark){assert.deepEqual(totals,{light:7,dark:5});assert.equal(state.players.dark.lost.length,forceFirst?4:2);assert.equal(state.players.light.lost.length,1)}
 for(const side of ['light','dark'])assert.equal(project(state,'light').players[side].lost.length,Math.min(1,state.players[side].lost.length));
});
test('both Used piles append under Reserve in order, leaving unspent Force untouched',()=>{
 const initial=createScenario('recirculation');assert.equal(prompt(initial).side,'dark');const state=finish(initial);for(const side of ['light','dark']){assert.deepEqual(state.players[side].reserve,[...initial.players[side].reserve,...initial.players[side].used]);assert.deepEqual(state.players[side].force,initial.players[side].force);assert.deepEqual(state.players[side].used,[])}
});
