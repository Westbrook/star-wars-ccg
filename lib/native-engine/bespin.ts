import {cardDefinition} from './definitions';
import {controls} from './board';
import {gameTextActive} from './game-text';
import {belowDecks} from './occupancy';
import {sectorFamily} from './sectors';
import {other,type Match,type Side} from './types';

/** An expansion icon does not make a card a Cloud City location. */
export const cloudCityLocation=(m:Match,id:string)=>cardDefinition(m,id).type==='Location'&&(sectorFamily(m,id)==='city'||cardDefinition(m,id).subType==='Site'&&cardDefinition(m,id).name.startsWith('Cloud City:'));
export function bespinDeployModifier(m:Match,id:string,location:string):number {
 if(!['Character','Vehicle'].includes(cardDefinition(m,id).type)||!cloudCityLocation(m,location))return 0;
 const at=m.locations.find(at=>['5_76','5_164'].includes(m.cards[at].blueprint)&&gameTextActive(m,at));if(!at)return 0;
 const owner=m.cards[at].owner,side=m.cards[id].owner;if(side===owner)return 0;
 return controls(m,owner,at)?1:controls(m,other(owner),at)?-1:0;
}
export function cloudCityBattleBonus(m:Match,side:Side,site:string):number {
 const b=m.data.battle as {site:string;stage:string}|undefined;
 if(!b||b.stage==='complete'||b.site!==site||cardDefinition(m,site).subType!=='Site'||!cloudCityLocation(m,site))return 0;
 const city=m.locations.find(at=>sectorFamily(m,at)==='city'&&gameTextActive(m,at)&&controls(m,side,at));if(!city)return 0;
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.location===city&&!belowDecks(m,c.id)&&['Starship','Vehicle'].includes(cardDefinition(m,c.id).type)).length;
}
