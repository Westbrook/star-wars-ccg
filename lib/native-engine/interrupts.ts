import {cardDefinition, name, printed} from './board';
import {battle, members} from './battle';
import {drawDestiny, type Draw} from './destiny';
import {retrieve} from './retrieval';
import {openWindow, type Context} from './runtime';
import {moveCard, shufflePile} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; side?: Side; pile?: 'reserve' | 'used' | 'lost'; target?: string; drawn?: string; draw?: Draw};
const action = (id: string, label: string, step: string, p: Payload, cost = 0, side?: Side): Action => ({id, label, handler: 'interrupt:' + step, payload: p as unknown as Json, source: p.card, ...(cost && side ? {payment: {[side]: cost}} : {})});
const cleanup = (m: Match, card: string, cancelled: boolean) => moveCard(m, card, cancelled || cardDefinition(m, card).subType === 'Lost' ? 'lost' : 'used');
export function interruptActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [], e = w.event as {kind?: string; side?: Side; card?: string} | undefined;
  // AR: ordinary top-level actions also have a place in the weapons segment,
  // but not in arbitrary responses or the power/damage segments.
  const topLevel = w.timing === 'phase' || w.timing === 'response' && e?.kind === 'battle-weapons';
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
      if (b && b.destiny[side] !== null && parent?.kind === 'resolution' && parent.action.handler === 'battle:destiny-finish' && !(parent.action.payload as {redraw?: boolean}).redraw)
        for (const target of members(m, side).filter(id => printed(m, id, 'ability') > 2)) actions.push(action('dice:' + card + ':' + target, "Han's Dice · redraw battle destiny", 'dice', {card, target, drawn: e.card}, 1, side));
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
    // Current admitted metadata contains the ground troopers only. Broader Rebel
    // trooper/Y-wing/stormtrooper/TIE-ln traits must join the registry before those
    // cards can be admitted to full matches.
    if (p.draw?.value !== null && p.draw?.value !== undefined && p.draw.value > 0)
      retrieve(m, r.actor, p.card, p.draw.value, [r.actor === 'light' ? '1_28' : '1_194']);
  } else if (h === 'interrupt:shuffle') {
    shufflePile(m, p.side!, p.pile!, context.entropy);
    m.stack.push({kind: 'resolution', actor: r.actor, cancelled: false, action: action('cleanup:' + p.card, 'Finish Interrupt', 'cleanup', {card: p.card})});
    openWindow(m, 'response', other(r.actor), {kind: 'pile-shuffled', side: p.side!, pile: p.pile!, source: p.card});
  } else if (h === 'interrupt:dice') {
    const pending = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'battle:destiny-finish');
    if (pending?.kind === 'resolution' && (pending.action.payload as {card?: string}).card === p.drawn) {
      (pending.action.payload as Record<string, Json>).redraw = true;
      battle(m)!.destiny[r.actor] = null;
    }
    cleanup(m, p.card, false);
  } else throw Error('Unknown Interrupt continuation.');
}

export function assertInterrupts(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('interrupt:')) {
    const p = f.action.payload as unknown as Payload;
    if (!p || m.cards[p.card]?.owner !== f.actor || m.cards[p.card]?.zone !== 'playing' || cardDefinition(m, p.card).type !== 'Interrupt') throw Error('Invalid pending Interrupt.');
    if (f.action.handler === 'interrupt:shuffle' && (!sides.includes(p.side!) || !['reserve', 'used', 'lost'].includes(p.pile!))) throw Error('Invalid shuffle target.');
    if (f.action.handler === 'interrupt:dice' && (!m.cards[p.target!] || m.cards[p.drawn!]?.owner !== f.actor)) throw Error('Invalid destiny redraw.');
  }
}
