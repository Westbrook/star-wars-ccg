import {ability} from './ability';
import {deployed, deployedAbilityDuringPhase} from './deployment';
import {queueForceLoss} from './ground';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; reference?: CardReference};
const blueprint = '5_110';
const count = (m: Match, side: Side) => Object.values(m.cards).filter(c => c.zone === 'table' && c.owner === side && ability(m, c.id) > 0).length;
const outnumbered = (m: Match, card: string) => count(m, other(m.cards[card].owner)) > count(m, m.cards[card].owner);
function action(step: string, p: Payload, label: string): Action {
  return {id: 'phase-effect:' + step + ':' + p.card + (p.reference ? ':' + p.reference.version : ''),
    handler: 'phase-effect:' + step, source: p.card, label, payload: p as unknown as Json};
}
export function phaseEffectActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'phase' || m.turn.side !== side || m.turn.phase !== 'deploy') return [];
  return m.players[side].hand.filter(id => m.cards[id].blueprint === blueprint)
    .map(card => action('deploy', {card}, 'Deploy Ability, Ability, Ability'));
}
export function phaseEffectAutomatic(m: Match, w: Window): RequiredAction[] {
  const event = w.event as {kind?: string; phase?: string; side?: Side; sources?: CardReference[]} | undefined;
  return Object.values(m.cards).filter(c => c.zone === 'table' && c.blueprint === blueprint).flatMap(c => {
    const p = {card: c.id, reference: referenceCard(m, c.id)};
    if (outnumbered(m, c.id)) return [{...action('lost', p, 'Lose Ability, Ability, Ability · opponent has more cards with ability'), actor: c.owner, unrespondable: true as const}];
    if (event?.kind === 'phase-end' && event.phase === 'deploy' && event.side === other(c.owner) && event.sources?.some(ref => ref.id === c.id && sameCard(m, ref)) &&
        !deployedAbilityDuringPhase(m, c.id, other(c.owner), 'deploy'))
      return [{...action('loss', p, 'Ability, Ability, Ability · opponent loses 2 Force'), actor: c.owner}];
    return [];
  });
}
export function phaseEffectInitiate(m: Match, r: Resolution): void {
  if (r.action.handler === 'phase-effect:deploy') moveCard(m, (r.action.payload as Payload).card, 'playing');
}
export function phaseEffectResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'phase-effect:deploy') {
    if (r.cancelled || !canEnterTable(m, p.card)) moveCard(m, p.card, 'lost');
    else {moveCard(m, p.card, 'table'); deployed(m, p.card);}
  } else if (r.action.handler === 'phase-effect:lost') {
    if (!r.cancelled && sameCard(m, p.reference!) && outnumbered(m, p.card)) loseFromTable(m, [p.card]);
  } else if (r.action.handler === 'phase-effect:loss') {
    // An already initiated mandatory action survives removal of its source.
    if (!r.cancelled) queueForceLoss(m, {side: other(r.actor), remaining: 2, source: p.card, site: null, reductionUsed: false});
  } else throw Error('Unknown phase Effect.');
}
export function assertPhaseEffects(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('phase-effect:')) {
    const p = f.action.payload as Payload, h = f.action.handler;
    if (!p || m.cards[p.card]?.blueprint !== blueprint || m.cards[p.card].owner !== f.actor || f.action.source !== p.card ||
        !['phase-effect:deploy','phase-effect:lost','phase-effect:loss'].includes(h)) throw Error('Invalid phase Effect.');
    if (h === 'phase-effect:deploy') {if (m.cards[p.card].zone !== 'playing') throw Error('Invalid phase Effect deployment.');}
    else {assertCardReference(m, p.reference!, p.card); if (p.reference!.zone !== 'table') throw Error('Invalid phase Effect reference.');}
  }
}
