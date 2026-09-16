import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
let observer;export const observe=f=>{observer=f};
export const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
export const step=(m,choice)=>{const p=prompt(m),next=applyCommand(JSON.parse(JSON.stringify(m)),p.side,{prompt:p.id,choice});observer?.(m,choice,next);return next};
export const fallback=m=>pick(m,'pass')?.id||pick(m,'recirculate')?.id||pick(m,'forfeit:')?.id||pick(m,'skip-destiny')?.id||prompt(m).choices[0].id;
export function until(m,done,choose=fallback){for(let i=0;i<700;i++){if(done(m))return m;assert.equal(m.complete,false,'Unexpected endpoint');m=step(m,choose(m))}throw Error('Continuation bound')}
export const ready=m=>until(m,x=>x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
export const phase=(m,stage,number=m.turn.number)=>until(m,x=>x.turn.number===number&&x.turn.stage===stage&&x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
export const card=(m,b,zone='hand')=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone===zone);
export const deploy=(m,b,at)=>{m=ready(m);return step(m,'deploy:'+card(m,b).id+':'+at)};
export const balances=m=>({lightForce:m.players.light.force.length,darkForce:m.players.dark.force.length,lightUsed:m.players.light.used.length,darkUsed:m.players.dark.used.length});
export const paths=['light-camp','light-dune','camp-barrier','dark-camp','dark-dune','ability-4','ability-5','ability-6','ability-barrier','patrol'];
export const scenarioFor=path=>path==='patrol'?'desert-patrol':path.startsWith('light')||path==='camp-barrier'?'jawa-bargain':'dune-sea';
export function runPath(path){
 let m=createScenario(scenarioFor(path)),facts={};
 if(path.startsWith('light')||path==='camp-barrier'){
  const at=m.locations[path==='light-dune'?1:0];m=deploy(m,'1_12',at);
  if(path==='camp-barrier')m=step(m,pick(m,'play:').id);
  m=ready(m);facts={...balances(m),barred:m.turn.restrictions.length,campAvailable:prompt(m).choices.some(c=>c.id.startsWith('deploy:')&&m.cards[c.card]?.blueprint==='1_12'&&c.id.endsWith(m.locations[0])),duneAvailable:prompt(m).choices.some(c=>c.id.startsWith('deploy:')&&m.cards[c.card]?.blueprint==='1_12'&&c.id.endsWith(m.locations[1]))};
 }
 if(path.startsWith('dark')){m=ready(deploy(m,'1_182',m.locations[path==='dark-camp'?0:1]));facts=balances(m)}
 if(path.startsWith('ability')){
  const count=path==='ability-4'?0:path==='ability-5'?1:2;
  for(let i=0;i<count;i++){m=deploy(m,path==='ability-barrier'&&i===1?'1_194':'1_182',m.locations[1]);if(path==='ability-barrier'&&i===0)m=step(m,pick(m,'play:').id);m=ready(m)}
  // Barrier spends Light's remaining Force after the first Jawa. Reinforce
  // with a Stormtrooper, not an unaffordable second bilateral Jawa.
  m=phase(m,'battle');m=step(m,'battle:'+m.locations[1]);
  m=until(m,x=>x.stack.at(-1)?.kind==='battle'&&x.stack.at(-1).stage==='damage'||x.stack.some(f=>f.kind==='battle'&&f.stage==='end'),x=>pick(x,'draw-destiny')?.id||fallback(x));
  facts={darkParticipants:m.battle.participants.dark.length,darkDestiny:m.battle.destiny.dark,lightDestiny:m.battle.destiny.light,darkPower:m.battle.power.dark,lightPower:m.battle.power.light,...balances(m)};
 }
 if(path==='patrol'){
  m=until(m,x=>x.turn.stage==='control'&&prompt(x).side==='dark',x=>pick(x,'activate')?.id||fallback(x));
  m=step(m,'drain:'+m.locations[1]);m=phase(m,'deploy');m=ready(deploy(m,'1_182',m.locations[1]));
  m=phase(m,'move');const id=card(m,'1_182','table').id;m=step(m,'move:'+id+':'+m.locations[0]);
  m=until(m,x=>x.turn.number===2&&x.turn.stage==='control'&&prompt(x).side==='light',x=>pick(x,'activate')?.id||fallback(x));
  m=phase(m,'deploy');m=deploy(m,'1_12',m.locations[0]);m=step(m,pick(m,'play:').id);m=ready(m);
  facts={...balances(m),turn:m.turn.number,generation:m.cycle.generation,barred:m.turn.restrictions.length,darkJawaAtCamp:m.cards[id].location===m.locations[0]};
 }
 m=until(m,x=>x.complete);return {m,facts};
}
