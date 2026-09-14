import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
export const clone=m=>JSON.parse(JSON.stringify(m));
let observer;export const observe=f=>{observer=f};
export const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
export function step(m,choice){const p=prompt(m),next=applyCommand(clone(m),p.side,{prompt:p.id,choice});assertMatch(next);observer?.(m,choice,next);return next}
export const fallback=m=>pick(m,'pass')?.id||pick(m,'recirculate')?.id||pick(m,'skip-destiny')?.id||pick(m,'forfeit:')?.id||prompt(m).choices[0].id;
export function until(m,done,select=fallback){for(let i=0;i<350;i++){if(done(m))return m;assert.equal(m.complete,false);m=step(m,select(m))}throw Error('Scenario continuation bound')}
export const ready=m=>until(m,x=>x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
export const phase=(m,stage)=>until(m,x=>x.turn.stage===stage&&x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
export const card=(m,b,zone='hand')=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone===zone);
export function deploy(m,b,site=m.locations[0]){m=ready(m);return step(m,'deploy:'+card(m,b).id+':'+site)}
export function losses(m,draw=true){m=phase(m,'battle');m=step(m,pick(m,'battle:').id);return until(m,x=>x.stack.at(-1)?.kind==='battle'&&x.stack.at(-1).stage==='damage'||x.stack.some(f=>f.kind==='battle'&&f.stage==='end'),x=>draw&&pick(x,'draw-destiny')?pick(x,'draw-destiny').id:fallback(x));}
export const finish=m=>until(m,x=>x.complete);
export const scenarioFor=path=>path.startsWith('raider')?'tusken-band':['luke-first','trooper-first'].includes(path)?'luke-support':'luke-arrives';
export function runPath(path){
 let m=createScenario(scenarioFor(path)),facts={},checkpoints=[];const note=()=>checkpoints.push(clone(m));
 if(path==='farm-deploy'||path==='bay-deploy'){
  const farm=path==='farm-deploy',at=m.locations[farm?1:0],other=m.locations[farm?0:1];m=ready(deploy(m,'101_2',at));const afterLuke=m.players.light.force.length;assert.equal(pick(m,'deploy:'+card(m,'101_2').id),undefined);m=ready(deploy(m,'1_28',other));const before=m.players.light.force.length;m=ready(deploy(m,'1_28',at));const p=project(m,'light');facts={lukeCost:5-afterLuke,forceBeforeFree:before,forceAfterFree:m.players.light.force.length,lukeForfeit:p.table.find(c=>c.blueprint==='101_2').rulesView.forfeit,sameForfeit:p.table.find(c=>c.blueprint==='1_28'&&c.location===at).rulesView.forfeit,adjacentForfeit:p.table.find(c=>c.blueprint==='1_28'&&c.location===other).rulesView.forfeit,duplicateAvailable:false};note();
 }
 if(path==='barrier-luke'){
  m=deploy(m,'101_2');m=step(m,pick(m,'play:').id);note();m=ready(deploy(m,'1_28'));const id=card(m,'1_28','table').id,beforeForfeit=project(m,'light').table.find(c=>c.id===id).rulesView.forfeit;m=losses(m);note();const duringForfeit=pick(m,'forfeit:'+id).lossPreview.value;m=phase(m,'move');facts={beforeForfeit,duringForfeit,afterLukeForfeit:project(m,'light').table.find(c=>c.blueprint==='101_2').rulesView.forfeit,canMove:!!pick(m,'move:'+card(m,'101_2','table').id),lightLost:m.players.light.lost.length};
 }
 if(path==='luke-first'||path==='trooper-first'){
  m=losses(m);note();const p=project(m,'light'),troop=card(m,'1_28','table').id,luke=card(m,'101_2','table').id,guard=card(m,'1_26','table').id;const initial={damage:m.battle.damage.light,attrition:m.battle.attrition.light,trooperBefore:pick(m,'forfeit:'+troop).lossPreview.value,lukeForfeit:pick(m,'forfeit:'+luke).lossPreview.value,guardForfeit:pick(m,'forfeit:'+guard).lossPreview.value};m=step(m,'forfeit:'+(path==='luke-first'?luke:troop));m=until(m,x=>x.stack.at(-1)?.kind==='battle'&&x.stack.at(-1).stage==='damage');note();const view=project(m,'light');facts=path==='luke-first'?{...initial,trooperAfter:view.table.find(c=>c.blueprint==='1_28').rulesView.forfeit,damageAfter:m.battle.damage.light,attritionAfter:m.battle.attrition.light}:{damageAfter:m.battle.damage.light,attritionAfter:m.battle.attrition.light,remainingForfeit:view.table.find(c=>c.blueprint==='1_28').rulesView.forfeit,lukeForfeit:view.table.find(c=>c.blueprint==='101_2').rulesView.forfeit};
 }
 if(path==='adjacent-luke'){
  m=ready(deploy(m,'101_2',m.locations[1]));m=ready(deploy(m,'1_28'));m=ready(deploy(m,'1_28',m.locations[1]));m=losses(m);facts={trooperForfeit:pick(m,'forfeit:').lossPreview.value,force:m.players.light.force.length,lukeParticipates:m.battle.participants.light.includes(card(m,'101_2','table').id)};note();
 }
 if(path.startsWith('raiders-')){
  const count=Number(path.split('-')[1]);for(let i=1;i<count;i++)m=ready(deploy(m,'1_196'));const individualPower=project(m,'dark').table.find(c=>c.blueprint==='1_196').rulesView.power;note();m=losses(m,false);facts={individualPower,totalPower:m.battle.power.dark,force:m.players.dark.force.length};note();
 }
 if(path==='raider-barrier'){
  for(let i=0;i<2;i++)m=ready(deploy(m,'1_196'));m=deploy(m,'1_196');m=step(m,pick(m,'play:').id);note();m=ready(m);const outsideIndividual=project(m,'dark').table.find(c=>c.blueprint==='1_196').rulesView.power;m=losses(m,false);facts={outsideIndividual,totalPower:m.battle.power.dark,participants:m.battle.participants.dark.length};note();
 }
 m=finish(m);return {m,facts,checkpoints};
}
