import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Json, Match} from './types';
export type ForfeitReset = {source: CardReference; target: CardReference; value: number; weapon: boolean};
const entries = (m: Match) => (m.data.forfeitResets ?? []) as unknown as ForfeitReset[];
/** Weapon resets last until restoration to normal or departure, even after the
 * weapon leaves play. They override ordinary forfeit bonuses (AR pp28,96). */
export function resetWeaponForfeit(m: Match, source: string, target: string, value = 0): void {
  const p = {source:referenceCard(m,source), target:referenceCard(m,target), value, weapon:true};
  m.data.forfeitResets = [...entries(m).filter(p=>sameCard(m,p.target)),p] as unknown as Json;
  assertForfeitResets(m);
}
export function weaponForfeit(m: Match, target: string, ordinary: number): number {
  const values=entries(m).filter(p=>p.target.id===target && sameCard(m,p.target)).map(p=>p.value);
  return values.length?Math.min(...values):ordinary;
}
export function restoreWeaponForfeit(m: Match, target: string): void {
  if(m.data.forfeitResets!==undefined)m.data.forfeitResets=entries(m).filter(p=>p.target.id!==target) as unknown as Json;
}
export function assertForfeitResets(m: Match): void {
  if(m.data.forfeitResets!==undefined && !Array.isArray(m.data.forfeitResets))throw Error('Invalid weapon forfeit resets.');
  for(const p of entries(m)){
    if(!p || !Number.isFinite(p.value) || p.value<0 || p.weapon!==true)throw Error('Invalid weapon forfeit reset.');
    assertCardReference(m,p.source);assertCardReference(m,p.target);
    if(p.target.zone!=='table' || cardDefinition(m,p.target.id).type!=='Character' || cardDefinition(m,p.source.id).type!=='Weapon')throw Error('Invalid weapon forfeit target.');
  }
}
