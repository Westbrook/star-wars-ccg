import {alternateDestinies, choosePrintedDestiny, assertPrintedDestinies, selectedPrintedDestiny} from './destiny-values';
import {mayBypassDestinyCost, beginDestinySequence, assertDestinyScope, assertDestinySequences, remainingDestinyDraws, countDestinyDraw, replaceDestinyDraw} from './destiny-limits';
import {printed, weaponDrawBonus} from './board';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {moveCard, moveTop} from './state';
import {openWindow} from './runtime';
import {other, sides, type Action, type Decision, type Json, type Match, type Resolution, type Side} from './types';
export type Substitution = {source: string; value: number};
export type Draw = {card: string | null; value: number | null; substitution?: Substitution; skipped?: 'cost-declined' | 'cost-unpaid' | 'limit'};
type Context = {next: Action; side: Side; source: string; category: string; scope?: string};
export type Modifier = number | {weapon: string};
export type DrawFlow = Context & {includeTotal: boolean; modifier: Modifier; drawn?: Action; retain?: boolean; reference?: CardReference};
type PendingStart = Context & {includeTotal: boolean; modifier: Modifier; drawn?: Action; substitution?: Substitution; retain?: boolean; costFailure?: 'cost-declined' | 'cost-unpaid'};
const validSubstitution = (m: Match, s: Substitution) => !!s && !!m.cards[s.source] && Number.isFinite(s.value) && s.value >= 0;
export function validDraw(m: Match, d: Draw, side: Side, allowNegative = false): boolean {
  return !!d && (d.skipped === undefined || ['cost-declined', 'cost-unpaid', 'limit'].includes(d.skipped) && d.card === null && d.value === null && !d.substitution) && (d.card === null || m.cards[d.card]?.owner === side) &&
    (d.value === null || Number.isFinite(d.value) && (allowNegative || d.value >= 0)) &&
    (d.substitution === undefined ? d.card !== null || d.value === null : validSubstitution(m, d.substitution) && d.card === null && d.value !== null);
}
/** Check initiation eligibility; a successfully initiated substitution may
 * finish even if a response later empties Reserve or lowers the draw limit. */
export function canSubstituteDestiny(m: Match, r: Resolution): boolean {
  if (!m.stack.includes(r) || r.action.handler !== 'destiny:draw' || r.cancelled) return false;
  const p = r.action.payload as unknown as PendingStart;
  return !p.substitution && !p.costFailure && m.players[p.side].reserve.length > 0 && remainingDestinyDraws(m, p.scope) > 0;
}
/** Only an actual pending before-draw continuation can receive a substitute.
 * Eligibility (including nonempty Reserve) belongs to the initiating card. */
export function substituteDestiny(m: Match, r: Resolution, source: string, value: number): boolean {
  if (!validSubstitution(m, {source, value})) throw Error('Invalid substituted destiny.');
  if (!m.stack.includes(r) || r.action.handler !== 'destiny:draw' || r.cancelled) return false;
  const p = r.action.payload as unknown as PendingStart;
  if (p.substitution || p.costFailure) return false;
  p.substitution = {source, value}; return true;
}
/** Cost providers bind the exact pre-draw continuation. Declining a cost and
 * being unable to pay remain distinct for rules such as "if unable otherwise";
 * the shared cost resolver checks any current permission before the draw. */
export function failDestinyCost(m: Match, r: Resolution, chosenByPlayer: boolean): boolean {
  if (typeof chosenByPlayer !== 'boolean') throw Error('Invalid destiny cost failure.');
  if (!m.stack.includes(r) || r.action.handler !== 'destiny:cost' || r.cancelled) return false;
  const p = r.action.payload as unknown as PendingStart;
  // A later compulsory failure cannot erase a player's earlier refusal.
  if (!p.costFailure || chosenByPlayer) p.costFailure = chosenByPlayer ? 'cost-declined' : 'cost-unpaid';
  return true;
}
/** Request a replacement of a just-drawn general destiny. The replacement
 * occupies the same selection slot; the canceled original never completes. */
export function redrawDestiny(m: Match, r: Resolution): boolean {
  if (!m.stack.includes(r) || r.action.handler !== 'destiny:finish' || r.cancelled) return false;
  const p = r.action.payload as unknown as PendingDraw;
  if (p.draw.value === null || p.draw.substitution || p.redraw) return false;
  p.redraw = true; r.cancelled = true; return true;
}
const validModifier = (m: Match, modifier: Modifier) => typeof modifier === 'number' ? Number.isFinite(modifier) : !!modifier && typeof modifier.weapon === 'string' && !!m.cards[modifier.weapon];
type PendingDraw = Context & {draw: Draw; includeTotal?: boolean; retain?: boolean; reference?: CardReference; redraw?: boolean; modifier?: Modifier};
type PendingTotal = Context & {draws: Draw[]; total: number | null; single: boolean};
const queue = (m: Match, step: string, p: PendingStart | PendingDraw | PendingTotal) => m.stack.push({kind: 'resolution', actor: p.side, cancelled: false,
  action: {id: 'destiny-' + step + ':' + (m.serial + 1), label: 'Resolve destiny', handler: 'destiny:' + step, payload: p as unknown as Json}});
