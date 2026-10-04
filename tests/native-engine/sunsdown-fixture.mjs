import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(){
 let m=runtime.createMatch('sunsdown-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['1_289','1_230','1_230','1_184','1_224']:['1_127','1_71','101_2','1_130','1_115','1_115']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),planet=pull(m,'dark','1_289','hand'),convert=pull(m,'light','1_127','hand'),suns=pull(m,'dark','1_230','hand'),spy=pull(m,'dark','1_184','hand'),warrior=pull(m,'light','1_31','table',site),dark=pull(m,'dark','1_194','table',site),alter=pull(m,'light','1_71','hand'),luke=pull(m,'light','101_2','table',site),macro=pull(m,'dark','1_224','table');
 force(m,'dark',8);force(m,'light',8);m=priority(phase(m,'deploy'),'dark');return {m,site,remote,planet,convert,suns,spy,warrior,dark,alter,luke,macro};
}
export function settled(m){return seek(m,x=>x.stack.length===1);}
export function deployed(f){let m=step(f.m,'site:'+f.planet+':at:1');m=priority(settled(m),'dark');m=step(m,'sunsdown:deploy:'+f.suns+':'+f.planet);return priority(settled(m),'dark');}
export function battleStart(f,m=deployed(f)){
 m=phase(m,'battle');m=priority(m,'dark');m=step(m,'battle:'+f.site);return seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
}
export {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority};
