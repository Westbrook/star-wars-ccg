import {remainingDestinyDraws} from './destiny-limits';
import {battle, members} from './battle';
import {cardDefinition} from './board';
import {convertDestinySelection} from './destiny-selection';
import {moveCard} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

type Payload = {card: string; amount: 1 | 2; pendingIndex?: number; pendingId?: string};
const pending = (m: Match, p: Payload) => {
  const r = p.pendingIndex === undefined ? undefined : m.stack[p.pendingIndex];
  return r?.kind === 'resolution' && r.action.handler === 'destiny:draw' && r.action.id === p.pendingId ? r : null;
};
export function gamblersLuckActions(m: Match, w: Window, side: Side): Action[] {
  const b = battle(m), own = members(m, side);
  const e = w.event as {kind?: string; side?: Side; category?: string} | undefined;
  const index = m.stack.length - 2, draw = m.stack[index], plan = b?.destinyPlans?.[side], grant = b?.gamblersLuck;
  // Coverage guard: delaying a choose-two conversion until only one scheduled
  // draw remains strands unresolved cards in pinned GEMP. No full admission
  // until that branch has a normative outcome; do not treat this as a rule.
  if (w.timing === 'response' && e?.kind === 'about-to-draw-destiny' && e.side === side && e.category === 'battle' &&
    b?.stage === 'power' && grant?.side === side && plan?.selection && plan.remaining + 1 >= plan.selection.y &&
    draw?.kind === 'resolution' && draw.action.handler === 'destiny:draw' && !draw.cancelled && m.players[side].reserve.length) {
    const p = draw.action.payload as {retain?: boolean; substitution?: unknown; next?: Action; scope?: string};
    if (!p.retain && !p.substitution && remainingDestinyDraws(m, p.scope) >= plan.selection.x && p.next?.handler === 'battle:plan-draw') return [{
      id: 'gamblers-select:' + grant.card, label: 'Gambler’s Luck · draw ' + plan.selection.x + ' and choose ' + plan.selection.y,
      source: grant.card, handler: 'gambler:convert', payload: {card: grant.card, amount: grant.amount, pendingIndex: index, pendingId: draw.action.id} as Json,
    }];
  }
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
  if (r.action.handler === 'gambler:convert') {battle(m)!.destinyPlans![r.actor]!.selection = null; return;}
  // Unique Interrupts consume their title's turn limit at initiation, even if canceled.
  m.data.gamblersLuckPlayedTurn = m.turn.number;
  moveCard(m, (r.action.payload as Payload).card, 'playing');
}
export function gamblersLuckResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, b = battle(m)!;
  if (r.action.handler === 'gambler:convert') {
    const draw = pending(m, p);
    if (!r.cancelled && draw && convertDestinySelection(m, draw, p.amount + 1, p.amount,
      {id: 'battle-plan-batch', label: 'Resolve selected battle destinies', handler: 'battle:plan-batch', payload: {side: r.actor}}))
      b.destinyPlans![r.actor]!.remaining -= p.amount - 1;
    return;
  }
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
    if (r.action.handler === 'gambler:convert') {
      const d = p && pending(m, p), b = battle(m), plan = b?.destinyPlans?.[r.actor];
      if (!d || !Number.isSafeInteger(p.pendingIndex) || p.pendingIndex! < 0 || p.pendingIndex! >= m.stack.indexOf(r) || d.actor !== r.actor ||
        r.action.source !== p.card || b?.gamblersLuck?.card !== p.card || b.gamblersLuck.amount !== p.amount || !plan || plan.selection !== null || plan.remaining + 1 < p.amount ||
        (d.action.payload as {next?: Action}).next?.handler !== 'battle:plan-draw' ||
        (d.action.payload as {category?: string}).category !== 'battle' || (d.action.payload as {source?: string}).source !== b.site) throw Error('Invalid Gambler’s Luck conversion.');
      continue;
    }
    if (r.action.handler !== 'gambler:play' || !p || ![1, 2].includes(p.amount) || m.cards[p.card]?.blueprint !== '5_48' || m.cards[p.card].owner !== r.actor ||
      m.cards[p.card].zone !== 'playing' || r.action.source !== p.card || !battle(m)) throw Error('Invalid Gambler’s Luck continuation.');
  }
}
