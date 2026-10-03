import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {wholeForce, validForceQuantity} from './force-quantity';
import {sides, type Json, type Match, type Phase, type Side} from './types';

type Counts = {turn: number; phase: Phase; counts: Record<Side, number>};
type Restriction = {source: CardReference; side: Side; duration: 'turn' | 'source'; turn: number};
export type ActivationBatch = {id: string; source: CardReference; side: Side; requested: number; count: number; remaining: number; maximum?: number; declaredWithInsert?: boolean};
function assertRestriction(m: Match, p: Restriction): void {
  if (!p || !sides.includes(p.side) || !['turn','source'].includes(p.duration) || !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number) throw Error('Invalid activation restriction.');
  assertCardReference(m,p.source);
  if (p.duration === 'source' && p.source.zone !== 'table') throw Error('Continuous activation restriction needs a table source.');
}
/** Rule-owned registration, not a player command. A turn effect persists after
 * source departure; continuous text binds to its original table instance. */
export function preventActivation(m: Match, source: string, side: Side, duration: Restriction['duration'] = 'turn'): void {
  const p: Restriction = {source: referenceCard(m,source), side, duration, turn:m.turn.number};
  assertRestriction(m,p); ((m.data.activationRestrictions ??= []) as unknown as Restriction[]).push(p);
}
export function mayActivate(m: Match, side: Side): boolean {
  return !((m.data.activationRestrictions ?? []) as unknown as Restriction[]).some(p => p.side === side && (p.duration === 'turn' ? p.turn === m.turn.number : sameCard(m,p.source)));
}
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
  const restrictions = m.data.activationRestrictions;
  if (restrictions !== undefined) {
    if (!Array.isArray(restrictions)) throw Error('Invalid activation restrictions.');
    for (const p of restrictions) assertRestriction(m,p as unknown as Restriction);
  }
  const ids = new Set<string>();
  const frames=m.stack.map(f=>{
    if(f.kind!=='decision'||f.handler!=='core:activation-extra')return f;
    const p=f.payload as unknown as ActivationBatch;
    if(!p || f.side!==p.side || p.remaining!==0 || !p.declaredWithInsert || p.maximum===undefined || p.maximum<=p.count)throw Error('Invalid extra activation decision.');
    return {kind:'resolution' as const,actor:p.side,cancelled:false,action:{id:p.id,source:p.source?.id,handler:'core:activate-batch',label:'Activate Force',payload:f.payload}};
  });
  for (const f of frames) if (f.kind === 'resolution' && f.action.handler === 'core:activate-batch') {
    const p=f.action.payload as unknown as ActivationBatch;
    if (!p || !/^activation-[1-9]\d*$/.test(p.id) || !Number.isSafeInteger(Number(p.id.slice(11))) || Number(p.id.slice(11)) > m.serial || ids.has(p.id) || !sides.includes(p.side) || f.actor !== p.side ||
        !validForceQuantity(p.requested) || p.count !== wholeForce(p.requested) || p.count < 1 || !Number.isSafeInteger(p.remaining) || p.remaining < 0 || p.remaining > p.count ||
        f.action.id !== p.id || f.action.source !== p.source?.id || f.awaitingResponses || f.action.payment !== undefined) throw Error('Invalid activation batch.');
    if (p.maximum !== undefined && (!Number.isSafeInteger(p.maximum) || p.maximum < p.count || typeof p.declaredWithInsert !== 'boolean') || p.maximum === undefined && p.declaredWithInsert !== undefined) throw Error('Invalid variable activation bound.');
    assertCardReference(m,p.source); ids.add(p.id);
  }
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
