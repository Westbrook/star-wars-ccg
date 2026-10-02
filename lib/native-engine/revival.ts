import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {cardDefinition, name, system} from './board';
import {canSearchLostCharacter, retrieve} from './retrieval';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target?: string; site?: string; targetRef?: CardReference};
type LossEvent = {kind?: string; card?: string; cards?: string[]; site?: string};
const character = (m: Match, id: string) => !!m.cards[id] && cardDefinition(m, id).type === 'Character';
const action = (step: string, p: Payload, side?: Side): Action => ({
  id: 'revival:' + step + ':' + p.card, label: step === 'old-ben' ? 'Old Ben · revive ' + p.target : 'Kintan Strider · retrieve your topmost lost character',
  handler: 'revival:' + step, source: p.card, payload: p as Json, ...(side ? {payment: {[side]: 1}} : {}),
});
function queue(m: Match, step: string, p: Payload): void {
  m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
}

export function revivalActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'response') return [];
  const e = w.event as LossEvent | undefined;
  // Units of Force lost from hand/Life Force have no character aspect. These
  // events specifically describe cards lost from table, after Lost ordering.
  if (!e || !['forfeited', 'character-lost', 'cards-lost'].includes(e.kind ?? '')) return [];
  const lost = (e.cards ?? (e.card ? [e.card] : [])).filter(id => character(m, id) && m.cards[id].zone === 'lost');
  const result: Action[] = [];
  for (const card of m.players[side].hand) {
    if (m.cards[card].blueprint === '1_100' && e.kind === 'forfeited' && e.site && system(m, e.site) === 'Tatooine') {
      for (const target of lost.filter(id => m.cards[id].owner === side && !name(m, id).includes('Obi-Wan'))) {
        const a = action('old-ben', {card, target, site: e.site}, side);
        a.id += ':' + target; a.label = 'Old Ben · revive ' + name(m, target); result.push(a);
      }
    }
    if (m.cards[card].blueprint === '1_254' && canSearchLostCharacter(m, side) && lost.some(id => m.cards[id].owner !== side) && m.players[side].lost.length)
      result.push(action('kintan', {card}, side));
  }
  return result;
}
export function revivalInitiate(m: Match, r: Resolution): void {const p = r.action.payload as Payload; if (p.target) p.targetRef = referenceCard(m, p.target); moveCard(m, p.card, 'playing');}
export function revivalResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, kind = r.action.handler;
  if (r.cancelled) {
    // Canceling the Interrupt loses it; preventing just its placement/retrieval
    // leaves cleanup to the existing continuation. Costs are never refunded.
    if (['revival:old-ben', 'revival:kintan'].includes(kind)) moveCard(m, p.card, 'lost');
    return;
  }
  if (kind === 'revival:old-ben') {
    queue(m, 'finish', p);
    if (sameCard(m, p.targetRef!) && m.cards[p.target!]?.zone === 'lost' && m.locations.includes(p.site!)) {
      queue(m, 'place', p);
      openWindow(m, 'response', other(r.actor), {kind: 'about-to-remove-just-lost', card: p.target!, source: p.card});
    }
  } else if (kind === 'revival:place') {
    // The selected visit to Lost must still exist; leaving and returning to
    // Lost cannot revive an old forfeiture opportunity. Returning to play is neither deployment nor retrieval.
    if (sameCard(m, p.targetRef!) && m.cards[p.target!]?.zone === 'lost' && m.locations.includes(p.site!)) {
      moveCard(m, p.target!, 'table'); m.cards[p.target!].location = p.site!;
      openWindow(m, 'response', other(r.actor), {kind: 'placed-in-play', card: p.target!, site: p.site!, source: p.card});
    }
  } else if (kind === 'revival:kintan') {
    queue(m, 'finish', p);
    retrieve(m, r.actor, p.card, 1, null, 'hand', 'top-character');
  } else if (kind === 'revival:finish') {if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost');}
  else throw Error('Unknown revival continuation.');
}
export function assertRevival(m: Match): void {
  for (const f of m.stack) {
    if (f.kind !== 'resolution' || !f.action.handler.startsWith('revival:')) continue;
    const p = f.action.payload as Payload, kind = f.action.handler, bp = m.cards[p?.card]?.blueprint;
    if (!p || !['1_100', '1_254'].includes(bp) || m.cards[p.card].owner !== f.actor || m.cards[p.card].zone !== 'playing' ||
      !['revival:old-ben', 'revival:kintan', 'revival:place', 'revival:finish'].includes(kind) ||
      kind === 'revival:kintan' && bp !== '1_254' || ['revival:old-ben', 'revival:place'].includes(kind) && bp !== '1_100') throw Error('Invalid revival continuation.');
    if (bp === '1_100' && (!p.target || !character(m, p.target) || m.cards[p.target].owner !== f.actor || !p.site || system(m, p.site) !== 'Tatooine' || name(m, p.target).includes('Obi-Wan'))) throw Error('Invalid revival target.');
    if (bp === '1_100') assertCardReference(m, p.targetRef!, p.target);
    if (bp === '1_254' && (p.target !== undefined || p.site !== undefined)) throw Error('Invalid Kintan selection.');
  }
}
