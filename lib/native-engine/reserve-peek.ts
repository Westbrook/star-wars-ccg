import {invalidatePileReveals} from './pile-reveal';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {insertsIn, assertReserveTopAccessible} from './reserve-inserts';
import {sides, type Match, type Side} from './types';

/** A peek never removes cards from Reserve or exposes an insert for resolution.
 * The private snapshot records unrevealed inserts passed while reaching ordinary
 * cards. Already revealed inserts retain their separate pending continuation. */
export type ReservePeek = {side: Side; cards: CardReference[]; inserts: CardReference[]; whole?: true};
export function peekReserve(m: Match, side: Side, count: number, whole = false): ReservePeek {
  if (!Number.isSafeInteger(count) || count < 1) throw Error('Invalid peek count.');
  assertReserveTopAccessible(m, side);
  const cards = m.players[side].reserve.slice(0, count).map(id => referenceCard(m,id));
  return {side, cards, ...(whole?{whole:true as const}:{}), inserts: insertsIn(m,side).filter(x=>!x.revealed&&(whole||x.position<cards.length)).map(x=>({...x.card}))};
}
export function assertReservePeek(m: Match, p: ReservePeek): void {
  if (!p || !sides.includes(p.side) || !Array.isArray(p.cards) || !p.cards.length || !Array.isArray(p.inserts) ||
      new Set(p.cards.map(x=>x.id)).size!==p.cards.length || new Set(p.inserts.map(x=>x.id)).size!==p.inserts.length) throw Error('Invalid Reserve peek.');
  if(p.whole!==undefined&&(p.whole!==true||p.cards.length!==m.players[p.side].reserve.length))throw Error('Invalid whole Reserve inspection.');
  p.cards.forEach((ref,i)=>{assertCardReference(m,ref);if(ref.zone!=='reserve'||!sameCard(m,ref)||m.players[p.side].reserve[i]!==ref.id)throw Error('Peeked Reserve changed.');});
  const encountered=insertsIn(m,p.side).filter(x=>!x.revealed&&(p.whole||x.position<p.cards.length));
  if(encountered.length!==p.inserts.length)throw Error('Peeked inserts changed.');
  p.inserts.forEach((ref,i)=>{assertCardReference(m,ref);if(!sameCard(m,ref)||encountered[i].revealed||encountered[i].card.id!==ref.id)throw Error('Peeked insert changed.');});
}
/** AR pp167–168: all returned peeked cards go above encountered inserts.
 * Restore the inspected ordinary block first; the provider may then remove its
 * selected cards. Ordinary identities/order remain unchanged by inspection. */
export function returnReservePeek(m: Match, p: ReservePeek): void {
  assertReservePeek(m,p);
  invalidatePileReveals(m,p.cards.map(ref=>ref.id));
  for(const x of insertsIn(m,p.side))if(p.whole||x.position<p.cards.length)x.position=p.cards.length;
}
export function reservePeekView(m: Match,p: ReservePeek) {
  return {peek:p.cards.map(ref=>({...m.cards[ref.id]})),peekInserts:p.inserts.map(ref=>({...m.cards[ref.id]}))};
}
