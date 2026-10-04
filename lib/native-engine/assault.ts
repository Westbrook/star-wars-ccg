import {beginDestinySequence, assertDestinyScope} from './destiny-limits';
import {name, totalPower} from './board';
import {characterPresent, isVessel, unitsAt} from './occupancy';
import {completeDestinyTotal, drawDestiny, validDraw, type Draw} from './destiny';
import {queueForceLoss} from './ground';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {defensiveDestiny?: boolean; defensiveScope?: string; defensiveDraw?: Draw; defensiveTotal?: number | null; attackTotal?: number | null; attackDraws?: Draw[]; scope?: string; card: string; site: string; drain: string; count?: number; power?: number; draws?: Draw[]; draw?: Draw; total?: number | null; loser?: Side | null; amount?: number};
const action = (step: string, p: Payload, side?: Side): Action => ({id: 'assault:' + step + ':' + p.card,
  label: 'Play Assault', handler: 'assault:' + step, source: p.card, payload: p as unknown as Json,
  ...(side ? {payment: {[side]: 1}} : {})});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
export function assaultActions(m: Match, w: Window, side: Side): Action[] {
  const pending = m.stack.at(-2);
  if (w.timing !== 'response' || pending?.kind !== 'resolution' || pending.awaitingResponses || pending.cancelled || pending.action.handler !== 'ground:drain') return [];
  const site = (pending.action.payload as {site: string}).site;
  // Card text can cancel either player's drain, including a zero drain.
  return m.players[side].hand.filter(id => m.cards[id].blueprint === (side === 'light' ? '1_113' : '1_238')).map(card => {
    const a = action('play', {card, site, drain: pending.action.id}, side); a.label = name(m, card) + ' · cancel Force drain'; return a;
  });
}
export function assaultInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
export function assaultResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload, h = r.action.handler, side = m.cards[p.card].owner;
  if (r.cancelled) {if (h === 'assault:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'assault:play') {
    const drain = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'ground:drain' && f.action.id === p.drain);
    if (drain?.kind !== 'resolution') throw Error('Missing Assault drain.');
    // AR Appendix B, Counter Assault (also Surprise Assault): freeze both
    // values when resolution starts, before any destiny or cancellation responses.
    // Count physical cards present, independently of power contribution: an
    // unpiloted/landed vessel still counts. Enclosed crew and cargo do not;
    // exposed occupants of open vehicles do (AR pp140–141).
    p.count = unitsAt(m, p.site).filter(c => c.owner !== side &&
      (characterPresent(m, c.id) || isVessel(m, c.id) && !c.attachedTo)).length;
    p.power = totalPower(m, other(side), p.site);
    p.draws = []; p.scope = beginDestinySequence(m, side, p.card, 'assault');
    queue(m, 'finish', {card: p.card, site: p.site, drain: p.drain});
    queue(m, 'draw', p);
    if (!drain.cancelled) {drain.cancelled = true; openWindow(m, 'response', other(side), {kind: 'force-drain-cancelled', site: p.site, source: p.card});}
  } else if (h === 'assault:draw') {
    if (p.draw) {p.draws!.push(p.draw); delete p.draw;}
    if (p.draws!.length < p.count!) drawDestiny(m, side, p.card, 'assault', action('draw', p), false, 0, undefined, false, p.scope);
    else completeDestinyTotal(m, side, p.card, 'assault', p.draws!, action('result', p));
  } else if (h === 'assault:defense') {
    p.defensiveDraw = p.draw; p.defensiveTotal = p.total; p.total = p.attackTotal; p.draws = p.attackDraws;
    delete p.draw; delete p.attackTotal; delete p.attackDraws;
    queue(m, 'result', p);
  } else if (h === 'assault:result') {
    if (p.defensiveDestiny && p.defensiveTotal === undefined) {
      p.attackTotal = p.total; p.attackDraws = p.draws;
      p.defensiveScope = beginDestinySequence(m, other(side), p.card, 'assault-defense');
      drawDestiny(m, other(side), p.card, 'assault-defense', action('defense', p), true, 0, undefined, false, p.defensiveScope); return;
    }
    // A failed set supplies no destiny total; its comparison contributes zero.
    // A zero-draw Assault is explicitly covered by AR's holosite ruling.
    const total = p.total ?? 0, defense = p.power! + (p.defensiveTotal ?? 0);
    p.loser = p.total === null && p.count! > 0 || total < defense ? side : total > defense ? other(side) : null;
    p.amount = Math.abs(total - defense);
    queue(m, 'loss', p);
    openWindow(m, 'response', other(side), {kind: 'assault-result', source: p.card, site: p.site, count: p.count!, power: p.power!, destiny: p.total!, loser: p.loser, amount: p.amount, ...(p.defensiveDestiny ? {defensiveDestiny: p.defensiveTotal!, defensiveTotal: defense} : {})});
  } else if (h === 'assault:loss') {
    if (p.loser && p.amount) queueForceLoss(m, {side: p.loser, remaining: p.amount, source: p.card, site: p.site, reductionUsed: false});
  } else if (h === 'assault:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown Assault continuation.');
}
export function assertAssault(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('assault:')) {
    const p = f.action.payload as unknown as Payload, h = f.action.handler, owner = m.cards[p?.card]?.owner;
    if (!p || m.cards[p.card]?.blueprint !== (owner === 'light' ? '1_113' : '1_238') || f.actor !== (h === 'assault:defense' ? other(owner) : owner) || m.cards[p.card]?.zone !== 'playing' || !m.locations.includes(p.site) || typeof p.drain !== 'string' || !['assault:play','assault:draw','assault:result','assault:defense','assault:loss','assault:finish'].includes(h)) throw Error('Invalid pending Assault.');
    assertDestinyScope(m, p.scope, owner, p.card, 'assault');
    if (p.defensiveDestiny !== undefined && p.defensiveDestiny !== true) throw Error('Invalid defensive destiny flag.');
    assertDestinyScope(m, p.defensiveScope, other(owner), p.card, 'assault-defense');
    if (p.defensiveTotal !== undefined && (!p.defensiveDestiny || p.defensiveTotal !== null && (!Number.isFinite(p.defensiveTotal) || p.defensiveTotal < 0) || !p.defensiveDraw || !validDraw(m, p.defensiveDraw, other(owner)) || p.defensiveDraw.value !== p.defensiveTotal)) throw Error('Invalid defensive Assault destiny.');
    if (h === 'assault:defense' && (!p.defensiveDestiny || !p.defensiveScope || !Number.isSafeInteger(p.count) || p.count! < 0 || p.count! > m.deckSize || !Number.isFinite(p.power) || p.power! < 0 || p.total !== null && (!Number.isFinite(p.total) || p.total! < 0) || !p.draw || !validDraw(m, p.draw, other(owner)) || !Array.isArray(p.attackDraws) || p.attackDraws.length !== p.count || p.attackDraws.some(d => !validDraw(m, d, owner)) || p.attackTotal !== null && (!Number.isFinite(p.attackTotal) || p.attackTotal! < 0))) throw Error('Invalid defensive Assault continuation.');
    if (['assault:draw','assault:result','assault:loss'].includes(h) && (!Number.isSafeInteger(p.count) || p.count! < 0 || p.count! > m.deckSize || !Number.isFinite(p.power) || p.power! < 0 || !Array.isArray(p.draws) || p.draws.length > p.count! || p.draws.some(d => !validDraw(m, d, f.actor)))) throw Error('Invalid Assault snapshot.');
    if (['assault:result','assault:loss'].includes(h) && p.draws!.length !== p.count) throw Error('Incomplete Assault draws.');
    if (h === 'assault:loss' && (p.total !== null && (!Number.isFinite(p.total) || p.total! < 0) || p.loser !== null && !sides.includes(p.loser!) || !Number.isSafeInteger(p.amount) || p.amount! < 0)) throw Error('Invalid Assault loss.');
  }
}
