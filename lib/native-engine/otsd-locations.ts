import {cardDefinition} from './definitions';
import {controls} from './board';
import {gameTextActive} from './game-text';
import {isSpecies,nonUnique} from './characteristics';
import {groundPresent} from './participation';
import type {Match,Side} from './types';

const controlledCorulag=(m:Match,side:Side)=>m.locations.some(id=>m.cards[id].blueprint===(side==='light'?'106_2':'106_12')&&gameTextActive(m,id)&&controls(m,side,id));
/** Corulag's faction modifiers are global, including cards in piles; they do
 * not require the affected character to be at Corulag or owned by its controller. */
export function corulagStatBonus(m:Match,id:string):number {
 const d=cardDefinition(m,id);if(d.type!=='Character'||!nonUnique(m,id))return 0;
 return d.subType==='Rebel'&&controlledCorulag(m,'light')||d.subType==='Imperial'&&controlledCorulag(m,'dark')?1:0;
}
export function corulagAllowsGuardMove(m:Match,id:string):boolean {
 const bp=m.cards[id]?.blueprint;return bp==='1_26'&&controlledCorulag(m,'light')||bp==='1_181'&&controlledCorulag(m,'dark');
}
function present(m:Match,id:string,site:string):boolean {
 const c=m.cards[id];if(c.zone!=='table'||c.coveredBy||(c.location??c.attachedTo)!==site)return false;
 if(cardDefinition(m,id).type==='Character')return groundPresent(m,id);
 return !c.attachedTo||c.attachedTo===site||groundPresent(m,c.attachedTo);
}
export function otsdDrainModifier(m:Match,side:Side,site:string):number {
 if(!gameTextActive(m,site)||!controls(m,side,site))return 0;
 const bp=m.cards[site].blueprint,here=Object.values(m.cards).filter(c=>present(m,c.id,site));
 if(bp==='106_2'&&side==='dark'||bp==='106_12'&&side==='light')return -1;
 if(bp==='106_8')return side==='light'?(here.some(c=>c.blueprint==='1_41')?2:1):here.some(c=>isSpecies(m,c.id,'TUSKEN_RAIDER'))?1:0;
 if(bp==='106_18'&&side==='dark')return here.some(c=>cardDefinition(m,c.id).name==='Gaderffii Stick')?2:1;
 return 0;
}
