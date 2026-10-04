import {fixture as vehicles,state,pull,force,seek,priority,step,ids,load} from './open-vehicles-fixture.mjs';
export * from './open-vehicles-fixture.mjs';
export const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
export function fixture(mode='escape-closed'){
 const run=mode.startsWith('run'),f=vehicles(mode.includes('open')?'1_149':'1_151','101_2',['101_3','1_98','1_28']);let m=f.m;
 const host=mode.startsWith('escape-landed')?f.ywing:f.host,interrupt=pull(m,'light',run?'101_3':'1_98','hand'),rebel=pull(m,'light','1_28','table',f.site);
 const put=(id,site)=>{state.moveCard(m,id,'table');m.cards[id].location=site;};
 put(host,run?f.dune:f.site);put(f.luke,run?f.dune:f.site);
 if(mode!=='run-ground'){m.cards[f.luke].attachedTo=host;m.cards[f.luke].aboardRole='passenger';}
 put(f.gun,m.cards[f.luke].location);m.cards[f.gun].attachedTo=f.luke;
 put(f.passenger,f.site);if(!run&&!mode.endsWith('only'))put(f.lightPilot,f.site);
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'dark');
 for(const id of [...m.players.light.force])state.moveCard(m,id,'reserve');if(mode!=='escape-no-force')force(m,'light',1);
 m=priority(step(m,'battle:'+f.site),'light');return {...f,m,host,rebel,interrupt,mode};
}
export const escapeChoice=(m,card)=>ids(m).find(id=>id==='escape:'+card||id.startsWith('escape:'+card+':'));
