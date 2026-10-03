import {groundPresent} from './participation';
import {cardDefinition} from './definitions';
import {hasPersona} from './persona';
import type {Match, Side} from './types';

/** AR p139: neither member can be reused in another Rebel/droid pair. */
export function protocolPowerBonus(m: Match, side: Side, site: string, active: (id: string) => boolean): number {
  const cards = Object.values(m.cards).filter(c => c.owner === side && c.location === site && groundPresent(m,c.id) && active(c.id));
  if (!cards.some(c => c.blueprint === '1_5')) return 0;
  return 2 * Math.min(cards.filter(c => cardDefinition(m,c.id).subType === 'Droid').length,
    cards.filter(c => cardDefinition(m,c.id).subType === 'Rebel').length);
}
/** This text names R2-D2, not only an own R2-D2. Duplicate sources do not stack. */
export function protocolForfeitBonus(m: Match, id: string, active: (id: string) => boolean): number {
  if (!hasPersona(m,id,'R2D2') || !active(id) || !groundPresent(m,id)) return 0;
  return Object.values(m.cards).some(c => c.blueprint === '1_5' && c.location === m.cards[id].location && groundPresent(m,c.id) && active(c.id)) ? 2 : 0;
}
