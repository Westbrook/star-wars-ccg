import {undercoverReference} from './undercover-state';
import {objectiveTrait} from './objectives';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Match} from './types';

// Explicit identity metadata, reviewed against the pinned source constructors.
// Never infer characteristics from a substring in lore: context matters (AR D).
const registry: Record<string, {keywords: string[]; species: string[]; models: string[]; nonUnique: boolean}> = identities;
export const characteristics = ['ISB_AGENT','LEADER','RECRUIT','CADET','SPY', 'THIEF', 'BOUNTY_HUNTER', 'SMUGGLER', 'GAMBLER', 'SCOUT', 'TROOPER', 'STORMTROOPER',
  'BIKER_SCOUT', 'DEATH_TROOPER', 'SANDTROOPER', 'SNOWTROOPER', 'ECHO_BASE_TROOPER', 'CLOUD_CITY_TROOPER', 'DEATH_STAR_TROOPER',
  'IMPERIAL_TROOPER_GUARD', 'CLONE_TROOPER', 'GUARD', 'BODYGUARD', 'CORUSCANT_GUARD', 'MAGNAGUARD', 'ROYAL_GUARD'] as const;
export type Characteristic = typeof characteristics[number];
type Change = {source: CardReference; target: CardReference; trait: Characteristic; operation: 'give' | 'remove'; duration: 'turn' | 'source'; turn: number};
const base = (m: Match, id: string) => registry[m.cards[id]?.blueprint];
const character = (m: Match, id: string) => !!m.cards[id] && cardDefinition(m, id).type === 'Character';
/** Dual-character subtypes retain both identities, independently of game text.
 * Match slash-delimited metadata tokens, never lore or partial names. */
export function hasCharacterSubtype(m: Match, id: string, subtype: string | undefined): boolean {
  return character(m, id) && cardDefinition(m, id).subType.split('/').some(value => value.trim() === subtype);
}
const changes = (m: Match) => (m.data.characteristics ?? []) as unknown as Change[];
function assertChange(m: Match, p: Change): void {
  if (!p || !characteristics.includes(p.trait) || !['give', 'remove'].includes(p.operation) || !['turn', 'source'].includes(p.duration) ||
      !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number) throw Error('Invalid characteristic change.');
  assertCardReference(m, p.source); assertCardReference(m, p.target);
  if (p.target.zone !== 'table' && !undercoverReference(m,p.target) || !character(m, p.target.id) || p.duration === 'source' && p.source.zone !== 'table' && !undercoverReference(m,p.source)) throw Error('Invalid characteristic target or source.');
}
/** Trusted rules API. Turn effects survive source departure; table-continuous
 * effects do not. Either ends for a target that leaves play, even if it returns. */
export function changeCharacteristic(m: Match, source: string, target: string, trait: Characteristic, operation: 'give' | 'remove', duration: 'turn' | 'source' = 'turn'): void {
  const p: Change = {source: referenceCard(m, source), target: referenceCard(m, target), trait, operation, duration, turn: m.turn.number};
  assertChange(m, p); ((m.data.characteristics ??= []) as unknown as Change[]).push(p);
}
export function assertCharacteristics(m: Match): void {
  if (m.data.characteristics !== undefined && !Array.isArray(m.data.characteristics)) throw Error('Invalid characteristic changes.');
  for (const p of changes(m)) assertChange(m, p);
}
function keyword(m: Match, id: string, trait: Characteristic): boolean {
  const active = changes(m).filter(p => p.target.id === id && p.trait === trait && sameCard(m, p.target) &&
    (p.duration === 'turn' ? p.turn === m.turn.number : sameCard(m, p.source)));
  // GEMP Keywords: removal overrides printed and granted instances, independent
  // of registration order. Removing a parent keyword does not erase subtypes.
  return !active.some(p => p.operation === 'remove') && (!!base(m, id)?.keywords.includes(trait) || objectiveTrait(m,id,trait) || active.some(p => p.operation === 'give'));
}
export function hasCharacteristic(m: Match, id: string, trait: Characteristic): boolean {
  if (!character(m, id)) return false;
  if (keyword(m, id, trait)) return true;
  const children: Partial<Record<Characteristic, readonly Characteristic[]>> = {
    TROOPER: ['STORMTROOPER', 'BIKER_SCOUT', 'DEATH_TROOPER', 'SANDTROOPER', 'SNOWTROOPER', 'ECHO_BASE_TROOPER', 'CLOUD_CITY_TROOPER', 'DEATH_STAR_TROOPER', 'IMPERIAL_TROOPER_GUARD', 'CLONE_TROOPER'],
    STORMTROOPER: ['BIKER_SCOUT', 'DEATH_TROOPER', 'SANDTROOPER', 'SNOWTROOPER'], SCOUT: ['BIKER_SCOUT'],
    GUARD: ['BODYGUARD', 'CORUSCANT_GUARD', 'MAGNAGUARD', 'ROYAL_GUARD', 'IMPERIAL_TROOPER_GUARD'],
  };
  return (children[trait] ?? []).some(child => keyword(m, id, child));
}
export const isSpecies = (m: Match, id: string, species: string) => character(m, id) && !!base(m, id)?.species.includes(species);
export const nonUnique = (m: Match, id: string) => !!base(m, id)?.nonUnique;
export const isModel = (m: Match, id: string, model: string) => !!base(m, id)?.models.includes(model);
export function reinforcementTarget(m: Match, id: string, side: 'dark' | 'light'): boolean {
  return side === 'light' ? hasCharacterSubtype(m, id, 'Rebel') && hasCharacteristic(m, id, 'TROOPER') || isModel(m, id, 'Y_WING') :
    hasCharacteristic(m, id, 'STORMTROOPER') || isModel(m, id, 'TIE_LN');
}
