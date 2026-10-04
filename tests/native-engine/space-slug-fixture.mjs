import {fixture as base,pull,deploySector,seek,priority,step,load} from './sectors-fixture.mjs';
import {place} from './named-sectors-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
export function fixture({withCave=true}={}){const f=base({light:['4_6','4_82','4_83','1_140'],dark:['4_112','4_157']});let m=f.m;const big=pull(m,'light','4_82','hand'),cave=pull(m,'light','4_83','hand'),slug=pull(m,'light','4_6','hand');m=deploySector(m,big);if(withCave)m=place(m,cave,board.sitePlacements(m,cave)[0]);m=step(m,'slug:deploy:'+slug+':'+big);m=priority(seek(m,x=>x.stack.length===1),'light');return {...f,m,big,cave,slug};}
