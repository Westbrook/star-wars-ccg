import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
export {load};
export {pull,location,force,prompt,ids,step,seek,phase,priority,clone} from './noble-fixture.mjs';
import {pull,location,force,phase,seek,priority,step,prompt,rules} from './noble-fixture.mjs';
export {rules};
export const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
export const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
export const support=load(new URL('../../lib/native-engine/power-support.ts',import.meta.url));
export const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(side='dark'){
 const extras={light:['1_129','101_2','1_28','1_28','1_28','3_8','3_8','4_13','4_13','1_5','1_18','1_28','1_153','1_35','1_115','1_115'],dark:['1_284','1_194','1_194','1_194','1_168','1_175','1_175','3_96','3_96','1_186','1_186','1_194','1_312','1_194','1_262']};
 let m=runtime.createMatch('power-test',60,manifest.decks.map(d=>({side:d.side,cards:[...extras[d.side],...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284');
 const warrior=pull(m,side,side==='dark'?'1_194':'1_28','table',site),target=pull(m,side,side==='dark'?'1_186':'1_18','table',site),power=pull(m,side,side==='dark'?'1_175':'3_8','hand'),second=pull(m,side,side==='dark'?'1_175':'3_8','hand'),fusion=pull(m,side,side==='dark'?'3_96':'4_13','hand');
 force(m,'dark',12);force(m,'light',12);m=phase(m,'deploy');m=seek(m,x=>x.turn.side===side&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,side);
 return {m,site,remote,side,warrior,target,power,second,fusion};
}
export function attach(f){let m=step(f.m,'attach:'+f.fusion+':'+f.warrior);m=seek(m,x=>x.stack.length===1);f.m=priority(m,f.side);return f;}
export function enhance(f){f.m=step(f.m,'fusion:'+f.fusion+':'+f.target);return f;}
export function drawing(side='light',high=true){
 const f=fixture(side),m=f.m,opp=side==='light'?'dark':'light';
 for(const id of [f.target])state.moveCard(m,id,'hand');
 const own=pull(m,side,side==='light'?'101_2':'1_168','table',f.site);
 pull(m,opp,opp==='dark'?'1_168':'101_2','table',f.site);
 if(high)for(let i=0;i<6;i++)pull(m,opp,opp==='dark'?'1_194':'1_28','table',f.site);
 state.moveCard(m,f.power,'reserve');
 f.m=seek(m,x=>x.turn.side===side&&x.turn.phase==='battle'&&x.stack.length===1);f.m=priority(f.m,side);f.m=step(f.m,'battle:'+f.site);
 f.m=seek(f.m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side===side);f.m=step(f.m,'draw-destiny');
 f.m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-drawn');return {...f,own};
}
