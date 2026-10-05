import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,bridge,runtime,rules,state,identity,clone,prompt,step,seek,play} from './retract-bridge-fixture.mjs';
const decision=m=>m.stack.at(-1)?.handler==='retract:order';
test('paid rearrangement retains occupants and only offers legal docking bay endpoints',()=>{
 const f=fixture();let m=f.m;const initial=m.players.dark.force.length;
 m=play(m,f.card);m=seek(m,decision);assert.equal(m.players.dark.force.length,initial-3);assert.equal(m.cards[f.hero].location,f.corridor);
 m=step(m,'retract:site:'+f.corridor);assert.ok(!prompt(m).choices.some(c=>c.id==='retract:site:'+f.bay));
 m=step(m,'retract:site:'+f.core);m=step(m,'retract:site:'+f.bay);
 assert.deepEqual(m.locations,[f.corridor,f.core,f.bay]);assert.equal(m.cards[f.hero].location,f.corridor);assert.equal(m.cards[f.card].zone,'lost');
});
test('rearrangement can reverse orientation with docking bay first',()=>{
 const f=fixture();let m=seek(play(f.m,f.card),decision);m=step(m,'retract:site:'+f.bay);m=step(m,'retract:site:'+f.corridor);m=step(m,'retract:site:'+f.core);assert.deepEqual(m.locations,[f.bay,f.corridor,f.core]);
});
test('Dark control of Central Core makes cost zero and loss of control after initiation does not reprice',()=>{
 const f=fixture();state.moveCard(f.m,f.trooper,'table');f.m.cards[f.trooper].location=f.core;
 const initial=f.m.players.dark.force.length;let m=play(f.m,f.card);state.moveCard(m,f.trooper,'lost');m=seek(m,decision);assert.equal(m.players.dark.force.length,initial);
});
test('paid initiation retains its price when Core control is later acquired',()=>{
 const f=fixture(),initial=f.m.players.dark.force.length;let m=play(f.m,f.card);state.moveCard(m,f.trooper,'table');m.cards[f.trooper].location=f.core;m=seek(m,decision);assert.equal(m.players.dark.force.length,initial-3);
});
test('choice continuation survives serialization; forged site lists and duplicate choices reject',()=>{
 const f=fixture();let m=seek(play(f.m,f.card),decision);m=step(m,'retract:site:'+f.bay);assert.deepEqual(prompt(m),prompt(clone(m)));
 assert.throws(()=>step(m,'retract:site:'+f.bay));
 const bad=clone(m);bad.stack.at(-1).payload.order.push(f.bay);assert.throws(()=>rules.validate(bad));
 const forged=clone(m);forged.stack.at(-1).payload.sites[0].version++;assert.throws(()=>rules.validate(forged));
});
test('named Skywalker cancellation cancels the pending Interrupt after payment',()=>{
 const f=fixture(),order=[...f.m.locations];let m=play(f.m,f.card);m=seek(m,x=>prompt(x).choices.some(c=>c.id.startsWith('scomp:play:'+f.sky+':cancel:')));m=step(m,prompt(m).choices.find(c=>c.id.startsWith('scomp:play:'+f.sky+':cancel:')).id);m=seek(m,x=>x.cards[f.card].zone==='lost');assert.deepEqual(m.locations,order);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-3);
});
test('cancel On The Edge after number/payment and before destiny; source and target go Lost',()=>{
 const f=fixture();let m=f.m;if(prompt(m).side!=='light')m=step(m,'pass');m=step(m,prompt(m).choices.find(c=>c.id.startsWith('edge:play:')).id);
 m=step(m,prompt(m).choices[0].id);m=seek(m,x=>prompt(x).choices.some(c=>c.id.startsWith('retract:play:'+f.card+':cancel')));m=play(m,f.card,'cancel');m=seek(m,x=>x.cards[f.edge].zone==='lost'&&x.cards[f.card].zone==='lost');assert.equal(m.players.light.destiny.length,0);
});
test('unaffordable, wrong-phase, and wrong-side rearrangements are absent',()=>{
 const f=fixture(),w=f.m.stack.at(-1);while(f.m.players.dark.force.length>2)state.moveCard(f.m,f.m.players.dark.force[0],'used');assert.deepEqual(bridge.retractBridgeActions(f.m,w,'dark'),[]);f.m.turn.phase='move';assert.deepEqual(bridge.retractBridgeActions(f.m,w,'dark'),[]);assert.deepEqual(bridge.retractBridgeActions(f.m,w,'light'),[]);
});

test('Sense can cancel Retract The Bridge; free Core cost does not confer immunity',()=>{
 const f=fixture();state.moveCard(f.m,f.trooper,'table');f.m.cards[f.trooper].location=f.core;
 const destiny=Object.values(f.m.cards).find(c=>c.owner==='light'&&c.zone==='reserve'&&c.blueprint==='1_129');assert.ok(destiny);state.moveCard(f.m,destiny.id,'hand');state.moveCard(f.m,destiny.id,'reserve');
 let m=play(f.m,f.card);m=seek(m,x=>prompt(x).choices.some(c=>c.id.startsWith('cancel:play:'+f.sense+':'+f.card+':')));m=step(m,prompt(m).choices.find(c=>c.id.startsWith('cancel:play:'+f.sense+':'+f.card+':')).id);m=seek(m,x=>x.cards[f.card].zone==='lost');assert.deepEqual(m.locations,f.m.locations);
});
test('rearrangement never revives an old physical source or a replaced site target',()=>{
 const f=fixture();let m=play(f.m,f.card);const r=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='retract:play');assert.ok(r);
 const before=[...m.locations];state.moveCard(m,f.card,'hand');state.moveCard(m,f.card,'playing');bridge.retractBridgeResolve(m,r);assert.deepEqual(m.locations,before);assert.equal(m.cards[f.card].zone,'playing');
 m=play(f.m,f.card);const other=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='retract:play');m.locations=m.locations.filter(id=>id!==f.core);state.moveCard(m,f.core,'hand');state.moveCard(m,f.core,'table');m.locations=[...before];bridge.retractBridgeResolve(m,other);assert.equal(m.cards[f.card].zone,'lost');assert.deepEqual(m.locations,before);
});

test('validators reject free prices without Core snapshot and incomplete target lists',()=>{
 const f=fixture();const m=play(f.m,f.card);
 const free=clone(m),r=free.stack.find(f=>f.action?.handler==='retract:play');r.action.payload.cost=0;r.action.payment={dark:0};assert.throws(()=>bridge.assertRetractBridge(free));
 const subset=clone(m),p=subset.stack.find(f=>f.action?.handler==='retract:play').action.payload;p.sites.pop();p.cost=p.sites.length;assert.throws(()=>bridge.assertRetractBridge(subset));
 const layout=clone(m),r2=layout.stack.find(f=>f.action?.handler==='retract:play');r2.action.payload.sites.pop();r2.action.payload.layout.pop();r2.action.payload.cost=2;r2.action.payment.dark=2;assert.throws(()=>bridge.assertRetractBridge(layout));
});
