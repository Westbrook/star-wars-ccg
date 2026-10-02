import type {Match, Side} from './types';

/** Preserve the whole obligation; never halve the shrinking unpaid remainder. */
export type LossLedger = {kind: 'drain' | 'battle' | 'effect'; base: number; paid: number; reduction: number; increase: number; irreducible: boolean};
export type Doomed = {turn: number; sources: string[]};
export const lossLedger = (base: number, kind: LossLedger['kind'], irreducible = false): LossLedger => ({kind, base, paid: 0, reduction: 0, increase: 0, irreducible});
export function doomedRounding(m: Match, side: Side): 'up' | 'down' | null {
  const d = m.data.doomed as Doomed | undefined;
  if (side !== 'light' || d?.turn !== m.turn.number) return null;
  // Explicit current identities. Other personas, permanent astromechs,
  // targeting immunity and inactive/captured cards require their own metadata.
  return Object.values(m.cards).some(c => c.zone === 'table' && ['1_5','2_14'].includes(c.blueprint)) ? 'down' : 'up';
}
export function lossTotal(m: Match, side: Side, ledger: LossLedger): number {
  // It's Worse is a drain bonus before loss reduction, but a later Force-loss
  // modifier for other losses. We're Doomed is applied before other reductions.
  let total = ledger.base + (ledger.kind === 'drain' ? ledger.increase : 0);
  const round = ledger.irreducible ? null : doomedRounding(m, side);
  if (round) total = round === 'down' ? Math.floor(total / 2) : Math.ceil(total / 2);
  return Math.max(0, total + (ledger.kind === 'drain' ? 0 : ledger.increase) - (ledger.irreducible ? 0 : ledger.reduction));
}
export const lossRemaining = (m: Match, side: Side, ledger: LossLedger): number => Math.max(0, lossTotal(m, side, ledger) - ledger.paid);
export function assertLedger(ledger: LossLedger): void {
  if (!ledger || !['drain','battle','effect'].includes(ledger.kind) || typeof ledger.irreducible !== 'boolean' ||
    [ledger.base, ledger.paid, ledger.reduction, ledger.increase].some(n => !Number.isSafeInteger(n) || n < 0)) throw Error('Invalid Force-loss ledger.');
}
