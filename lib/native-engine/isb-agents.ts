import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {hasCharacteristic} from './characteristics';
import {hasPersona,isUnique} from './persona';
import {crewActive} from './occupancy';
import {besiegedParticipant} from './captured-ship-state';
import type {Match} from './types';

/** "At the same site" includes characters aboard enclosed vehicles. It is
 * broader than presence; an excluded participant still supplies no modifier. */
function activeCharacter(m:Match,id:string,active:(id:string)=>boolean):boolean {
 const c=m.cards[id];return !!c&&c.zone==='table'&&!c.coveredBy&&cardDefinition(m,id).type==='Character'&&crewActive(m,id)&&active(id);
}
function sameSite(m:Match,a:string,b:string,active:(id:string)=>boolean):boolean {
 const x=m.cards[a],y=m.cards[b];
 if(!activeCharacter(m,a,active)||!activeCharacter(m,b,active)||!x.location||x.location!==y.location||!m.locations.includes(x.location))return false;
 return cardDefinition(m,x.location).subType==='Site'||besiegedParticipant(m,a)&&besiegedParticipant(m,b);
}
export function isbAgentPowerBonus(m:Match,id:string,active:(id:string)=>boolean=()=>true):number {
 if(m.cards[id]?.blueprint!=='1_166'||!gameTextActive(m,id))return 0;
 return Object.values(m.cards).some(c=>c.id!==id&&(hasPersona(m,c.id,'TARKIN')||['Chief Bast','General Dodonna'].includes(cardDefinition(m,c.id).name))&&sameSite(m,id,c.id,active))?1:0;
}
export function isbAgentForfeitBonus(m:Match,id:string,active:(id:string)=>boolean=()=>true):number {
 if(!hasCharacteristic(m,id,'SNOWTROOPER'))return 0;
 return Object.values(m.cards).some(c=>c.blueprint==='104_6'&&gameTextActive(m,c.id)&&sameSite(m,c.id,id,active))?1:0;
}
/** Veers' opponent-count prohibition is not a location restriction and cannot
 * be bypassed by ISB Operations. Printed pilot capability is intentionally absent. */
export function isbAgentDeploymentProhibited(m:Match,id:string):boolean {
 return m.cards[id]?.blueprint==='104_6'&&Object.values(m.cards).filter(c=>c.owner!==m.cards[id].owner&&activeCharacter(m,c.id,()=>true)&&isUnique(m,c.id)).length>=3;
}
