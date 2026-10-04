import fs from 'node:fs';
import {runtime,state,rules,pull,location,force,phase,priority,step,prompt,seek} from './noble-fixture.mjs';
export {runtime,state,rules,pull,step,prompt};
export const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
/** Controlled inventory using the exact starter lists; no mid-action zone intervention. */
export function fixture(mode){
 let m=runtime.createMatch('travel-responses',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),rules);
 const site=location(m,'light','1_129'),near=location(m,'light','1_130'),remote=location(m,'dark','1_284');m.locations=[site,near,remote];
 const luke=pull(m,'light','101_2','table',mode.startsWith('run')?near:site),rebel=pull(m,'light','1_28','table',site);
 const wolf=pull(m,'light','1_30','table',near),cz=pull(m,'light','1_6','table',site),miner=pull(m,'light','1_18','table',site);
 const storm=pull(m,'dark','1_194','table',site),darkMiner=pull(m,'dark','1_186','table',site),vader=pull(m,'dark','101_5','table',near);
 const attach=(side,bp,host)=>{const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;return id;};
 const gun=attach('light','1_152',rebel),binoculars=attach('light','1_35',rebel),darkGun=attach('dark','1_317',storm),comlink=attach('dark','1_201',storm);
 const hand={};for(const c of manifest.cards.filter(c=>c.type==='Interrupt'))hand[c.gempId]=pull(m,c.side,c.gempId,'hand');
 const extra=pull(m,'light','1_28','hand'),darkExtra=pull(m,'dark','1_194','hand');force(m,'light',10);force(m,'dark',10);
 m=phase(m,'battle');if(mode==='run-light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);
 m=priority(m,mode==='run-light'?'light':'dark');m=step(m,'battle:'+site);const before=prompt(m).choices.map(c=>c.id);m=priority(m,'light');
 return {m,mode,before,site,near,remote,luke,rebel,wolf,cz,miner,storm,darkMiner,vader,gun,binoculars,darkGun,comlink,extra,darkExtra,hand,interrupt:hand[mode.startsWith('run')?'101_3':'1_98']};
}
export const play=f=>step(f.m,(f.mode.startsWith('run')?'run-luke:'+f.interrupt+':'+f.luke:'escape:'+f.interrupt));
