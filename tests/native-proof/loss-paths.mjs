import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
let observer;export const observe=fn=>observer=fn;
export const clone=m=>JSON.parse(JSON.stringify(m));
export const card=(m,b,zone='table')=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone===zone);
export const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
export function step(m,choice){const p=prompt(m);const next=applyCommand(clone(m),p.side,{choice,prompt:p.id});assertMatch(next);observer?.(m,choice,next);return next}
export const fallback=m=>pick(m,'battle')?.id||pick(m,'drain')?.id||pick(m,'draw-destiny')?.id||pick(m,'pass')?.id||pick(m,'forfeit:')?.id||prompt(m).choices[0].id;
export function until(m,done,select=fallback){for(let n=0;n<250;n++){if(done(m))return m;assert.ok(!m.complete,'Finished before target');m=step(m,select(m))}throw Error('Target not reached')}
export const ready=m=>until(m,x=>x.complete||!prompt(x).automatic);
export const finish=m=>until(m,x=>x.complete);
export const scenarioFor=path=>path.startsWith('drain-')?'reduce-drain':path.startsWith('damage-')?'reduce-damage':'talz-rescue';
export const paths=['drain-pass','drain-one','drain-two','drain-overpay','drain-after-loss','drain-two-copies','damage-pass','damage-one','damage-four','damage-after-forfeit','rescue-healthy','rescue-hit','rescue-ordinary','rescue-zero'];
export function facts(m){const b=m.battle,face=id=>m.cards[id].blueprint;return {force:m.players.light.force.length,used:m.players.light.used.map(face),lost:m.players.light.lost.map(face),damage:b?.damage.light??0,attrition:b?.attrition.light??0,remaining:m.scenario==='reduce-drain'?(m.stack.find(f=>f.kind==='drain')?.remaining??0):b.damage.light,talzLost:!!card(m,'1_31','lost'),hits:b?b.participants.light.filter(id=>m.cards[id].hit).length:0,armedTrooperAlive:!!Object.values(m.cards).find(c=>c.blueprint==='1_152'&&c.zone==='table'&&c.attachedTo)};}
export function runPath(path){
 let m=createScenario(scenarioFor(path));
 if(path.startsWith('drain-')){
  m=until(m,x=>!!pick(x,'reduce:'));
  if(path==='drain-pass')m=finish(m);
  else{
   if(path==='drain-after-loss'){m=until(step(m,'pass'),x=>prompt(x)?.title==='Choose Force to lose');m=step(m,'lose:reserve');m=until(m,x=>!!pick(x,'reduce:'));}
   const amount=path==='drain-two'?2:path==='drain-overpay'?3:1;
   m=step(m,`reduce:${card(m,'1_90','hand').id}:${amount}`);m=ready(m);
   if(path==='drain-two-copies'){m=until(m,x=>!!pick(x,'reduce:'));m=ready(step(m,`reduce:${card(m,'1_90','hand').id}:1`));}
   m=finish(m);
  }
 }else if(path.startsWith('damage-')){
  m=until(m,x=>!!pick(x,'reduce:'));
  if(path==='damage-pass'){m=until(step(m,'pass'),x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side==='light');}
  else{
   if(path==='damage-after-forfeit'){m=until(step(m,'pass'),x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side==='light');m=step(m,pick(m,'forfeit:').id);m=until(m,x=>!!pick(x,'reduce:'));}
   const amount=path==='damage-four'?4:1;m=ready(step(m,`reduce:${card(m,'1_90','hand').id}:${amount}`));
  }
 }else{
  m=until(m,x=>x.stack.at(-1)?.kind==='weapons');
  if(path!=='rescue-zero'){
   const w=card(m,'1_317'),target=card(m,'1_152').attachedTo;m=ready(step(m,`fire:${w.id}:${target}`));
   if(path==='rescue-hit'){m=until(m,x=>x.stack.at(-1)?.kind==='weapons'&&prompt(x).side==='dark');m=ready(step(m,`fire:${card(m,'1_312').id}:${card(m,'1_31').id}`));}
   m=until(m,x=>!!pick(x,'rescue:'));
  }else{
   // One hit; both sides decline destiny so there are no numeric losses.
   m=ready(step(m,`fire:${card(m,'1_317').id}:${card(m,'1_152').attachedTo}`));
   m=until(m,x=>!!pick(x,'rescue:'),x=>pick(x,'skip-destiny')?.id||fallback(x));
  }
  if(path==='rescue-ordinary'){m=until(step(m,'pass'),x=>prompt(x)?.title==='Satisfy battle losses'&&prompt(x).side==='light');m=ready(step(m,'forfeit:'+card(m,'1_31').id));}
  else m=ready(step(m,pick(m,'rescue:').id));
 }
 const result=facts(m);m=finish(m);return {m,facts:result};
}
