import {fixture as shuttle,pull,state,seek,priority,step} from './shuttle-fixture.mjs';
export * from './shuttle-fixture.mjs';
export function fixture({bp='1_305'}={}){
 const f=shuttle({light:['1_135','1_129','1_109','1_132'],dark:['1_284','1_310','1_310','1_300']});
 for(const id of [f.carrier,f.corvette]){state.moveCard(f.m,id,'table');f.m.cards[id].location=f.planet;}
 state.moveCard(f.m,f.pilot,'table');Object.assign(f.m.cards[f.pilot],{location:f.planet,attachedTo:f.carrier,aboardRole:'pilot'});
 state.moveCard(f.m,f.comlink,'table');Object.assign(f.m.cards[f.comlink],{location:f.planet,attachedTo:f.pilot});
 state.moveCard(f.m,f.lightPilot,'table');f.m.cards[f.lightPilot].location=f.site;
 const away=pull(f.m,'light','1_135','table');f.m.locations.push(away);
 const cargo=bp==='1_305'?f.scout:pull(f.m,'dark',bp,'hand'),sense=pull(f.m,'light','1_109','hand'),zero=pull(f.m,'light','1_132','hand');
 let m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,'light');state.moveCard(m,zero,'reserve');m=step(m,'battle:'+f.planet);m=priority(m,'dark');return {...f,m,away,cargo,sense,zero,grant:f.comlink,enemy:f.lightPilot};
}
export const choice=(f,card=f.cargo,target=f.carrier)=>'transport:deploy:'+card+':'+target+':'+(f.m.cards[card].blueprint==='1_310'?'vehicle':'starship')+':react:via:'+f.grant;
