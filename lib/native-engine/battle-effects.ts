import {locationAbility} from './location-ability';
import {abilityForBattleDestiny, pilotAtSite} from './ability';
import {battle, members, participatingAbility} from './battle';
import {name} from './board';
import {referenceCard, sameCard, assertCardReference, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {openWindow, type RequiredAction} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

export type AbilityTrade = {source: CardReference; side: Side; amount: number; applied: boolean};
type Payload = {card: string; amount?: number; site?: string; trade?: number; reference?: CardReference};
const effectCards = ['1_53', '1_225', '4_37'];
const powerEffect = (m: Match, id: string) => ['1_53', '1_225'].includes(m.cards[id]?.blueprint);
function action(step: string, p: Payload, label: string): Action {
  return {id: 'battle-effect:' + step + ':' + p.card + (p.amount === undefined ? '' : ':' + p.amount) +
    (step === 'cancel' ? ':' + p.reference?.version : ''), label, handler: 'battle-effect:' + step,
    source: p.card, payload: p as unknown as Json};
}
export const tradedPower = (m: Match, side: Side): number => (battle(m)?.abilityTrades ?? [])
  .filter(t => t.side === side && t.applied).reduce((n, t) => n + t.amount, 0);
/** Spending ability changes only the battle-destiny total. Presence, weapon
 * defense and other ability queries continue to use ordinary current ability. */
export const battleAbility = (m: Match, side: Side): number => battle(m) ? locationAbility(m, side, battle(m)!.site,
  members(m, side).reduce((n, id) => n + abilityForBattleDestiny(m, id), 0), -tradedPower(m, side)) : 0;
const scrambleExpires = (m: Match, id: string) => !Object.values(m.cards)
  .some(c => c.owner !== m.cards[id].owner && pilotAtSite(m, c.id));

export function battleEffectActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [];
  if (w.timing === 'phase' && m.turn.phase === 'deploy' && m.turn.side === side) {
    for (const card of m.players[side].hand.filter(id => effectCards.includes(m.cards[id].blueprint)))
      actions.push(action('deploy', {card}, 'Deploy ' + name(m, card)));
  }
  const b = battle(m);
  if (w.timing === 'response' && (w.event as {kind?: string})?.kind === 'battle-weapons' && b?.stage === 'weapons') {
    const max = Math.min(Math.floor(participatingAbility(m, side)), m.players[side].force.length);
    for (const c of Object.values(m.cards).filter(c => c.zone === 'table' && c.owner === side && powerEffect(m, c.id) &&
      !b.abilityTrades?.some(t => t.source.id === c.id && sameCard(m, t.source)))) {
      for (let amount = 1; amount <= max; amount++) {
        const a = action('trade', {card: c.id, amount, site: b.site}, name(m, c.id) + ' · use ' + amount +
          ' Force for +' + amount + ' power (−' + amount + ' ability for battle destiny)');
        // The card action has no response step after its costs. Individual
        // Force-use responses still settle before the result is applied.
        a.payment = {[side]: amount}; a.unrespondable = true; actions.push(a);
      }
    }
  }
  return actions;
}
export function battleEffectAutomatic(m: Match, _w: Window): RequiredAction[] {
  // Vader and excluded pilots still prevent cancellation. The restriction on
  // applying ability uses a narrower "present at" query in ability.ts.
  return Object.values(m.cards).filter(c => c.blueprint === '4_37' && c.zone === 'table' && scrambleExpires(m, c.id))
    .map(c => ({...action('cancel', {card: c.id, reference: referenceCard(m, c.id)},
      'Cancel Scramble · no opposing pilots at sites'), actor: c.owner, unrespondable: true}));
}
export function battleEffectInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'battle-effect:deploy') moveCard(m, p.card, 'playing');
  else if (r.action.handler === 'battle-effect:trade') {
    const b = battle(m)!;
    p.trade = (b.abilityTrades ??= []).length;
    b.abilityTrades.push({source: referenceCard(m, p.card), side: r.actor, amount: p.amount!, applied: false});
  }
}
export function battleEffectResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (h === 'battle-effect:deploy') {
    if (r.cancelled || !canEnterTable(m, p.card)) moveCard(m, p.card, 'lost');
    else {moveCard(m, p.card, 'table'); openWindow(m, 'response', other(r.actor), {kind: 'deployed', card: p.card});}
  } else if (h === 'battle-effect:cancel') {
    if (!r.cancelled && sameCard(m, p.reference!) && scrambleExpires(m, p.card)) {
      moveCard(m, p.card, 'lost');
      openWindow(m, 'response', other(r.actor), {kind: 'card-canceled', card: p.card, source: p.card});
    }
  } else if (h === 'battle-effect:trade') {
    const b = battle(m);
    if (!r.cancelled && b && b.site === p.site && b.stage !== 'complete') b.abilityTrades![p.trade!].applied = true;
  } else throw Error('Unknown battle Effect.');
}
export function assertBattleEffects(m: Match): void {
  const trades = battle(m)?.abilityTrades;
  if (trades !== undefined && !Array.isArray(trades)) throw Error('Invalid ability trades.');
  const seen = new Set<string>();
  for (const t of trades ?? []) {
    assertCardReference(m, t.source);
    const key = t.source.id + ':' + t.source.version;
    if (!powerEffect(m, t.source.id) || t.source.zone !== 'table' || t.side !== m.cards[t.source.id].owner || seen.has(key) ||
      !Number.isSafeInteger(t.amount) || t.amount < 1 || t.amount > m.deckSize || typeof t.applied !== 'boolean') throw Error('Invalid ability trade.');
    seen.add(key);
  }
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('battle-effect:')) {
    const p = r.action.payload as Payload, h = r.action.handler;
    if (!p || !effectCards.includes(m.cards[p.card]?.blueprint) || m.cards[p.card].owner !== r.actor || r.action.source !== p.card ||
      !['battle-effect:deploy', 'battle-effect:cancel', 'battle-effect:trade'].includes(h)) throw Error('Invalid battle Effect continuation.');
    if (h === 'battle-effect:deploy' && m.cards[p.card].zone !== 'playing') throw Error('Invalid battle Effect deployment.');
    if (h === 'battle-effect:cancel') {
      assertCardReference(m, p.reference!, p.card);
      if (m.cards[p.card].blueprint !== '4_37' || p.reference?.zone !== 'table' || r.action.unrespondable !== true) throw Error('Invalid Scramble cancellation.');
    }
    if (h === 'battle-effect:trade') {
      const t = trades?.[p.trade!];
      if (!Number.isSafeInteger(p.trade) || !t || t.source.id !== p.card || t.amount !== p.amount || t.side !== r.actor ||
        battle(m)?.site !== p.site || r.action.payment?.[r.actor] !== p.amount || (r.action.payment?.[other(r.actor)] ?? 0) !== 0 ||
        r.action.unrespondable !== true) throw Error('Invalid ability trade continuation.');
    }
  }
}
