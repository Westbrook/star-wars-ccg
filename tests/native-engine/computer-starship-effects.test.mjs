import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,action,mod,runtime,rules,clone,step,settled} from './starship-effects-fixture.mjs';
const choose=(m,side='light')=>mod('computer').chooseComputerAction(runtime.project(m,rules,side),side);
test('CPU deploys Special Modifications from its legal private projection and pays once',()=>{
 const f=fixture(),view=runtime.project(f.m,rules,'light'),before=clone(view);view.prompt.choices=view.prompt.choices.filter(c=>c.id===action(f)||c.id==='pass');
 assert.equal(mod('computer').chooseComputerAction(view,'light'),action(f));const m=settled(step(f.m,action(f)));assert.equal(m.cards[f.effect].attachedTo,f.ship);assert.equal(m.players.light.force.length,f.m.players.light.force.length-1);
 assert.deepEqual(runtime.project(f.m,rules,'light'),before);
});
test('CPU does not spend Special Modifications on an unpiloted ship and ignores hidden Reserve ordering',()=>{
 const f=fixture('unpiloted'),v=runtime.project(f.m,rules,'light');v.prompt.choices=v.prompt.choices.filter(c=>c.id===action(f)||c.id==='pass');assert.equal(mod('computer').chooseComputerAction(v,'light'),'pass');
 const g=fixture(),changed=clone(g.m);changed.players.dark.reserve.reverse();changed.players.light.reserve.reverse();assert.equal(choose(changed),choose(g.m));
});
test('CPU evaluates enemy-ship movement as counterplay rather than friendly fleet travel',()=>{
 const f=fixture(),view=runtime.project(f.m,rules,'light'),enemy={id:'enemy-executor',blueprint:'4_167',owner:'dark',zone:'table',location:'from'};view.table.push(enemy);
 // A pure public-projection policy fixture. The service remains responsible
 // for granting these moves; no private engine state is passed to the policy.
 view.prompt={side:'light',timing:'phase',mandatory:false,choices:['pass','voyage:hyperspace:'+enemy.id+':safe','voyage:hyperspace:'+enemy.id+':weak'].map(id=>({id,label:id}))};
 enemy.location='from';view.rules.vessels??={};view.rules.vessels[enemy.id]={power:12};view.rules.values.sites={from:{light:{power:5},dark:{power:12}},safe:{light:{power:0},dark:{power:0}},weak:{light:{power:3},dark:{power:0}}};
 assert.equal(mod('computer').chooseComputerAction(view,'light'),'voyage:hyperspace:'+enemy.id+':safe');
 view.prompt.choices=view.prompt.choices.filter(c=>!c.id.endsWith(':safe'));assert.equal(mod('computer').chooseComputerAction(view,'light'),'pass');
});
