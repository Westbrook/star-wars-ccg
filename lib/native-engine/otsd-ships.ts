import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {isModel,nonUnique} from './characteristics';
import {hasPersona} from './persona';
import {system} from './board';
import {sectorKind} from './sectors';
import {belowDecks,capital,crewActive,operational,type AboardRole} from './occupancy';
import type {Match} from './types';

/** Printed OTSD modifiers. Evaluate at the actual destination/draw rather than
 * baking a discount or bonus into the card's printed attributes. */
export function otsdDeployModifier(m:Match,id:string,at:string):number {
 const bp=m.cards[id].blueprint;
 if(bp==='1_304')return cardDefinition(m,at).subType==='System'&&Object.values(m.cards).some(c=>c.zone==='table'&&!c.coveredBy&&c.location===at&&crewActive(m,c.id)&&capital(m,c.id)&&cardDefinition(m,c.id).side==='dark'&&!cardDefinition(m,c.id).icons.some(icon=>['Independent','Republic','Trade Federation','Separatist','Clone Army','First Order','Resistance'].includes(icon)))?-1:0;
 if(bp==='106_15')return sectorKind(m,at)==='cloud'?-1:0;
 const rule:Record<string,[string,string]>={'106_4':['Yavin 4','DUTCH'],'106_7':['Yavin 4','RED_LEADER'],'106_10':['Death Star','VADER']};
 const r=rule[bp];if(!r)return 0;
 return system(m,at)===r[0]||Object.values(m.cards).some(c=>c.zone==='table'&&!c.coveredBy&&c.location===at&&hasPersona(m,c.id,r[1]))?-2:0;
}
export const tie=(m:Match,id:string)=>['TIE_LN','TIE_ADVANCED_X1','TIE_INTERCEPTOR','TIE_DEFENDER','TIE_AD','TIE_RC','TIE_SA','TIE_SF','TIE_SR','TIE_VN'].some(model=>isModel(m,id,model));
export function otsdShipBonus(m:Match,id:string,stat:'power'|'maneuver'):number {
 const c=m.cards[id];if(c?.zone!=='table'||!operational(m,id))return 0;
 const active=gameTextActive(m,id),cloud=c.location&&sectorKind(m,c.location)==='cloud'&&nonUnique(m,c.location);
 let n=active&&stat==='power'&&['106_4','106_7','106_10','106_15'].includes(c.blueprint)?2:0;
 if(active&&cloud&&(c.blueprint==='106_9'||stat==='power'&&c.blueprint==='106_15'))n+=2;
 // Identical automatic modifiers are noncumulative; cargo is not present outside.
 if(stat==='power'&&tie(m,id)&&!belowDecks(m,id)&&!c.attachedTo&&Object.values(m.cards).some(h=>h.blueprint==='106_13'&&h.owner===c.owner&&h.location===c.location&&gameTextActive(m,h.id)&&operational(m,h.id)&&crewActive(m,h.id)&&!h.attachedTo))n++;
 return n;
}
export function otsdWeaponDrawBonus(m:Match,weapon:string):number {
 const c=m.cards[weapon],host=c?.attachedTo;if(!host||!gameTextActive(m,host)||!operational(m,host)||belowDecks(m,host))return 0;
 return m.cards[host].blueprint==='106_10'||m.cards[host].blueprint==='106_4'&&['1_318','2_81'].includes(c.blueprint)?1:0;
}
export function otsdWeaponFree(m:Match,weapon:string,host:string,mode:'deploy'|'fire'):boolean {
 if(!gameTextActive(m,host)||mode==='fire'&&!operational(m,host))return false;
 return m.cards[host].blueprint==='106_7'&&m.cards[weapon].blueprint==='1_158'||mode==='fire'&&m.cards[host].blueprint==='106_15'&&m.cards[weapon].blueprint==='1_313';
}
export function cargoRoles(m:Match,id:string,host:string):AboardRole[] {
 if(cardDefinition(m,id).type==='Vehicle')return ['vehicle'];
 return m.cards[id].blueprint==='106_9'&&capital(m,host)?['starship','vehicle']:['starship'];
}
export const vehicleCargoCompatible=(m:Match,id:string,host:string)=>cardDefinition(m,id).type==='Vehicle'||m.cards[id].blueprint==='106_9'&&capital(m,host);
