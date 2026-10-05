import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,clone} from './prisoner-fixture.mjs';
import {objectiveRules,objectiveFixture,objectiveStart,objectivePrompt,objectiveStep,objectiveSeek,tableCard} from './objective-fixture.mjs';
import {fixture,deployed,rules,phase,priority,pull,step,seek} from './undercover-fixture.mjs';
const choose=(m,packageRules,side)=>mod('computer').chooseComputerAction(runtime.project(m,packageRules,side),side);

test('CPU completes real mandatory Objective setup from each seat projection',()=>{
 let m=objectiveStart();for(let n=0;n<45&&m.status==='setup';n++){
  const p=objectivePrompt(m),choice=choose(m,objectiveRules,p.side);
  assert.ok(p.choices.some(c=>c.id===choice));m=objectiveStep(m,choice);
 }
 assert.equal(m.status,'playing');assert.equal(m.players.dark.hand.length,8);
 assert.equal(mod('objectives').objectiveRecords(m)[0].complete,true);
});

test('CPU uses an offered Objective retrieval for a public eligible Lost agent',()=>{
 const f=objectiveFixture();for(const bp of ['8_114','106_11','1_166','104_6'])tableCard(f.m,f.pick(bp),f.coruscant);
 let m=objectiveStep(f.m,objectivePrompt(f.m).choices[0].id);m=objectiveSeek(m,x=>x.cards[f.objective].face==='back');
 state.moveCard(m,f.pick('104_6'),'lost');m=objectiveSeek(m,x=>x.turn.side==='dark'&&x.turn.phase==='draw'&&objectivePrompt(x).side==='dark'&&x.stack.at(-1)?.timing==='phase');
 const view=runtime.project(m,objectiveRules,'dark'),id='objective:retrieve:'+f.objective;
 // Keep only two genuinely offered choices to isolate this policy decision.
 view.prompt.choices=view.prompt.choices.filter(c=>c.id===id||c.id==='pass');
 assert.equal(mod('computer').chooseComputerAction(view,'dark'),id);
 const shuffled=clone(m);shuffled.players.light.reserve.reverse();shuffled.players.dark.reserve.reverse();
 assert.equal(choose(m,objectiveRules,'dark'),choose(shuffled,objectiveRules,'dark'));
 m=objectiveStep(m,id);m=objectiveSeek(m,x=>x.stack.at(-1)?.handler==='retrieval:select');
 m=objectiveStep(m,choose(m,objectiveRules,'dark'));m=objectiveSeek(m,x=>x.cards[f.pick('104_6')].zone==='used');
 assert.equal(mod('objectives').objectiveRecord(m,f.objective).retrieved,m.turn.number);
});

test('CPU sends a threatened spy undercover and does not immediately break cover',()=>{
 const f=fixture({side:'light'});for(let n=0;n<3;n++)pull(f.m,'dark','1_194','table',f.site);
 const id='undercover:deploy:'+f.effect+':'+f.spy,view=runtime.project(f.m,rules,'light');
 view.prompt.choices=view.prompt.choices.filter(c=>c.id===id||c.id==='pass');
 assert.equal(mod('computer').chooseComputerAction(view,'light'),id);
 let m=deployed(f);m=seek(m,x=>x.stack.length===1&&x.stack[0].timing==='phase');m=priority(m,'light');
 const after=runtime.project(m,rules,'light');after.prompt.choices=after.prompt.choices.filter(c=>c.id==='undercover:break:'+f.spy||c.id==='pass');
 assert.equal(mod('computer').chooseComputerAction(after,'light'),'pass');
});

test('CPU moves undercover on the opponent turn only for a stronger visible drain block',()=>{
 const f=fixture({side:'light'});pull(f.m,'dark','1_194','table',f.to);
 let m=priority(phase(deployed(f),'dark','move'),'light');
 const id='undercover:move:'+f.spy+':'+f.to,view=runtime.project(m,rules,'light');
 assert.ok(view.prompt.choices.some(c=>c.id===id));view.prompt.choices=view.prompt.choices.filter(c=>c.id===id||c.id==='pass');
 assert.equal(mod('computer').chooseComputerAction(view,'light'),id);
 const before=m.players.light.force.length;m=step(m,id);m=seek(m,x=>x.cards[f.spy].location===f.to);
 assert.equal(m.players.light.force.length,before-1);
 assert.equal(mod('undercover-state').activeUndercoverSpy(m,f.spy),true);
});
