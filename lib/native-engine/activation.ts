import {assertCardReference, referenceCard, type CardReference} from './identity';
import {sides, type Json, type Match, type Phase, type Side} from './types';

type Counts = {turn: number; phase: Phase; counts: Record<Side, number>};
export type ActivationEvent = {kind: 'force-activated'; side: Side; turn: number; phase: Phase; count: number; card: CardReference};
export function activatedThisPhase(m: Match, side: Side): number {
  const s = m.data.activation as unknown as Counts | undefined;
  if (s?.turn === m.turn.number && s.phase === m.turn.phase) return s.counts[side];
  // Older saves contain ordinary activation history in the turn record.
  return m.turn.phase === 'activate' && m.turn.side === side ? m.turn.activated : 0;
}
export function recordActivation(m: Match, side: Side, id: string): ActivationEvent {
  const counts = {dark: activatedThisPhase(m,'dark'), light: activatedThisPhase(m,'light')};
  counts[side]++;
  m.data.activation = {turn: m.turn.number, phase: m.turn.phase, counts} as unknown as Json;
  return {kind:'force-activated', side, turn:m.turn.number, phase:m.turn.phase, count:counts[side], card:referenceCard(m,id)};
}
export function assertActivations(m: Match): void {
  const s = m.data.activation as unknown as Counts | undefined;
  if (s !== undefined && (!s || !Number.isSafeInteger(s.turn) || s.turn < 1 || s.turn > m.turn.number ||
    !['activate','control','deploy','battle','move','draw'].includes(s.phase) || !s.counts ||
    sides.some(side=>!Number.isSafeInteger(s.counts[side]) || s.counts[side]<0))) throw Error('Invalid activation history.');
  for (const w of m.stack) if (w.kind === 'window' && (w.event as {kind?:string})?.kind === 'force-activated') {
    const e = w.event as unknown as ActivationEvent;
    if (w.timing !== 'response' || !sides.includes(e.side) || e.turn !== m.turn.number || e.phase !== m.turn.phase ||
      !Number.isSafeInteger(e.count) || e.count < 1 || e.count > activatedThisPhase(m,e.side)) throw Error('Invalid activation result.');
    assertCardReference(m,e.card);
    if (e.card.zone !== 'force' || m.cards[e.card.id].owner !== e.side) throw Error('Invalid activated card.');
  }
}
