import {forfeit} from './board';
import {statModifiers} from './stat-modifiers';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Json, Match} from './types';
export type ForfeitReset = {source: CardReference; target: CardReference; value: number; weapon: boolean};
const entries = (m: Match) => (m.data.forfeitResets ?? []) as unknown as ForfeitReset[];
/** Weapon resets last until restoration to normal or departure, even after the
 * weapon leaves play. They override ordinary forfeit bonuses (AR pp28,96). */
export function resetWeaponForfeit(m: Match, source: string, target: string, value = 0): void {
  if(value<forfeit(m,target) && forfeitReductionPrevented(m,target))return;
  const p = {source:referenceCard(m,source), target:referenceCard(m,target), value, weapon:true};
  m.data.forfeitResets = [...entries(m).filter(p=>sameCard(m,p.target)),p] as unknown as Json;
  assertForfeitResets(m);
}
export const forfeitReductionPrevented=(m:Match,target:string):boolean=>statModifiers(m,target,'forfeit').some(p=>p.kind==='prevent-reduce');
export function currentForfeit(m:Match,target:string,printed:number,bonuses:number[]):number{
  const mods=statModifiers(m,target,'forfeit'),prevent=forfeitReductionPrevented(m,target),preventIncrease=mods.some(p=>p.kind==='prevent-increase');
  let value=printed;
  for(const p of mods.filter(p=>p.kind==='define'))value=p.amount;
  if(mods.some(p=>p.kind==='base-double'))value*=2;
  for(const amount of [...bonuses,...mods.filter(p=>p.kind==='add').map(p=>p.amount)])if(amount>=0&&!preventIncrease||amount<=0&&!prevent)value+=amount;
  const resets=[...mods.filter(p=>p.kind==='reset').map(p=>p.amount),...entries(m).filter(p=>p.target.id===target&&sameCard(m,p.target)).map(p=>p.value)].filter(v=>v>=value||!prevent);
  if(resets.length)value=Math.min(...resets);
  const limits=mods.filter(p=>p.kind==='increase-limit');if(limits.length)value=Math.min(value,printed+Math.min(...limits.map(p=>p.amount)));
  if(mods.some(p=>p.kind==='printed-cap'))value=Math.min(value,printed);
  return Math.max(0,value);
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
