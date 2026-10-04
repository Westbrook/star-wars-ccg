import {fixture as base,pull,phase,priority,seek,step,load,rules,runtime,board,state} from './hoth-fixture.mjs';
export {pull,phase,priority,seek,step,load,rules,runtime,board,state};
export {ids,prompt,clone} from './noble-fixture.mjs';
export function fixture(){
 const f=base({extra:{dark:['3_155','3_158','3_158','3_115','3_115','1_262','1_194','1_179','1_194'],light:['1_28','1_153','3_61']}}),m=f.m;
 const walker=pull(m,'dark','3_155','table',f.trench),gun=pull(m,'dark','3_158','table',f.trench),epic=pull(m,'dark','3_115','hand');m.cards[gun].attachedTo=walker;
 for(const site of [f.perimeter,f.ridge])pull(m,'dark','1_194','table',site);
 const victim=pull(m,'light','1_28','table',f.gen),rifle=pull(m,'light','1_153','table',f.gen);m.cards[rifle].attachedTo=victim;
 return {...f,walker,gun,epic,victim,rifle};
}
export const controlling=m=>priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='control'&&x.stack.length===1),'dark');
export const normal=m=>seek(m,x=>x.stack.length===1);
export function ready(f,die='1_262'){f.m=controlling(f.m);const id=pull(f.m,'dark',die,'hand');state.moveCard(f.m,id,'reserve');return f;}
export const fire=f=>step(f.m,'generator:fire:'+f.epic+':'+f.gun+':'+f.walker);
