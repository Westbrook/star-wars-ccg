import {printed} from './board';
import {moveCard, moveTop} from './state';
import {openWindow} from './runtime';
import {other, type Action, type Json, type Match, type Resolution, type Side} from './types';
export type Draw = {card: string | null; value: number | null};
type PendingDraw = {draw: Draw; next: Action; side: Side; source: string; category: string};
/** General (non-battle) destiny. The following effect is a serialized action,
 * never a closure. Timer Mine specifically does not draw weapon destiny. */
export function drawDestiny(m: Match, side: Side, source: string, category: string, next: Action): void {
  const card = m.players[side].reserve.length ? moveTop(m, side, 'reserve', 'destiny') : null;
  const draw: Draw = {card, value: card ? printed(m, card, 'destiny') : null};
  m.stack.push({kind: 'resolution', actor: side, cancelled: false, action: {id: 'destiny-finish:' + (m.serial + 1), label: 'Resolve destiny', handler: 'destiny:finish', payload: {draw, next, side, source, category} as unknown as Json}});
  openWindow(m, 'response', other(side), {kind: card ? 'destiny-drawn' : 'destiny-failed', category, source, side, card});
}
export function resolveDestiny(m: Match, r: Resolution): void {
  if (r.action.handler !== 'destiny:finish') throw Error('Unknown destiny continuation.');
  const p = r.action.payload as unknown as PendingDraw;
  if (p.draw.card && m.cards[p.draw.card]?.zone === 'destiny') moveCard(m, p.draw.card, 'used');
  m.stack.push({kind: 'resolution', actor: p.side, cancelled: false, action: {...p.next, payload: {...p.next.payload as Record<string, Json>, draw: (r.cancelled ? {card: p.draw.card, value: null} : p.draw) as unknown as Json}}});
}

export function assertDestiny(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'destiny:finish') {
    const p = f.action.payload as unknown as PendingDraw;
    if (!p || !['dark', 'light'].includes(p.side) || !m.cards[p.source] || typeof p.category !== 'string' || !p.next?.handler || !p.draw ||
        p.draw.card !== null && (!m.cards[p.draw.card] || m.cards[p.draw.card].owner !== p.side) ||
        p.draw.value !== null && (!Number.isFinite(p.draw.value) || p.draw.value < 0) || p.draw.card === null && p.draw.value !== null)
      throw Error('Invalid pending destiny.');
  }
}
