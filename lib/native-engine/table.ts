import {bellyLossCards} from './space-slug';
import {isVessel} from './occupancy';
import {referenceCard} from './identity';
import {recordTableLossOrigins} from './loss-origin';
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
    for (const c of Object.values(m.cards)) if ((c.attachedTo || c.stackedOn) && ids.has((c.attachedTo || c.stackedOn)!) && !ids.has(c.id)) {ids.add(c.id); changed = true;}
  }
  if ([...ids].some(id => !['table','stacked'].includes(m.cards[id]?.zone) || m.locations.includes(id))) throw Error('Invalid table loss.');
  return ids;
}
function removeGroup(m: Match, ids: Set<string>, zone: 'leaving' | 'hand'): void {
  // Remove descendants before their host to satisfy the primitive invariant.
  const waiting = new Set(ids);
  while (waiting.size) {
    const id = [...waiting].find(id => ![...waiting].some(child => m.cards[child].attachedTo === id || m.cards[child].stackedOn === id));
    if (!id) throw Error('Cyclic table loss.');
    moveCard(m, id, zone); waiting.delete(id);
  }
}
/** Snapshot the complete affected group for response targeting before removal. */
export const tableLossCards = (m: Match, hosts: string[]): string[] => [...tableGroup(m,[...hosts,...bellyLossCards(m,hosts)])];
export function loseFromTable(m: Match, hosts: string[]): string[] {
  const ids = tableGroup(m, [...hosts,...bellyLossCards(m,hosts)]), references = [...ids].map(id=>referenceCard(m,id));
  removeGroup(m, ids, 'leaving');
  recordTableLossOrigins(m,references);
  orderNext(m, [...ids]);
  return [...ids];
}
/** Revealed minefield duds are discarded from their buried state. They never
 * deploy or become active characters/locations while their Lost order is chosen. */
export function loseBuriedCards(m: Match, cards: string[]): void {
  if (new Set(cards).size !== cards.length || cards.some(id => m.cards[id]?.zone !== 'buried')) throw Error('Invalid buried-card loss.');
  for (const id of cards) moveCard(m,id,'leaving');
  orderNext(m,cards);
}
/** Failed simultaneous deployment never entered table, but Lost ordering is still chosen. */
export function losePlayingCards(m:Match,cards:string[]):void {
 if(new Set(cards).size!==cards.length||cards.some(id=>m.cards[id]?.zone!=='playing'))throw Error('Invalid failed deployment.');
 for(const id of cards)moveCard(m,id,'leaving');orderNext(m,cards);
}
/** Placement in Used changes only the host's destination. Descendants
 * still leave simultaneously and are ordered in Lost before the host enters Used. */
export function placeInUsedFromTable(m: Match, host: string): void {
  const ids = tableGroup(m,[host]), references = [...ids].filter(id=>id!==host).map(id=>referenceCard(m,id));
  removeGroup(m,ids,'leaving');
  if (references.length) recordTableLossOrigins(m,references);
  orderNext(m,[...ids].filter(id => id !== host),[host]);
}
export const forfeitToUsed = placeInUsedFromTable;
/** Out-of-play costs remove the host permanently. Its dependents are lost,
 * not sacrificed; their ordering must finish before the parent can respond. */
export function placeOutFromTable(m: Match, host: string): string[] {
  const ids = tableGroup(m, [host]), lost = [...ids].filter(id => id !== host);
  const references = lost.map(id => referenceCard(m, id));
  removeGroup(m, ids, 'leaving');
  moveCard(m, host, 'out');
  if (references.length) recordTableLossOrigins(m, references);
  orderNext(m, lost);
  return lost;
}
/** Returning a carrier to hand loses its occupants and attachments. Other
 * returning hosts retain their established attachment destinations. */
export function returnToHand(m: Match, hosts: string[]): string[] {
  const ids = tableGroup(m, hosts);
  const lost = new Set(hosts.filter(id=>isVessel(m,id)).flatMap(id=>[...tableGroup(m,[id])].filter(child=>child!==id)));
  if(lost.size){
    const refs=[...lost].map(id=>referenceCard(m,id));
    removeGroup(m,ids,'leaving');for(const id of ids)if(!lost.has(id))moveCard(m,id,'hand');
    recordTableLossOrigins(m,refs);orderNext(m,[...lost]);
  }else removeGroup(m, ids, 'hand');
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