const dispatch = (m: Match, p: Context, result: Record<string, Json>) => m.stack.push({kind: 'resolution', actor: p.side, cancelled: false,
  action: {...p.next, payload: {...p.next.payload as Record<string, Json>, ...result}}});

/** Individual draw completion precedes Used placement. A canceled/nonexistent
 * draw has no completed-draw trigger, but its physical card still gets cleanup. */
export function completeDestinyDraw(m: Match, side: Side, source: string, category: string, draw: Draw, next: Action, includeTotal = true, retain = false, reference?: CardReference, scope?: string): void {
  const p: PendingDraw = {side, source, category, ...(scope ? {scope} : {}), next, includeTotal, ...(retain ? {retain, ...(reference ? {reference} : {})} : {}), draw: {...draw, value: draw.substitution?.value ?? (draw.value === null ? null : Math.max(0, draw.value))}};
  queue(m, 'place', p);
  if (p.draw.value !== null) openWindow(m, 'response', other(side), {kind: 'destiny-draw-complete', category, source, side, ...p.draw});
}
/** Total modifiers apply only after individual draws and their Used placement.
 * A successful zero supplies a total; all failed/canceled draws never do. */
export function completeDestinyTotal(m: Match, side: Side, source: string, category: string, draws: Draw[], next: Action, modifier = 0, single = false): void {
  if (!Number.isFinite(modifier)) throw Error('Invalid destiny total modifier.');
  const total = draws.some(d => d.value !== null) ? Math.max(0, draws.reduce((n, d) => n + (d.value ?? 0), 0) + modifier) : null;
  const p: PendingTotal = {side, source, category, next, draws: structuredClone(draws), total, single};
  queue(m, 'total-finish', p);
  if (total !== null) openWindow(m, 'response', other(side), {kind: 'destiny-total', category, source, side, draws: p.draws as unknown as Json, total});
}
/** General destiny. Multi-draw callers pass includeTotal=false, then complete
 * their combined total once, after all the individual draw continuations. */
