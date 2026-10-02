import {battle, members} from './battle';
import {cardDefinition, name, printed} from './board';
import {substituteDestiny} from './destiny';
import {moveCard} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

type Payload = {card: string; target: string; pendingIndex: number; pendingId: string};
const pending = (m: Match, p: Payload) => {
  const r = m.stack[p.pendingIndex];
  return r?.kind === 'resolution' && r.action.handler === 'destiny:draw' && r.action.id === p.pendingId ? r : null;
};
export function substitutionActions(m: Match, w: Window, side: Side): Action[] {
  const e = w.event as {kind?: string; category?: string; side?: Side} | undefined;
  const index = m.stack.length - 2, r = m.stack[index], b = battle(m);
  if (w.timing !== 'response' || e?.kind !== 'about-to-draw-destiny' || e.category !== 'battle' || e.side !== side || !b || b.stage !== 'power' ||
    r?.kind !== 'resolution' || r.action.handler !== 'destiny:draw' || r.cancelled || (r.action.payload as {substitution?: unknown}).substitution || !m.players[side].reserve.length || cardDefinition(m, b.site).subType !== 'Site') return [];
  const targets = members(m, side).filter(id => cardDefinition(m, id).type === 'Character' && printed(m, id, 'ability') > 0);
  return m.players[side].hand.filter(id => m.cards[id].blueprint === '5_69').flatMap(card => targets.map(target => ({
    id: 'smoke:' + card + ':' + target, label: 'Smoke Screen · use ' + name(m, target) + ' ability', handler: 'substitution:smoke', source: card,
    payload: {card, target, pendingIndex: index, pendingId: r.action.id} as Json,
  })));
}
export function substitutionInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
export function substitutionResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, draw = pending(m, p);
  // Like GEMP Card5_069, read the targeted character's current ability at the
  // result. Initiation conditions are not retroactively undone by responses.
  if (!r.cancelled && draw) substituteDestiny(m, draw, p.card, printed(m, p.target, 'ability'));
  if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost');
}
export function assertSubstitution(m: Match): void {
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('substitution:')) {
    const p = r.action.payload as Payload, d = p && pending(m, p);
    if (r.action.handler !== 'substitution:smoke' || !p || m.cards[p.card]?.blueprint !== '5_69' || m.cards[p.card].owner !== r.actor || m.cards[p.card].zone !== 'playing' ||
      r.action.source !== p.card || m.cards[p.target]?.owner !== r.actor || cardDefinition(m, p.target).type !== 'Character' || !Number.isSafeInteger(p.pendingIndex) || p.pendingIndex < 0 || p.pendingIndex >= m.stack.indexOf(r) || !d || d.actor !== r.actor ||
      (d.action.payload as {category?: string}).category !== 'battle') throw Error('Invalid Smoke Screen continuation.');
  }
}
