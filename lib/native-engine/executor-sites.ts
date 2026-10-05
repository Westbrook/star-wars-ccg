import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {hasPersona} from './persona';
import type {Match,Side} from './types';

/** Holotheatre's bonus modifies generation, not its printed Force icons.
 * A character with canceled text still has its persona; an inactive captive does
 * not meet the active on-table condition. */
export function executorGenerationModifier(m:Match,side:Side,site:string):number {
 if(side!=='dark'||m.cards[site]?.blueprint!=='4_161'||!gameTextActive(m,site))return 0;
 const cards=Object.values(m.cards).filter(c=>c.zone==='table'&&!c.coveredBy);
 return Number(cards.some(c=>hasPersona(m,c.id,'VADER')))+Number(cards.some(c=>hasPersona(m,c.id,'SIDIOUS')&&/\bEmperor\b/.test(cardDefinition(m,c.id).name)));
}
export const executorDrainModifier=(m:Match,side:Side,site:string)=>side==='light'&&m.cards[site]?.blueprint==='4_161'&&gameTextActive(m,site)?1:0;
