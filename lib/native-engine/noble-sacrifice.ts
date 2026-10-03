import {cardDefinition, forfeit, name, power} from './board';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {mayContributeToRetrieval} from './retrieval-contributors';
import {retrieve} from './retrieval';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {placeOutFromTable, tableLossCards} from './table';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target: CardReference; deployed: CardReference; window: number;
  parent?: number; amount?: number; eligible?: boolean; paid?: boolean; notified?: CardReference[]; lost?: string[]};
const action = (step: string, p: Payload): Action => ({id: 'noble:' + step + ':' + p.card + ':' + p.target.id + ':' + p.window,
  handler: 'noble:' + step, source: p.card, label: 'Resolve Noble Sacrifice', payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
export function nobleActions(m: Match, w: Window, side: Side): Action[] {
  const e = w.event as {kind?: string; card?: string} | undefined, deployed = m.cards[e?.card ?? ''];
  if (side !== 'light' || w.timing !== 'response' || e?.kind !== 'deployed' || !deployed || deployed.owner === side || deployed.zone !== 'table' || cardDefinition(m, deployed.id).type !== 'Character') return [];
  const value = power(m, deployed.id), targets = Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' &&
    cardDefinition(m, c.id).type === 'Character' && power(m, c.id) === value);
  return m.players[side].hand.filter(id => m.cards[id].blueprint === '1_99').flatMap(card => targets.map(c => ({
    ...action('play', {card, target: referenceCard(m, c.id), deployed: referenceCard(m, deployed.id), window: w.serial}),
    label: 'Noble Sacrifice · place ' + name(m, c.id) + ' out of play · may retrieve ' + forfeit(m, c.id) + ' Force',
  })));
}
export function nobleInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  p.parent = m.stack.indexOf(r); p.amount = forfeit(m, p.target.id);
  p.eligible = mayContributeToRetrieval(m, p.target.id); p.paid = false; p.notified = [];
  moveCard(m, p.card, 'playing');
  queue(m, 'attachments', p);
  openWindow(m, 'response', other(r.actor), {kind: 'about-to-place-out-of-play', card: p.target.id, source: p.card});
}
function parent(m: Match, p: Payload): Resolution {
  const r = m.stack[p.parent!];
  if (r?.kind !== 'resolution' || r.action.id !== action('play', p).id || !r.awaitingResponses) throw Error('Missing Noble Sacrifice cost parent.');
  return r;
}
export function nobleResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload, h = r.action.handler;
  if (r.cancelled) {if (h === 'noble:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'noble:attachments') {
    const root = parent(m, p);
    // Appendix B: a redirected/failed sacrifice ends the Interrupt. Returning
    // the physical card cannot substitute a new table instance for this cost.
    if (!sameCard(m, p.target)) {root.cancelled = true; root.action.unrespondable = true; return;}
    const dependents = tableLossCards(m, [p.target.id]).filter(id => id !== p.target.id);
    const next = dependents.find(id => !p.notified!.some(ref => ref.id === id && sameCard(m, ref)));
    if (next) {
      p.notified!.push(referenceCard(m, next)); queue(m, 'attachments', p);
      openWindow(m, 'response', other(r.actor), {kind: 'about-to-lose', card: next, cards: dependents, source: p.card, cause: 'out-of-play'});
      return;
    }
    (root.action.payload as unknown as Payload).paid = true;
    p.paid = true;
    // Queue first so any private ordering decisions suspend the result event.
    queue(m, 'paid', p); p.lost = placeOutFromTable(m, p.target.id);
  } else if (h === 'noble:paid') {
    if (p.lost?.length) {
      queue(m, 'out', p);
      openWindow(m, 'response', other(r.actor), {kind: 'cards-lost', cards: p.lost, cardRefs: p.lost.map(id => referenceCard(m, id)), source: p.card});
    } else nobleResolve(m, {...r, action: action('out', p)});
  } else if (h === 'noble:out') {
    openWindow(m, 'response', other(r.actor), {kind: 'placed-out-of-play', card: p.target.id, source: p.card});
  } else if (h === 'noble:play') {
    if (!p.paid) throw Error('Unpaid Noble Sacrifice.');
    queue(m, 'finish', p);
    if (p.eligible) m.stack.push({kind: 'decision', side: r.actor, handler: 'noble:retrieve', payload: p as unknown as Json});
  } else if (h === 'noble:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown Noble Sacrifice continuation.');
}
export function nobleChoices(_m: Match, d: Decision) {
  const p = d.payload as unknown as Payload;
  return [{id: 'noble:retrieve', label: 'Retrieve ' + p.amount + ' Force'}, {id: 'noble:decline', label: 'Decline retrieval'}];
}
export function nobleChoose(m: Match, d: Decision, choice: string): void {
  if (!nobleChoices(m, d).some(c => c.id === choice)) throw Error('Invalid Noble Sacrifice choice.');
  const p = d.payload as unknown as Payload;
  if (choice === 'noble:retrieve') retrieve(m, d.side, p.card, p.amount!);
}
export function assertNoble(m: Match): void {
  for (const [index, f] of m.stack.entries()) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('noble:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as unknown as Payload;
    if (!p || m.cards[p.card]?.blueprint !== '1_99' || m.cards[p.card].zone !== 'playing' || m.cards[p.card].owner !== 'light' ||
        (f.kind === 'resolution' ? f.actor : (f as Decision).side) !== 'light' || !Number.isSafeInteger(p.window) || p.window < 1 || p.window > m.serial ||
        !Number.isSafeInteger(p.parent) || p.parent! < 0 || !Number.isFinite(p.amount) || p.amount! < 0 || typeof p.eligible !== 'boolean' || typeof p.paid !== 'boolean' || !Array.isArray(p.notified)) throw Error('Invalid Noble Sacrifice state.');
    assertCardReference(m, p.target); assertCardReference(m, p.deployed);
    const w = m.stack.find(q => q.kind === 'window' && q.serial === p.window) as Window | undefined;
    if (!w || m.stack.indexOf(w) >= index || w.timing !== 'response' || (w.event as {kind?: string})?.kind !== 'deployed' ||
        (w.event as {card?: string})?.card !== p.deployed.id) throw Error('Invalid sacrifice deployment window.');
    if (p.target.zone !== 'table' || p.deployed.zone !== 'table' || m.cards[p.target.id].owner !== 'light' || m.cards[p.deployed.id].owner !== 'dark' ||
        [p.target, p.deployed].some(ref => cardDefinition(m, ref.id).type !== 'Character')) throw Error('Invalid Noble Sacrifice targets.');
    for (const ref of p.notified) assertCardReference(m, ref);
    if (p.lost !== undefined && (!Array.isArray(p.lost) || new Set(p.lost).size !== p.lost.length || p.lost.some(id => !m.cards[id] || id === p.target.id))) throw Error('Invalid sacrifice dependents.');
    if (f.kind === 'resolution') {
      if (!['noble:play','noble:attachments','noble:paid','noble:out','noble:finish'].includes(h) || f.action.id !== action(h.slice(6), p).id || f.action.source !== p.card) throw Error('Invalid Noble Sacrifice action.');
      if (h === 'noble:play' && p.parent !== index) throw Error('Invalid sacrifice parent.');
      if (['noble:attachments','noble:paid','noble:out'].includes(h)) {if (p.parent! >= index) throw Error('Invalid sacrifice cost.'); parent(m, p);}
      if (h === 'noble:play' && !f.awaitingResponses && !f.cancelled && !p.paid) throw Error('Unpaid Noble Sacrifice.');
    } else if (h !== 'noble:retrieve' || !p.paid || !p.eligible || !m.stack.some(q => q.kind === 'resolution' && q.action.handler === 'noble:finish' && q.action.source === p.card)) throw Error('Invalid sacrifice retrieval choice.');
  }
}
