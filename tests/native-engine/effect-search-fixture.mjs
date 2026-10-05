import {runtime,rules,state,pull,location,force,step,seek,priority,prompt} from './noble-fixture.mjs';
export {runtime,rules,state,pull,location,force,step,seek,priority,prompt};
export const ordinary=m=>m.stack.length===1&&m.stack[0].kind==='window'&&m.stack[0].timing==='phase';
export function fixture({side='light',empty=false,amount=5}={}){
 const extras={light:['6_77','6_77','4_21','1_109','101_2','1_129'],dark:['6_160','6_160','4_134','1_267','101_5','1_284']};
 let m=runtime.createMatch('effect-search',60,['light','dark'].map(side=>({side,cards:[...extras[side],...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);
 const site=location(m,'light','1_129');location(m,'dark','1_284');
 const source=pull(m,side,side==='light'?'6_77':'6_160','hand'),copy=pull(m,side,side==='light'?'6_77':'6_160','hand');
 const target=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===(side==='light'?'4_21':'4_134')).id;
 if(empty)state.moveCard(m,target,'hand');
 const opponent=side==='light'?'dark':'light';const sense=pull(m,opponent,opponent==='light'?'1_109':'1_267','hand');pull(m,opponent,opponent==='light'?'101_2':'101_5','table',site);
 force(m,side,amount);force(m,opponent,4);m=runtime.startTurns(m,rules);m=seek(m,x=>ordinary(x)&&x.turn.phase==='control');m=priority(m,side);
 return {m,side,opponent,source,copy,target,sense};
}
export const play=f=>step(f.m,'effect-search:play:'+f.source);
export const choosing=m=>seek(m,x=>x.stack.at(-1)?.handler==='effect-search:choose');
export const finish=m=>seek(m,ordinary);
