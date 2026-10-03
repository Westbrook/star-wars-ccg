import {duel} from './duel';
import {addDuelModifier} from './duel-modifiers';
import {moveCard} from './state';
import type {Action, Match, Resolution, Side, Window} from './types';

const cards = ['5_41','5_141'];
export function duelInterruptActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'response' || (w.event as {kind?: string})?.kind !== 'duel-destiny-before' || duel(m)?.stage !== 'draws') return [];
  return m.players[side].hand.filter(id => cards.includes(m.cards[id].blueprint)).map(card => ({
    id: 'duel-interrupt:add:' + card, handler: 'duel-interrupt:add', source: card,
    label: (side === 'dark' ? 'Focused Attack' : 'Courage Of A Skywalker') + ' · add one duel destiny', payload: {card},
  }));
}
export function duelInterruptInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as {card: string}).card, 'playing');}
export function duelInterruptResolve(m: Match, r: Resolution): void {
  const {card} = r.action.payload as {card: string};
  if (!r.cancelled && duel(m)?.stage === 'draws') addDuelModifier(m, card, r.actor, 'draws', 1);
  moveCard(m, card, 'lost');
}
export function assertDuelInterrupts(m: Match): void {
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('duel-interrupt:')) {
    const p = r.action.payload as {card: string};
    if (r.action.handler !== 'duel-interrupt:add' || !p || !cards.includes(m.cards[p.card]?.blueprint) ||
        m.cards[p.card].owner !== r.actor || m.cards[p.card].zone !== 'playing' || r.action.source !== p.card || !duel(m)) throw Error('Invalid duel destiny Interrupt.');
  }
}
