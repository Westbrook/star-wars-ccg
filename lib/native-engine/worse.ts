import {battle} from './battle';
import type {Loss} from './ground';
import {openWindow} from './runtime';
import {moveCard} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

type Payload = {card: string; amount: number; target?: string; targetIndex?: number; lossIndex?: number; battleSite?: string};
const action = (step: string, p: Payload): Action => ({id: 'worse:' + step + ':' + p.card + ':' + p.amount, label: step === 'cancel' ? 'It’s Worse · cancel and add ' + p.amount + ' Force loss' : 'It’s Worse · increase battle loss by 1', handler: 'worse:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: 'dark', action: action(step, p), cancelled: false});
function lossAt(m: Match, index: number | undefined): Loss | null {
  if (index === undefined) return null;
  const f = m.stack[index];
  return f?.kind === 'resolution' && f.action.handler === 'ground:force-loss' && !f.cancelled && (f.action.payload as Loss).side === 'light' ? f.action.payload as Loss : null;
}
function targetAt(m: Match, p: Payload): Resolution | null {
  const r = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex];
  return r?.kind === 'resolution' && ['ground:reduce','battle:reduce'].includes(r.action.handler) && r.actor === 'light' && r.action.source === p.target && !r.awaitingResponses && !r.cancelled && m.cards[p.target!]?.zone === 'playing' ? r : null;
}
export function worseActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'response' || side !== 'dark') return [];
  const cards = m.players.dark.hand.filter(id => m.cards[id].blueprint === '1_252'), actions: Action[] = [], b = battle(m), parent = m.stack.at(-2);
  if (parent?.kind === 'resolution' && ['ground:reduce','battle:reduce'].includes(parent.action.handler) && !parent.awaitingResponses && !parent.cancelled && parent.actor === 'light' && m.cards[parent.action.source!]?.blueprint === '1_90' && m.cards[parent.action.source!].zone === 'playing') {
    const lossIndex = parent.action.handler === 'ground:reduce' ? (parent.action.payload as {lossIndex: number}).lossIndex : undefined;
    if (lossAt(m, lossIndex) || lossIndex === undefined && b?.stage === 'damage') for (const card of cards) for (let amount = 0; amount <= m.players.dark.force.length; amount++)
      actions.push({...action('cancel', {card, amount, target: parent.action.source!, targetIndex: m.stack.length - 2, ...(lossIndex === undefined ? {battleSite: b!.site} : {lossIndex})}), payment: {dark: amount}});
  }
  const e = w.event as {kind?: string; side?: string; source?: string} | undefined;
  if (e?.kind === 'force-lost' && e.side === 'light' && e.source === 'battle' && b?.stage === 'damage')
    for (const card of cards) actions.push(action('battle', {card, amount: 1, battleSite: b.site}));
  return actions;
}
export function worseInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
export function worseResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (r.cancelled) {if (['worse:cancel','worse:battle'].includes(h)) moveCard(m, p.card, 'lost'); return;}
  if (h === 'worse:cancel') {
    queue(m, 'finish', p);
    const target = targetAt(m, p);
    if (!target) return;
    target.cancelled = true;
    // Cancellation removes the Interrupt now. Its original continuation must
    // not remove it a second time after cancellation-result responses.
    moveCard(m, p.target!, 'lost');
    queue(m, 'increase', p);
    openWindow(m, 'response', 'light', {kind: 'card-canceled', card: p.target!, source: p.card});
  } else if (h === 'worse:battle') {queue(m, 'finish', p); queue(m, 'increase', p);}
  else if (h === 'worse:increase') {
    if (!p.amount) return;
    const loss = lossAt(m, p.lossIndex), b = battle(m);
    // AR pp28–29/147: modify the original loss, never initiate a new one.
    // Same-title increases are noncumulative; the first modifier stays in effect.
    if (loss && loss.worseIncrease === undefined) {loss.remaining += p.amount; loss.worseIncrease = p.amount;}
    else if (p.lossIndex === undefined && b?.stage === 'damage' && b.site === p.battleSite && b.worseIncrease === undefined) {b.damage.light += p.amount; b.worseIncrease = p.amount;}
  } else if (h === 'worse:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown It’s Worse continuation.');
}
export function assertWorse(m: Match): void {
  for (let index = 0; index < m.stack.length; index++) {
    const f = m.stack[index];
    if (f.kind !== 'resolution' || !f.action.handler.startsWith('worse:')) continue;
    const p = f.action.payload as Payload;
    if (!p || m.cards[p.card]?.blueprint !== '1_252' || m.cards[p.card].owner !== 'dark' || m.cards[p.card].zone !== 'playing' || f.actor !== 'dark' || !['worse:cancel','worse:battle','worse:increase','worse:finish'].includes(f.action.handler) || !Number.isSafeInteger(p.amount) || p.amount < 0) throw Error('Invalid It’s Worse continuation.');
    if (p.target !== undefined) {
      const r = m.stack[p.targetIndex!];
      if (!Number.isSafeInteger(p.targetIndex) || p.targetIndex! < 0 || p.targetIndex! >= index || r?.kind !== 'resolution' || r.action.source !== p.target || !['ground:reduce','battle:reduce'].includes(r.action.handler) || m.cards[p.target]?.blueprint !== '1_90' || r.actor !== 'light') throw Error('Invalid cancellation target.');
      if (r.action.handler === 'ground:reduce' ? p.lossIndex !== (r.action.payload as {lossIndex: number}).lossIndex : p.lossIndex !== undefined) throw Error('Cancellation changed its original loss.');
    } else if (p.amount !== 1 || f.action.handler === 'worse:cancel') throw Error('Invalid battle loss response.');
    if (p.lossIndex !== undefined) {
      const loss = m.stack[p.lossIndex];
      if (!Number.isSafeInteger(p.lossIndex) || p.lossIndex < 0 || p.lossIndex >= (p.targetIndex ?? index) || loss?.kind !== 'resolution' || loss.action.handler !== 'ground:force-loss' || (loss.action.payload as Loss).side !== 'light' || p.battleSite !== undefined) throw Error('Invalid modified Force loss.');
    } else if (!p.battleSite || battle(m)?.site !== p.battleSite) throw Error('Invalid modified battle damage.');
  }
}
