import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,gate,bridge,rules,state,identity,text,ability,clone,pull,prompt,step,seek,deploy,ready} from './laser-gate-fixture.mjs';
const order=m=>m.stack.at(-1)?.handler==='retract:order';
function rearrange(f,m=ready(deploy(f))){m=step(m,prompt(m).choices.find(c=>c.id.startsWith('retract:play:'+f.retract+':rearrange')).id);return seek(m,order);}
test('free Gate deploy between adjacent mobile interior sites persists both physical endpoints',()=>{
 const f=fixture(),before=f.m.players.dark.force.length;let m=step(f.m,'laser-gate:deploy:'+f.card+':'+f.core+':'+f.corridor);
 assert.deepEqual(prompt(clone(m)),prompt(m));m=seek(m,x=>x.cards[f.card].zone==='table');
 assert.equal(m.players.dark.force.length,before);assert.deepEqual(gate.laserGatePair(m,f.card).map(r=>r.id),[f.core,f.corridor]);assert.equal(m.cards[f.card].location,undefined);
 assert.deepEqual(gate.laserGateTargetsAt(m,f.core,'light'),[f.card]);assert.deepEqual(gate.laserGateTargetsAt(m,f.corridor,'light'),[f.card]);assert.deepEqual(gate.laserGateTargetsAt(m,f.bay,'light'),[]);assert.deepEqual(gate.laserGateTargetsAt(m,f.core,'dark'),[]);
});
test('deployment never offers nonadjacent endpoints, wrong side or phase',()=>{
 const f=fixture(),w=f.m.stack.at(-1),actions=gate.laserGateActions(f.m,w,'dark');assert.equal(actions.length,6);
 assert.ok(!actions.some(a=>a.id.endsWith(f.core+':'+f.bay)));assert.equal(gate.laserGateActions(f.m,w,'light').length,0);f.m.turn.phase='move';assert.equal(gate.laserGateActions(f.m,w,'dark').length,0);
});
test('Restricted2 gates: two physical copies may coexist, third absent',()=>{
 const f=fixture();let m=ready(deploy(f));m=ready(deploy({...f,m},f.second,f.corridor,f.bay));
 assert.equal(prompt(m).choices.filter(c=>c.id.startsWith('laser-gate:deploy:')).length,0);rules.validate(clone(m));
});
test('crossing uses current power plus ability, applies both ways and blocks ordinary vehicles',()=>{
 const f=fixture(),m=deploy(f);assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.core,f.corridor),false);assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.corridor,f.core),false);
 assert.equal(gate.laserGateAllowsPassage(m,f.hero,f.core,f.corridor),true);assert.equal(gate.laserGateAllowsPassage(m,f.vehicle,f.core,f.corridor),false);
 assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.corridor,f.bay),true);assert.equal(gate.laserGateAllowsPath(m,f.weak,[f.core,f.corridor,f.bay]),false);
 ability.addAbilityModifier(m,f.hero,f.weak,'add',3);assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.core,f.corridor),true);
});
test('suppressed Gate has no passage restriction or targeting permission; public view says inactive',()=>{
 const f=fixture(),m=deploy(f);text.suppressGameText(m,f.hero,f.card,'turn');assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.core,f.corridor),true);assert.deepEqual(gate.laserGateTargetsAt(m,f.core),[]);assert.equal(gate.laserGatesView(m).laserGates[f.card].active,false);
});
test('deployment cancellation and stale playing reference cannot deploy a replacement instance',()=>{
 const f=fixture();let m=step(f.m,'laser-gate:deploy:'+f.card+':'+f.core+':'+f.corridor),r=m.stack.find(x=>x.action?.handler==='laser-gate:deploy');
 r.cancelled=true;gate.laserGateResolve(m,r);assert.equal(m.cards[f.card].zone,'lost');
 m=step(f.m,'laser-gate:deploy:'+f.card+':'+f.core+':'+f.corridor);r=m.stack.find(x=>x.action?.handler==='laser-gate:deploy');state.moveCard(m,f.card,'hand');state.moveCard(m,f.card,'playing');gate.laserGateResolve(m,r);assert.equal(m.cards[f.card].zone,'playing');assert.equal(gate.laserGatePair(m,f.card),undefined);
});
test('stale site or Gate bindings never revive after leave and return',()=>{
 const f=fixture(),m=deploy(f);state.moveCard(m,f.card,'lost');state.moveCard(m,f.card,'table');assert.equal(gate.laserGatePair(m,f.card),undefined);assert.throws(()=>gate.assertLaserGate(m));
 const n=deploy(f);n.locations=n.locations.filter(id=>id!==f.core);for(const c of Object.values(n.cards))if(c.location===f.core)c.location=f.bay;state.moveCard(n,f.core,'hand');state.moveCard(n,f.core,'table');n.locations.unshift(f.core);assert.equal(gate.laserGatePair(n,f.card),undefined);assert.throws(()=>gate.assertLaserGate(n));
});
test('rearrangement offers durable optional relocation and holds Interrupt playing until completed',()=>{
 const f=fixture();let m=rearrange(f);m=step(m,'retract:site:'+f.core);assert.ok(!prompt(m).choices.some(c=>c.id==='retract:site:'+f.bay));m=step(m,'retract:site:'+f.corridor);m=step(m,'retract:site:'+f.bay);
 assert.equal(m.stack.at(-1).handler,'retract:relocate');assert.equal(m.cards[f.retract].zone,'playing');assert.deepEqual(prompt(m),prompt(clone(m)));
 assert.ok(prompt(m).choices.some(c=>c.id==='retract:gate:keep'));m=step(m,'retract:gate:'+f.corridor+':'+f.bay);
 assert.equal(m.cards[f.retract].zone,'lost');assert.deepEqual(gate.laserGatePair(m,f.card).map(r=>r.id),[f.corridor,f.bay]);assert.equal(gate.laserGateAllowsPassage(m,f.weak,f.core,f.corridor),true);
});
test('declining relocation retains pair through a reversed layout',()=>{
 const f=fixture();let m=rearrange(f);for(const id of [f.bay,f.corridor,f.core])m=step(m,'retract:site:'+id);
 m=step(m,'retract:gate:keep');assert.deepEqual(new Set(gate.laserGatePair(m,f.card).map(r=>r.id)),new Set([f.core,f.corridor]));assert.deepEqual(m.locations,[f.bay,f.corridor,f.core]);
});
test('two Gate relocation continuations survive independent choices and JSON refresh',()=>{
 const f=fixture();let m=ready(deploy(f));m=ready(deploy({...f,m},f.second,f.corridor,f.bay));m=rearrange(f,m);
 for(const id of [f.core,f.corridor,f.bay])m=step(m,'retract:site:'+id);
 m=step(m,'retract:gate:'+f.corridor+':'+f.bay);assert.equal(m.stack.at(-1).payload.gateIndex,1);assert.deepEqual(prompt(m),prompt(clone(m)));
 m=step(m,'retract:gate:keep');assert.equal(m.cards[f.retract].zone,'lost');assert.equal(gate.laserGatePair(m,f.second)[0].id,f.corridor);
});
test('relocation validator rejects missing Gate list, forged index and stale source',()=>{
 const f=fixture();let m=rearrange(f);for(const id of [f.core,f.corridor,f.bay])m=step(m,'retract:site:'+id);
 const missing=clone(m);delete missing.stack.at(-1).payload.gates;assert.throws(()=>bridge.assertRetractBridge(missing));
 const index=clone(m);index.stack.at(-1).payload.gateIndex=1;assert.throws(()=>bridge.assertRetractBridge(index));
 const stale=clone(m);state.moveCard(stale,f.card,'lost');state.moveCard(stale,f.card,'table');assert.throws(()=>bridge.assertRetractBridge(stale));assert.throws(()=>step(stale,'retract:gate:keep'));
});
test('canceling Retract before resolution never opens a relocation choice',()=>{
 const f=fixture(),m=ready(deploy(f));let n=step(m,prompt(m).choices.find(c=>c.id.startsWith('retract:play:'+f.retract+':rearrange')).id);
 n=seek(n,x=>prompt(x).choices.some(c=>c.id.startsWith('scomp:play:'+f.sky+':cancel:')));n=step(n,prompt(n).choices.find(c=>c.id.startsWith('scomp:play:'+f.sky+':cancel:')).id);n=seek(n,x=>x.cards[f.retract].zone==='lost');assert.ok(!n.stack.some(x=>x.handler==='retract:relocate'));assert.deepEqual(gate.laserGatePair(n,f.card).map(r=>r.id),[f.core,f.corridor]);
});
test('real move commands exclude weak passage and resolve legal Luke passage after refresh',()=>{
 const f=fixture();let m=seek(deploy(f),x=>x.stack.length===1&&x.turn.side==='light'&&x.turn.phase==='move'&&prompt(x).side==='light');
 assert.ok(!prompt(m).choices.some(c=>c.id==='move:'+f.weak+':'+f.corridor));assert.throws(()=>step(m,'move:'+f.weak+':'+f.corridor));
 assert.ok(prompt(m).choices.some(c=>c.id==='move:'+f.hero+':'+f.corridor));m=step(clone(m),'move:'+f.hero+':'+f.corridor);m=seek(m,x=>x.cards[f.hero].location===f.corridor);assert.equal(m.cards[f.weak].location,f.core);
});
test('real site conversion retains the existing Gate gap using the replacement reference',()=>{
 const f=fixture(),replacement=pull(f.m,'light','1_124','hand');let m=deploy(f,f.card,f.corridor,f.bay);
 m=seek(m,x=>x.stack.length===1&&x.turn.side==='light'&&x.turn.phase==='deploy'&&prompt(x).side==='light');
 m=step(m,'site:'+replacement+':over:'+f.bay);m=seek(m,x=>x.cards[replacement].zone==='table');
 assert.equal(m.cards[f.bay].coveredBy,replacement);assert.deepEqual(gate.laserGatePair(m,f.card).map(r=>r.id),[f.corridor,replacement]);assert.deepEqual(gate.laserGateTargetsAt(m,replacement,'light'),[f.card]);rules.validate(clone(m));
});
