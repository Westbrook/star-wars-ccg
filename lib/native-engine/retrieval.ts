import {reinforcementTarget} from './characteristics';
import {retrievalAmount, assertRetrievalModifiers} from './retrieval-policy';
import {cardDefinition, name} from './board';
import {moveCard} from './state';
import {openWindow} from './runtime';
import {other, sides, type Decision, type Json, type Match, type Resolution, type Side} from './types';

export type Retrieval = {
  id: string; initial: number; amount: number | null; uncancelable: boolean;
  side: Side; source: string; remaining: number; destination: 'used' | 'hand';
  // A list restricts blueprints. With null, selection may apply a rule-owned
  // filter; otherwise retrieve normally from the top of Lost.
  blueprints: string[] | null; retrieved: string[]; announced: boolean; card?: string;
  selection?: 'top-character' | 'reinforcements';
};
type CharacterSearches = Partial<Record<Side, number>>;
export const canSearchLostCharacter = (m: Match, side: Side) => (m.data.failedCharacterSearches as CharacterSearches | undefined)?.[side] !== m.turn.number;
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
export function retrieve(m: Match, side: Side, source: string, amount: number, blueprints: string[] | null = null, destination: 'used' | 'hand' = 'used', selection?: 'top-character' | 'reinforcements', options: {uncancelable?: boolean} = {}): void {
  if (!Number.isSafeInteger(amount) || amount < 0 || !m.cards[source] || options.uncancelable !== undefined && typeof options.uncancelable !== 'boolean') throw Error('Invalid retrieval.');
  if (!amount) return;
  const p: Retrieval = {id: 'retrieval-' + ++m.serial, side, source, initial: amount, amount: null, uncancelable: options.uncancelable ?? false, remaining: amount, destination, blueprints, retrieved: [], announced: false, ...(selection ? {selection} : {})};
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
export function retrievalResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Retrieval;
  if (r.cancelled) return;
  if (r.action.handler === 'retrieval:next') {
    if (p.amount === null) p.remaining = p.amount = retrievalAmount(m, p.side, p.source, p.initial);
    if (!p.remaining || !eligible(m, p).length) {
      if (p.remaining && p.selection === 'top-character') {
        // An unsuccessful Kintan search disables this same-title search function
        // for the remainder of the turn, including other physical copies.
        const failures = (m.data.failedCharacterSearches ??= {}) as CharacterSearches;
        failures[p.side] = m.turn.number;
      }
      openWindow(m, 'response', other(p.side), {kind: 'retrieval-complete', side: p.side, source: p.source, cards: p.retrieved}); return;
    }
    if (p.blueprints && !p.selection || p.selection === 'reinforcements') m.stack.push({kind: 'decision', side: p.side, handler: 'retrieval:select', payload: p as unknown as Json});
    else selected(m, p, eligible(m, p)[0]);
  } else if (r.action.handler === 'retrieval:place') {
    const card = p.card!; delete p.card;
    if (m.cards[card]?.zone !== 'lost') {queue(m, 'next', p); return;}
    moveCard(m, card, p.destination); p.remaining--; p.retrieved.push(card);
    queue(m, 'next', p);
    openWindow(m, 'response', other(p.side), {kind: 'force-retrieved', side: p.side, source: p.source, card, count: p.retrieved.length});
  } else throw Error('Unknown retrieval continuation.');
}
export function retrievalChoices(m: Match, d: Decision) {
  return eligible(m, d.payload as unknown as Retrieval).map(card => ({id: 'retrieve:' + card, label: 'Retrieve ' + name(m, card)}));
}
export function retrievalChoose(m: Match, d: Decision, choice: string): void {
  selected(m, d.payload as unknown as Retrieval, choice.slice('retrieve:'.length));
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
        p.card && m.cards[p.card]?.owner !== p.side) throw Error('Invalid pending retrieval.');
    ids.add(p.id);
    if (f.kind === 'decision' && (f.side !== p.side || !p.remaining || !eligible(m, p).length)) throw Error('Invalid retrieval choice.');
  }
}
