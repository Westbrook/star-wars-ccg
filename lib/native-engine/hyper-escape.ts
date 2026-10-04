import {spaceLocation,sectorPaths} from './sectors';
import {battle, members} from './battle';
import {name} from './board';
import {cardDefinition} from './definitions';
import {canMove} from './ground';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {premiereSystems} from './premiere-setup';
import {queueForcePayment} from './runtime';
import {moveCard} from './state';
import {vesselRoutes, vesselMovementAction} from './vessel-travel';
import type {Action, Decision, Json, Match, Resolution, Side, Window} from './types';

type Payload = {card: string; origin: CardReference; ships: CardReference[]; remaining: string[]; window: number};
const payload = (f: Resolution | Decision) => ('action' in f ? f.action.payload : f.payload) as unknown as Payload;
const playId = (p: Payload) => 'hyper-escape:' + p.card;
const systemLocation = spaceLocation;

export function hyperEscapeActions(m: Match, w: Window, side: Side): Action[] {
 const parent = m.stack.at(-2), b = battle(m);
 if (side !== 'light' || w.timing !== 'response' || parent?.kind !== 'resolution' || parent.action.handler !== 'battle:begin' || parent.cancelled || parent.awaitingResponses || b?.stage !== 'begin' || !systemLocation(m, b.site)) return [];
 // AR pp70–71: check for a destination, not range, navigation, piloting or
 // affordability. Landing is never a move-away option.
 if (!m.locations.some(id => id !== b.site && premiereSystems[m.cards[b.site].blueprint] && premiereSystems[m.cards[id].blueprint])&&!members(m,side).some(id=>sectorPaths(m,id,b.site).length)) return [];
 const ships = members(m, side).filter(id => cardDefinition(m, id).type === 'Starship' && !m.cards[id].attachedTo).map(id => referenceCard(m, id));
 if (!ships.length) return [];
 return m.players[side].hand.filter(id => m.cards[id].blueprint === '1_88').map(card => {
  const p: Payload = {card, origin: referenceCard(m, b.site), ships, remaining: ships.map(r => r.id), window: w.serial};
  return {id: playId(p), handler: 'hyper-escape:play', source: card, label: 'Hyper Escape · move your ships away', payload: p as unknown as Json};
 });
}
export function hyperEscapeInitiate(m: Match, r: Resolution): void {moveCard(m, payload(r).card, 'playing');}
function queue(m: Match, p: Payload, handler: string): void {
 m.stack.push({kind: 'resolution', actor: 'light', cancelled: false, action: {id: playId(p), handler, source: p.card, label: 'Hyper Escape', payload: p as unknown as Json}});
}
function options(m: Match, p: Payload) {
 if (!sameCard(m, p.origin)) return [];
 return p.ships.filter(ref => p.remaining.includes(ref.id) && sameCard(m, ref) && m.cards[ref.id].location === p.origin.id && canMove(m, ref.id)).flatMap(ref =>
  vesselRoutes(m, ref.id).filter(route => ['hyperspace', 'orbit', 'sector'].includes(route.method) && route.cost <= m.players.light.force.length).map(route => ({card: ref.id, route})));
}
export function hyperEscapeResolve(m: Match, r: Resolution): void {
 const p = payload(r);
 if (r.cancelled) {if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost'); return;}
 if (r.action.handler === 'hyper-escape:play') {queue(m, p, 'hyper-escape:done'); queue(m, p, 'hyper-escape:next');}
 else if (r.action.handler === 'hyper-escape:next') {
  if (options(m, p).length) m.stack.push({kind: 'decision', side: 'light', handler: 'hyper-escape:move', payload: p as unknown as Json});
 } else if (r.action.handler === 'hyper-escape:done') moveCard(m, p.card, 'used');
 else throw Error('Unknown ship escape continuation.');
}
const choiceId = (card: string, method: string, to: string) => 'escape-away:' + card + ':' + method + ':' + to;
export function hyperEscapeChoices(m: Match, d: Decision) {
 return options(m, payload(d)).map(({card, route}) => ({id: choiceId(card, route.method, route.path.at(-1)!), label: 'Move ' + name(m, card) + ' to ' + name(m, route.path.at(-1)!) + ' · ' + route.cost + ' Force'}));
}
export function hyperEscapeChoose(m: Match, d: Decision, choice: string): void {
 const p = payload(d), selected = options(m, p).find(({card, route}) => choiceId(card, route.method, route.path.at(-1)!) === choice);
 if (!selected) throw Error('Invalid ship escape choice.');
 // One attempt per original ship. A canceled move keeps its paid cost, and
 // the remaining ships still attempt movement in their owner's chosen order.
 queue(m, {...p, remaining: p.remaining.filter(id => id !== selected.card)}, 'hyper-escape:next');
 const action = vesselMovementAction(m, selected.card, selected.route);
 const movement: Resolution = {kind: 'resolution', actor: d.side, cancelled: false, awaitingResponses: true, action};
 m.stack.push(movement); queueForcePayment(m, movement, action.payment!);
}
export function assertHyperEscape(m: Match): void {
 for (const f of m.stack) {
  const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
  if (!h.startsWith('hyper-escape:')) continue;
  const p = payload(f as Resolution | Decision), side = f.kind === 'decision' ? f.side : (f as Resolution).actor;
  if (!p || side !== 'light' || !['hyper-escape:play', 'hyper-escape:next', 'hyper-escape:done', 'hyper-escape:move'].includes(h) || m.cards[p.card]?.blueprint !== '1_88' || m.cards[p.card].owner !== side || m.cards[p.card].zone !== 'playing' || !Number.isSafeInteger(p.window) || !Array.isArray(p.ships) || !p.ships.length || !Array.isArray(p.remaining)) throw Error('Invalid ship escape continuation.');
  const wi = m.stack.findIndex(f => f.kind === 'window' && f.serial === p.window), w = m.stack[wi], parent = m.stack[wi - 1];
  if (!w || w.kind !== 'window' || w.timing !== 'response' || parent?.kind !== 'resolution' || parent.action.handler !== 'battle:begin' || (parent.action.payload as {site?:string}).site !== p.origin?.id || !systemLocation(m, p.origin?.id)) throw Error('Invalid ship escape opportunity.');
  assertCardReference(m, p.origin); if (p.origin.zone !== 'table') throw Error('Invalid ship escape origin.');
  for (const ref of p.ships) {assertCardReference(m, ref); if (ref.zone !== 'table' || m.cards[ref.id].owner !== side || cardDefinition(m, ref.id).type !== 'Starship') throw Error('Invalid escaping ship.');}
  if (new Set(p.ships.map(r => r.id)).size !== p.ships.length || new Set(p.remaining).size !== p.remaining.length || p.remaining.some(id => !p.ships.some(r => r.id === id))) throw Error('Invalid escape group.');
  if (f.kind === 'resolution' && (h === 'hyper-escape:move' || f.action.source !== p.card || f.action.id !== playId(p)) || f.kind === 'decision' && (h !== 'hyper-escape:move' || !options(m, p).length)) throw Error('Invalid escape frame.');
 }
}
export function hyperEscapeView(m: Match) {
 const f = [...m.stack].reverse().find(f => f.kind === 'decision' && f.handler === 'hyper-escape:move' || f.kind === 'resolution' && ['hyper-escape:play', 'hyper-escape:next'].includes(f.action.handler));
 if (!f || f.kind === 'window') return {shipEscape: null};
 const p = payload(f);
 return {shipEscape: {from: name(m, p.origin.id), remaining: p.remaining.map(id => name(m, id)), force: m.players.light.force.length, choosing: f.kind === 'decision'}};
}
