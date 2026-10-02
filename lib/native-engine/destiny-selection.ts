import {name} from './board';
import {completeDestinyTotal, drawDestiny, validDraw, type Draw, type Modifier} from './destiny';
import {assertCardReference, sameCard, type CardReference} from './identity';
import {moveCard} from './state';
import {sides, type Action, type Decision, type Json, type Match, type Resolution, type Side} from './types';

type Candidate = {draw: Draw; reference?: CardReference};
type Selection = {
  side: Side; source: string; category: string; next: Action; drawX: number; chooseY: number;
  complete: boolean; modifier: Modifier; remainder: 'used' | 'hand'; candidates: Candidate[]; selected: number[];
};
type Result = Selection & {draw: Draw; reference?: CardReference};
const eligible = (p: Selection) => p.candidates.flatMap((c, i) => c.draw.value !== null && !p.selected.includes(i) ? [i] : []);
const queue = (m: Match, p: Selection) => m.stack.push({kind: 'resolution', actor: p.side, cancelled: false,
  action: {id: 'selection:next', label: 'Continue destiny selection', handler: 'selection:next', payload: p as unknown as Json}});

/** Draw X, then select Y values. A caller supplies the applicable limit by
 * scheduling the permitted draw count. This does not grant any card permission
 * or replace the battle/weapon adapters' own legal drawing opportunities. */
export function drawDestinySelection(m: Match, side: Side, source: string, category: string, drawX: number, chooseY: number,
  next: Action, modifier: Modifier = 0, remainder: 'used' | 'hand' = 'used'): void {
  const p: Selection = {side, source, category, drawX, chooseY, next, complete: false, modifier, remainder, candidates: [], selected: []};
  assertSelection(m, p); advance(m, p);
}

function place(m: Match, c: Candidate, zone: 'used' | 'hand'): void {
  // A value survives losing its physical card. A later visit to the unresolved
  // zone must not be mistaken for the original drawn card.
  if (c.reference && sameCard(m, c.reference)) moveCard(m, c.reference.id, zone);
}
function advance(m: Match, p: Selection): void {
  p.complete ||= p.candidates.length === p.drawX || !m.players[p.side].reserve.length;
  if (!p.complete) {
    const next: Action = {id: 'selection:drawn', label: 'Keep unresolved destiny', handler: 'selection:drawn', payload: p as unknown as Json};
    drawDestiny(m, p.side, p.source, p.category, next, false, p.modifier, undefined, true); return;
  }
  if (p.selected.length < p.chooseY && eligible(p).length) {
    m.stack.push({kind: 'decision', side: p.side, handler: 'selection:choose', payload: p as unknown as Json}); return;
  }
  // AR p32 step 2 resolves chosen draws in selection order; step 3 places
  // remaining unresolved cards in draw order (unless the card says otherwise).
  for (const [i, c] of p.candidates.entries()) if (!p.selected.includes(i)) place(m, c, p.remainder);
  completeDestinyTotal(m, p.side, p.source, p.category, p.selected.map(i => p.candidates[i].draw), p.next);
}
export function selectionResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Selection;
  if (r.action.handler === 'selection:drawn') {
    const {draw, reference} = r.action.payload as unknown as Result;
    p.candidates.push({draw: structuredClone(draw), ...(reference ? {reference: structuredClone(reference)} : {})});
    delete (p as Partial<Result>).draw; delete (p as Partial<Result>).reference;
  } else if (r.action.handler !== 'selection:next') throw Error('Unknown destiny selection continuation.');
  advance(m, p);
}
export function selectionChoices(m: Match, d: Decision) {
  const p = d.payload as unknown as Selection;
  return eligible(p).map(i => ({id: 'destiny-choice:' + i,
    label: 'Choose ' + (p.candidates[i].draw.card ? name(m, p.candidates[i].draw.card!) : 'substituted destiny') + ' · ' + p.candidates[i].draw.value}));
}
export function selectionChoose(m: Match, d: Decision, choice: string): void {
  const p = d.payload as unknown as Selection;
  const i = eligible(p).find(i => choice === 'destiny-choice:' + i);
  if (i === undefined) throw Error('Invalid destiny selection.');
  p.selected.push(i); place(m, p.candidates[i], 'used'); queue(m, p);
}
function assertCandidate(m: Match, c: Candidate, side: Side): void {
  if (!c || !validDraw(m, c.draw, side) || !!c.draw.card !== !!c.reference) throw Error('Invalid destiny candidate.');
  if (c.reference) {assertCardReference(m, c.reference, c.draw.card!); if (c.reference.zone !== 'destiny') throw Error('Invalid candidate reference.');}
}
function assertSelection(m: Match, p: Selection): void {
  if (!p || !sides.includes(p.side) || !m.cards[p.source] || typeof p.category !== 'string' || !p.category || !p.next?.handler ||
    !Number.isSafeInteger(p.drawX) || p.drawX < 1 || !Number.isSafeInteger(p.chooseY) || p.chooseY < 1 || p.chooseY > p.drawX ||
    typeof p.complete !== 'boolean' || !['used', 'hand'].includes(p.remainder) || !Array.isArray(p.candidates) || p.candidates.length > p.drawX || !Array.isArray(p.selected) ||
    p.selected.length > p.chooseY || new Set(p.selected).size !== p.selected.length ||
    p.selected.some(i => !Number.isSafeInteger(i) || i < 0 || !p.candidates[i] || p.candidates[i].draw.value === null) ||
    p.selected.length > 0 && !p.complete ||
    (typeof p.modifier === 'number' ? !Number.isFinite(p.modifier) : !p.modifier || !m.cards[p.modifier.weapon])) throw Error('Invalid destiny selection.');
  p.candidates.forEach(c => assertCandidate(m, c, p.side));
  const refs = p.candidates.flatMap(c => c.reference ? [c.reference.id + ':' + c.reference.version] : []);
  if (new Set(refs).size !== refs.length) throw Error('Duplicate destiny candidate.');
}
export function assertDestinySelection(m: Match): void {
  // Before/drawn/completed windows carry the batch in the draw's callback.
  for (const f of m.stack) {
    const handler = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (handler.startsWith('selection:')) {
      const payload = f.kind === 'resolution' ? f.action.payload : (f as Decision).payload;
      const p = payload as unknown as Selection;
      assertSelection(m, p);
      if (f.kind === 'resolution' ? f.actor !== p.side : (f as Decision).side !== p.side) throw Error('Invalid selection actor.');
      if (handler === 'selection:choose') {
        if (f.kind !== 'decision' || !p.complete || p.selected.length >= p.chooseY || !eligible(p).length) throw Error('Invalid selection decision.');
      } else if (f.kind !== 'resolution' || !['selection:next', 'selection:drawn'].includes(handler)) throw Error('Invalid selection handler.');
      if (handler === 'selection:drawn') {const r = payload as unknown as Result; assertCandidate(m, {draw: r.draw, reference: r.reference}, p.side);}
    } else if (handler.startsWith('destiny:') && f.kind === 'resolution') {
      const p = f.action.payload as {next?: Action; retain?: boolean; side?: Side; category?: string; source?: string};
      if (p.next?.handler === 'selection:drawn') {
        const batch = p.next.payload as unknown as Selection; assertSelection(m, batch);
        if (!p.retain || p.side !== batch.side || p.category !== batch.category || p.source !== batch.source || batch.complete || batch.candidates.length >= batch.drawX || batch.selected.length) throw Error('Invalid selection draw continuation.');
      }
    }
  }
}
