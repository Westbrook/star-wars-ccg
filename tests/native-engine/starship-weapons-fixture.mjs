import {fixture as vessels,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load};
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export function fixture(bp='1_158',stage='battle',equipped=true,targetCapital=false){
 const f=vessels({light:['1_6','1_129','1_158','1_158','1_159','1_159','1_140','1_140','1_147','1_144','1_115','1_115','1_105'],dark:['1_284','1_323','1_323','1_302','1_302','1_305','1_262','1_262','1_317']});
 let m=f.m;const side=bp==='1_323'?'dark':'light',enemy=side==='dark'?'light':'dark';
 const host=bp==='1_158'?f.ywing:pull(m,side,bp==='1_159'?'1_140':'1_302','hand');
 const target=targetCapital?pull(m,enemy,enemy==='dark'?'1_302':'1_140','hand'):side==='light'?f.scout:f.ywing;
 for(const c of [host,target]){state.moveCard(m,c,'table');m.cards[c].location=f.planet;}
 const weapon=pull(m,side,bp,equipped?'table':'hand');if(equipped){m.cards[weapon].attachedTo=host;m.cards[weapon].location=f.planet;}
 m.turn.side=side;m.turn.phase=stage;m.stack[0].priority=side;m.stack[0].passes=0;
 return {...f,m,ground:f.site,site:f.planet,side,enemy,host,target,weapon};
}
export function draws(f,values){
 const m=f.m;for(const id of [...m.players[f.side].reserve])state.moveCard(m,id,'hand');
 for(const value of [...values].reverse()){
  const id=Object.values(m.cards).find(c=>c.owner===f.side&&c.zone==='hand'&&Number(rulesCard(c.blueprint).stats.destiny)===value)?.id;
  if(!id)throw Error('No fixture destiny '+value);state.moveCard(m,id,'reserve');
 }
}
const rulesCard=load(new URL('../../lib/native-engine/definitions.ts',import.meta.url)).definition;
export function initiated(f,values=[5,5]){draws(f,values);return step(priority(boundary(step(f.m,'battle:'+f.site),'battle-weapons'),f.side),'space-weapon:fire:'+f.weapon+':'+f.target);}
export const fire=(f,values)=>boundary(initiated(f,values),'weapon-fired');
