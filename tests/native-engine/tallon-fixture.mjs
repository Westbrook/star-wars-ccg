import {fixture as vessels,pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,settled} from './vessels-fixture.mjs';
export {pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,settled};
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export function fixture(dark=1,light=5){
 const f=vessels({light:['1_129','2_47','2_47','1_70','1_70','1_109','1_115','1_28','1_124','1_144','1_158'],dark:['1_302','2_143','1_284','1_270','1_270','1_300','1_241','1_267','1_262','1_194','1_317']});let m=f.m;
 const roll=pull(m,'dark','1_270','hand'),roll2=pull(m,'dark','1_270','hand'),slip=pull(m,'light','2_47','hand'),slip2=pull(m,'light','2_47','hand'),maneuver=pull(m,'dark','1_241','hand'),few=pull(m,'light','1_70','hand'),tie=pull(m,'dark','1_300','table',f.planet);
 state.moveCard(m,f.pilot,'table');Object.assign(m.cards[f.pilot],{attachedTo:tie,aboardRole:'pilot',location:f.planet});state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;
 const drawIds={dark:dark===null?null:pull(m,'dark',dark===1?'1_194':dark===3?'1_317':'1_262','hand'),light:light===null?null:pull(m,'light',light===6?'1_70':light===0?'1_124':light===1?'1_28':'1_115','hand')};
 for(const side of ['dark','light'])if(drawIds[side])state.moveCard(m,drawIds[side],'reserve');else for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');
 m.turn.side='dark';m.turn.phase='control';m.stack[0].priority='dark';m.stack[0].passes=0;
 return {...f,m,roll,roll2,slip,slip2,maneuver,few,tie,drawIds};
}
export const start=f=>step(f.m,'tallon:play:'+f.roll+':'+f.tie+':'+f.ywing);
export const finish=(m,card)=>seek(m,x=>x.cards[card].zone!=='playing');
export function slip(m,f){return step(priority(m,'light'),'tallon:slip:'+f.slip+':'+f.roll);}
