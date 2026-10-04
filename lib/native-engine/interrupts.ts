import {optionalActionWindow} from './action-timing';
import {cancelPendingDestiny, destinyInWindow} from './destiny-response';
import {ability} from './ability';
import {cardDefinition, name} from './board';
import {battle, members} from './battle';
import {drawDestiny, type Draw} from './destiny';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {retrieve} from './retrieval';
import {openWindow, type Context} from './runtime';
import {moveCard, shufflePile} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type DiceBinding = {character: CardReference; destiny: CardReference; index: number; actionId: string; window: number};
type Payload = {card: string; side?: Side; pile?: 'reserve' | 'used' | 'lost'; target?: string; drawn?: string; draw?: Draw; dice?: DiceBinding};
const action = (id: string, label: string, step: string, p: Payload, cost = 0, side?: Side): Action => ({id, label, handler: 'interrupt:' + step, payload: p as unknown as Json, source: p.card, ...(cost && side ? {payment: {[side]: cost}} : {})});
const cleanup = (m: Match, card: string, cancelled: boolean) => moveCard(m, card, cancelled || cardDefinition(m, card).subType === 'Lost' ? 'lost' : 'used');
export function interruptActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [], e = w.event as {kind?: string; side?: Side; card?: string} | undefined;
  // AR: ordinary top-level actions also have a place in the weapons segment,
  // but not in arbitrary responses or the power/damage segments.
  const topLevel = optionalActionWindow(w);
  const count = (s: Side) => Object.values(m.cards).filter(c => c.owner === s && c.zone === 'table' && ['Character', 'Starship'].includes(cardDefinition(m, c.id).type)).length;
  for (const card of m.players[side].hand) {
    const bp = m.cards[card].blueprint;
    if (topLevel && ['1_106', '1_251'].includes(bp) && count(other(side)) > count(side))
      actions.push(action('reinforce:' + card, 'Play ' + name(m, card), 'reinforce', {card}, 1, side));
    if (topLevel && ['1_115', '1_262'].includes(bp)) for (const target of sides) for (const pile of ['reserve', 'lost', 'used'] as const) {
      if (m.players[target][pile].length) actions.push(action('shuffle:' + card + ':' + target + ':' + pile, name(m, card) + ' · shuffle ' + target + ' ' + pile, 'shuffle', {card, side: target, pile}));
    }
    if (bp === '1_84' && w.timing === 'response' && e?.kind === 'battle-destiny-drawn' && e.side === side) {
      const parent = m.stack.at(-2), b = battle(m);
      if (destinyInWindow(m,w) && b && b.destiny[side] !== null && !b.destinyDraws?.[side]?.substitution && parent?.kind === 'resolution' && parent.action.handler === 'battle:destiny-finish' && !(parent.action.payload as {redraw?: boolean}).redraw)
        for (const target of members(m, side).filter(id => cardDefinition(m, id).type === 'Character' && ability(m, id) > 2)) actions.push(action('dice:' + card + ':' + target, "Han's Dice · redraw battle destiny", 'dice', {card, target, drawn: e.card,
          dice: {character: referenceCard(m, target), destiny: referenceCard(m, e.card!), index: m.stack.indexOf(parent), actionId: parent.action.id, window: w.serial}}, 1, side));
    }
  }
  return actions;
}
export function interruptInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as unknown as Payload).card, 'playing');}
export function interruptResolve(m: Match, r: Resolution, context: Context): void {
  const p = r.action.payload as unknown as Payload, h = r.action.handler;
  if (r.cancelled) {if (m.cards[p.card].zone === 'playing') cleanup(m, p.card, true); return;}
  if (h === 'interrupt:cleanup') {cleanup(m, p.card, false); return;}
  if (h === 'interrupt:reinforce') {
    m.stack.push({kind: 'resolution', actor: r.actor, cancelled: false, action: action('cleanup:' + p.card, 'Finish Interrupt', 'cleanup', {card: p.card})});
    drawDestiny(m, r.actor, p.card, 'reinforcements', action('retrieve:' + p.card, 'Retrieve reinforcements', 'retrieve', {card: p.card}));
  } else if (h === 'interrupt:retrieve') {
    if (p.draw?.value !== null && p.draw?.value !== undefined && p.draw.value > 0)
      retrieve(m, r.actor, p.card, p.draw.value, null, 'used', 'reinforcements');
  } else if (h === 'interrupt:shuffle') {
    shufflePile(m, p.side!, p.pile!, context.entropy);
    m.stack.push({kind: 'resolution', actor: r.actor, cancelled: false, action: action('cleanup:' + p.card, 'Finish Interrupt', 'cleanup', {card: p.card})});
    openWindow(m, 'response', other(r.actor), {kind: 'pile-shuffled', side: p.side!, pile: p.pile!, source: p.card});
  } else if (h === 'interrupt:dice') {
    const binding = p.dice!, pending = m.stack[binding.index], w = m.stack[binding.index + 1];
    // AR p15: the selected character qualifies at initiation. Departure or an
    // ability change during responses does not undo that successful initiation.
    // Cancel the exact pending draw, even if its physical card has moved.
    // The draw provider owns cleanup and must not move a departed card.
    if (pending?.kind === 'resolution' && pending.action.handler === 'battle:destiny-finish' && pending.action.id === binding.actionId &&
        pending.actor === r.actor && w?.kind === 'window' && w.serial === binding.window &&
        (pending.action.payload as {card?: string}).card === p.drawn) {
      if(cancelPendingDestiny(m,pending,true)) battle(m)!.destiny[r.actor] = null;
    }
    cleanup(m, p.card, false);
  } else throw Error('Unknown Interrupt continuation.');
}

