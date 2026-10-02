import {battle, members} from './battle';
import {cardDefinition} from './board';
import {moveCard} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

type Payload = {card: string; amount: 1 | 2};
export function gamblersLuckActions(m: Match, w: Window, side: Side): Action[] {
  const b = battle(m), own = members(m, side);
  if (m.data.gamblersLuckPlayedTurn === m.turn.number || w.timing !== 'response' || (w.event as {kind?: string})?.kind !== 'battle-weapons' || !b || b.stage !== 'weapons' || b.initiator === side ||
    cardDefinition(m, b.site).subType !== 'Site' || own.length !== 1) return [];
  // Explicit reviewed identities. Broader personas/trait modifiers are not
  // inferred from prose or admitted to full native decks.
  const bp = m.cards[own[0]].blueprint, amounts: (1 | 2)[] = bp === '5_5' ? [1, 2] : bp === '1_11' ? [1] : [];
  return m.players[side].hand.filter(card => m.cards[card].blueprint === '5_48').flatMap(card => amounts.map(amount => ({
    id: 'gamblers-luck:' + card + ':' + amount, label: 'Gambler’s Luck · add ' + amount + ' battle destiny', source: card,
    handler: 'gambler:play', payload: {card, amount} as Json,
  })));
}
export function gamblersLuckInitiate(m: Match, r: Resolution): void {
  // Unique Interrupts consume their title's turn limit at initiation, even if canceled.
  m.data.gamblersLuckPlayedTurn = m.turn.number;
  moveCard(m, (r.action.payload as Payload).card, 'playing');
}
export function gamblersLuckResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, b = battle(m)!;
  // Successful optional destiny additions persist even if the initiating
  // character later leaves. Repeated same-title additions are not cumulative.
  if (!r.cancelled && !b.gamblersLuck) b.gamblersLuck = {...p, side: r.actor};
  if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost');
}
export function assertGamblersLuck(m: Match): void {
  const turn = m.data.gamblersLuckPlayedTurn;
  if (turn !== undefined && (!Number.isSafeInteger(turn) || Number(turn) < 1 || Number(turn) > m.turn.number)) throw Error('Invalid Gambler’s Luck turn history.');
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('gambler:')) {
    const p = r.action.payload as Payload;
    if (r.action.handler !== 'gambler:play' || !p || ![1, 2].includes(p.amount) || m.cards[p.card]?.blueprint !== '5_48' || m.cards[p.card].owner !== r.actor ||
      m.cards[p.card].zone !== 'playing' || r.action.source !== p.card || !battle(m)) throw Error('Invalid Gambler’s Luck continuation.');
  }
}
