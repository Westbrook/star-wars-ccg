import {assertCardReference, sameCard, type CardReference} from './identity';
import {sides, type Json, type Match, type Side} from './types';
import {shuffled, type Entropy} from './random';

/** Inserts remain on table. Position counts ordinary Reserve cards above them;
 * array order breaks ties between adjacent inserts. Neither is client data. */
export type ReserveInsert = {card: CardReference; side: Side; position: number; revealed: boolean};
export const reserveInserts = (m: Match): ReserveInsert[] => (m.data.reserveInserts ?? []) as unknown as ReserveInsert[];
export const insertsIn = (m: Match, side: Side) => reserveInserts(m).filter(x => x.side === side);
export const isInserted = (m: Match, id: string) => reserveInserts(m).some(x => x.card.id === id);
export function saveInserts(m: Match, entries: ReserveInsert[]): void {m.data.reserveInserts = entries as unknown as Json;}
export function assertReserveInserts(m: Match): void {
  if (m.data.reserveInserts === undefined) return;
  if (!Array.isArray(m.data.reserveInserts)) throw Error('Invalid Reserve inserts.');
  const ids = new Set<string>();
  for (const x of reserveInserts(m)) {
    if (!x || !sides.includes(x.side) || !Number.isSafeInteger(x.position) || x.position < 0 || x.position > m.players[x.side].reserve.length || typeof x.revealed !== 'boolean') throw Error('Invalid insert position.');
    assertCardReference(m,x.card);
    const c=m.cards[x.card.id];
    if (ids.has(c.id) || x.card.zone !== 'table' || !sameCard(m,x.card) || c.location || c.attachedTo || c.coveredBy || c.stackedOn || x.revealed && x.position !== 0) throw Error('Invalid inserted card.');
    ids.add(c.id);
  }
}
/** A revealed insert is still pending until its provider finishes/cancels it.
 * A second exposed insert must not jump over that unresolved topmost action. */
export function topInsert(m: Match, side: Side): ReserveInsert | undefined {
  return insertsIn(m,side).find(x=>x.position===0);
}
export function revealInsert(m: Match, side: Side): CardReference | undefined {
  const x=topInsert(m,side); if (!x || x.revealed) return;
  x.revealed=true; return {...x.card};
}
export function assertReserveTopAccessible(m: Match, side: Side): void {
  // Exposure interrupts the parent action, but valid responses may themselves
  // move ordinary cards. A revealed insert is never a destiny/Force card.
  const top=topInsert(m,side);
  if (top && !top.revealed) throw Error('Resolve the exposed insert before moving another Reserve card.');
}
/** One conditional uniform shuffle, equivalent to reshuffling until the first
 * card is ordinary. This terminates even for deterministic test entropy. */
export function shuffledReserve(m: Match, side: Side, entropy?: Entropy): {cards: string[]; entries: ReserveInsert[]} {
  const real=m.players[side].reserve, entries=insertsIn(m,side);
  if (entries.some(x=>x.revealed)) throw Error('Resolve the revealed insert before shuffling Reserve.');
  if (!entries.length) return {cards:shuffled(real,entropy),entries:[]};
  if (!real.length) throw Error('Resolve exposed inserts before shuffling an empty Reserve.');
  const first=shuffled(real,entropy)[0];
  const order=[first,...shuffled([...real.filter(id=>id!==first),...entries.map(x=>x.card.id)],entropy)];
  const map=new Map(entries.map(x=>[x.card.id,x]));let position=0;const result:ReserveInsert[]=[];
  for(const id of order){const x=map.get(id);if(x)result.push({...x,position});else position++;}
  return {cards:order.filter(id=>!map.has(id)),entries:result};
}
/** Called before any ordinary card changes piles. Peek providers must inspect
 * ordinary IDs without removing them; their final replacement is a separate action. */
export function reserveCardRemoved(m: Match, side: Side, index: number): void {
  for(const x of insertsIn(m,side))if(index<x.position)x.position--;
}
export function reserveCardAdded(m: Match, side: Side, atTop: boolean): void {
  if(atTop)for(const x of insertsIn(m,side))if(!x.revealed)x.position++;
}
export function forgetInsert(m: Match, id: string): void {
  if(isInserted(m,id))saveInserts(m,reserveInserts(m).filter(x=>x.card.id!==id));
}
