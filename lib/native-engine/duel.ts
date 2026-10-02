import {adjacent, power} from './board';
import {completeDestinyTotal, drawDestiny, type Draw} from './destiny';
import {queueForceLoss} from './ground';
import {retrieve} from './retrieval';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {markRunPlayed, travelState} from './travel';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

export type Duel = {
  source: string; site: string; characters: Record<Side, string>;
  stage: 'begin' | 'draws' | 'result' | 'losses' | 'end' | 'complete';
  draws: Record<Side, Draw[]>; destinyTotals?: Record<Side, number | null>; total: Record<Side, number | null>;
  // Null is an unresolved rules amount, never zero Force loss. Such a result
  // cannot be applied or admitted to public matches until its ruling is verified.
  winner: Side | null; difference: number | null; interrupted: boolean;
};
type Payload = {card: string; vader?: string; luke?: string; site?: string; side?: Side; draw?: Draw; target?: string; total?: number | null};
type Usage = {turn: number; obsession: boolean};
export const duel = (m: Match) => m.data.duel as Duel | undefined;
const usage = (m: Match): Usage => {
  const s = m.data.duelUsage as Usage | undefined;
  return s?.turn === m.turn.number ? s : {turn: m.turn.number, obsession: false};
};
const action = (step: string, p: Payload, label = step): Action => ({id: 'duel:' + step + ':' + p.card + (p.target ? ':' + p.target : ''), label, handler: 'duel:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload, actor: Side = 'dark') => m.stack.push({kind: 'resolution', actor, cancelled: false, action: action(step, p)});
const together = (m: Match, d: Pick<Duel, 'characters' | 'site'>) => sides.every(side => m.cards[d.characters[side]]?.zone === 'table' && m.cards[d.characters[side]].location === d.site);
function boundary(m: Match, step: string, kind: string, p: Payload, priority: Side = 'light'): void {
  queue(m, step, p); openWindow(m, 'response', priority, {kind, source: p.card});
}
function end(m: Match, p: Payload, interrupted = false): void {
  const d = duel(m)!; d.stage = 'end'; d.interrupted = interrupted;
  boundary(m, 'complete', 'duel-ending', p);
}
export function duelActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'response') return [];
  const result: Action[] = [], e = w.event as {kind?: string; card?: string; cards?: string[]; from?: string; site?: string} | undefined;
  const d = duel(m), parent = m.stack.at(-2);
  if (side === 'light' && !travelState(m).runPlayed && parent?.kind === 'resolution' && parent.action.handler === 'duel:obsession' && !parent.cancelled && !parent.awaitingResponses)
    for (const card of m.players.light.hand.filter(id => m.cards[id].blueprint === '101_3'))
      result.push(action('cancel', {card, target: (parent.action.payload as Payload).card}, 'Run Luke, Run! · cancel Vader’s Obsession'));
  if (side !== 'dark' || m.turn.side !== side || m.turn.phase !== 'move' || usage(m).obsession || d && d.stage !== 'complete' ||
      e?.kind !== 'moved' || !e.from || !e.site || !adjacent(m, e.from, e.site)) return result;
  for (const vader of e.cards ?? (e.card ? [e.card] : [])) {
    if (m.cards[vader]?.blueprint !== '101_5' || m.cards[vader].owner !== side || m.cards[vader].zone !== 'table' || m.cards[vader].location !== e.site) continue;
    for (const luke of Object.values(m.cards).filter(c => c.blueprint === '101_2' && c.owner === 'light' && c.zone === 'table' && c.location === e.site))
      for (const card of m.players.dark.hand.filter(id => m.cards[id].blueprint === '101_6'))
        result.push(action('obsession', {card, vader, luke: luke.id, site: e.site}, 'Vader’s Obsession · duel Luke'));
  }
  return result;
}
export function duelInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  moveCard(m, p.card, 'playing');
  if (r.action.handler === 'duel:obsession') m.data.duelUsage = {turn: m.turn.number, obsession: true};
  else if (r.action.handler === 'duel:cancel') markRunPlayed(m);
  else throw Error('Invalid duel initiation.');
}
export function duelResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload, h = r.action.handler;
  if (r.cancelled) {
    if (['duel:obsession', 'duel:cancel'].includes(h) && m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost');
    else if (h === 'duel:lose-character') end(m, p);
    return;
  }
  if (h === 'duel:cancel') {
    const pending = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'duel:obsession' && (f.action.payload as Payload).card === p.target);
    if (pending?.kind === 'resolution') {
      pending.cancelled = true; moveCard(m, p.target!, 'lost');
      queue(m, 'cancel-cleanup', p, 'light');
      openWindow(m, 'response', 'dark', {kind: 'interrupt-canceled', card: p.target!, source: p.card});
    } else moveCard(m, p.card, 'lost');
    return;
  }
  if (h === 'duel:cancel-cleanup') {moveCard(m, p.card, 'lost'); return;}
  if (h === 'duel:obsession') {
    queue(m, 'cleanup', {card: p.card});
    const d: Duel = {source: p.card, site: p.site!, characters: {dark: p.vader!, light: p.luke!}, stage: 'begin', draws: {dark: [], light: []}, total: {dark: null, light: null}, winner: null, difference: 0, interrupted: false};
    if (!together(m, d)) return;
    m.data.duel = d as unknown as Json;
    boundary(m, 'draws-before', 'duel-initiated', p); return;
  }
  if (h === 'duel:cleanup') {moveCard(m, p.card, 'lost'); return;}
  const d = duel(m); if (!d || d.source !== p.card) throw Error('Missing duel.');
  // Once results are determined, retrieval/losses complete even when a
  // participant leaves. Before that boundary, both must remain at the site.
  if (['begin', 'draws'].includes(d.stage) && !together(m, d)) {end(m, p, true); return;}
  if (h === 'duel:draws-before') {d.stage = 'draws'; boundary(m, 'draw-next', 'duel-destiny-before', {...p, side: 'dark'}, 'dark');}
  else if (h === 'duel:draw-next') {
    const side = p.side!;
    if (p.draw) d.draws[side].push(p.draw);
    const next: Payload = {card: p.card, side};
    if (d.draws[side].length < 2) drawDestiny(m, side, p.card, 'duel', action('draw-next', next), false);
    else completeDestinyTotal(m, side, p.card, 'duel', d.draws[side], action('player-total', next));
  } else if (h === 'duel:player-total') {
    (d.destinyTotals ??= {dark: null, light: null})[p.side!] = p.total!;
    if (p.side === 'dark') boundary(m, 'draw-next', 'duel-player-destiny-complete', {card: p.card, side: 'light'});
    else boundary(m, 'totals', 'duel-destiny-complete', {card: p.card});
  } else if (h === 'duel:totals') {
    if (!d.destinyTotals) throw Error('Missing duel destiny totals.');
    const successful = (side: Side) => d.destinyTotals![side] !== null;
    for (const side of sides) d.total[side] = power(m, d.characters[side]) + (d.destinyTotals?.[side] ?? 0);
    // AR Failed Destiny Draws: no successful draw loses the action, even
    // against lower power. When both fail there is neither winner nor loser.
    d.winner = !successful('dark') ? successful('light') ? 'light' : null : !successful('light') ? 'dark'
      : d.total.dark! === d.total.light! ? null : d.total.dark! > d.total.light! ? 'dark' : 'light';
    // The AR determines the winner when exactly one side fails, but the pinned
    // GEMP result contradicts that rule. Do not invent the Force-difference
    // amount from a nonexistent destiny total; keep this case explicitly gated.
    d.difference = successful('dark') !== successful('light') ? null : d.winner ? Math.round(Math.abs(d.total.dark! - d.total.light!)) : 0;
    d.stage = 'result'; boundary(m, 'retrieve', 'duel-result', {card: p.card});
  } else if (h === 'duel:retrieve') {
    if (d.difference === null) throw Error('Unverified rule: Obsession Force difference after a failed duel destiny.');
    d.stage = 'losses'; queue(m, 'force-loss', p);
    if (d.winner) retrieve(m, d.winner, p.card, d.difference);
  } else if (h === 'duel:force-loss') {
    queue(m, 'character-loss', p);
    if (d.winner && d.difference) queueForceLoss(m, {side: other(d.winner), remaining: d.difference, source: p.card, site: d.site, reductionUsed: false});
  } else if (h === 'duel:character-loss') {
    if (!d.winner || m.cards[d.characters[other(d.winner)]].zone !== 'table') {end(m, p); return;}
    const target = d.characters[other(d.winner)];
    queue(m, 'lose-character', {card: p.card, target});
    openWindow(m, 'response', 'light', {kind: 'about-to-lose', card: target, source: p.card, site: d.site, cause: 'duel'});
  } else if (h === 'duel:lose-character') {
    if (m.cards[p.target!].zone !== 'table') {end(m, p); return;}
    queue(m, 'lost', p); loseFromTable(m, [p.target!]);
  } else if (h === 'duel:lost') {
    queue(m, 'end', p); openWindow(m, 'response', 'light', {kind: 'character-lost', card: p.target!, source: p.card, site: d.site, cause: 'duel'});
  }
  else if (h === 'duel:end') end(m, p);
  else if (h === 'duel:complete') {d.stage = 'complete'; openWindow(m, 'response', 'light', {kind: 'duel-ended', source: p.card, winner: d.winner});}
  else throw Error('Unknown duel continuation.');
}
export function duelView(m: Match): Json {return {duel: duel(m) ? structuredClone(duel(m)!) as unknown as Json : null};}
export function assertDuel(m: Match): void {
  const u = m.data.duelUsage as Usage | undefined;
  if (u && (!Number.isSafeInteger(u.turn) || u.turn < 1 || u.turn > m.turn.number || typeof u.obsession !== 'boolean')) throw Error('Invalid duel usage.');
  const d = duel(m);
  if (d) {
    if (m.cards[d.source]?.blueprint !== '101_6' || !m.locations.includes(d.site) || !['begin','draws','result','losses','end','complete'].includes(d.stage) || typeof d.interrupted !== 'boolean' || d.winner !== null && !sides.includes(d.winner) || d.difference !== null && (!Number.isSafeInteger(d.difference) || d.difference < 0)) throw Error('Invalid duel state.');
    for (const side of sides) if (m.cards[d.characters[side]]?.owner !== side || !Array.isArray(d.draws[side]) || d.draws[side].length > 2 || d.draws[side].some(x => x.card !== null && m.cards[x.card]?.owner !== side || x.value !== null && (!Number.isFinite(x.value) || x.value < 0) || x.card === null && x.value !== null) || d.total[side] !== null && (!Number.isFinite(d.total[side]) || d.total[side]! < 0)) throw Error('Invalid duel total.');
    if (d.destinyTotals && sides.some(side => d.destinyTotals![side] !== null && (!Number.isFinite(d.destinyTotals![side]) || d.destinyTotals![side]! < 0))) throw Error('Invalid duel destiny totals.');
    if (m.cards[d.characters.dark].blueprint !== '101_5' || m.cards[d.characters.light].blueprint !== '101_2') throw Error('Invalid duel participants.');
    if (d.difference === null && (d.stage !== 'result' || d.draws.dark.some(x => x.value !== null) === d.draws.light.some(x => x.value !== null))) throw Error('Invalid unverified duel amount.');
    if (['result', 'losses'].includes(d.stage) && sides.some(side => d.draws[side].length !== 2 || d.total[side] === null)) throw Error('Incomplete duel result.');
  }
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('duel:')) {
    const p = f.action.payload as unknown as Payload;
    const cancel = ['duel:cancel', 'duel:cancel-cleanup'].includes(f.action.handler);
    if (!p || !m.cards[p.card] || m.cards[p.card].zone !== 'playing' && !(f.action.handler === 'duel:obsession' && f.cancelled && m.cards[p.card].zone === 'lost')) throw Error('Invalid duel continuation.');
    if (cancel && (m.cards[p.card].blueprint !== '101_3' || m.cards[p.target!]?.blueprint !== '101_6' || f.actor !== 'light')) throw Error('Invalid duel cancellation.');
    if (!cancel && m.cards[p.card].blueprint !== '101_6') throw Error('Invalid duel source.');
    if (f.action.handler === 'duel:obsession' && (m.cards[p.vader!]?.blueprint !== '101_5' || m.cards[p.luke!]?.blueprint !== '101_2' || !m.locations.includes(p.site!))) throw Error('Invalid duel participants.');
    if (f.action.handler === 'duel:draw-next' && !sides.includes(p.side!)) throw Error('Invalid duel draw seat.');
  }
}
