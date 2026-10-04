import {isVessel,permanentAbility,enclosedOccupant,landed} from './occupancy';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {hasPersona} from './persona';
import type {Match} from './types';

type Kind = 'add' | 'reset' | 'base-double' | 'battle-add' | 'battle-prevent' | 'sense-prevent' | 'highest-exclude';
export type AbilityModifier = {source: CardReference; target: CardReference; kind: Kind; amount: number;
  duration: 'turn' | 'source'; turn: number; function: string; cumulative: boolean};
const kinds: Kind[] = ['add','reset','base-double','battle-add','battle-prevent','sense-prevent','highest-exclude'];
const entries = (m: Match) => (m.data.abilityModifiers ?? []) as unknown as AbilityModifier[];
function assertModifier(m: Match, p: AbilityModifier): void {
  if (!p || !kinds.includes(p.kind) || !Number.isFinite(p.amount) || p.kind === 'reset' && p.amount < 0 ||
    !['add','reset','battle-add'].includes(p.kind) && p.amount !== 1 || !['turn','source'].includes(p.duration) ||
    !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number || typeof p.function !== 'string' || !p.function || typeof p.cumulative !== 'boolean') throw Error('Invalid ability modifier.');
  assertCardReference(m, p.source); assertCardReference(m, p.target);
  if (p.target.zone !== 'table' || cardDefinition(m, p.target.id).type !== 'Character' || p.duration === 'source' && p.source.zone !== 'table') throw Error('Invalid ability modifier target/source.');
}
/** Trusted rules providers register effects; player commands never supply stats.
 * Fractional ability is exact for the quarter/half values used by SWCCG. */
export function addAbilityModifier(m: Match, source: string, target: string, kind: Kind, amount: number,
 options: {duration?: 'turn' | 'source'; function?: string; cumulative?: boolean} = {}): void {
  const p: AbilityModifier = {source: referenceCard(m, source), target: referenceCard(m, target), kind, amount,
    duration: options.duration ?? 'turn', turn: m.turn.number, function: options.function ?? kind, cumulative: options.cumulative ?? false};
  assertModifier(m, p); ((m.data.abilityModifiers ??= []) as unknown as AbilityModifier[]).push(p);
}
export function assertAbility(m: Match): void {
  if (m.data.abilityModifiers !== undefined && !Array.isArray(m.data.abilityModifiers)) throw Error('Invalid ability modifiers.');
  entries(m).forEach(p => assertModifier(m, p));
}
function active(m: Match, id: string): AbilityModifier[] {
  const mods = entries(m).filter(p => p.target.id === id && sameCard(m, p.target) && (p.duration === 'turn' ? p.turn === m.turn.number : sameCard(m, p.source)));
  const grouped = new Map<string, AbilityModifier>(), result: AbilityModifier[] = [];
  for (const p of mods) {
    if (p.cumulative) {result.push(p); continue;}
    const key = cardDefinition(m, p.source.id).name + ':' + p.function + ':' + p.kind, prior = grouped.get(key);
    if (!prior || (p.kind === 'reset' ? p.amount < prior.amount : Math.abs(p.amount) > Math.abs(prior.amount))) grouped.set(key, p);
  }
  return [...result, ...grouped.values()];
}
export function ability(m: Match, id: string): number {
  if(isVessel(m,id))return permanentAbility(m,id);
  const def = cardDefinition(m, id);
  // AR p77: droids have no ability; comparison treats it as unmodifiable zero.
  // No printed ability attribute cannot acquire ability from
  // a generic numerical modifier. Creature vehicles/permanent pilots follow
  // separate card-type rules and are not inferred here.
  if (def.type !== 'Character' || def.subType === 'Droid') return 0;
  const value = (def.stats as Record<string, string>).ability;
  if (value === undefined || !Number.isFinite(Number(value))) throw Error('Ability requires a printed-value provider.');
  const mods = active(m, id), reset = mods.filter(p => p.kind === 'reset');
  if (reset.length) return Math.min(...reset.map(p => p.amount));
  return Math.max(0, Number(value) * (mods.some(p => p.kind === 'base-double') ? 2 : 1) + mods.filter(p => p.kind === 'add').reduce((n,p) => n + p.amount, 0));
}
export const mayBeHighestAbility = (m: Match, id: string) => !active(m, id).some(p => p.kind === 'highest-exclude');
export const mayApplySenseAbility = (m: Match, id: string) => !active(m, id).some(p => p.kind === 'sense-prevent');
export const pilotAtSite = (m: Match, id: string) => m.cards[id]?.zone === 'table' && !!m.cards[id].location && m.locations.includes(m.cards[id].location!) && cardDefinition(m,m.cards[id].location!).subType==='Site' &&
  cardDefinition(m, id).type === 'Character' && (cardDefinition(m, id).icons as string[]).includes('Pilot');
export function abilityForBattleDestiny(m: Match, id: string): number {
  if(isVessel(m,id))return landed(m,id)?0:permanentAbility(m,id);
  const aboard=m.cards[id];if(enclosedOccupant(m,id)&&(aboard.aboardRole==='passenger'||landed(m,aboard.attachedTo!)))return 0;
  if (cardDefinition(m, id).subType === 'Droid') return 0; // AR p77: unmodifiable zero.
  const mods = active(m, id), card = m.cards[id];
  const scramble = pilotAtSite(m, id) && !card.attachedTo && !hasPersona(m, id, 'VADER') && Object.values(m.cards).some(c => c.zone === 'table' && c.blueprint === '4_37' && c.owner !== card.owner);
  if (scramble || mods.some(p => p.kind === 'battle-prevent')) return 0;
  return Math.max(0, ability(m, id) + mods.filter(p => p.kind === 'battle-add').reduce((n,p) => n + p.amount, 0));
}
