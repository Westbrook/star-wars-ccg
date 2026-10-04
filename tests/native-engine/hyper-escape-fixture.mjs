import {fixture as vessels,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load};
export const mod=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
export function fixture(mode='single'){
 const f=vessels({light:['1_129','1_88','1_147','1_135','1_158','2_15','1_144'],dark:['1_284','2_143','1_302','1_267']});let {m}=f;
 const escape=pull(m,'light','1_88','hand'),destination=pull(m,mode==='out-of-range'?'dark':'light',mode==='out-of-range'?'2_143':'1_135',mode==='no-destination'?'hand':'table');if(mode!=='no-destination')m.locations.push(destination);
 state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;
 const second=pull(m,'light','1_147',['two-ships','one-force'].includes(mode)?'table':'hand',f.planet);
 const enemy=pull(m,'dark','1_302','table',f.planet);
 const crew=pull(m,'light','2_15',mode==='weapon-and-crew'?'table':'hand',f.planet),weapon=pull(m,'light','1_158',mode==='weapon-and-crew'?'table':'hand',f.planet);
 if(mode==='weapon-and-crew'){Object.assign(m.cards[crew],{attachedTo:f.ywing,aboardRole:'passenger'});m.cards[weapon].attachedTo=f.ywing;}
 for(const c of Object.values(m.cards))if(c.zone!=='table')delete c.location;
 m.turn.phase='battle';m.turn.side=mode==='own-battle'?'light':'dark';m.stack[0].priority=m.turn.side;m.stack[0].passes=0;
 if(['one-force','no-force'].includes(mode))while(m.players.light.force.length>(mode==='one-force'?1:0))state.moveCard(m,m.players.light.force.at(-1),'reserve');
 m=step(m,'battle:'+f.planet);m=seek(m,x=>x.stack.at(-2)?.action?.handler==='battle:begin'&&!x.stack.at(-2).awaitingResponses);m=priority(m,'light');
 return {...f,m,escape,destination,second,enemy,crew,weapon};
}
export const start=f=>step(f.m,'hyper-escape:'+f.escape);
export const choosing=m=>seek(m,x=>x.stack.at(-1)?.handler==='hyper-escape:move');
export const away=(m,card,to,method='hyperspace')=>step(m,'escape-away:'+card+':'+method+':'+to);
export const finish=(m,card)=>seek(m,x=>x.cards[card].zone==='used'||x.cards[card].zone==='lost');
