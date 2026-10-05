import assert from 'node:assert/strict';
import {mod,runtime,state,rules,pull,phase,step,ids} from './prisoner-fixture.mjs';
const ships=mod('captured-ships');
export const shipDecks=()=>['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_127','1_140','1_19','1_28','1_152','1_40','1_109','1_13','1_147']:['1_302','2_115','2_142','1_168','1_241']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
export function fixture(crew=2,{capture=true,beamInHand=false,decks=shipDecks()}={}){
 let m=runtime.createMatch('captured-ships',60,decks,rules);
 const site=pull(m,'light','1_127');m.locations.push(site);
 const ship=pull(m,'light','1_140','table',site),host=pull(m,'dark','1_302','table',site),beam=pull(m,'dark','2_115','table',site);m.cards[beam].attachedTo=host;
 const characters=[];for(let i=0;i<crew;i++){const id=pull(m,'light',i?'1_28':'1_19','table',site);m.cards[id].attachedTo=ship;m.cards[id].aboardRole=i?'passenger':'pilot';characters.push(id);}
 const gun=crew?pull(m,'light','1_152','table',site):null;if(gun)m.cards[gun].attachedTo=characters[0];
 const card=pull(m,'dark','2_142','hand'),escort=pull(m,'dark','1_168','table',site);m.cards[escort].attachedTo=host;m.cards[escort].aboardRole='pilot';
 for(const side of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 if(beamInHand)state.moveCard(m,beam,'hand');
 m=phase(runtime.startTurns(m,rules),'dark','control');if(capture)ships.captureStarship(m,ship,host);
 return {m,ship,host,site,beam,card,characters,gun,escort};
}

export function ending(f){
 let m=phase(f.m,'dark','battle');m=step(m,'battle:'+f.site);
 for(let i=0;i<500;i++){
  if(ids(m).some(id=>id.startsWith('tractor:use:')))return m;
  const cs=ids(m);m=step(m,cs.includes('pass')?'pass':cs.includes('skip-destiny')?'skip-destiny':cs.includes('battle-lose:force')?'battle-lose:force':cs[0]);
 }throw Error('No battle-ending Tractor Beam action.');
}
