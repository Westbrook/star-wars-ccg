import {assertCardReference, cardVersion, type CardReference} from './identity';
import {sides, type Json, type Match, type Side} from './types';

type Origin = {source: CardReference; turn: number; side: Side};
const origins = (m: Match) => (m.data.tableLossOrigins ?? {}) as unknown as Record<string, Origin>;
/** Capture the old active/supporting state before the table -> leaving -> Lost
 * sequence. A buried dud or hand/Force loss must never impersonate this event. */
export function recordTableLossOrigins(m: Match, references: CardReference[]): void {
  const next = {...origins(m)};
  for (const source of references) next[source.id] = {source, turn:m.turn.number, side:m.turn.side};
  m.data.tableLossOrigins = next as unknown as Json;
}
export function lostFromActiveTable(m: Match, id: string): Origin | null {
  const p = origins(m)[id];
  return p?.source.zone === 'table' && m.cards[id]?.zone === 'lost' && cardVersion(m,id) === p.source.version + 2 ? p : null;
}
export function assertTableLossOrigins(m: Match): void {
  const raw = m.data.tableLossOrigins;
  if (raw === undefined) return;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid table loss origins.');
  for (const [id,p] of Object.entries(origins(m))) {
    if (!p || !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number || !sides.includes(p.side)) throw Error('Invalid table loss origin.');
    assertCardReference(m,p.source,id);
    if (!['table','stacked'].includes(p.source.zone) || p.source.version >= cardVersion(m,id) || m.cards[id].zone !== 'leaving' && p.source.version + 1 === cardVersion(m,id)) throw Error('Invalid departed table instance.');
  }
}
