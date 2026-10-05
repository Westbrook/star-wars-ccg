import assert from 'node:assert/strict';
import {runtime,rules,state,pull,location,force,step,seek,priority,prompt} from './noble-fixture.mjs';
export {runtime,rules,state,pull,step,seek,priority,prompt};
export const ids=m=>prompt(m).choices.map(c=>c.id);
export const ordinary=(m,phase='control',side='dark')=>m.turn.phase===phase&&m.turn.side===side&&m.stack.length===1&&m.stack[0].timing==='phase';
export function fixture({side='dark',effects=['light'],zone='table',mode='sense',failure=false}={}){
 let m=runtime.createMatch('try-effects',60,['light','dark'].map(s=>({side:s,cards:[...(s==='light'?['1_129','101_2','4_21','4_21','1_109','1_71','1_115','1_115','102_1','1_90']:['1_284','101_5','4_134','4_134','1_267','1_234','1_262','101_6','102_6','1_278']),...Array(60).fill(s==='light'?'1_28':'1_194')].slice(0,60)})),rules);
 const site=location(m,'light','1_129');location(m,'dark','1_284');const characters={light:pull(m,'light','101_2','table',site),dark:pull(m,'dark','101_5','table',site)},cards={},senses={},alters={},shuffles={},otherEffects={};
 for(const s of ['light','dark']){cards[s]=pull(m,s,s==='light'?'4_21':'4_134',effects.includes(s)?zone:'hand');senses[s]=pull(m,s,s==='light'?'1_109':'1_267','hand');alters[s]=pull(m,s,s==='light'?'1_71':'1_234','hand');shuffles[s]=pull(m,s,s==='light'?'1_115':'1_262','hand');otherEffects[s]=pull(m,s,s==='light'?'102_1':'102_6','table');force(m,s,5);}
 m=runtime.startTurns(m,rules);m=seek(m,x=>ordinary(x));
 const die=pull(m,side,failure?(side==='light'?'1_115':'101_6'):(side==='light'?'1_28':'1_194'),'hand');state.moveCard(m,die,'reserve');
 return {m,side,cards,senses,alters,shuffles,otherEffects,characters,site,die,mode};
}
export function play(f){const opponent=f.side==='light'?'dark':'light';let m=f.m;
 if(f.mode==='sense'){m=priority(m,opponent);m=step(m,'shuffle:'+f.shuffles[opponent]+':'+opponent+':reserve');m=priority(m,f.side);m=step(m,'cancel:play:'+f.senses[f.side]+':'+f.shuffles[opponent]+':'+f.characters[f.side]);}
 else {m=priority(m,f.side);m=step(m,'cancel:play:'+f.alters[f.side]+':'+f.otherEffects[opponent]+':'+f.characters[f.side]);}
 return m;
}
export const finish=m=>seek(m,x=>ordinary(x));
export const success=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='sense-alter-destiny-successful');
export const loss=m=>seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');
