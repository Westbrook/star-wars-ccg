import {fixture as vessels,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load} from './vessels-fixture.mjs';
import {boundary,draws} from './starship-weapons-fixture.mjs';
export {runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load,boundary,draws};
export function fixture(bp='1_318',cap=false,equipped=true){
 const f=vessels({light:['1_129','1_152','2_81','2_81','1_158','1_158','1_140','1_115','1_115','1_28','1_109','1_70'],dark:['1_284','1_296','1_318','1_318','1_323','1_323','1_302','1_262','1_262','1_317','1_194','1_241']});
 const {m}=f,side=bp==='1_318'?'dark':'light',enemy=side==='dark'?'light':'dark';
 const host=side==='dark'?pull(m,'dark','1_302','table',f.planet):f.ywing;
 const target=cap?pull(m,enemy,enemy==='light'?'1_140':'1_302','table',f.planet):side==='dark'?f.ywing:f.scout;
 for(const id of [host,target]){if(m.cards[id].zone!=='table')state.moveCard(m,id,'table');m.cards[id].location=f.planet;}
 const weapon=pull(m,side,bp,equipped?'table':'hand',equipped?f.planet:undefined);if(equipped)m.cards[weapon].attachedTo=host;
 const guns=[0,1].map(()=>{const id=pull(m,enemy,enemy==='light'?'1_158':'1_323','table',f.planet);m.cards[id].attachedTo=target;return id;});
 const crew=enemy==='light'?f.lightPilot:f.pilot;state.moveCard(m,crew,'table');Object.assign(m.cards[crew],{attachedTo:target,aboardRole:'pilot',location:f.planet});
 m.turn.side=side;m.turn.phase=equipped?'battle':'deploy';m.stack[0].priority=side;m.stack[0].passes=0;
 return {...f,m,ground:f.site,site:f.planet,side,enemy,host,target,weapon,guns,crew};
}
export function start(f,values=[5]){draws(f,values);return step(priority(boundary(step(f.m,'battle:'+f.site),'battle-weapons'),f.side),'space-weapon:fire:'+f.weapon+':'+f.target);}
export const fire=(f,values=[5])=>boundary(start(f,values),'weapon-fired');
