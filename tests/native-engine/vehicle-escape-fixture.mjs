import {fixture as vehicles,state,pull,force,seek,priority,step,ids,location,load} from './open-vehicles-fixture.mjs';
export * from './open-vehicles-fixture.mjs';
export const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
export function fixture(mode='escape-vehicle'){
 const f=vehicles('1_149','101_2',['3_69','1_98','3_59','3_62']),m=f.m;
 const host=pull(m,'light','3_69','table',f.site),interrupt=pull(m,'light','1_98','hand');
 const put=(id,site)=>{state.moveCard(m,id,'table');m.cards[id].location=site;};
 put(f.luke,f.site);m.cards[f.luke].attachedTo=host;m.cards[f.luke].aboardRole='passenger';
 put(f.gun,f.site);m.cards[f.gun].attachedTo=f.luke;put(f.lightPilot,f.site);put(f.passenger,f.site);
 let next=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);next=priority(next,'dark');
 for(const id of [...next.players.light.force])state.moveCard(next,id,'reserve');
 if(mode!=='escape-no-force')force(next,'light',mode==='escape-passenger'?2:1);
 next=priority(step(next,'battle:'+f.site),'light');return {...f,m:next,host,interrupt,mode,to:mode==='escape-long'?f.farm:f.dune};
}
export const escapeChoice=(m,card)=>ids(m).find(id=>id==='escape:'+card||id.startsWith('escape:'+card+':'));
export function reactionFixture(hoth=true){
 const f=vehicles('1_149','101_2',['3_69','3_62']);let m=f.m;
 const from=hoth?f.echo:f.site,to=hoth?location(m,'light','3_62'):f.dune;
 if(hoth)m.locations=m.locations.filter(id=>id!==from&&id!==to).concat(from,to);
 const host=pull(m,'light','3_69','table',from);state.moveCard(m,f.lightPilot,'table');m.cards[f.lightPilot].location=from;
 state.moveCard(m,f.passenger,'table');m.cards[f.passenger].location=to;
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');m=priority(step(m,'drain:'+to),'light');
 return {...f,m,host,from,to};
}
