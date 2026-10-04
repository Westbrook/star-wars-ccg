import {controls} from './board';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {hasCharacteristic} from './characteristics';
import {generator} from './hoth';
import type {Match,Side} from './types';
const active=(m:Match,site:string)=>m.locations.includes(site)&&gameTextActive(m,site);
export function hothDeployModifier(m:Match,id:string,site:string):number {
 if(!active(m,site))return 0;
 const c=m.cards[id],d=cardDefinition(m,id),bp=m.cards[site].blueprint;
 if(bp==='3_56'&&c.owner==='light'&&hasCharacteristic(m,id,'ECHO_BASE_TROOPER'))return -1;
 if(bp==='104_4'&&c.owner==='dark'&&(d.type==='Character'&&d.subType==='Imperial'||d.type==='Vehicle'&&d.subType.startsWith('Combat:')))return -1;
 return 0;
}
export function hothDrainModifier(m:Match,side:Side,site:string):number {
 if(!active(m,site)||!controls(m,side,site))return 0;
 const bp=m.cards[site].blueprint;
 if(bp==='3_56'||bp==='3_144'&&side==='dark'||bp==='104_4'&&side==='light')return 1;
 if(['3_148','3_150'].includes(bp)&&side==='light'&&m.locations.some(id=>generator(m,id)))return -1;
 return 0;
}
export const hothGenerationModifier=(m:Match,side:Side,site:string)=>side==='dark'&&m.cards[site].blueprint==='3_63'&&active(m,site)&&controls(m,side,site)?1:0;
export function hothWeaponModifier(m:Match,id:string):number {
 const c=m.cards[id],at=c.location;if(!at||!active(m,at))return 0;
 return c.owner==='light'&&m.cards[at].blueprint==='3_63'||c.owner==='dark'&&m.cards[at].blueprint==='3_144'?1:0;
}
export function hothForfeitModifier(m:Match,id:string):number {
 const c=m.cards[id],at=c.location;
 return c.zone==='table'&&c.owner==='light'&&at&&m.cards[at].blueprint==='3_144'&&active(m,at)&&hasCharacteristic(m,id,'TROOPER')?-1:0;
}
