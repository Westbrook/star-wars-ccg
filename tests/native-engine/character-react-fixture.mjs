import {fixture as vehicles,state,pull,force,seek,priority,step,ids,load} from './open-vehicles-fixture.mjs';
export * from './open-vehicles-fixture.mjs';
export const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
export function fixture(mode='closed'){
 const f=vehicles(mode==='open'?'1_149':'1_151','1_30',['1_30'],['1_267','101_4']);let m=f.m;
 const host=mode==='landed'?f.ywing:f.host,dest=mode.endsWith('embark')?pull(m,'light','1_149','table',f.dune):host===f.ywing?f.host:f.ywing;
 const put=(id,site)=>{if(m.cards[id].zone!=='table')state.moveCard(m,id,'table');m.cards[id].location=site;};
 if(!mode.endsWith('embark')){state.moveCard(m,dest,'hand');}else put(dest,f.dune);
 put(host,f.site);put(f.rider,f.site);if(!mode.startsWith('ground')){m.cards[f.rider].attachedTo=host;m.cards[f.rider].aboardRole='passenger';}
 put(f.gun,f.site);m.cards[f.gun].attachedTo=f.rider;put(f.vader,f.dune);
 if(mode==='battle')put(f.luke,f.dune);
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase===(mode==='battle'?'battle':'control')&&x.stack.length===1);m=priority(m,'dark');
 m=priority(step(m,(mode==='battle'?'battle:':'drain:')+f.dune),'light');const sense=pull(m,'dark','1_267','hand'),zero=pull(m,'dark','101_4','hand');return {...f,m,host,dest,sense,zero,mode,wolf:f.rider};
}
export const begin=f=>step(f.m,'react-move:'+f.wolf+':'+f.dune);
export const atExit=m=>seek(m,x=>x.stack.at(-1)?.handler==='character-react:exit');
export const atMove=m=>seek(m,x=>x.stack.at(-2)?.action?.handler==='ground:move'&&!x.stack.at(-2).awaitingResponses);
export const atBoard=m=>seek(m,x=>x.stack.at(-1)?.handler==='character-react:board');
export const finish=m=>{for(let n=0;n<220;n++){if(m.stack.length===1||m.stack.at(-1)?.event?.kind==='battle-weapons')return m;m=step(m,ids(m).includes('finish-react')?'finish-react':ids(m).includes('pass')?'pass':ids(m)[0]);}throw Error('React did not finish');};
