import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(){
 let m=runtime.createMatch('vessels',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['1_305','1_309','1_184','1_179','1_194']:['1_127','1_147','1_150','1_11','101_2','1_5']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),planet=location(m,'light','1_127');m.locations=[site,planet,remote];
 const scout=pull(m,'dark','1_305','hand'),crawler=pull(m,'dark','1_309','hand'),driver=pull(m,'dark','1_184','hand'),pilot=pull(m,'dark','1_179','hand'),passenger=pull(m,'dark','1_194','hand'),ywing=pull(m,'light','1_147','hand'),lightPilot=pull(m,'light','1_11','hand'),luke=pull(m,'light','101_2','hand'),droid=pull(m,'light','1_5','hand');
 force(m,'dark',12);force(m,'light',12);m=priority(phase(m,'deploy'),'dark');return {m,site,remote,planet,scout,crawler,driver,pilot,passenger,ywing,lightPilot,luke,droid};
}
export const settled=m=>seek(m,x=>x.stack.length===1);
export const deploy=(m,card,target,role)=>priority(settled(step(m,'vessel:'+(role?'aboard':'deploy')+':'+card+':'+target+(role?':'+role:''))),m.turn.side);
export {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority,load};
export function fleets(){
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');m=deploy(m,f.passenger,f.scout,'passenger');
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');m=deploy(m,f.ywing,f.planet);m=deploy(m,f.lightPilot,f.ywing,'pilot');
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'dark');return {...f,m};
}
