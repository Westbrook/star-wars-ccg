import {atSite, name, totalPower} from './board';
import {completeDestinyTotal, drawDestiny, validDraw, type Draw} from './destiny';
import {queueForceLoss} from './ground';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; site: string; drain: string; count?: number; power?: number; draws?: Draw[]; draw?: Draw; total?: number | null; loser?: Side | null; amount?: number};
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
  const p = r.action.payload as unknown as Payload, h = r.action.handler, side = r.actor;
  if (r.cancelled) {if (h === 'assault:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'assault:play') {
    const drain = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'ground:drain' && f.action.id === p.drain);
    if (drain?.kind !== 'resolution') throw Error('Missing Assault drain.');
    // AR Appendix B, Counter Assault (also Surprise Assault): freeze both
    // values when resolution starts, before any destiny or cancellation responses.
    // Current board helpers cover ground characters; aboard-unit and space
    // presence still need implementation before full card admission.
    p.count = atSite(m, p.site).filter(c => c.owner !== side).length;
    p.power = totalPower(m, other(side), p.site);
    p.draws = [];
    queue(m, 'finish', {card: p.card, site: p.site, drain: p.drain});
    queue(m, 'draw', p);
    if (!drain.cancelled) {drain.cancelled = true; openWindow(m, 'response', other(side), {kind: 'force-drain-cancelled', site: p.site, source: p.card});}
  } else if (h === 'assault:draw') {
    if (p.draw) {p.draws!.push(p.draw); delete p.draw;}
    if (p.draws!.length < p.count!) drawDestiny(m, side, p.card, 'assault', action('draw', p), false);
    else completeDestinyTotal(m, side, p.card, 'assault', p.draws!, action('result', p));
  } else if (h === 'assault:result') {
    // A failed set supplies no destiny total; its comparison contributes zero.
    // A zero-draw Assault is explicitly covered by AR's holosite ruling.
    const total = p.total ?? 0;
    p.loser = p.total === null && p.count! > 0 || total < p.power! ? side : total > p.power! ? other(side) : null;
    p.amount = Math.abs(total - p.power!);
    queue(m, 'loss', p);
    openWindow(m, 'response', other(side), {kind: 'assault-result', source: p.card, site: p.site, count: p.count!, power: p.power!, destiny: p.total!, loser: p.loser, amount: p.amount});
  } else if (h === 'assault:loss') {
    if (p.loser && p.amount) queueForceLoss(m, {side: p.loser, remaining: p.amount, source: p.card, site: p.site, reductionUsed: false});
  } else if (h === 'assault:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown Assault continuation.');
}
export function assertAssault(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('assault:')) {
    const p = f.action.payload as unknown as Payload, h = f.action.handler;
    if (!p || m.cards[p.card]?.blueprint !== (f.actor === 'light' ? '1_113' : '1_238') || m.cards[p.card]?.owner !== f.actor || m.cards[p.card]?.zone !== 'playing' || !m.locations.includes(p.site) || typeof p.drain !== 'string' || !['assault:play','assault:draw','assault:result','assault:loss','assault:finish'].includes(h)) throw Error('Invalid pending Assault.');
    if (['assault:draw','assault:result','assault:loss'].includes(h) && (!Number.isSafeInteger(p.count) || p.count! < 0 || p.count! > m.deckSize || !Number.isFinite(p.power) || p.power! < 0 || !Array.isArray(p.draws) || p.draws.length > p.count! || p.draws.some(d => !validDraw(m, d, f.actor)))) throw Error('Invalid Assault snapshot.');
    if (['assault:result','assault:loss'].includes(h) && p.draws!.length !== p.count) throw Error('Incomplete Assault draws.');
    if (h === 'assault:loss' && (p.total !== null && (!Number.isFinite(p.total) || p.total! < 0) || p.loser !== null && !sides.includes(p.loser!) || !Number.isSafeInteger(p.amount) || p.amount! < 0)) throw Error('Invalid Assault loss.');
  }
}
