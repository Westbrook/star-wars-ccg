import type {Battle} from './battle';
import type {GroundState} from './ground';
import type {Match, Side} from './types';

/** Read-only rules state shared by movement, combat and continuous modifiers.
 * Type-only dependencies keep attribute queries independent of action handlers. */
export const barred = (m: Match, id: string) => (((m.data.ground as GroundState | undefined)?.barriers ?? {})[id] ?? 0) >= m.turn.number;
export function battleMembers(m: Match, side: Side): string[] {
  const b = m.data.battle as Battle | undefined;
  if (!b) return [];
  return b.participants[side].filter(id => !b.departed?.includes(id) && m.cards[id]?.zone === 'table' && m.cards[id].location === b.site && !barred(m,id));
}
