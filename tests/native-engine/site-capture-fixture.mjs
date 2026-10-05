import {mod,runtime,state,rules,pull,phase,step,seek,ids} from './prisoner-fixture.mjs';
import {ending} from './captured-ships-fixture.mjs';
export const siteDecks=()=>['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_124','1_140','1_19','1_28','1_152','1_13']:['1_285','2_143','1_302','2_111','1_168','1_175','1_241','2_142']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
export function siteFixture(lightBay=false,decks=siteDecks()){
 let m=runtime.createMatch('site-capture',60,decks,rules);
 const bay=pull(m,lightBay?'light':'dark',lightBay?'1_124':'1_285'),site=pull(m,'dark','2_143');m.locations.push(bay,site);
 const ship=pull(m,'light','1_140','table',site),host=pull(m,'dark','1_302','table',site),beam=pull(m,'dark','2_111','hand'),characters=[pull(m,'light','1_19','table',site),pull(m,'light','1_28','table',site)],gun=pull(m,'light','1_152','table',site);
 for(const [i,id]of characters.entries()){m.cards[id].attachedTo=ship;m.cards[id].aboardRole=i?'passenger':'pilot';}m.cards[gun].attachedTo=characters[0];
 for(const side of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','deploy');return {m,bay,site,ship,host,beam,characters,gun};
}
export function deployedSiteBeam(f){let m=step(f.m,'tractor:deploy:'+f.beam+':'+f.bay);return seek(m,x=>x.cards[f.beam].zone==='table');}
export function siteBeamEnding(f){f.m=deployedSiteBeam(f);return ending(f);}
export function setBeamDestinies(m,bps=['1_241','1_194']){const chosen=[];for(const bp of bps){const id=m.players.dark.reserve.find(id=>m.cards[id].blueprint===bp&&!chosen.includes(id));if(!id)throw Error('Missing destiny '+bp);chosen.push(id);}m.players.dark.reserve=chosen.concat(m.players.dark.reserve.filter(id=>!chosen.includes(id)));return chosen;}
export function capturedAtSite(f){let m=siteBeamEnding(f);setBeamDestinies(m);m=step(m,'tractor:use:'+f.beam+':'+f.bay);return seek(m,x=>!!x.cards[f.ship].capturedShip);}
