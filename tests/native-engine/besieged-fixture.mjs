import {mod,runtime,state,rules,pull,phase,step,ids,seek} from './prisoner-fixture.mjs';
import {fixture as captured,shipDecks} from './captured-ships-fixture.mjs';
export {mod,runtime,state,rules,pull,phase,step,ids,seek};
export function fixture({crew=2,site=false}={}){
 const decks=shipDecks();decks[1].cards.splice(5,0,'2_117','1_285','4_165','1_317','2_111');decks[1].cards.length=60;
 let f=captured(crew,{decks,capture:false}),m=f.m;
 const card=pull(m,'dark','2_117','hand'),second=pull(m,'dark','1_194','table',f.site);m.cards[second].attachedTo=f.host;m.cards[second].aboardRole='passenger';
 if(site){const bay=pull(m,'dark',site==='launch'?'4_165':'1_285');m.locations.push(bay);if(site==='launch')mod('ship-sites').registerShipSite(m,bay,f.host);else {f.beam=pull(m,'dark','2_111','table',bay);m.cards[f.beam].attachedTo=bay;}for(const id of [f.escort,second]){delete m.cards[id].attachedTo;delete m.cards[id].aboardRole;m.cards[id].location=bay;}f.bay=bay;}
 mod('captured-ships').captureStarship(m,f.ship,f.bay??f.host);
 m=phase(m,'dark','deploy');return {...f,m,card,second};
}
export function deployed(f){return seek(step(f.m,'besieged:deploy:'+f.card+':'+f.ship),m=>m.cards[f.card].zone==='table');}
export function selection(f){let m=phase(deployed(f),'dark','battle');return step(m,'besieged:select:'+f.card+':'+f.ship);}
export function begun(f,selected=[f.escort]){let m=selection(f);for(const id of selected)m=step(m,'besieged:add:'+id);return step(m,'besieged:begin');}
