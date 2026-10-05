import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const {addBattleDrawModifier}=load(new URL('../../lib/native-engine/battle-destiny.ts',import.meta.url));
import {runtime,rules,state,location,pull,force,phase,step,seek,priority,prompt} from './noble-fixture.mjs';
export {runtime,rules,state,step,seek,priority,prompt};
export function fixture(side='light',additional=0){
 const decks=['dark','light'].map(s=>({side:s,cards:[s==='dark'?'1_284':'1_129',s==='dark'?'101_5':'101_2',s==='dark'?'9_139':'9_51',s==='dark'?'9_139':'9_51',s==='dark'?'1_267':'1_109',...(s==='light'?['1_84','5_69']:['1_194','1_194']),...Array(53).fill(s==='dark'?'1_194':'1_28')]}));
 let m=runtime.createMatch('preparation-test',60,decks,rules);
 const site=location(m,'light','1_129');location(m,'dark','1_284');
 const luke=pull(m,'light','101_2','table',site),vader=pull(m,'dark','101_5','table',site);for(let n=0;n<3;n++)pull(m,'light','1_28','table',site);
 const cards={},seconds={},senses={};for(const s of ['dark','light']){cards[s]=pull(m,s,s==='dark'?'9_139':'9_51','hand');seconds[s]=pull(m,s,s==='dark'?'9_139':'9_51','hand');senses[s]=pull(m,s,s==='dark'?'1_267':'1_109','hand');force(m,s,6);}
 const dice=pull(m,'light','1_84','hand'),smoke=pull(m,'light','5_69','hand');m=phase(m,'battle');m=step(m,'battle:'+site);if(additional)addBattleDrawModifier(m,side==='light'?luke:vader,side,'add',additional);
 m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side===side);
 const draw=pull(m,side,side==='light'?'1_28':'1_194','hand');state.moveCard(m,draw,'reserve');m=step(m,'draw-destiny');
 return {m,side,site,luke,vader,cards,seconds,senses,dice,smoke,draw};
}
export function ready(side='light',additional=0) {const f=fixture(side,additional);f.m=seek(f.m,m=>m.stack.at(-1)?.event?.kind==='battle-destiny-drawn'&&m.stack.at(-1).event.side===side);f.m=priority(f.m,side);assert.equal(f.m.data.battle.destiny[side],1);return f;}
export const choice=f=>'preparation:destiny:'+f.cards[f.side];
export const total=(m,side)=>seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-total'&&x.stack.at(-1).event.side===side);
