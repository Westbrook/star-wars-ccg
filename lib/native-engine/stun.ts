import {cardDefinition, name, printed} from './board';
import {drawDestiny, type Draw} from './destiny';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {returnToHand} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target: string; draw?: Draw; targetRef?: CardReference};
const action = (step: string, p: Payload): Action => ({id: 'stun:' + step + ':' + p.card + ':' + p.target,
  label: 'Resolve Set For Stun', handler: 'stun:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
const eligible = (m: Match, target: string, side: Side) => m.cards[target]?.zone === 'table' && m.cards[target].owner !== side && cardDefinition(m, target).type === 'Character';
export function stunActions(m: Match, w: Window, side: Side): Action[] {
  const event = w.event as {kind?: string} | undefined;
  if (w.timing !== 'phase' && !(w.timing === 'response' && event?.kind === 'battle-weapons')) return [];
  return m.players[side].hand.filter(id => m.cards[id].blueprint === '1_268').flatMap(card =>
    Object.keys(m.cards).filter(id => eligible(m, id, side)).map(target => ({...action('play', {card, target}),
      label: 'Set For Stun · ' + name(m, target), payment: {[side]: 2}})));
}
export function stunInitiate(m: Match, r: Resolution): void {const p = r.action.payload as Payload; p.targetRef = referenceCard(m, p.target); moveCard(m, p.card, 'playing');}
export function stunResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (r.cancelled) {if (h === 'stun:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'stun:play') {
    queue(m, 'finish', p);
    if (sameCard(m, p.targetRef!) && eligible(m, p.target, r.actor)) drawDestiny(m, r.actor, p.card, 'stun', action('result', p));
  } else if (h === 'stun:result') {
    // Compare the completed total with current ability, including zero for a
    // Droid. Equality and failed draws do not return anything to hand.
    if (sameCard(m, p.targetRef!) && eligible(m, p.target, r.actor) && p.draw!.value !== null && p.draw!.value > printed(m, p.target, 'ability')) {
      queue(m, 'return', p);
      openWindow(m, 'response', other(r.actor), {kind: 'about-to-return-to-hand', card: p.target, source: p.card});
    }
  } else if (h === 'stun:return') {
    if (sameCard(m, p.targetRef!) && eligible(m, p.target, r.actor)) {
      const site = m.cards[p.target].location!, cards = returnToHand(m, [p.target]);
      openWindow(m, 'response', other(r.actor), {kind: 'returned-to-hand', card: p.target, cards, source: p.card, site});
    }
  } else if (h === 'stun:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown Set For Stun continuation.');
}
export function assertStun(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('stun:')) {
    const p = f.action.payload as Payload, h = f.action.handler;
    if (!p || m.cards[p.card]?.blueprint !== '1_268' || m.cards[p.card].zone !== 'playing' || m.cards[p.card].owner !== f.actor ||
      !m.cards[p.target] || m.cards[p.target].owner === f.actor || cardDefinition(m, p.target).type !== 'Character' ||
      !['stun:play','stun:result','stun:return','stun:finish'].includes(h)) throw Error('Invalid pending Set For Stun.');
    assertCardReference(m, p.targetRef!, p.target);
    if (['stun:result','stun:return'].includes(h) && (!p.draw || p.draw.card !== null && m.cards[p.draw.card]?.owner !== f.actor ||
      p.draw.value !== null && (!Number.isFinite(p.draw.value) || p.draw.value < 0) || p.draw.card === null && p.draw.value !== null)) throw Error('Invalid Set For Stun destiny.');
  }
}
