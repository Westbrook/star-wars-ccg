import {gameTextActive} from './game-text';
import {crewActive} from './occupancy';
import {hasPersona} from './persona';
import type {Match} from './types';

export const activeChewbacca=(m:Match,id:string)=>m.cards[id]?.blueprint==='2_3'&&gameTextActive(m,id)&&crewActive(m,id);
/** Same location, not present together: pilots and passengers aboard vessels
 * qualify. Han's persona survives canceled Han text; inactive cards do not. */
export function chewbaccaPowerBonus(m:Match,id:string):number{
 const c=m.cards[id];return activeChewbacca(m,id)&&!!c.location&&Object.values(m.cards).some(h=>h.zone==='table'&&h.location===c.location&&crewActive(m,h.id)&&hasPersona(m,h.id,'HAN'))?1:0;
}
