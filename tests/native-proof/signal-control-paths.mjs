import assert from 'node:assert/strict';
import {createScenario,prompt,step,until,fallback} from './integration-paths.mjs';
export const control=m=>m.stack.at(-1)?.kind==='drain-control'&&prompt(m)?.side==='dark';
export const paths=['bay-pass','bay-trooper','bay-wolfman','corridor-pass','corridor-trooper','corridor-wolfman'];
export function runControlPath(path){
 let m=createScenario('react-drain-deploy');const order=path.startsWith('bay')?[0,1]:[1,0];
 for(const index of order){
  m=until(m,control);m=step(m,'drain:'+m.locations[index]);
  if(index===0&&!path.endsWith('pass')){
   const bp=path.endsWith('wolfman')?'1_30':'1_28';
   const choice=prompt(m).choices.find(c=>c.reactPreview&&m.cards[c.card].blueprint===bp);assert.ok(choice);m=step(m,choice.id);
  }
  m=until(m,x=>x.reactStudy.drains.length===order.indexOf(index)+1);
 }
 m=until(m,x=>x.complete,fallback);return m;
}
