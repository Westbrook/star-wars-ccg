import {printed, weaponDrawBonus} from './board';
import {moveCard, moveTop} from './state';
import {openWindow} from './runtime';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side} from './types';
export type Draw = {card: string | null; value: number | null};
type Context = {next: Action; side: Side; source: string; category: string};
type Modifier = number | {weapon: string};
type PendingStart = Context & {includeTotal: boolean; modifier: Modifier; drawn?: Action};
const validModifier = (m: Match, modifier: Modifier) => typeof modifier === 'number' ? Number.isFinite(modifier) : !!modifier && typeof modifier.weapon === 'string' && !!m.cards[modifier.weapon];
type PendingDraw = Context & {draw: Draw; includeTotal?: boolean};
type PendingTotal = Context & {draws: Draw[]; total: number | null; single: boolean};
const queue = (m: Match, step: string, p: PendingStart | PendingDraw | PendingTotal) => m.stack.push({kind: 'resolution', actor: p.side, cancelled: false,
  action: {id: 'destiny-' + step + ':' + (m.serial + 1), label: 'Resolve destiny', handler: 'destiny:' + step, payload: p as unknown as Json}});
const dispatch = (m: Match, p: Context, result: Record<string, Json>) => m.stack.push({kind: 'resolution', actor: p.side, cancelled: false,
  action: {...p.next, payload: {...p.next.payload as Record<string, Json>, ...result}}});

/** Individual draw completion precedes Used placement. A canceled/nonexistent
 * draw has no completed-draw trigger, but its physical card still gets cleanup. */
export function completeDestinyDraw(m: Match, side: Side, source: string, category: string, draw: Draw, next: Action, includeTotal = true): void {
  const p: PendingDraw = {side, source, category, next, includeTotal, draw: {...draw, value: draw.value === null ? null : Math.max(0, draw.value)}};
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
export function drawDestiny(m: Match, side: Side, source: string, category: string, next: Action, includeTotal = true, modifier: Modifier = 0, drawn?: Action): void {
  if (!validModifier(m, modifier)) throw Error('Invalid destiny draw modifier.');
  queue(m, 'draw', {next, side, source, category, includeTotal, modifier, ...(drawn ? {drawn} : {})});
  // An empty Reserve cannot trigger "about to draw" text (AR pp10,32).
  // Do not capture its top card: responses can change the deck before reveal.
  if (m.players[side].reserve.length) openWindow(m, 'response', other(side), {kind: 'about-to-draw-destiny', category, source, side});
}
export function resolveDestiny(m: Match, r: Resolution): void {
  if (r.action.handler === 'destiny:draw') {
    const p = r.action.payload as unknown as PendingStart;
    const card = !r.cancelled && m.players[p.side].reserve.length ? moveTop(m, p.side, 'reserve', 'destiny') : null;
    const modifier = typeof p.modifier === 'number' ? p.modifier : weaponDrawBonus(m, p.modifier.weapon);
    const draw: Draw = {card, value: card ? printed(m, card, 'destiny') + modifier : null};
    // Battle adapters preserve their public events and redraw protocol while
    // sharing the same before-draw boundary and physical draw operation.
    if (p.drawn) dispatch(m, {...p, next: p.drawn}, {draw: draw as unknown as Json});
    else {
      queue(m, 'finish', {...p, draw});
      openWindow(m, 'response', other(p.side), {kind: card ? 'destiny-drawn' : 'destiny-failed', category: p.category, source: p.source, side: p.side, card});
    }
    return;
  }
  if (r.action.handler === 'destiny:total-finish') {
    const p = r.action.payload as unknown as PendingTotal;
    const total = p.total === null ? null : Math.max(0, p.total);
    dispatch(m, p, {draws: p.draws as unknown as Json, total,
      ...(p.single ? {draw: {card: p.draws[0].card, value: total}} : {})});
    return;
  }
  const p = r.action.payload as unknown as PendingDraw;
  if (r.action.handler === 'destiny:finish') {
    completeDestinyDraw(m, p.side, p.source, p.category, r.cancelled ? {...p.draw, value: null} : p.draw, p.next, p.includeTotal);
  } else if (r.action.handler === 'destiny:place') {
    // A response can relocate the physical card without erasing its destiny
    // value. Only cards still in the unresolved zone are placed on Used.
    if (p.draw.card && m.cards[p.draw.card]?.zone === 'destiny') moveCard(m, p.draw.card, 'used');
    if (p.includeTotal !== false) completeDestinyTotal(m, p.side, p.source, p.category, [p.draw], p.next, 0, true);
    else dispatch(m, p, {draw: p.draw as unknown as Json});
  } else throw Error('Unknown destiny continuation.');
}

export function assertDestiny(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('destiny:')) {
    const p = f.action.payload as unknown as PendingDraw & PendingTotal, h = f.action.handler;
    if (!p || !sides.includes(p.side) || f.actor !== p.side || !m.cards[p.source] || typeof p.category !== 'string' || !p.category || !p.next?.handler ||
      !['destiny:draw', 'destiny:finish', 'destiny:place', 'destiny:total-finish'].includes(h)) throw Error('Invalid pending destiny.');
    if (h === 'destiny:draw') {
      const start = f.action.payload as unknown as PendingStart;
      if (!validModifier(m, start.modifier) || typeof start.includeTotal !== 'boolean' || start.drawn !== undefined && !start.drawn?.handler) throw Error('Invalid destiny initiation.');
      continue;
    }
    const draws = h === 'destiny:total-finish' ? p.draws : [p.draw];
    if (!Array.isArray(draws) || draws.some(d => !d || d.card !== null && m.cards[d.card]?.owner !== p.side ||
      d.value !== null && (!Number.isFinite(d.value) || h !== 'destiny:finish' && d.value < 0) || d.card === null && d.value !== null)) throw Error('Invalid pending destiny.');
    if (h === 'destiny:total-finish') {
      if (typeof p.single !== 'boolean' || p.single && draws.length !== 1 || p.total !== null && !Number.isFinite(p.total) ||
        (p.total === null) !== !draws.some(d => d.value !== null)) throw Error('Invalid destiny total.');
    } else if (p.includeTotal !== undefined && typeof p.includeTotal !== 'boolean') throw Error('Invalid destiny completion.');
  }
}