export function drawDestiny(m: Match, side: Side, source: string, category: string, next: Action, includeTotal = true, modifier: Modifier = 0, drawn?: Action, retain = false, scope?: string): void {
  if (!validModifier(m, modifier) || retain && (drawn && drawn.handler !== 'battle:planned-drawn' || includeTotal || next.handler !== 'selection:drawn')) throw Error('Invalid destiny draw modifier or retention.');
  scope ??= beginDestinySequence(m, side, source, category);
  assertDestinyScope(m, scope, side, source, category);
  const capable = m.players[side].reserve.length > 0 && remainingDestinyDraws(m, scope) > 0;
  queue(m, capable ? 'cost' : 'draw', {next, side, source, category, ...(scope ? {scope} : {}), includeTotal, modifier, ...(drawn ? {drawn} : {}), ...(retain ? {retain} : {})});
  // An empty Reserve cannot trigger "about to draw" text (AR pp10,32).
  // Do not capture its top card: responses can change the deck before reveal.
  if (capable) openWindow(m, 'response', other(side), {kind: 'destiny-cost', category, source, side});
}
type ValueChoice = {start: PendingStart; card: CardReference};
export function destinyChoices(m: Match, d: Decision): {id: string; label: string}[] {
  const p=d.payload as unknown as ValueChoice;
  if(d.handler!=='destiny:value')throw Error('Unknown destiny choice.');
  return alternateDestinies(m,p.card.id).map(value=>({id:'value:'+value,label:'Choose printed destiny '+value}));
}
export function destinyChoose(m: Match, d: Decision, choice: string): void {
  const p=d.payload as unknown as ValueChoice,value=Number(choice.slice(6));
  if (d.handler !== 'destiny:value' || !destinyChoices(m,d).some(c=>c.id===choice) || !sameCard(m,p.card)) throw Error('Invalid destiny choice.');
  choosePrintedDestiny(m,p.card.id,value); finishReveal(m,p.start,p.card.id,false);
}
function finishReveal(m: Match, p: PendingStart, card: string | null, limited: boolean): void {
  const modifier = typeof p.modifier === 'number' ? p.modifier : weaponDrawBonus(m, p.modifier.weapon);
  const draw: Draw = limited ? {card: null, value: null, skipped: 'limit'} : p.costFailure ? {card: null, value: null, skipped: p.costFailure} : p.substitution ? {card: null, value: p.substitution.value, substitution: {...p.substitution}} : {card, value: card ? printed(m, card, 'destiny') + modifier : null};
  // Battle adapters preserve their public events and redraw protocol while
  // sharing the same before-draw boundary and physical draw operation.
  if (p.drawn) dispatch(m, {...p, next: p.drawn}, {draw: draw as unknown as Json, ...(['battle:planned-drawn','battle:weapon-drawn'].includes(p.drawn.handler) ? {flow: {...p, ...(card ? {reference: referenceCard(m, card)} : {})} as unknown as Json} : {})});
  else {
    queue(m, 'finish', {...p, draw, ...(p.retain && card ? {reference: referenceCard(m, card)} : {})});
    if (!draw.skipped) openWindow(m, 'response', other(p.side), {kind: draw.value !== null ? 'destiny-drawn' : 'destiny-failed', category: p.category, source: p.source, side: p.side, card, ...(p.substitution ? {substituted: true, value: draw.value} : {})});
  }
}
export function resolveDestiny(m: Match, r: Resolution): void {
  if (r.action.handler === 'destiny:cost') {
    const p = r.action.payload as unknown as PendingStart;
    if (p.costFailure === 'cost-unpaid' && mayBypassDestinyCost(m, p.scope)) delete p.costFailure;
    queue(m, 'draw', p);
    if (r.cancelled) (m.stack.at(-1) as Resolution).cancelled = true;
    if (!p.costFailure && !r.cancelled && m.players[p.side].reserve.length && remainingDestinyDraws(m, p.scope) > 0)
      openWindow(m, 'response', other(p.side), {kind: 'about-to-draw-destiny', category: p.category, source: p.source, side: p.side});
    return;
  }
  if (r.action.handler === 'destiny:draw') {
    const p = r.action.payload as unknown as PendingStart;
    const limited = !p.substitution && !p.costFailure && remainingDestinyDraws(m, p.scope) === 0;
    const card = !limited && !p.costFailure && !p.substitution && !r.cancelled && m.players[p.side].reserve.length ? moveTop(m, p.side, 'reserve', 'destiny') : null;
    if (card) countDestinyDraw(m, p.scope, 'physical');
    else if (p.substitution) countDestinyDraw(m, p.scope, 'substituted');
    else if (p.costFailure) countDestinyDraw(m, p.scope, 'skipped');
    if (card && alternateDestinies(m,card).length) {
      m.stack.push({kind:'decision',side:p.side,handler:'destiny:value',payload:{start:p,card:referenceCard(m,card)} as unknown as Json});
    } else finishReveal(m,p,card,limited);
    return;
  }
  if (r.action.handler === 'destiny:total-finish') {
    const p = r.action.payload as unknown as PendingTotal;
    const total = p.total === null ? null : Math.max(0, p.total);
    dispatch(m, p, {draws: p.draws as unknown as Json, total,
      ...(p.single ? {draw: {...p.draws[0], value: total}} : {})});
    return;
  }
  const p = r.action.payload as unknown as PendingDraw;
  if (r.action.handler === 'destiny:finish') {
    if (p.redraw && !p.draw.substitution) {
      if (p.draw.card && (p.reference ? sameCard(m, p.reference) : m.cards[p.draw.card]?.zone === 'destiny')) moveCard(m, p.draw.card, 'used');
      if (p.draw.card) replaceDestinyDraw(m, p.scope);
      drawDestiny(m, p.side, p.source, p.category, p.next, p.includeTotal !== false, p.modifier ?? 0, undefined, p.retain, p.scope); return;
    }
    completeDestinyDraw(m, p.side, p.source, p.category, r.cancelled && !p.draw.substitution ? {...p.draw, value: null} : p.draw, p.next, p.includeTotal, p.retain, p.reference, p.scope);
  } else if (r.action.handler === 'destiny:place') {
    if (p.draw.substitution) p.draw.value = p.draw.substitution.value;
    // A response can relocate the physical card without erasing its destiny
    // value. Only cards still in the unresolved zone are placed on Used.
    if (p.draw.card && (!p.retain || p.draw.value === null) && (p.reference ? sameCard(m, p.reference) : m.cards[p.draw.card]?.zone === 'destiny')) moveCard(m, p.draw.card, 'used');
    if (p.includeTotal !== false) completeDestinyTotal(m, p.side, p.source, p.category, [p.draw], p.next, 0, true);
    else dispatch(m, p, {draw: p.draw as unknown as Json, ...(p.reference ? {reference: p.reference as unknown as Json} : {})});
  } else throw Error('Unknown destiny continuation.');
}

