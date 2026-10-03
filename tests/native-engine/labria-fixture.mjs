import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(bp='1_194'){
 let m=runtime.createMatch('labria-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['1_184',bp]:['1_42']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),labria=pull(m,'dark','1_184','table',remote),top=pull(m,'dark',bp,'hand'),insert=pull(m,'light','1_42','hand');
 force(m,'dark',6);force(m,'light',6);m=phase(m,'control');m=priority(m,'dark');state.moveCard(m,top,'reserve');
 return {m,site,remote,labria,top,insert};
}
export function begin(f,m=f.m){m=step(m,'labria:reveal:'+f.labria);m=seek(m,x=>x.stack.at(-1)?.handler==='labria:acknowledge');m=step(m,'labria:acknowledge');return seek(m,x=>x.stack.at(-1)?.handler==='labria:return'||x.stack.at(-1)?.event?.cause==='labria');}
export function finish(m){return seek(m,x=>x.stack.length===1);}
export {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority};
