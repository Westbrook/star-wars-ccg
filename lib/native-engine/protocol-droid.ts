import type {Battle} from './battle';
import {battleMembers} from './participation';
import {cardDefinition} from './definitions';
import {hasPersona} from './persona';
import type {Match, Side} from './types';

/** Current ground presence. Excluded/nonparticipating cards at the battle site
 * cannot supply continuous text or form a pair during that battle (AR p60). */
function present(m: Match, id: string): boolean {
  const c = m.cards[id];
  if (!c || c.zone !== 'table' || c.attachedTo || c.coveredBy || !c.location || !m.locations.includes(c.location) || cardDefinition(m,id).type !== 'Character') return false;
  const b = m.data.battle as Battle | undefined;
  return !b || b.stage === 'complete' || b.site !== c.location || battleMembers(m,c.owner).includes(id);
}
/** AR p139: neither member can be reused in another Rebel/droid pair. */
export function protocolPowerBonus(m: Match, side: Side, site: string, active: (id: string) => boolean): number {
  const cards = Object.values(m.cards).filter(c => c.owner === side && c.location === site && present(m,c.id) && active(c.id));
  if (!cards.some(c => c.blueprint === '1_5')) return 0;
  return 2 * Math.min(cards.filter(c => cardDefinition(m,c.id).subType === 'Droid').length,
    cards.filter(c => cardDefinition(m,c.id).subType === 'Rebel').length);
}
/** This text names R2-D2, not only an own R2-D2. Duplicate sources do not stack. */
export function protocolForfeitBonus(m: Match, id: string, active: (id: string) => boolean): number {
  if (!hasPersona(m,id,'R2D2') || !active(id) || !present(m,id)) return 0;
  return Object.values(m.cards).some(c => c.blueprint === '1_5' && c.location === m.cards[id].location && present(m,c.id) && active(c.id)) ? 2 : 0;
}
