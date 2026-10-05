import fs from 'node:fs';
import {runtime,rules,state,pull,location,force,phase,priority,seek} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(){
 let m=runtime.createMatch('wrong-turn',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_110','1_110','1_19','1_19','3_32','1_6','1_64']:['1_232','1_232','4_116','1_235']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),wrong=pull(m,'dark','1_232','hand'),second=pull(m,'dark','1_232','hand'),bad=pull(m,'dark','4_116','hand'),sky=pull(m,'light','1_110','hand'),boring=pull(m,'dark','1_235','hand'),hero=pull(m,'light','1_19','hand'),troop=pull(m,'light','1_28','hand'),droid=pull(m,'light','1_6','hand'),enemy=pull(m,'dark','1_194','hand'),tank=pull(m,'light','3_32','hand');
 force(m,'light',12);force(m,'dark',12);m=priority(phase(m),'dark');return {m,site,remote,wrong,second,bad,sky,boring,hero,troop,droid,enemy,tank};
}
export const settled=m=>seek(m,x=>x.stack.length===1);
export const turn=(m,side)=>priority(seek(m,x=>x.stack.length===1&&x.turn.side===side&&x.turn.phase==='deploy'),side);
export const cancel=(m,card,mode='table')=>{const p=runtime.prompt(m,rules,runtime.prompt(m,rules,'light').side);return p.choices.find(c=>c.id.startsWith('scomp:play:'+card+':'+mode+':'))?.id;};
