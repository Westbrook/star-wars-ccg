import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {hasPersona} from './persona';
import {crewActive,landed,operational,occupants} from './occupancy';
import type {Match} from './types';

const powerBonuses:Record<string,number>={'1_8':2,'1_174':3,'1_11':2,'5_5':2,'1_4':3,'1_172':2,'1_19':3,'3_3':3,'5_99':2,'4_1':2,'9_24':2,'1_168':3,'1_167':2,'1_179':2};
const matchingShips:Record<string,string>={'1_8':'GOLD_1','1_174':'BLACK_3'};
/** A pilot seat is not enough: landed pilots are passengers for functions,
 * and excluded crew cannot operate or enhance a vessel during battle. */
export function actingPilot(m:Match,id:string):boolean {
 const c=m.cards[id];return !!c&&c.aboardRole==='pilot'&&!!c.attachedTo&&crewActive(m,id)&&crewActive(m,c.attachedTo)&&!landed(m,c.attachedTo);
}
export function matchingPilot(m:Match,id:string):boolean {
 const c=m.cards[id],persona=matchingShips[c?.blueprint];return !!persona&&actingPilot(m,id)&&gameTextActive(m,id)&&hasPersona(m,c.attachedTo!,persona);
}
export const pilotPowerBonus=(m:Match,id:string)=>actingPilot(m,id)&&gameTextActive(m,id)?powerBonuses[m.cards[id].blueprint]??0:0;
/** Missing maneuver stays missing. Unpiloted maneuver is unmodifiable zero. */
export function vesselManeuver(m:Match,id:string):number|null {
 const raw=(cardDefinition(m,id).stats as Record<string,string>).maneuver;if(raw===undefined)return null;
 if(!Number.isFinite(Number(raw)))throw Error('Maneuver needs a printed-value provider.');
 return operational(m,id)?Number(raw)+occupants(m,id).filter(c=>matchingPilot(m,c.id)).length:0;
}
const keywords:Record<string,{keywords:string[]}>=identities;
export function squadronPilot(m:Match,id:string,squadron:string):boolean {
 const c=m.cards[id];return !!c&&cardDefinition(m,id).type==='Character'&&(cardDefinition(m,id).icons as string[]).includes('Pilot')&&
  (!!keywords[c.blueprint]?.keywords.includes(squadron)||actingPilot(m,id)&&!!keywords[m.cards[c.attachedTo!].blueprint]?.keywords.includes(squadron));
}
/** Dutch affects other Gold Squadron pilots at his location, including a pilot
 * whose squadron comes from their ship. He need not be piloting himself. */
export function squadronForfeitBonus(m:Match,id:string,active:(id:string)=>boolean=()=>true):number {
 const c=m.cards[id];if(!c?.location||!crewActive(m,id)||!active(id)||!squadronPilot(m,id,'GOLD_SQUADRON'))return 0;
 return Object.values(m.cards).some(d=>d.id!==id&&d.owner===c.owner&&d.blueprint==='1_8'&&d.location===c.location&&crewActive(m,d.id)&&active(d.id)&&gameTextActive(m,d.id))?1:0;
}
