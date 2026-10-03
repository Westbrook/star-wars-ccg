import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {insertsIn, assertReserveTopAccessible} from './reserve-inserts';
import {sides, type Match, type Side} from './types';

/** A peek never removes cards from Reserve or exposes an insert for resolution.
 * The private snapshot also records inserts passed while reaching ordinary cards. */
export type ReservePeek = {side: Side; cards: CardReference[]; inserts: CardReference[]};
export function peekReserve(m: Match, side: Side, count: number): ReservePeek {
  if (!Number.isSafeInteger(count) || count < 1) throw Error('Invalid peek count.');
  assertReserveTopAccessible(m, side);
  const cards = m.players[side].reserve.slice(0, count).map(id => referenceCard(m,id));
  return {side, cards, inserts: insertsIn(m,side).filter(x=>x.position<cards.length).map(x=>({...x.card}))};
}
export function assertReservePeek(m: Match, p: ReservePeek): void {
  if (!p || !sides.includes(p.side) || !Array.isArray(p.cards) || !p.cards.length || !Array.isArray(p.inserts) ||
      new Set(p.cards.map(x=>x.id)).size!==p.cards.length || new Set(p.inserts.map(x=>x.id)).size!==p.inserts.length) throw Error('Invalid Reserve peek.');
  p.cards.forEach((ref,i)=>{assertCardReference(m,ref);if(ref.zone!=='reserve'||!sameCard(m,ref)||m.players[p.side].reserve[i]!==ref.id)throw Error('Peeked Reserve changed.');});
  const encountered=insertsIn(m,p.side).filter(x=>x.position<p.cards.length);
  if(encountered.length!==p.inserts.length)throw Error('Peeked inserts changed.');
  p.inserts.forEach((ref,i)=>{assertCardReference(m,ref);if(!sameCard(m,ref)||encountered[i].revealed||encountered[i].card.id!==ref.id)throw Error('Peeked insert changed.');});
}
/** AR pp167–168: all returned peeked cards go above encountered inserts.
 * Restore the inspected ordinary block first; the provider may then remove its
 * selected cards. Ordinary identities/order remain unchanged by inspection. */
export function returnReservePeek(m: Match, p: ReservePeek): void {
  assertReservePeek(m,p);
  for(const x of insertsIn(m,p.side))if(x.position<p.cards.length)x.position=p.cards.length;
}
export function reservePeekView(m: Match,p: ReservePeek) {
  return {peek:p.cards.map(ref=>({...m.cards[ref.id]})),peekInserts:p.inserts.map(ref=>({...m.cards[ref.id]}))};
}
