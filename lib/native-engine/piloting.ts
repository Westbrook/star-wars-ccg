import {otsdShipBonus} from './otsd-ships';
import {cloudStatModifier} from './sectors';
import {hasNavComputer} from './navigation';
import {vesselStatBonus,vesselStatValue} from './stat-modifiers';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {isModel} from './characteristics';
import {gameTextActive} from './game-text';
import {hasPersona} from './persona';
import {crewActive,landed,operational,occupants} from './occupancy';
import type {Match} from './types';

const powerBonuses:Record<string,number>={'1_13':2,'1_3':2,'2_23':3,'1_173':3,'1_8':2,'1_174':3,'1_11':2,'5_5':2,'1_4':3,'1_172':2,'1_19':3,'3_3':3,'5_99':2,'4_1':2,'9_24':2,'1_168':3,'1_167':2,'1_179':2};
const matchingShips:Record<string,{persona?:string;blueprint?:string;maneuver:number}>={
 '1_8':{persona:'GOLD_1',maneuver:1},'1_174':{persona:'BLACK_3',maneuver:1},
 '1_13':{blueprint:'2_72',maneuver:1},'1_3':{blueprint:'1_145',maneuver:1},'2_23':{persona:'RED_2',maneuver:2},'1_173':{persona:'BLACK_2',maneuver:1},
};
/** A pilot seat is not enough: landed pilots are passengers for functions,
 * and excluded crew cannot operate or enhance a vessel during battle. */
export function actingPilot(m:Match,id:string):boolean {
 const c=m.cards[id];return !!c&&c.aboardRole==='pilot'&&!!c.attachedTo&&crewActive(m,id)&&crewActive(m,c.attachedTo)&&!landed(m,c.attachedTo);
}
export function matchingPilot(m:Match,id:string):boolean {
 return matchingPilotManeuver(m,id)>0;
}
export function matchingPilotManeuver(m:Match,id:string):number {
 const c=m.cards[id],rule=matchingShips[c?.blueprint];
 return rule&&actingPilot(m,id)&&gameTextActive(m,id)&&(rule.persona?hasPersona(m,c.attachedTo!,rule.persona):m.cards[c.attachedTo!].blueprint===rule.blueprint)?rule.maneuver:0;
}
export const pilotPowerBonus=(m:Match,id:string)=>actingPilot(m,id)&&gameTextActive(m,id)?powerBonuses[m.cards[id].blueprint]??0:0;
/** Missing maneuver stays missing. Unpiloted maneuver is unmodifiable zero. */
export function vesselManeuver(m:Match,id:string):number|null {
 const raw=(cardDefinition(m,id).stats as Record<string,string>).maneuver;if(raw===undefined)return null;
 if(!Number.isFinite(Number(raw)))throw Error('Maneuver needs a printed-value provider.');
 return operational(m,id)?vesselStatValue(m,id,'maneuver',Number(raw)+cloudStatModifier(m,id)+otsdShipBonus(m,id,'maneuver')+vesselStatBonus(m,id,'maneuver')+repairDroidBonus(m,id)+aboardStarfighterBonus(m,id)+occupants(m,id).reduce((n,c)=>n+matchingPilotManeuver(m,c.id)+(c.blueprint==='1_19'&&actingPilot(m,c.id)&&gameTextActive(m,c.id)&&hasPersona(m,id,'RED_5')?2:0),0)):0;
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

/** Astromech slots are passenger capacity; droid identity survives canceled text. */
export function hasAstromechNavigation(m:Match,id:string):boolean {
 return cardDefinition(m,id).type==='Starship'&&occupants(m,id).some(c=>c.aboardRole==='passenger'&&crewActive(m,c.id)&&isModel(m,c.id,'ASTROMECH'));
}
export function hasNavigation(m:Match,id:string):boolean {
 if(cardDefinition(m,id).type!=='Starship')return false;
 return hasNavComputer(m,id)||hasAstromechNavigation(m,id);
}
/** Different card titles combine; multiple copies of one noncumulative text do not. */
export function aboardStarfighterBonus(m:Match,id:string):number {
 if(cardDefinition(m,id).type!=='Starship'||!cardDefinition(m,id).subType.startsWith('Starfighter:'))return 0;
 const contributions=new Map<string,number>();
 for(const c of occupants(m,id))if(crewActive(m,c.id)&&gameTextActive(m,c.id)){
  const amount=c.blueprint==='2_14'?(hasPersona(m,id,'RED_5')?3:2):c.blueprint==='1_24'?1:0;
  if(amount)contributions.set(cardDefinition(m,c.id).name,amount);
 }
 return [...contributions.values()].reduce((a,b)=>a+b,0);
}
export function vesselHyperspeed(m:Match,id:string):number|null {
 const raw=(cardDefinition(m,id).stats as Record<string,string>).hyperspeed;
 if(raw===undefined)return null;
 return vesselStatValue(m,id,'hyperspeed',Number(raw)+aboardStarfighterBonus(m,id)+vesselStatBonus(m,id,'hyperspeed'));
}
export function redFiveImmunity(m:Match,id:string):number {
 return m.cards[id].blueprint==='2_71'&&gameTextActive(m,id)&&occupants(m,id).some(c=>actingPilot(m,c.id)&&hasPersona(m,c.id,'LUKE'))?4:0;
}

/** The unpiloted armor rule takes precedence over ordinary ship resets. */
export function vesselArmor(m:Match,id:string):number|null {
 const raw=(cardDefinition(m,id).stats as Record<string,string>).armor;
 if(raw===undefined)return null;
 if(!Number.isFinite(Number(raw)))throw Error('Armor needs a printed-value provider.');
 return operational(m,id)?vesselStatValue(m,id,'armor',Number(raw)):2;
}

/** R5 units enhance any directly occupied starship, without adding hyperspeed.
 * Different titles combine; copies of one title are noncumulative. */
export function repairDroidBonus(m:Match,id:string):number {
 if(cardDefinition(m,id).type!=='Starship')return 0;
 return new Set(repairCrew(m,id).map(c=>cardDefinition(m,c.id).name)).size;
}

export const repairCrew=(m:Match,id:string)=>occupants(m,id).filter(c=>['2_15','2_101'].includes(c.blueprint)&&crewActive(m,c.id)&&gameTextActive(m,c.id));

export function redTwoImmunity(m:Match,id:string):number {
 return m.cards[id].blueprint==='2_70'&&gameTextActive(m,id)&&occupants(m,id).some(c=>actingPilot(m,c.id)&&hasPersona(m,c.id,'WEDGE'))?3:0;
}
