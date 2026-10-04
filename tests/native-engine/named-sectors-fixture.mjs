import {fixture as base,pull,deploySector,seek,priority,step,load} from './sectors-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
export const fixture=()=>base({light:['5_76','5_77','4_82','4_83','4_83','5_79'],dark:['5_164','5_165','4_156','4_157']});
export function place(m,id,p){const side=m.cards[id].owner;m=priority(seek(m,x=>x.turn.side===side&&x.turn.phase==='deploy'&&x.stack.length===1),side);return priority(seek(step(m,'site:'+id+':'+p.id),x=>x.stack.length===1),side);}
export function caveFixture(){const f=fixture();let m=f.m;const big=pull(m,'light','4_82','hand'),cave=pull(m,'light','4_83','hand');m=deploySector(m,big);m=place(m,cave,board.sitePlacements(m,cave)[0]);return {...f,m,big,cave};}
