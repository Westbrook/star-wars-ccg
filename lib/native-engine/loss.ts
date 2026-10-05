import {resistanceLimit} from './resistance';
import {hasPersona} from './persona';
import {validForceQuantity, wholeForce} from './force-quantity';
import type {Match, Side} from './types';

/** Preserve the whole obligation; never halve the shrinking unpaid remainder. */
export type LossLedger = {kind: 'drain' | 'battle' | 'effect'; base: number; paid: number; reduction: number; increase: number; irreducible: boolean; multiplier?: number; insert?: true};
export type Doomed = {turn: number; sources: string[]};
export const lossLedger = (base: number, kind: LossLedger['kind'], irreducible = false): LossLedger => ({kind, base, paid: 0, reduction: 0, increase: 0, irreducible});
export function doomedRounding(m: Match, side: Side): 'up' | 'down' | null {
  const d = m.data.doomed as Doomed | undefined;
  if (side !== 'light' || d?.turn !== m.turn.number) return null;
  // Explicit persona metadata. Permanent astromechs, targeting immunity
  // and inactive/captured cards require their own rules.
  return Object.values(m.cards).some(c => c.zone === 'table' && (hasPersona(m, c.id, 'C3PO') || hasPersona(m, c.id, 'R2D2'))) ? 'down' : 'up';
}
export function lossTotal(m: Match, side: Side, ledger: LossLedger): number {
  // It's Worse is a drain bonus before loss reduction, but a later Force-loss
  // modifier for other losses. We're Doomed is applied before other reductions.
  let total = ledger.base + (ledger.kind === 'drain' ? ledger.increase : 0);
  const round = ledger.irreducible ? null : doomedRounding(m, side);
  if (round) total = round === 'down' ? Math.floor(total / 2) : Math.ceil(total / 2);
  // Battle multipliers are scheduled at initiation, before damage-segment
  // increases/reductions. We're Doomed is the explicit first-applied exception.
  total *= ledger.multiplier ?? 1;
  const amount = Math.max(0, total + (ledger.kind === 'drain' ? 0 : ledger.increase) - (ledger.irreducible ? 0 : ledger.reduction));
  // Battle damage is also payable with forfeit values, which can be fractional.
  // Do not round that numeric obligation as if it were already a pile movement.
  const cap=ledger.kind==='drain'||ledger.insert?resistanceLimit(m,side):null;
  const capped=cap===null?amount:Math.min(amount,cap);
  return ledger.kind === 'battle' ? capped : wholeForce(capped);
}
export const lossRemaining = (m: Match, side: Side, ledger: LossLedger): number => Math.max(0, lossTotal(m, side, ledger) - ledger.paid);
export function assertLedger(ledger: LossLedger): void {
  if (!ledger || ledger.insert!==undefined&&(ledger.insert!==true||ledger.kind!=='effect') || !['drain','battle','effect'].includes(ledger.kind) || typeof ledger.irreducible !== 'boolean' ||
    [ledger.base, ledger.paid, ledger.reduction, ledger.increase].some(n => !validForceQuantity(n)) ||
    ledger.kind !== 'battle' && !Number.isSafeInteger(ledger.paid) ||
    ledger.multiplier !== undefined && (ledger.kind !== 'battle' || !Number.isSafeInteger(ledger.multiplier) || ledger.multiplier < 1)) throw Error('Invalid Force-loss ledger.');
}

/** Public obligation only; payment choices and hidden pile identities remain
 * in the seat-filtered prompt. The nearest pending loss may be nested. */
export function forceLossView(m:Match){
 const f=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler==='ground:force-loss'||f.kind==='resolution'&&f.action.handler==='ground:force-loss');
 if(!f||f.kind==='window')return {forceLoss:null};
 const p=(f.kind==='decision'?f.payload:f.action.payload) as unknown as {side:Side;remaining:number;ledger?:LossLedger};
 const kind=p.ledger?.kind==='drain'?'drain':p.ledger?.insert?'insert':'effect';
 return {forceLoss:{side:p.side,kind,remaining:p.ledger?lossRemaining(m,p.side,p.ledger):p.remaining,paid:p.ledger?.paid??0,base:p.ledger?.base??p.remaining,limit:kind==='effect'?null:resistanceLimit(m,p.side)}};
}
