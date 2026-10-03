import {moveCard} from './state';
import {name} from './board';
import {sides, type Decision, type Json, type Match} from './types';

type Ordering = {remaining: string[]; used?: string[]};
/** All dependents leave simultaneously. Ordering their Lost Piles must not keep
 * their presence/modifiers on table, or add their forfeit to the host's value. */
function tableGroup(m: Match, hosts: string[]): Set<string> {
  const ids = new Set(hosts);
  for (let changed = true; changed;) {
    changed = false;
    for (const c of Object.values(m.cards)) if (c.attachedTo && ids.has(c.attachedTo) && !ids.has(c.id)) {ids.add(c.id); changed = true;}
  }
  if ([...ids].some(id => m.cards[id]?.zone !== 'table' || m.locations.includes(id))) throw Error('Invalid table loss.');
  return ids;
}
function removeGroup(m: Match, ids: Set<string>, zone: 'leaving' | 'hand'): void {
  // Remove descendants before their host to satisfy the primitive invariant.
  const waiting = new Set(ids);
  while (waiting.size) {
    const id = [...waiting].find(id => ![...waiting].some(child => m.cards[child].attachedTo === id));
    if (!id) throw Error('Cyclic table loss.');
    moveCard(m, id, zone); waiting.delete(id);
  }
}
export function loseFromTable(m: Match, hosts: string[]): void {
  const ids = tableGroup(m, hosts);
  removeGroup(m, ids, 'leaving');
  orderNext(m, [...ids]);
}
/** A forfeiture replacement changes only the host's destination. Descendants
 * still leave simultaneously and are ordered in Lost before the host enters Used. */
export function forfeitToUsed(m: Match, host: string): void {
  const ids = tableGroup(m,[host]);
  removeGroup(m,ids,'leaving');
  orderNext(m,[...ids].filter(id => id !== host),[host]);
}
/** Returning to hand is neither losing nor forfeiting. Every descendant goes
 * to its own owner's hand, without Lost ordering or forfeiture credit. */
export function returnToHand(m: Match, hosts: string[]): string[] {
  const ids = tableGroup(m, hosts);
  removeGroup(m, ids, 'hand');
  return [...ids];
}
function orderNext(m: Match, remaining: string[], used: string[] = []): void {
  if (!remaining.length) {for (const id of used) moveCard(m,id,'used'); return;}
  const side = remaining.some(id => m.cards[id].owner === m.turn.side) ? m.turn.side : m.cards[remaining[0]].owner;
  const own = remaining.filter(id => m.cards[id].owner === side);
  if (own.length === 1) {moveCard(m, own[0], 'lost'); orderNext(m, remaining.filter(id => id !== own[0]),used); return;}
  m.stack.push({kind: 'decision', side, handler: 'table:lost-order', payload: {remaining,...(used.length?{used}:{})} as Json});
}
export function tableChoices(m: Match, decision: Decision) {
  return (decision.payload as Ordering).remaining.filter(id => m.cards[id].owner === decision.side).map(id => ({id: 'place-lost:' + id, label: 'Place ' + name(m, id) + ' on top of Lost'}));
}
export function tableChoose(m: Match, decision: Decision, choice: string): void {
  const id = choice.slice('place-lost:'.length), remaining = (decision.payload as Ordering).remaining;
  moveCard(m, id, 'lost'); orderNext(m, remaining.filter(card => card !== id),(decision.payload as Ordering).used);
}
export function assertLeaving(m: Match): void {
  const pending = m.stack.filter(f => f.kind === 'decision' && f.handler === 'table:lost-order').flatMap(f => {const p=f.kind === 'decision' ? f.payload as Ordering : {remaining: []};return [...p.remaining,...(p.used??[])];});
  if (new Set(pending).size !== pending.length || pending.some(id => m.cards[id]?.zone !== 'leaving')) throw Error('Invalid pending table loss.');
  if (Object.values(m.cards).some(c => c.zone === 'leaving' && !pending.includes(c.id))) throw Error('Orphaned leaving card.');
  for (const f of m.stack) if (f.kind === 'decision' && f.handler === 'table:lost-order' && !(f.payload as Ordering).remaining.some(id => m.cards[id]?.owner === f.side && sides.includes(f.side))) throw Error('Invalid loss ordering seat.');
  for (const f of m.stack) if (f.kind === 'decision' && f.handler === 'table:lost-order') {
    const p=f.payload as Ordering;
    if (p.used !== undefined && (!Array.isArray(p.used) || p.used.length !== 1)) throw Error('Invalid pending forfeiture destination.');
  }
}
