import {fixture as vessels,pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,settled} from './vessels-fixture.mjs';
export {pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,settled};
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export const values=(m,id)=>({power:mod('board').power(m,id),maneuver:mod('piloting').vesselManeuver(m,id),hyperspeed:mod('piloting').vesselHyperspeed(m,id)});
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export function fixture(){
 const f=vessels({light:['1_129','1_70','1_70','1_158','1_115','1_115','1_144','1_140'],dark:['1_284','1_267','1_194','2_143','1_241','1_241','1_323','1_302','1_262','1_262','1_317','1_300']});let m=f.m;
 const few=pull(m,'light','1_70','hand'),few2=pull(m,'light','1_70','hand'),dark=pull(m,'dark','1_241','hand'),dark2=pull(m,'dark','1_241','hand');
 for(const id of [f.ywing,f.scout]){state.moveCard(m,id,'table');m.cards[id].location=f.planet;}
 const capital=pull(m,'dark','1_302','table',f.planet),turbo=pull(m,'dark','1_323','table',f.planet),torpedo=pull(m,'light','1_158','table',f.planet),tie=pull(m,'dark','1_300','table',f.planet);state.moveCard(m,f.pilot,'table');Object.assign(m.cards[f.pilot],{attachedTo:tie,aboardRole:'pilot',location:f.planet});m.cards[turbo].attachedTo=capital;m.cards[torpedo].attachedTo=f.ywing;
 m.turn.side='light';m.turn.phase='deploy';m.stack[0].priority='light';m.stack[0].passes=0;
 return {...f,m,few,few2,dark,dark2,capital,turbo,torpedo,tie};
}
export const play=(m,card,target)=>seek(step(priority(m,m.cards[card].owner),'maneuver:'+card+':'+target),x=>x.cards[card].zone!=='playing');
export function shot(f,light=false){let m=f.m;const side=light?'light':'dark',gun=light?f.torpedo:f.turbo,target=light?f.scout:f.ywing;
 // Controlled physical destinies, consumed by the actual draw pipeline.
 const destinies=Array.from({length:2},()=>pull(m,side,light?'1_115':'1_262','hand'));for(const id of destinies)state.moveCard(m,id,'reserve');
 m.turn.side=side;m.turn.phase='battle';m.stack[0].priority=side;
 m=priority(boundary(step(m,'battle:'+f.planet),'battle-weapons'),side);return boundary(step(m,'space-weapon:fire:'+gun+':'+target),'destiny-drawn');
}
