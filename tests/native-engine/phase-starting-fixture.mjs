import {decks as base} from './preparation-starting-fixture.mjs';
export {rules,runtime,playing,step,prompt,advance} from './preparation-starting-fixture.mjs';
export const decks=({size=60,first='dark',three=false,immune=false}={})=>base({size,first}).map(d=>({...d,cards:[d.cards[0],three?d.cards[1]:d.side==='light'?'6_77':'6_160',...Array(2).fill(d.side==='light'?'102_1':'5_110'),...(immune?[d.side==='light'?'4_21':'4_134']:[]),...Array(size).fill(d.side==='light'?'1_28':'1_194')].slice(0,size)}));

// Normal command-only client policy, matching PhaseStartFlowOracleTests. No
// cards, piles, phase state or shuffle order are edited after match creation.
export const firstLightBattle=m=>m.status==='playing'&&m.turn.side==='light'&&m.turn.phase==='battle';
export function flowClient(mode){
 const activated=new Set(),deployed=new Set();
 return {deployed,choose(m,p){
  let choice=p.choices.find(c=>c.id==='pass')??p.choices[0];
  const activate=p.choices.find(c=>c.id==='core:activate');
  const deploy=p.choices.find(c=>c.id.startsWith('deploy:')&&m.cards[c.id.split(':')[1]]?.blueprint===(p.side==='light'?'1_28':'1_194'));
  if(activate&&!activated.has(p.side)){activated.add(p.side);choice=activate;}
  else if(deploy&&!deployed.has(p.side)&&(mode==='both'||mode==='light'&&p.side==='light')){deployed.add(p.side);choice=deploy;}
  return choice;
 }};
}
