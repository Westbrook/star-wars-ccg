import {cardDefinition} from './definitions';
import {sameCard,type CardReference} from './identity';
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
export const trappedCharacters=(m:Match,id:string)=>attachmentGroup(m,id).filter(c=>c.id!==id&&(c.zone==='inactive'||besiegedActiveCard(m,c.id))&&c.owner==='light'&&cardDefinition(m,c.id).type==='Character');

export type BesiegedBattle={ship:CardReference;effect:CardReference;host:CardReference;selected:CardReference[];activated:CardReference[]};
export function besiegedActiveCard(m:Match,id:string):boolean {
 const b=m.data.battle as {stage:string;besieged?:BesiegedBattle}|undefined;
 return !!b&&b.stage!=='complete'&&!!b.besieged?.activated.some(r=>r.id===id&&sameCard(m,r))&&capturedShipFor(m,id)?.id===b.besieged.ship.id;
}
export function besiegedParticipant(m:Match,id:string):boolean {
 const b=m.data.battle as {stage:string;besieged?:BesiegedBattle;participants:Record<string,string[]>;departed?:string[]}|undefined;
 return !!b?.besieged&&sameCard(m,b.besieged.ship)&&sameCard(m,b.besieged.host)&&m.cards[b.besieged.ship.id].capturedShip?.host===b.besieged.host.id&&(m.cards[id]?.owner==='light'?capturedShipFor(m,id)?.id===b.besieged.ship.id:cardDefinition(m,b.besieged.host.id).type==='Location'||m.cards[id]?.attachedTo===b.besieged.host.id)&&b.stage!=='complete'&&m.cards[id]?.zone==='table'&&!b.departed?.includes(id)&&Object.values(b.participants).some(ids=>ids.includes(id));
}

/** AR p25: an attachment explicitly functioning on an inactive host stays active. */
export const capturedShipActiveAttachment=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&m.cards[id].blueprint==='2_117'&&!!m.cards[m.cards[id].attachedTo??'']?.capturedShip;
