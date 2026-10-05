import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,rules,state,pull,phase,step,seek,ids,clone} from './prisoner-fixture.mjs';
const gate=mod('laser-gate');
function fixture(){
 const decks=['dark','light'].map(side=>({side,cards:[...(side==='dark'?['1_283','1_284','2_113','101_5']:['1_21']),...Array(60).fill(side==='dark'?'1_194':'1_28')].slice(0,60)}));
 let m=runtime.createMatch('gate-movement',60,decks,rules);
 const a=pull(m,'dark','1_283'),b=pull(m,'dark','1_284');m.locations.push(a,b);
 const weak=pull(m,'dark','1_194','table',a),strong=pull(m,'dark','101_5','table',a),device=pull(m,'dark','2_113','table');gate.bindLaserGate(m,device,a,b);
 for(const side of ['dark','light'])for(let i=0;i<8;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','move');return {m,a,b,weak,strong,device};
}
test('Laser Gate filters real Move-phase choices and permits a strong character in either direction',()=>{
 const f=fixture();assert.ok(!ids(f.m).includes('move:'+f.weak+':'+f.b));assert.ok(ids(f.m).includes('move:'+f.strong+':'+f.b));
 let m=seek(step(f.m,'move:'+f.strong+':'+f.b),x=>x.cards[f.strong].location===f.b);
 assert.equal(gate.laserGateAllowsPassage(m,f.strong,f.b,f.a),true);
 for(const side of ['dark','light'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));
});
test('passage uses current values, and rechecks after a movement response',()=>{
 const f=fixture();mod('ability').addAbilityModifier(f.m,f.strong,f.weak,'add',3);
 assert.ok(ids(f.m).includes('move:'+f.weak+':'+f.b));
 let m=step(f.m,'move:'+f.weak+':'+f.b);delete m.data.abilityModifiers;
 m=seek(m,x=>!x.stack.some(r=>r.kind==='resolution'&&r.action.handler==='ground:move'));
 assert.equal(m.cards[f.weak].location,f.a,'losing passage eligibility during response stops the move');
});
test('suppressed or lost Gate removes passage restriction without moving either site',()=>{
 const f=fixture();mod('game-text').suppressGameText(f.m,f.strong,f.device);
 assert.ok(ids(f.m).includes('move:'+f.weak+':'+f.b));
 delete f.m.data.gameTextSuppressions;mod('table').loseFromTable(f.m,[f.device]);
 assert.ok(ids(f.m).includes('move:'+f.weak+':'+f.b));assert.deepEqual(f.m.locations,[f.a,f.b]);
});
test('Obi-Wan move-away choices respect the passage restriction',()=>{
 const f=fixture(),obi=pull(f.m,'light','1_21','table',f.a);
 // Obi-Wan's explicit move-away grant must still respect the Gate. A trooper
 // with no legal adjacent destination gets only the printed loss alternative.
 const p={source:mod('identity').referenceCard(f.m,obi),target:mod('identity').referenceCard(f.m,f.weak),site:mod('identity').referenceCard(f.m,f.a),window:1};
 assert.deepEqual(mod('obi-wan').obiWanChoices(f.m,{kind:'decision',side:'dark',handler:'obi:choose',payload:p}).map(c=>c.id),['obi:lose']);
});
