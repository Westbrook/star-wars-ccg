import {fixture as base,pull,phase,priority,step,seek,load,rules,runtime,board,state} from './hoth-fixture.mjs';
export {pull,phase,priority,step,seek,load,rules,runtime,board,state};
export {ids,prompt,clone} from './noble-fixture.mjs';
export function fixture({artillery=false,remote=false,target='character',source='generator'}={}){
 const f=base({extra:{light:['3_75','3_75','3_8','4_13','1_28','1_28','1_153','1_149','1_147','1_115','1_28'],dark:['3_155','3_158','3_158','1_194','1_194','1_262','3_158','1_175','3_96']}}),m=f.m;
 const site=f.gen,origin=remote?f.trench:site,side=artillery?'light':'dark';
 const warrior=pull(m,'light','1_28','table',artillery?origin:site),trooper=pull(m,'dark','1_194','table',site);
 const walker=pull(m,'dark','3_155','table',artillery?site:origin);
 const gun=pull(m,side,artillery?'3_75':'3_158','table',origin);m.cards[gun].attachedTo=artillery?origin:walker;
 if(artillery&&remote)pull(m,'light','1_28','table',site);
 const rifle=pull(m,'light','1_153','table',m.cards[warrior].location);m.cards[rifle].attachedTo=warrior;
 const victim=artillery?trooper:target==='character'?warrior:pull(m,'light',target==='vehicle'?'1_149':'1_147','table',site);
 let powerSource;
 if(source!=='generator'){
  m.cards[site].blownAway=true;
  if(source==='droid')powerSource=pull(m,'light','3_8','table',origin);
  if(source==='fusion'){const carrier=pull(m,'light','1_28','table',origin);powerSource=pull(m,'light','4_13','table',origin);m.cards[powerSource].attachedTo=carrier;}
 }
 return {...f,site,origin,side,gun,walker,warrior,trooper,rifle,victim,powerSource,artillery};
}
export function ready(f){let m=phase(f.m,'battle');m=priority(m,'dark');m=step(m,'battle:'+f.site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');f.m=priority(m,f.side);return f;}
export function destiny(f,bp=f.side==='dark'?'1_262':'1_115'){const id=pull(f.m,f.side,bp,'hand');state.moveCard(f.m,id,'reserve');return f;}
export const fire=f=>step(f.m,'heavy:fire:'+f.gun+':'+(f.artillery?f.warrior:f.walker)+':'+f.victim);
export const done=m=>seek(m,x=>x.data.heavyShots?.at(-1)?.stage==='complete'&&x.stack.at(-1)?.event?.kind==='battle-weapons');
