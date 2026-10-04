import {cardDefinition,isSite,system} from './board';
import {gameTextActive} from './game-text';
import {belowDecks,crewActive,enclosedOccupant} from './occupancy';
import {groundPresent} from './participation';
import type {Match} from './types';

/** Characters share presence on the open site or inside the same enclosed
 * vessel. Being merely at the same location is insufficient. */
export function charactersPresentTogether(m:Match,a:string,b:string):boolean {
 const x=m.cards[a],y=m.cards[b];
 if(a===b||!x||!y||x.zone!=='table'||y.zone!=='table'||!x.location||x.location!==y.location||!crewActive(m,a)||!crewActive(m,b)||belowDecks(m,a)||belowDecks(m,b))return false;
 return groundPresent(m,a)&&groundPresent(m,b)||enclosedOccupant(m,a)&&enclosedOccupant(m,b)&&x.attachedTo===y.attachedTo;
}
export function leiaPowerBonus(m:Match,id:string,active:(id:string)=>boolean):number {
 const c=m.cards[id];if(!c?.location||!isSite(m,c.location)||system(m,c.location)!=='Death Star'||cardDefinition(m,id).subType!=='Rebel'||!active(id))return 0;
 return Object.values(m.cards).some(leia=>leia.blueprint==='1_17'&&gameTextActive(m,leia.id)&&active(leia.id)&&charactersPresentTogether(m,id,leia.id))?1:0;
}
