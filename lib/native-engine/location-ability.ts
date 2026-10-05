import {ability} from './ability';
import {groundPresent} from './participation';
import type {Battle} from './battle';
import {gameTextActive} from './game-text';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {other, sides, type Match, type Side} from './types';

type Kind = 'add' | 'reset' | 'battle-add' | 'prevent-reduction';
export type LocationAbilityModifier = {source: CardReference; site: CardReference; side: Side; kind: Kind; amount: number;
  duration: 'source' | 'turn'; turn: number; function: string; cumulative: boolean};
const entries = (m: Match) => (m.data.locationAbilityModifiers ?? []) as unknown as LocationAbilityModifier[];
function assertModifier(m: Match, p: LocationAbilityModifier): void {
  if (!p || !sides.includes(p.side) || !['add', 'reset', 'battle-add', 'prevent-reduction'].includes(p.kind) ||
    !Number.isFinite(p.amount) || p.kind === 'reset' && p.amount < 0 || p.kind === 'prevent-reduction' && p.amount !== 1 ||
    !['source', 'turn'].includes(p.duration) || !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number ||
    typeof p.function !== 'string' || !p.function || typeof p.cumulative !== 'boolean') throw Error('Invalid location ability modifier.');
  assertCardReference(m, p.source); assertCardReference(m, p.site);
  if (p.site.zone !== 'table' || cardDefinition(m, p.site.id).type !== 'Location' || p.duration === 'source' && p.source.zone !== 'table') throw Error('Invalid location ability reference.');
}
/** Rules-owned provider API. Individual Character ability is never changed by
 * these location totals. Battle-only totals are applied before total resets. */
export function addLocationAbilityModifier(m: Match, source: string, site: string, side: Side, kind: Kind, amount: number,
  options: {duration?: 'source' | 'turn'; function?: string; cumulative?: boolean} = {}): void {
  const p: LocationAbilityModifier = {source: referenceCard(m, source), site: referenceCard(m, site), side, kind, amount,
    duration: options.duration ?? 'turn', turn: m.turn.number, function: options.function ?? kind, cumulative: options.cumulative ?? false};
  assertModifier(m, p); ((m.data.locationAbilityModifiers ??= []) as unknown as LocationAbilityModifier[]).push(p);
}
export function assertLocationAbility(m: Match): void {
  if (m.data.locationAbilityModifiers !== undefined && !Array.isArray(m.data.locationAbilityModifiers)) throw Error('Invalid location ability modifiers.');
  entries(m).forEach(p => assertModifier(m, p));
}
export const isJedi = (m: Match, id: string, side: Side) => m.cards[id]?.zone === 'table' &&
  cardDefinition(m, id).type === 'Character' && cardDefinition(m, id).side === side && ability(m, id) >= 6;
function affectMind(m: Match, side: Side, site: string): boolean {
  const b=m.data.battle as Battle|undefined,besieged=b?.stage!=='complete'&&!!b?.besieged&&b.site===site;
  if (!m.locations.includes(site) || !besieged&&cardDefinition(m, site).subType !== 'Site') return false;
  // Only the selected boarding party and trapped defenders share Besieged's
  // virtual site. Outside characters at the physical bay/system cannot supply
  // a Dark Jedi or an Affect Mind bearer to this separate battle.
  const present = Object.values(m.cards).filter(c => c.location === site && groundPresent(m,c.id));
  if (present.some(c => isJedi(m, c.id, 'dark'))) return false;
  return Object.values(m.cards).some(c => c.blueprint === '1_43' && gameTextActive(m,c.id) && other(c.owner) === side &&
    !!c.attachedTo && present.some(host => host.id === c.attachedTo));
}
/** Caller supplies the correct contributing group (all at site, eligible battle
 * participants, or those applying battle-destiny ability). Undefined battleDelta
 * means an ordinary query; zero enables the battle-only modifier layer. */
export function locationAbility(m: Match, side: Side, site: string, base: number, battleDelta?: number): number {
  const active = entries(m).filter(p => p.side === side && p.site.id === site && m.locations.includes(site) && sameCard(m, p.site) &&
    (p.duration === 'turn' ? p.turn === m.turn.number : sameCard(m, p.source)));
  const groups = new Map<string, LocationAbilityModifier>(), mods: Pick<LocationAbilityModifier, 'kind' | 'amount'>[] = [];
  for (const p of active) {
    if (p.cumulative) {mods.push(p); continue;}
    const key = cardDefinition(m, p.source.id).name + ':' + p.function + ':' + p.kind, prior = groups.get(key);
    if (!prior || (p.kind === 'reset' ? p.amount < prior.amount : Math.abs(p.amount) > Math.abs(prior.amount))) groups.set(key, p);
  }
  mods.push(...groups.values());
  if (affectMind(m, side, site)) mods.push({kind: 'add', amount: -2});
  const protectedTotal = mods.some(p => p.kind === 'prevent-reduction');
  let result = base + mods.filter(p => p.kind === 'add' && (p.amount >= 0 || !protectedTotal)).reduce((n, p) => n + p.amount, 0);
  if (battleDelta !== undefined) result += battleDelta + mods.filter(p => p.kind === 'battle-add').reduce((n, p) => n + p.amount, 0);
  const resets = mods.filter(p => p.kind === 'reset' && (!protectedTotal || p.amount >= result));
  return Math.max(0, resets.length ? Math.min(...resets.map(p => p.amount)) : result);
}
