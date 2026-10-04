import {characterPresent} from './occupancy';
import {cardDefinition} from './definitions';
import type {Battle} from './battle';
import type {GroundState} from './ground';
import type {Match, Side} from './types';

/** Read-only rules state shared by movement, combat and continuous modifiers.
 * Type-only dependencies keep attribute queries independent of action handlers. */
export const barred = (m: Match, id: string) => (((m.data.ground as GroundState | undefined)?.barriers ?? {})[id] ?? 0) >= m.turn.number;
export function battleProhibited(m:Match,id:string):boolean {
 const seen=new Set<string>();let c=m.cards[id];while(c){if(seen.has(c.id))throw Error('Cyclic battle carrier.');seen.add(c.id);if(barred(m,c.id))return true;c=m.cards[c.attachedTo!];}return false;
}
export function battleMembers(m: Match, side: Side): string[] {
  const b = m.data.battle as Battle | undefined;
  if (!b) return [];
  return b.participants[side].filter(id => !b.departed?.includes(id) && m.cards[id]?.zone === 'table' && m.cards[id].location === b.site && !battleProhibited(m,id));
}

/** Current ground presence. Excluded/nonparticipating cards at the battle site
 * cannot supply continuous text or form a pair during that battle (AR p60). */
export function groundPresent(m: Match, id: string): boolean {
  const c = m.cards[id];
  if (!c || c.zone !== 'table' || !characterPresent(m,id) || c.coveredBy || !c.location || !m.locations.includes(c.location) || cardDefinition(m,id).type !== 'Character') return false;
  const b = m.data.battle as Battle | undefined;
  return !b || b.stage === 'complete' || b.site !== c.location || battleMembers(m,c.owner).includes(id);
}