export function assertInterrupts(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('interrupt:')) {
    const p = f.action.payload as unknown as Payload;
    if (!p || m.cards[p.card]?.owner !== f.actor || m.cards[p.card]?.zone !== 'playing' || cardDefinition(m, p.card).type !== 'Interrupt') throw Error('Invalid pending Interrupt.');
    if (f.action.handler === 'interrupt:shuffle' && (!sides.includes(p.side!) || !['reserve', 'used', 'lost'].includes(p.pile!))) throw Error('Invalid shuffle target.');
    if (f.action.handler === 'interrupt:dice') {
      const b = p.dice;
      if (!b || typeof p.target !== 'string' || typeof p.drawn !== 'string' || !Number.isSafeInteger(b.index) || b.index < 0 || b.index >= m.stack.indexOf(f)) throw Error('Invalid destiny redraw binding.');
      assertCardReference(m, b.character, p.target); assertCardReference(m, b.destiny, p.drawn);
      const parent = m.stack[b.index], w = m.stack[b.index + 1], event = w?.kind === 'window' ? w.event as {kind?: string; side?: Side; card?: string} : undefined;
      if (m.cards[p.card].blueprint !== '1_84' || f.action.source !== p.card || f.action.id !== 'dice:' + p.card + ':' + p.target ||
          m.cards[b.character.id].owner !== f.actor || cardDefinition(m, b.character.id).type !== 'Character' || b.character.zone !== 'table' ||
          m.cards[b.destiny.id].owner !== f.actor || b.destiny.zone !== 'destiny' ||
          parent?.kind !== 'resolution' || parent.action.handler !== 'battle:destiny-finish' || parent.actor !== f.actor || parent.action.id !== b.actionId ||
          (parent.action.payload as {card?: string}).card !== p.drawn || w?.kind !== 'window' || w.timing !== 'response' || w.serial !== b.window ||
          event?.kind !== 'battle-destiny-drawn' || event.side !== f.actor || event.card !== p.drawn)
        throw Error('Invalid destiny redraw binding.');
    }
  }
}
