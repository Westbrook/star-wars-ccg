import {fixture as captured,shipDecks} from './captured-ships-fixture.mjs';
import {mod,runtime,state,rules,pull,phase,step,ids,seek,priority,prompt,clone} from './prisoner-fixture.mjs';
export {mod,runtime,state,rules,pull,phase,step,ids,seek,priority,prompt,clone};
export function fixture({capture=true,site=false}={}){
 const decks=shipDecks();decks[0].cards.splice(0,0,'2_44','2_44','1_129','3_59','4_81');decks[0].cards.length=60;decks[1].cards.splice(0,0,'2_117','1_285','2_111','1_267','1_317','2_143');decks[1].cards.length=60;
 const f=captured(2,{capture:false,decks});const alt=pull(f.m,'light','2_44','hand'),secondAlt=pull(f.m,'light','2_44','hand'),bay=pull(f.m,'light','1_129'),effect=pull(f.m,'dark','2_117','hand');f.m.locations.push(bay);
 let host=f.host;if(site){const deathStar=pull(f.m,'dark','2_143');f.m.locations.push(deathStar);host=pull(f.m,'dark','1_285');f.m.locations.push(host);const beam=pull(f.m,'dark','2_111','table',host);f.m.cards[beam].attachedTo=host;}
 if(capture)mod('captured-ships').captureStarship(f.m,f.ship,host);
 f.m=phase(f.m,'dark','control');return {...f,alt,secondAlt,bay,effect,captureHost:host};
}
export const releaseId=(f,bay=f.bay)=>'alternatives:'+f.alt+':release:'+f.ship+':'+bay;
export function releaseReady(f){return priority(f.m,'light');}
export function battleReady(f){let m=phase(f.m,'dark','battle');m=step(m,'battle:'+f.site);return seek(m,x=>ids(x).includes('alternatives:'+f.alt+':battle:'+f.site));}
export function deployEffect(f){let m=phase(f.m,'dark','deploy');m=step(m,'besieged:deploy:'+f.effect+':'+f.ship);return seek(m,x=>x.cards[f.effect].zone==='table');}
export function besiegedReady(f,side='light'){let m=phase(deployEffect(f),'dark','battle');m=step(m,'besieged:select:'+f.effect+':'+f.ship);m=step(m,'besieged:add:'+f.escort);m=step(m,'besieged:begin');return priority(seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons'),side);}
export const done=m=>seek(m,x=>!x.stack.some(f=>f.kind==='resolution'&&f.action.handler.startsWith('alternatives:')));
