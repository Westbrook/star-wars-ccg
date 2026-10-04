import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import type {Match,Side} from './types';
/** Printed location identities. Card text coverage and deck admission are separate. */
export const hothMarkers:Record<string,number>={'3_61':1,'3_63':2,'3_56':3,'3_144':3,'3_62':4,'3_149':4,'3_148':5,'104_4':6,'3_150':7};
export const generator=(m:Match,id:string)=>m.cards[id]?.blueprint==='3_61'&&!m.cards[id]?.blownAway;
export const hothMarker=(m:Match,id:string)=>hothMarkers[m.cards[id]?.blueprint];
export const outerHothMarker=(m:Match,id:string)=>[4,5,6].includes(hothMarker(m,id));
export const hothSite=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).subType==='Site'&&cardDefinition(m,id).name.startsWith('Hoth:');
export function hothRank(m:Match,id:string):number|undefined {
 if(!hothSite(m,id))return;const marker=hothMarker(m,id);if(marker)return 1+marker/10;
 const icons=cardDefinition(m,id).icons as string[];
 if(icons.includes('Exterior'))return icons.includes('Interior')?1:1.65;
 return 0;
}
export function shielded(m:Match,site:string):boolean {
 if(!m.locations.some(id=>generator(m,id)&&gameTextActive(m,id))||!hothSite(m,site))return false;
 return cardDefinition(m,site).name.startsWith('Hoth: Echo ')||[1,2,3].includes(hothMarker(m,site));
}
export const shieldDeployment=(m:Match,card:string,site:string)=>m.cards[card].owner==='dark'&&['Character','Vehicle','Starship'].includes(cardDefinition(m,card).type)&&shielded(m,site);
export const shieldMovement=(m:Match,side:Side,from:string,to?:string)=>side==='dark'&&(shielded(m,from)||!!to&&shielded(m,to));
export const fourthMarkers=(m:Match,side:Side)=>m.players[side].reserve.filter(id=>hothMarker(m,id)===4);
export const generatorAllowed=(m:Match,id:string,locations=m.locations)=>!generator(m,id)||locations.some(at=>outerHothMarker(m,at))||fourthMarkers(m,m.cards[id].owner).length>0;
export const hothView=(m:Match)=>({hothShield:{active:m.locations.some(id=>generator(m,id)&&gameTextActive(m,id)),sites:m.locations.filter(id=>shielded(m,id))}});
