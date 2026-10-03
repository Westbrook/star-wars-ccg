import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {sides, type Json, type Match, type Side} from './types';

type CurrentDuel = {serial?: number; stage: string};
export type DuelModifier = {duel: number; source: CardReference; side: Side; kind: 'draws' | 'total'; amount: number;
  whileSourceActive: boolean; function: string; cumulative: boolean};
const entries = (m: Match) => (m.data.duelModifiers ?? []) as unknown as DuelModifier[];
const current = (m: Match) => m.data.duel as unknown as CurrentDuel | undefined;
function assertModifier(m: Match, p: DuelModifier): void {
  if (!p || !Number.isSafeInteger(p.duel) || p.duel < 1 || p.duel > m.serial || !sides.includes(p.side) ||
      !['draws','total'].includes(p.kind) || !Number.isFinite(p.amount) || p.kind === 'draws' && !Number.isSafeInteger(p.amount) ||
      typeof p.whileSourceActive !== 'boolean' || typeof p.function !== 'string' || !p.function || typeof p.cumulative !== 'boolean') throw Error('Invalid duel modifier.');
  assertCardReference(m, p.source);
  if (p.whileSourceActive && p.source.zone !== 'table') throw Error('Invalid continuous duel source.');
}
/** Resolved additions last through this duel; continuous providers also bind
 * their original table source. Neither kind can leak into a subsequent duel. */
export function addDuelModifier(m: Match, source: string, side: Side, kind: DuelModifier['kind'], amount: number,
  options: {whileSourceActive?: boolean; function?: string; cumulative?: boolean} = {}): void {
  const d = current(m);
  if (!d || !['begin','draws'].includes(d.stage)) throw Error('Duel modifiers require an unresolved duel.');
  d.serial ??= ++m.serial; // Resume an older saved duel before the first new grant.
  const p: DuelModifier = {duel: d.serial, source: referenceCard(m, source), side, kind, amount,
    whileSourceActive: options.whileSourceActive ?? false, function: options.function ?? kind, cumulative: options.cumulative ?? false};
  assertModifier(m, p);
  m.data.duelModifiers = [...entries(m).filter(v => v.duel === d.serial), p] as unknown as Json;
}
export function duelModifier(m: Match, side: Side, kind: DuelModifier['kind']): number {
  const d = current(m); if (!d || !['begin','draws'].includes(d.stage)) return 0;
  const grouped = new Map<string, DuelModifier>(); let result = 0;
  for (const p of entries(m).filter(p => p.duel === d.serial && p.side === side && p.kind === kind && (!p.whileSourceActive || sameCard(m, p.source)))) {
    if (p.cumulative) {result += p.amount; continue;}
    const key = cardDefinition(m, p.source.id).name + ':' + p.function;
    const prior = grouped.get(key);
    if (!prior || Math.abs(p.amount) > Math.abs(prior.amount)) grouped.set(key, p);
  }
  return result + [...grouped.values()].reduce((n, p) => n + p.amount, 0);
}
export function assertDuelModifiers(m: Match): void {
  if (m.data.duelModifiers !== undefined && !Array.isArray(m.data.duelModifiers)) throw Error('Invalid duel modifiers.');
  entries(m).forEach(p => assertModifier(m, p));
}
