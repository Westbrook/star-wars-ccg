import {cardDefinition} from './definitions';
import type {Card,Match} from './types';

/** A held ship is inactive cargo, without occupying a cargo-capacity slot.
 * Its crew are trapped aboard, not character captives. */
export type CapturedShip={host:string;pending?:'release'|'steal'};
export function attachmentGroup(m:Match,id:string):Card[]{
 const ids=new Set([id]);
 for(let changed=true;changed;){changed=false;for(const c of Object.values(m.cards))if(c.attachedTo&&ids.has(c.attachedTo)&&!ids.has(c.id)){ids.add(c.id);changed=true;}}
 return [...ids].map(id=>m.cards[id]);
}
export const capturedShips=(m:Match)=>Object.values(m.cards).filter(c=>c.capturedShip);
export function capturedShipFor(m:Match,id:string):Card|undefined {
 let c=m.cards[id];const seen=new Set<string>();
 while(c){if(seen.has(c.id))throw Error('Cyclic captured ship.');seen.add(c.id);if(c.capturedShip)return c;c=m.cards[c.attachedTo!];}
}
/** Related ship sites are separate locations, outside the bridge/cockpit/cargo. */
export const trappedCharacters=(m:Match,id:string)=>attachmentGroup(m,id).filter(c=>c.id!==id&&c.zone==='inactive'&&c.owner==='light'&&cardDefinition(m,c.id).type==='Character');