export function assertDestiny(m: Match): void {
  assertDestinySequences(m); assertPrintedDestinies(m);
  for (const f of m.stack) if (f.kind==='decision' && f.handler==='destiny:value') {
    const p=f.payload as unknown as ValueChoice,s=p?.start;
    if (!s || s.side!==f.side || !sides.includes(s.side) || !m.cards[s.source] || typeof s.category!=='string' || !s.category || !s.next?.handler ||
        typeof s.includeTotal!=='boolean' || !validModifier(m,s.modifier) || s.substitution || s.costFailure ||
        s.retain!==undefined && typeof s.retain!=='boolean' || s.retain && (s.includeTotal || s.next.handler!=='selection:drawn' || s.drawn && s.drawn.handler!=='battle:planned-drawn') || s.drawn!==undefined && !s.drawn?.handler) throw Error('Invalid destiny value continuation.');
    assertCardReference(m,p.card); assertDestinyScope(m,s.scope,s.side,s.source,s.category);
    if (!sameCard(m,p.card) || p.card.zone!=='destiny' || m.cards[p.card.id].owner!==f.side || !alternateDestinies(m,p.card.id).length || selectedPrintedDestiny(m,p.card.id)!==undefined) throw Error('Invalid destiny value target.');
  }
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('destiny:')) {
    const p = f.action.payload as unknown as PendingDraw & PendingTotal, h = f.action.handler;
    if (!p || !sides.includes(p.side) || f.actor !== p.side || !m.cards[p.source] || typeof p.category !== 'string' || !p.category || !p.next?.handler ||
      !['destiny:cost', 'destiny:draw', 'destiny:finish', 'destiny:place', 'destiny:total-finish'].includes(h)) throw Error('Invalid pending destiny.');
    assertDestinyScope(m, p.scope, p.side, p.source, p.category);
    if (p.redraw !== undefined && (h !== 'destiny:finish' || typeof p.redraw !== 'boolean' || p.redraw && (!f.cancelled || p.draw?.substitution || p.draw?.value === null))) throw Error('Invalid destiny redraw.');
    if (h !== 'destiny:cost' && h !== 'destiny:draw' && p.modifier !== undefined && !validModifier(m, p.modifier)) throw Error('Invalid destiny modifier.');
    if (p.retain !== undefined && (typeof p.retain !== 'boolean' || p.retain && (h === 'destiny:total-finish' || p.includeTotal !== false || p.next.handler !== 'selection:drawn'))) throw Error('Invalid retained destiny.');
    if (p.reference) {assertCardReference(m, p.reference, p.draw?.card ?? undefined); if (!p.retain || p.reference.zone !== 'destiny') throw Error('Invalid destiny reference.');}
    if (p.retain && h !== 'destiny:cost' && h !== 'destiny:draw' && !!p.draw?.card !== !!p.reference) throw Error('Missing retained destiny reference.');
    if (h === 'destiny:cost' || h === 'destiny:draw') {
      const start = f.action.payload as unknown as PendingStart;
      if (start.costFailure !== undefined && !['cost-declined', 'cost-unpaid'].includes(start.costFailure) || start.costFailure && start.substitution || h === 'destiny:cost' && start.substitution || !validModifier(m, start.modifier) || start.retain && !!start.drawn && start.drawn.handler !== 'battle:planned-drawn' || typeof start.includeTotal !== 'boolean' || start.drawn !== undefined && !start.drawn?.handler || start.substitution !== undefined && !validSubstitution(m, start.substitution)) throw Error('Invalid destiny initiation.');
      continue;
    }
    const draws = h === 'destiny:total-finish' ? p.draws : [p.draw];
    if (!Array.isArray(draws) || draws.some(d => !validDraw(m, d, p.side, h === 'destiny:finish'))) throw Error('Invalid pending destiny.');
    if (h === 'destiny:total-finish') {
      if (typeof p.single !== 'boolean' || p.single && draws.length !== 1 || p.total !== null && !Number.isFinite(p.total) ||
        (p.total === null) !== !draws.some(d => d.value !== null)) throw Error('Invalid destiny total.');
    } else if (p.includeTotal !== undefined && typeof p.includeTotal !== 'boolean') throw Error('Invalid destiny completion.');
  }
}

export function assertDrawFlow(m: Match, f: DrawFlow, draw: Draw): void {
  if (!f || !sides.includes(f.side) || !m.cards[f.source] || !f.category || !f.next?.handler || typeof f.includeTotal !== 'boolean' ||
    !validModifier(m, f.modifier) || !['battle:planned-drawn','battle:weapon-drawn'].includes(f.drawn?.handler??'') || f.retain !== undefined && typeof f.retain !== 'boolean' ||
    f.retain && (f.includeTotal || f.next.handler !== 'selection:drawn') || !!draw.card !== !!f.reference) throw Error('Invalid adapted destiny draw.');
  assertDestinyScope(m, f.scope, f.side, f.source, f.category);
  if (f.reference) {assertCardReference(m, f.reference, draw.card!); if (f.reference.zone !== 'destiny') throw Error('Invalid adapted destiny reference.');}
}
