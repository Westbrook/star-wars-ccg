import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,applyCommand,project,assertMatch}=engine;
export const clone=m=>JSON.parse(JSON.stringify(m));
export const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
let observer;
export const observe=fn=>{observer=fn};
export function step(m,id){const p=prompt(m);const next=applyCommand(clone(m),p.side,{prompt:p.id,choice:id});assertMatch(next);observer?.(m,id,next);return next}
export const fallback=m=>pick(m,'pass')?.id||pick(m,'recirculate')?.id||pick(m,'skip-destiny')?.id||pick(m,'forfeit:')?.id||prompt(m).choices[0].id;
export function until(m,done,select=fallback){for(let i=0;i<600;i++){if(done(m))return m;assert.equal(m.complete,false,'Study ended before target');m=step(m,select(m))}throw Error('Continuation bound')}
export const phase=(m,number,stage)=>until(m,x=>x.turn?.number===number&&x.turn.stage===stage&&(stage==='activate'||x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active));
export const setup=()=>until(createScenario('second-contact'),m=>!m.setup);
export const activate=m=>until(m,x=>x.turn.stage==='control',x=>pick(x,'activate')?.id||fallback(x));
export const ready=m=>phase(m,m.turn.number,'deploy');
export const byBlueprint=(m,b,zone='hand')=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone===zone);
export function deploy(m,b,site=m.locations[0]){m=ready(m);return step(m,'deploy:'+byBlueprint(m,b).id+':'+site)}
export function equip(m,b,host){m=ready(m);return step(m,'equip:'+byBlueprint(m,b).id+':'+host)}
export function move(m,id,to){m=phase(m,m.turn.number,'move');return step(m,'move:'+id+':'+to)}
export function end(m){return phase(m,m.turn.number+1,'activate')}
export function battle(m,site=m.locations[0],select=fallback){m=phase(m,m.turn.number,'battle');m=step(m,'battle:'+site);return until(m,x=>!!x.battle.resolved,select)}
export function snapshot(m,name){
 const r={name,active:m.active==='dark'?'Dark Side Player':'Light Side Player',phase:m.phase.toUpperCase()};
 for(const side of ['light','dark']){for(const z of ['force','reserve','hand','used','lost']){const title=z[0].toUpperCase()+z.slice(1);r[side+title]=m.players[side][z].length;const cards=m.players[side][z].map(id=>m.cards[id].blueprint);r[side+title+'Cards']=z==='hand'?cards.sort():cards;}}
 return r;
}
export function runPath(path){
 let m=setup();const records=[snapshot(m,path+'-opening')],battles=[];const remember=()=>{m=end(m);records.push(snapshot(m,path+'-end-'+(m.turn.number-1)))};
 if(path==='pass')for(let i=0;i<4;i++)remember();
 if(path==='draw')for(let i=0;i<4;i++){m=activate(m);m=phase(m,m.turn.number,'draw');m=until(m,x=>x.turn.stage==='end',x=>pick(x,'draw')?.id||fallback(x));remember();}
 if(path==='reengage'){
  m=activate(m);m=deploy(m,'1_194');const host=byBlueprint(m,'1_194','table').id;m=equip(m,'1_317',host);remember();
  for(const number of [2,3,4]){m=activate(m);if(number!==3)m=deploy(m,'1_28');m=battle(m,m.locations[0],x=>prompt(x).side==='dark'&&pick(x,'fire:')?pick(x,'fire:').id:fallback(x));battles.push(clone(m.battle));remember();}
 }
 if(path==='guards'){
  m=activate(m);m=deploy(m,'1_181');remember();
  m=activate(m);m=deploy(m,'1_26');m=step(m,pick(m,'play:').id);remember();
  m=activate(m);m=deploy(m,'1_170');const guard=byBlueprint(m,'1_181','table').id;
  m=battle(m,m.locations[0],x=>pick(x,'forfeit:'+guard)?.id||pick(x,'lose:reserve')?.id||fallback(x));battles.push(clone(m.battle));remember();
  m=activate(m);m=battle(m);battles.push(clone(m.battle));remember();
 }
 if(path==='rifle'){
  const corridor=m.locations[1];m=activate(m);m=deploy(m,'1_194',corridor);m=equip(m,'1_312',byBlueprint(m,'1_194','table').id);remember();
  m=activate(m);m=deploy(m,'1_28');m=move(m,byBlueprint(m,'1_28','table').id,corridor);remember();
  m=activate(m);m=battle(m,corridor,x=>pick(x,'fire:')?.id||fallback(x));battles.push(clone(m.battle));remember();
  m=activate(m);m=deploy(m,'1_28');m=move(m,byBlueprint(m,'1_28','table').id,corridor);remember();
 }
 if(path==='maximum-loss'){
  m=activate(m);m=deploy(m,'1_194');m=deploy(m,'1_170');remember();
  m=activate(m);m=deploy(m,'1_28');m=battle(m,m.locations[0],x=>pick(x,'lose:reserve')?.id||fallback(x));battles.push(clone(m.battle));remember();
  m=activate(m);m=deploy(m,'1_170');m=battle(m,m.locations[0],x=>pick(x,'draw-destiny')?.id||pick(x,'lose:reserve')?.id||fallback(x));battles.push(clone(m.battle));remember();
  m=activate(m);remember();
 }
 if(path==='pressure'){
  m=activate(m);m=deploy(m,'1_181');m=deploy(m,'1_194');remember();
  m=activate(m);m=deploy(m,'1_28');m=battle(m,m.locations[0],x=>pick(x,'lose:reserve')?.id||fallback(x));battles.push(clone(m.battle));remember();
  m=activate(m);remember();
  m=activate(m);remember();
 }
 if(path==='drains'){
  m=activate(m);m=deploy(m,'1_170');remember();m=activate(m);m=deploy(m,'1_28');m=move(m,byBlueprint(m,'1_28','table').id,m.locations[1]);remember();
  for(const number of [3,4]){m=activate(m);const site=m.locations[number===3?0:1];m=step(m,'drain:'+site);m=until(m,x=>x.stack.at(-1)?.kind==='turn',x=>pick(x,'lose:reserve')?.id||fallback(x));remember();}
 }
 assert.equal(m.complete,true);return {m,records,battles};
}
