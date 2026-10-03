import {reinforcementTarget} from './characteristics';
import {canSearch, recordFailedSearch, searchFunctions} from './search-policy';
import {retrievalAmount, assertRetrievalModifiers} from './retrieval-policy';
import {cardDefinition, name} from './board';
import {moveCard, shufflePile} from './state';
import {openWindow, type Context} from './runtime';
import {other, sides, type Decision, type Json, type Match, type Resolution, type Side} from './types';

export type Retrieval = {
  id: string; initial: number; amount: number | null; uncancelable: boolean;
  side: Side; source: string; remaining: number; destination: 'used' | 'hand';
  // A list restricts blueprints. With null, selection may apply a rule-owned
  // filter; otherwise retrieve normally from the top of Lost.
  blueprints: string[] | null; retrieved: string[]; announced: boolean; card?: string;
  selection?: 'top-character' | 'reinforcements';
  upTo?: boolean; chosen?: number; random?: boolean; mayTakeIntoHand?: boolean;
  placement?: 'used' | 'hand';
};
type RetrievalOptions = {uncancelable?: boolean; upTo?: boolean; random?: boolean; mayTakeIntoHand?: boolean};
type CharacterSearches = Partial<Record<Side, number>>;
export const canSearchLostCharacter = (m: Match, side: Side, blueprint = '1_254') => canSearch(m, {blueprint, side, function: searchFunctions.kintan, owner: side, pile: 'lost'});
function queue(m: Match, step: string, p: Retrieval): void {
  m.stack.push({kind: 'resolution', actor: p.side, cancelled: false, action: {id: 'retrieve:' + step, label: 'Retrieve Force', handler: 'retrieval:' + step, payload: p as unknown as Json}});
}
const eligible = (m: Match, p: Retrieval) => {
  const cards = m.players[p.side].lost.filter(id => (!p.blueprints || p.blueprints.includes(m.cards[id].blueprint)) &&
    (p.selection !== 'top-character' || cardDefinition(m, id).type === 'Character') &&
    (p.selection !== 'reinforcements' || reinforcementTarget(m, id, p.side)));
  return p.selection === 'top-character' ? cards.slice(0, 1) : cards;
};
/** A single retrieval action, with serializable per-card response boundaries.
 * Ordinary retrieval preserves top-first selection, reversing that group onto
 * Used. Specific-card retrieval never rearranges the remaining Lost Pile. */
export function retrieve(m: Match, side: Side, source: string, amount: number, blueprints: string[] | null = null, destination: 'used' | 'hand' = 'used', selection?: 'top-character' | 'reinforcements', options: RetrievalOptions = {}): void {
  if (!Number.isSafeInteger(amount) || amount < 0 || !m.cards[source] || !sides.includes(side) || !['used','hand'].includes(destination) ||
    [options.uncancelable, options.upTo, options.random, options.mayTakeIntoHand].some(v => v !== undefined && typeof v !== 'boolean') ||
    options.random && (blueprints !== null || selection !== undefined)) throw Error('Invalid retrieval.');
  if (!amount) return;
  const p: Retrieval = {id: 'retrieval-' + ++m.serial, side, source, initial: amount, amount: null, uncancelable: options.uncancelable ?? false, remaining: amount, destination, blueprints, retrieved: [], announced: false, ...(selection ? {selection} : {}), ...(options.upTo ? {upTo: true} : {}), ...(options.random ? {random: true} : {}), ...(options.mayTakeIntoHand ? {mayTakeIntoHand: true} : {})};
  queue(m, 'next', p);
  openWindow(m, 'response', other(side), {kind: 'retrieval-initiated', side, source, amount, retrieval: p.id});
}
/** Bind responses to one suspended retrieval, including nested actions by the
 * same source. Canceling retrieval never cancels its parent card's cleanup. */
