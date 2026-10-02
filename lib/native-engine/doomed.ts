import {lifeForce, moveCard} from './state';
import {doomedRounding, type Doomed} from './loss';
import type {Action, Json, Match, Resolution, Side, Window} from './types';
export function doomedActions(m: Match, w: Window, side: Side): Action[] {
  if (side !== 'light' || m.turn.side !== 'dark' || m.turn.phase !== 'control' || w.timing !== 'phase' || lifeForce(m, side) >= 15) return [];
  return m.players.light.hand.filter(id => m.cards[id].blueprint === '1_120').map(card => ({id: 'doomed:' + card, label: 'Play We’re Doomed', handler: 'doomed:play', source: card, payload: {card}}));
}
export function doomedInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as {card: string}).card, 'playing');}
export function doomedResolve(m: Match, r: Resolution): void {
  const {card} = r.action.payload as {card: string};
  if (!r.cancelled) {
    const old = m.data.doomed as Doomed | undefined;
    m.data.doomed = {turn: m.turn.number, sources: [...new Set([...(old?.turn === m.turn.number ? old.sources : []), card])]};
  }
  moveCard(m, card, r.cancelled ? 'lost' : 'used');
}
export function doomedView(m: Match): Json {
  return {doomed: m.status === 'playing' && doomedRounding(m, 'light') ? {side: 'light', turn: m.turn.number, rounding: doomedRounding(m, 'light')} : null};
}
export function assertDoomed(m: Match): void {
  const d = m.data.doomed as Doomed | undefined;
  if (d && (!Number.isSafeInteger(d.turn) || d.turn < 1 || d.turn > m.turn.number || !Array.isArray(d.sources) || !d.sources.length || new Set(d.sources).size !== d.sources.length || d.sources.some(id => m.cards[id]?.blueprint !== '1_120' || m.cards[id].owner !== 'light'))) throw Error('Invalid We’re Doomed duration.');
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('doomed:')) {
    const p = r.action.payload as {card: string};
    if (r.action.handler !== 'doomed:play' || r.actor !== 'light' || !p || m.cards[p.card]?.blueprint !== '1_120' || m.cards[p.card].owner !== 'light' || m.cards[p.card].zone !== 'playing') throw Error('Invalid We’re Doomed continuation.');
  }
}
