import {undercoverReference} from './undercover-state';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Json, Match} from './types';

type Armor = {source: CardReference; target: CardReference; mode: 'define' | 'reset'; turn: number};
const records = (m: Match) => (m.data.armorEquipment ?? []) as unknown as Armor[];
export const isArmorDevice = (blueprint: string) => blueprint === '5_109';
/** Whether armor defines or resets an attribute is fixed when it attaches, not
 * recomputed from the current value. AR p28 explicitly distinguishes the two. */
export function recordArmor(m: Match, source: string, target: string, hadArmor: boolean): void {
  const entry: Armor = {source: referenceCard(m,source), target: referenceCard(m,target), mode: hadArmor ? 'reset' : 'define', turn: m.turn.number};
  m.data.armorEquipment = [...records(m).filter(p => p.source.id !== source),entry] as unknown as Json;
}
export function attachedArmor(m: Match, target: string): Armor[] {
  return records(m).filter(p => p.target.id === target && sameCard(m,p.source) && sameCard(m,p.target) && m.cards[p.source.id].attachedTo === target);
}
export function assertArmorEquipment(m: Match): void {
  if (m.data.armorEquipment !== undefined && !Array.isArray(m.data.armorEquipment)) throw Error('Invalid armor equipment.');
  const seen = new Set<string>();
  for (const p of records(m)) {
    if (!p || !['define','reset'].includes(p.mode) || !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number) throw Error('Invalid armor grant.');
    assertCardReference(m,p.source); assertCardReference(m,p.target);
    if (!isArmorDevice(m.cards[p.source.id].blueprint) || p.source.zone !== 'table' || p.target.zone !== 'table'&&!(p.target.zone==='inactive'&&undercoverReference(m,p.target)) || cardDefinition(m,p.target.id).type !== 'Character' || seen.has(p.source.id)) throw Error('Invalid armor source or target.');
    seen.add(p.source.id);
  }
  for (const c of Object.values(m.cards)) if (c.zone === 'table' && isArmorDevice(c.blueprint) && (!c.attachedTo || !attachedArmor(m,c.attachedTo).some(p => p.source.id === c.id))) throw Error('Armor requires its original attachment grant.');
}
