import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
function view(choices,mandatory=false){return {id:'policy-test',revision:1,status:'playing',turn:{side:'dark'},table:[],players:{dark:{hand:[],lost:[],destiny:[],lifeForce:10},light:{hand:[],lost:[],destiny:[],lifeForce:10}},prompt:{side:'dark',timing:'phase',mandatory,choices:choices.map(id=>({id,label:id}))}}}
test('computer refuses another seat, finished games and concession-only prompts',()=>{
 const v=view(['pass']);assert.equal(chooseComputerAction(v,'light'),null);assert.equal(chooseComputerAction({...v,status:'finished'},'dark'),null);assert.equal(chooseComputerAction(view(['concede']),'dark'),null);
});
test('computer preserves final Life Force, caps hand growth and passes unknown optional actions',()=>{
 const v=view(['core:draw','pass']);assert.equal(chooseComputerAction(v,'dark'),'core:draw');v.players.dark.lifeForce=1;assert.equal(chooseComputerAction(v,'dark'),'pass');assert.equal(chooseComputerAction(view(['unknown:action','pass']),'dark'),'pass');assert.equal(chooseComputerAction(view(['unknown:action'],true),'dark'),'unknown:action');
});
test('party selection confirms rather than repeatedly toggling and never voluntarily skips destiny',()=>{
 assert.equal(chooseComputerAction(view(['toggle:a','confirm','cancel'],true),'dark'),'confirm');assert.equal(chooseComputerAction(view(['skip-destiny','draw-destiny'],true),'dark'),'draw-destiny');
});
for(const [size,seed] of [[40,1],[40,8],[60,1],[60,8]])test(`projected CPU self-play finishes ${size} cards seed ${seed} without privileged state`,()=>{
 let m=runtime.createMatch('cpu-match-'+size+'-'+seed,size,starterDecks(size),auditRules);const entropy=seeded(seed);let now=1_800_000_000_000;
 for(let i=0;i<18000&&m.status!=='finished';i++){
  now+=1000;m=runtime.advanceTime(m,auditRules,now,entropy);
  if(m.status==='finished')break;
  let v=runtime.project(m,auditRules,'dark',now),side='dark';if(!v.prompt?.choices.length){side='light';v=runtime.project(m,auditRules,side,now)}
  const before=clone(v),choice=chooseComputerAction(v,side);assert.ok(choice,`missing decision at ${m.turn.number}`);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');assert.deepEqual(v,before);
  assert.equal(chooseComputerAction(clone(v),side),choice);
  m=runtime.applyCommand(clone(m),auditRules,side,{revision:m.revision,choice},entropy,now);
 }
 assert.equal(m.status,'finished',`budget exhausted at turn ${m.turn.number}`);assert.equal(m.result.reason,'life-force');
});
