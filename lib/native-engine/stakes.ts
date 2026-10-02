import {battle, members} from './battle';
import {name, totalPower} from './board';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; site: string; factor: number; target?: string; targetIndex?: number; boost?: number; han?: string};
const chances = {light: '1_77', dark: '1_279'};
const action = (step: string, p: Payload, label: string): Action => ({id: 'stakes:' + step + ':' + p.card + (p.han ? ':' + p.han : ''), label, handler: 'stakes:' + step, source: p.card, payload: p as unknown as Json});
const participatingPower = (m: Match, side: Side) => totalPower(m, side, battle(m)!.site, side !== battle(m)!.initiator, id => members(m, side).includes(id));
const hans = (m: Match) => [...members(m, 'light'), ...members(m, 'dark')].filter(id => m.cards[id].blueprint === '1_11');
function targetAt(m: Match, p: Payload): Resolution | undefined {
  const r = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex];
  return r?.kind === 'resolution' && ['stakes:play','stakes:boost'].includes(r.action.handler) && !r.cancelled && !r.awaitingResponses && r.action.source === p.target && m.cards[p.target!]?.zone === 'playing' && m.cards[p.target!].blueprint === chances[other(m.cards[p.card].owner)] ? r : undefined;
}
export function stakesActions(m: Match, w: Window, side: Side): Action[] {
  const b = battle(m), parent = m.stack.at(-2), actions: Action[] = [];
  if (w.timing !== 'response' || !b || b.stage !== 'begin' || parent?.kind !== 'resolution' || parent.cancelled || parent.awaitingResponses) return actions;
  const cards = m.players[side].hand.filter(id => m.cards[id].blueprint === chances[side]);
  if (parent.action.handler === 'battle:begin') {
    if (side !== b.initiator) for (const card of cards) actions.push(action('play', {card, site: b.site, factor: 3}, name(m, card) + ' · triple eventual loser’s battle damage'));
    if (side === 'light' && b.initiator === side && participatingPower(m, side) < participatingPower(m, 'dark')) {
      const targets = hans(m);
      for (const card of m.players.light.hand.filter(id => m.cards[id].blueprint === '1_91')) {
        if (targets.length) for (const han of targets) actions.push(action('feeling', {card, site: b.site, factor: 3, han}, name(m, card) + ' · triple opponent’s battle damage'));
        else actions.push(action('feeling', {card, site: b.site, factor: 2}, name(m, card) + ' · double opponent’s battle damage'));
      }
    }
  }
  for (const card of cards) {
    const p: Payload = {card, site: b.site, factor: 3, target: parent.action.source, targetIndex: m.stack.length - 2};
    if (targetAt(m, p)) actions.push(action('boost', p, name(m, card) + ' · triple ' + name(m, p.target!)));
  }
  return actions;
}
export function stakesInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
export function stakesResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, b = battle(m), kind = r.action.handler;
  if (!r.cancelled && b?.site === p.site && b.stage === 'begin') {
    const factor = p.factor * (p.boost ?? 1);
    if (!Number.isSafeInteger(factor)) throw Error('Battle multiplier exceeds exact supported arithmetic.');
    if (kind === 'stakes:boost') {
      const target = targetAt(m, p);
      // Multiple copies modify the same pending result only once. GEMP ignores
      // a boost of the booster itself; the printed recursive-result reading
      // disagrees. Preserve the stack and reject atomically until adjudicated.
      if (target) {
        const payload = target.action.payload as Payload;
        if (payload.boost === undefined && p.boost !== undefined) throw Error('Nested Chances result needs verified rule adjudication.');
        payload.boost ??= factor;
      }
    } else if (kind === 'stakes:play' || kind === 'stakes:feeling') {
      if (!p.han || hans(m).includes(p.han)) {
        const modifiers = b.damageMultipliers ??= [];
        if (!modifiers.some(v => m.cards[v.card].blueprint === m.cards[p.card].blueprint)) modifiers.push({card: p.card, factor, side: kind === 'stakes:feeling' ? 'dark' : 'both'});
      }
    } else throw Error('Unknown battle stakes effect.');
  }
  if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, !r.cancelled && kind === 'stakes:feeling' ? 'used' : 'lost');
}
export function assertStakes(m: Match): void {
  const b = battle(m), seen = new Set<string>();
  for (const v of b?.damageMultipliers ?? []) {
    const bp = m.cards[v.card]?.blueprint;
    if (!bp || seen.has(bp) || (bp === '1_91' ? v.side !== 'dark' || ![2,3].includes(v.factor) : !Object.values(chances).includes(bp) || v.side !== 'both' || ![3,9].includes(v.factor))) throw Error('Invalid battle multiplier.');
    seen.add(bp);
  }
  if (b?.damageLedger) for (const side of ['light','dark'] as const) {
    const expected = (b.damageMultipliers ?? []).filter(v => v.side === 'both' || v.side === side).reduce((n, v) => n * v.factor, 1);
    if ((b.damageLedger[side].multiplier ?? 1) !== expected) throw Error('Inconsistent battle multiplier ledger.');
  }
  for (let index = 0; index < m.stack.length; index++) {
    const r = m.stack[index]; if (r.kind !== 'resolution' || !r.action.handler.startsWith('stakes:')) continue;
    const p = r.action.payload as Payload, kind = r.action.handler;
    if (!p || !b || p.site !== b.site || m.cards[p.card]?.owner !== r.actor || m.cards[p.card].zone !== 'playing' || r.action.source !== p.card || !['stakes:play','stakes:boost','stakes:feeling'].includes(kind)) throw Error('Invalid battle stakes continuation.');
    if (kind === 'stakes:feeling') {
      if (r.actor !== 'light' || m.cards[p.card].blueprint !== '1_91' || p.factor !== (p.han ? 3 : 2) || p.han && m.cards[p.han]?.blueprint !== '1_11' || p.boost !== undefined || p.target !== undefined || p.targetIndex !== undefined) throw Error('Invalid Bad Feeling target.');
    } else {
      if (m.cards[p.card].blueprint !== chances[r.actor] || p.factor !== 3 || p.han !== undefined || p.boost !== undefined && p.boost !== 3) throw Error('Invalid Chances multiplier.');
      if (kind === 'stakes:boost') {
        const target = m.stack[p.targetIndex!];
        if (!Number.isSafeInteger(p.targetIndex) || p.targetIndex! < 0 || p.targetIndex! >= index || target?.kind !== 'resolution' || !['stakes:play','stakes:boost'].includes(target.action.handler) || target.action.source !== p.target || m.cards[p.target!]?.blueprint !== chances[other(r.actor)]) throw Error('Invalid Chances response target.');
      } else if (p.target !== undefined || p.targetIndex !== undefined) throw Error('Unexpected Chances target.');
    }
  }
}