export function pendingRetrieval(m: Match, id: string): Resolution | undefined {
  return m.stack.find((f): f is Resolution => f.kind === 'resolution' && f.action.handler.startsWith('retrieval:') && (f.action.payload as unknown as Retrieval).id === id);
}
export function cancelRetrieval(m: Match, id: string, source: string): boolean {
  const f = pendingRetrieval(m, id); if (!f || f.cancelled) return false;
  if (!m.cards[source]) throw Error('Invalid retrieval cancellation source.');
  const p = f.action.payload as unknown as Retrieval;
  if (p.uncancelable) return false;
  f.cancelled = true;
  openWindow(m, 'response', other(p.side), {kind: 'retrieval-canceled', side: p.side, source, retrieval: id, cards: [...p.retrieved]});
  return true;
}
function selected(m: Match, p: Retrieval, card: string): void {
  p.card = card; queue(m, 'place', p);
  if (!p.announced) {
    p.announced = true;
    openWindow(m, 'response', other(p.side), {kind: 'about-to-retrieve', side: p.side, source: p.source, amount: p.remaining, card, retrieval: p.id});
  }
}
export function retrievalResolve(m: Match, r: Resolution, context: Context): void {
  const p = r.action.payload as unknown as Retrieval;
  if (r.cancelled) return;
  if (r.action.handler === 'retrieval:next') {
    if (p.upTo && p.chosen === undefined) {
      // A Lost Pile may be inspected before this choice. Choose X before
      // retrieval modifiers/Secret Plans, without capping X by eligible cards.
      m.stack.push({kind: 'decision', side: p.side, handler: 'retrieval:amount', payload: p as unknown as Json}); return;
    }
    if (p.amount === null) p.remaining = p.amount = retrievalAmount(m, p.side, p.source, p.chosen ?? p.initial);
    if (!p.remaining || !eligible(m, p).length) {
      if (p.remaining && p.selection === 'top-character') {
        // An unsuccessful Kintan search disables this same-title search function
        // for the remainder of the turn, including other physical copies.
        recordFailedSearch(m, {blueprint: m.cards[p.source].blueprint, side: p.side, function: searchFunctions.kintan, owner: p.side, pile: 'lost'});
      }
      openWindow(m, 'response', other(p.side), {kind: 'retrieval-complete', side: p.side, source: p.source, cards: p.retrieved}); return;
    }
    if (p.blueprints && !p.selection || p.selection === 'reinforcements') m.stack.push({kind: 'decision', side: p.side, handler: 'retrieval:select', payload: p as unknown as Json});
    else {
      // Random retrieval reshuffles the remaining Lost Pile for each card.
      // Persist that order before the first response; resuming never rerolls it.
      if (p.random) shufflePile(m, p.side, 'lost', context.entropy);
      selected(m, p, eligible(m, p)[0]);
    }
  } else if (r.action.handler === 'retrieval:place') {
    const card = p.card!;
    // GEMP retains the selected physical card through responses, including a
    // leave-and-return. It only checks that it is currently in its Lost Pile.
    if (m.cards[card]?.zone === 'lost' && p.mayTakeIntoHand && p.destination !== 'hand' && !p.placement) {
      m.stack.push({kind: 'decision', side: p.side, handler: 'retrieval:destination', payload: p as unknown as Json}); return;
    }
    const destination = p.placement ?? p.destination; delete p.card; delete p.placement;
    if (m.cards[card]?.zone !== 'lost') {queue(m, 'next', p); return;}
    moveCard(m, card, destination); p.remaining--; p.retrieved.push(card);
    queue(m, 'next', p);
    openWindow(m, 'response', other(p.side), {kind: 'force-retrieved', side: p.side, source: p.source, card, count: p.retrieved.length});
  } else throw Error('Unknown retrieval continuation.');
}
export function retrievalChoices(m: Match, d: Decision) {
  const p = d.payload as unknown as Retrieval;
  if (d.handler === 'retrieval:amount') return Array.from({length: p.initial}, (_, i) => ({id: 'retrieve-amount:' + (i + 1), label: 'Retrieve ' + (i + 1) + (i ? ' cards' : ' card')}));
  if (d.handler === 'retrieval:destination') return [{id: 'retrieve-to:used', label: 'Retrieve ' + name(m, p.card!) + ' to Used Pile'}, {id: 'retrieve-to:hand', label: 'Retrieve ' + name(m, p.card!) + ' into hand'}];
  if (d.handler !== 'retrieval:select') throw Error('Unknown retrieval decision.');
  return eligible(m, p).map(card => ({id: 'retrieve:' + card, label: 'Retrieve ' + name(m, card)}));
}
export function retrievalChoose(m: Match, d: Decision, choice: string): void {
  if (!retrievalChoices(m,d).some(c => c.id === choice)) throw Error('Invalid retrieval choice.');
  const p = d.payload as unknown as Retrieval;
  if (d.handler === 'retrieval:amount') {p.chosen = Number(choice.slice('retrieve-amount:'.length)); queue(m, 'next', p);}
  else if (d.handler === 'retrieval:destination') {p.placement = choice === 'retrieve-to:hand' ? 'hand' : 'used'; queue(m, 'place', p);}
  else selected(m, p, choice.slice('retrieve:'.length));
}
export function retrievalView(m: Match): Json {
  const w = m.stack.at(-1), e = w?.kind === 'window' ? w.event as {kind?: string; card?: string; cards?: string[]} | undefined : undefined;
  const cards = e?.kind === 'force-retrieved' ? [e.card!] : e?.kind === 'retrieval-complete' ? e.cards! : [];
  // These identities were publicly retrieved, not a projection of Used order.
  return {retrievedCards: cards.map(id => ({id, blueprint: m.cards[id].blueprint}))};
}
export function assertRetrieval(m: Match): void {
  assertRetrievalModifiers(m);
  const failures = m.data.failedCharacterSearches as CharacterSearches | undefined;
  if (failures && Object.entries(failures).some(([side, turn]) => !sides.includes(side as Side) || !Number.isSafeInteger(turn) || turn < 1 || turn > m.turn.number)) throw Error('Invalid failed character search.');
  const ids = new Set<string>();
  for (const f of m.stack) {
    const handler = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!handler.startsWith('retrieval:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : f.kind === 'decision' ? f.payload : null) as unknown as Retrieval;
    if (!p || typeof p.id !== 'string' || !/^retrieval-[1-9]\d*$/.test(p.id) || !Number.isSafeInteger(Number(p.id.slice(10))) || Number(p.id.slice(10)) > m.serial || ids.has(p.id) || !sides.includes(p.side) || !m.cards[p.source] || !Number.isSafeInteger(p.remaining) || p.remaining < 0 ||
        !Array.isArray(p.retrieved) || !Number.isSafeInteger(p.initial) || p.initial <= 0 || typeof p.uncancelable !== 'boolean' ||
        p.amount !== null && (!Number.isSafeInteger(p.amount) || p.amount < 0 || p.remaining + p.retrieved.length !== p.amount) ||
        p.amount === null && (p.remaining !== p.initial || p.announced || p.retrieved.length > 0) ||
        !['used', 'hand'].includes(p.destination) || typeof p.announced !== 'boolean' || p.selection !== undefined && !['top-character', 'reinforcements'].includes(p.selection) ||
        p.blueprints !== null && (!Array.isArray(p.blueprints) || p.blueprints.some(b => typeof b !== 'string')) ||
        !Array.isArray(p.retrieved) || p.retrieved.some(id => m.cards[id]?.owner !== p.side) ||
        p.card !== undefined && (typeof p.card !== 'string' || m.cards[p.card]?.owner !== p.side) ||
        [p.upTo,p.random,p.mayTakeIntoHand].some(v => v !== undefined && typeof v !== 'boolean') ||
        p.random && (p.blueprints !== null || p.selection !== undefined) ||
        p.chosen !== undefined && (!p.upTo || !Number.isSafeInteger(p.chosen) || p.chosen < 1 || p.chosen > p.initial) ||
        p.upTo && p.amount !== null && p.chosen === undefined ||
        p.placement !== undefined && (!p.mayTakeIntoHand || p.destination !== 'used' || !['used','hand'].includes(p.placement))) throw Error('Invalid pending retrieval.');
    ids.add(p.id);
    if (f.kind === 'decision' && f.side !== p.side) throw Error('Invalid retrieval choice.');
    if ((f.kind === 'resolution' ? f.actor : (f as Decision).side) !== p.side ||
      !(f.kind === 'resolution' ? ['retrieval:next','retrieval:place'] : ['retrieval:select','retrieval:amount','retrieval:destination']).includes(handler) ||
      ['retrieval:place','retrieval:destination'].includes(handler) !== (p.card !== undefined) ||
      p.card !== undefined && !p.announced ||
      p.placement !== undefined && handler !== 'retrieval:place') throw Error('Invalid retrieval continuation.');
    if (handler === 'retrieval:amount' && (!p.upTo || p.chosen !== undefined || p.amount !== null)) throw Error('Invalid retrieval amount choice.');
    if (handler === 'retrieval:destination' && (!p.mayTakeIntoHand || p.destination !== 'used' || p.placement !== undefined || m.cards[p.card!].zone !== 'lost')) throw Error('Invalid retrieval destination choice.');
    if (handler !== 'retrieval:next' && handler !== 'retrieval:amount' && (p.amount === null || !p.remaining)) throw Error('Invalid retrieval amount.');
    if (handler === 'retrieval:select' && (!eligible(m, p).length || !p.blueprints && p.selection !== 'reinforcements')) throw Error('Invalid retrieval choice.');
  }
}
