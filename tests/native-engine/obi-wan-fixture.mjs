import fs from 'node:fs';
import {runtime,rules,state,pull,location,force,phase,priority,step,seek} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(mode='move',own=false,extra={}){
 let m=runtime.createMatch('obi-wan',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...(d.side==='light'?['1_21','1_21','1_82','1_157','1_132']:['1_181','1_315','1_254','1_194']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),adj=location(m,'light','1_132'),remote=location(m,'dark','1_284');m.locations=mode==='no-adj'?[site,remote]:[site,adj,remote];if(mode==='no-adj')state.moveCard(m,adj,'hand');
 const obi=pull(m,'light','1_21','table',site),target=pull(m,'dark',mode==='guard'?'1_181':'1_194','table',site),second=pull(m,'dark','1_194','table',site),gift=pull(m,'light','1_82','hand'),gun=pull(m,'dark','1_315','hand'),kintan=pull(m,'dark','1_254','hand');
 force(m,'light',12);force(m,'dark',12);m=phase(m,'battle');m.turn.side=own?'light':'dark';m.stack[0].priority=m.turn.side;if(mode==='barred')m.data.ground={turn:m.turn.number,moved:[],reacted:[],drained:[],barriers:{[target]:m.turn.number}};
 if(mode==='already-moved')m.data.ground={turn:m.turn.number,moved:[target],reacted:[],drained:[],barriers:{}};
 m=priority(step(m,'battle:'+site),'light');return {m,site,adj,remote,obi,target,second,gift,gun,kintan,mode,own};
}
export const choice=f=>'obi:use:'+f.obi+':'+f.target;
export const decision=m=>seek(m,x=>x.stack.at(-1)?.handler==='obi:choose');
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export const weapons=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons'||x.data.battle?.stage==='complete');
