import {gameTextActive} from './game-text';
import {hasPersona} from './persona';
import {occupants,crewActive,operational} from './occupancy';
import type {Match} from './types';

/** Printed "moves free" applies to every movement method, including transit.
 * Being carried does not make the passenger a separate paying mover. */
export function movesFree(m:Match,id:string):boolean {
 const bp=m.cards[id]?.blueprint;
 return ['1_149','1_151'].includes(bp)&&operational(m,id)&&gameTextActive(m,id)&&occupants(m,id).some(c=>crewActive(m,c.id)&&
  (hasPersona(m,c.id,'LUKE')||bp==='1_151'&&['1_2','1_22'].includes(c.blueprint)));
}
