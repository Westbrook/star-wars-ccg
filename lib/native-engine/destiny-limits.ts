import {battleDrawPolicy} from './battle-destiny';
import {battle} from './battle';
import {sides, type Match, type Side} from './types';

/** A sequence is a rules action's draw group, not a physical card or a global
 * per-player counter. Nested draws and the two sides of a battle stay isolated. */
export type DestinySequence = {side: Side; source: string; category: string; limit: number | null; physical: number; skipped: number; substituted?: number};
const sequences = (m: Match) => (m.data.destinySequences ??= {}) as Record<string, DestinySequence>;
const validNumber = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
export function beginDestinySequence(m: Match, side: Side, source: string, category: string, limit: number | null = null): string {
  if (!sides.includes(side) || !m.cards[source] || !category || limit !== null && !validNumber(limit)) throw Error('Invalid destiny sequence.');
  const id = 'destiny-sequence:' + ++m.serial;
  sequences(m)[id] = {side, source, category, limit, physical: 0, skipped: 0};
  return id;
}
export function destinySequence(m: Match, id: string): DestinySequence {
  const all = m.data.destinySequences as Record<string, DestinySequence> | undefined;
  if (!all || !Object.hasOwn(all, id)) throw Error('Missing destiny sequence.');
  return all[id];
}
/** A modifier provider supplies the currently applicable combined limit. */
export function setDestinyLimit(m: Match, id: string, limit: number | null): void {
  if (limit !== null && !validNumber(limit)) throw Error('Invalid destiny limit.');
  destinySequence(m, id).limit = limit;
}
export function remainingDestinyDraws(m: Match, id?: string): number {
  if (!id) return Infinity;
  const p = destinySequence(m, id);
  const b = battle(m);
  const limit = p.category === 'battle' && b?.stage !== 'complete' && b?.destinyScopes?.[p.side] === id ? battleDrawPolicy(m, p.side, p.limit).limit : p.limit;
  return limit === null ? Infinity : Math.max(0, limit - p.physical - p.skipped);
}
export function countDestinyDraw(m: Match, id: string | undefined, kind: 'physical' | 'skipped' | 'substituted'): void {
  if (id) {const p = destinySequence(m, id); p[kind] = (p[kind] ?? 0) + 1;}
}
/** An involuntary cost failure can be bypassed by current if-unable text.
 * Voluntary refusal is never overridden. Substitutions count as draws here. */
export function mayBypassDestinyCost(m: Match, id?: string): boolean {
  if (!id) return false;
  const p = destinySequence(m, id), b = battle(m);
  return p.category === 'battle' && b?.stage === 'power' && b.destinyScopes?.[p.side] === id &&
    p.physical + p.skipped + (p.substituted ?? 0) < battleDrawPolicy(m, p.side).minimum;
}
/** Only cancel-and-redraw releases the original slot. Plain cancellation keeps
 * it consumed (AR p32). The resolving continuation calls this exactly once. */
export function replaceDestinyDraw(m: Match, id?: string): void {
  if (!id) return;
  const p = destinySequence(m, id);
  if (!p.physical) throw Error('Missing physical destiny to replace.');
  p.physical--;
}
export function assertDestinyScope(m: Match, id: string | undefined, side: Side, source: string, category: string): void {
  if (id === undefined) return;
  if (typeof id !== 'string') throw Error('Invalid destiny scope.');
  const p = destinySequence(m, id);
  if (p.side !== side || p.source !== source || p.category !== category) throw Error('Mismatched destiny scope.');
}
export function assertDestinySequences(m: Match): void {
  const all = m.data.destinySequences;
  if (all === undefined) return;
  if (!all || Array.isArray(all) || typeof all !== 'object') throw Error('Invalid destiny sequences.');
  for (const [id, raw] of Object.entries(all)) {
    const p = raw as unknown as DestinySequence;
    const serial = Number(id.slice('destiny-sequence:'.length));
    if (!/^destiny-sequence:[1-9]\d*$/.test(id) || !Number.isSafeInteger(serial) || serial > m.serial || !p || !sides.includes(p.side) ||
      !m.cards[p.source] || typeof p.category !== 'string' || !p.category || p.limit !== null && !validNumber(p.limit) ||
      !validNumber(p.physical) || !validNumber(p.skipped) || p.substituted !== undefined && !validNumber(p.substituted)) throw Error('Invalid destiny sequence.');
  }
}
