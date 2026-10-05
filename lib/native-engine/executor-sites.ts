import {cardDefinition} from './definitions';
import {controls} from './board';
import {hasCharacteristic} from './characteristics';
import {uniqueShipSitePersona} from './ship-sites';
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
/** Light control cancels only the Dark side of Main Corridor's text. Losing
 * control restores that permission; canceling the whole site's text also
 * removes the Light suppression, without recreating its Dark permission. */
export const mainCorridorActive=(m:Match,id:string)=>m.cards[id]?.blueprint==='4_162'&&gameTextActive(m,id)&&!controls(m,'light',id);
export function executorControlPowerBonus(m:Match,id:string):number {
 if(!hasPersona(m,id,'EXECUTOR'))return 0;
 const active=m.locations.some(site=>m.cards[site].blueprint==='4_160'&&gameTextActive(m,site)&&Object.values(m.cards).some(c=>c.zone==='table'&&!c.coveredBy&&c.location===site&&cardDefinition(m,c.id).subType.includes('Imperial')&&hasCharacteristic(m,c.id,'LEADER')));
 return active?m.locations.filter(site=>uniqueShipSitePersona(m,site)==='EXECUTOR'&&!m.cards[site].blownAway&&!m.cards[site].coveredBy).length:0;
}
/** This permission belongs to the Light side of the location, not to whoever
 * currently owns Executor. It does not transfer ownership of the ship/crew. */
export function executorMovementController(m:Match,id:string):string|undefined {
 if(!hasPersona(m,id,'EXECUTOR')||m.turn.side!=='dark'||m.turn.phase!=='move')return;
 return m.locations.find(site=>m.cards[site].blueprint==='4_160'&&gameTextActive(m,site)&&controls(m,'light',site));
}

/** Applies only to movement of the hull itself, not crew transfers. */
export const executorMayMove=(m:Match,id:string,actor:Side):boolean=>!executorMovementController(m,id)||actor==='light';
