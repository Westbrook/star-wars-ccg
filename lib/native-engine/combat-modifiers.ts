import {cardDefinition} from './definitions';
import {referenceCard, sameCard, assertCardReference, type CardReference} from './identity';
import type {Json, Match} from './types';

type Kind = 'power-add' | 'immunity-less-than' | 'immunity-full' | 'immunity-cancel';
export type CombatModifier = {source: CardReference; target: CardReference; kind: Kind; amount: number;
  turn: number; duration: 'turn' | 'source'; function: string; cumulative: boolean};
const entries = (m: Match) => (m.data.combatModifiers ?? []) as unknown as CombatModifier[];
function assertModifier(m: Match, p: CombatModifier): void {
  if (!p || !['power-add','immunity-less-than','immunity-full','immunity-cancel'].includes(p.kind) || !Number.isFinite(p.amount) ||
      p.kind === 'immunity-less-than' && p.amount < 0 || ['immunity-full','immunity-cancel'].includes(p.kind) && p.amount !== 1 ||
      !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number || !['turn','source'].includes(p.duration) ||
      typeof p.function !== 'string' || !p.function || typeof p.cumulative !== 'boolean') throw Error('Invalid combat modifier.');
  assertCardReference(m,p.source); assertCardReference(m,p.target);
  if (p.target.zone !== 'table' || cardDefinition(m,p.target.id).type !== 'Character' || p.duration === 'source' && p.source.zone !== 'table') throw Error('Invalid combat modifier source/target.');
}
export function addCombatModifier(m: Match, source: string, target: string, kind: Kind, amount: number,
 options: {duration?: 'turn' | 'source'; function?: string; cumulative?: boolean} = {}): void {
  const p: CombatModifier = {source:referenceCard(m,source),target:referenceCard(m,target),kind,amount,turn:m.turn.number,
    duration:options.duration ?? 'turn',function:options.function ?? kind,cumulative:options.cumulative ?? false};
  assertModifier(m,p);
  m.data.combatModifiers = [...entries(m).filter(p => p.duration === 'source' || p.turn === m.turn.number),p] as unknown as Json;
}
export function assertCombatModifiers(m: Match): void {
  if (m.data.combatModifiers !== undefined && !Array.isArray(m.data.combatModifiers)) throw Error('Invalid combat modifiers.');
  entries(m).forEach(p=>assertModifier(m,p));
}
function active(m: Match,id: string): CombatModifier[] {
  return entries(m).filter(p=>p.target.id===id && sameCard(m,p.target) && (p.duration==='turn'?p.turn===m.turn.number:sameCard(m,p.source)));
}
export function combatPowerBonus(m: Match,id: string): number {
  const grouped=new Map<string,number>();let result=0;
  for(const p of active(m,id).filter(p=>p.kind==='power-add')){
    if(p.cumulative){result+=p.amount;continue;}
    const key=cardDefinition(m,p.source.id).name+':'+p.function,prior=grouped.get(key);
    if(prior===undefined || Math.abs(p.amount)>Math.abs(prior))grouped.set(key,p.amount);
  }
  return result+[...grouped.values()].reduce((n,v)=>n+v,0);
}
/** Ground immunity queries. None of these metadata cards is admitted as a
 * complete card. Ship/vehicle passengers and immunity to exact values require
 * their own providers. Infinity is query-only and is never saved. */
export function attritionImmunity(m: Match,id: string): number {
  const c=m.cards[id];if(c?.zone!=='table')return 0;
  const mods=active(m,id);if(mods.some(p=>p.kind==='immunity-cancel'))return 0;
  if(c.blueprint==='9_109' || mods.some(p=>p.kind==='immunity-full'))return Infinity;
  const fixed:Record<string,number>={'1_171':3,'1_4':3,'1_19':3,'3_3':3,'1_21':5,'4_1':4,'1_168':5};
  let value=fixed[c.blueprint]??0;
  if(c.blueprint==='4_103' && c.location)value=Object.values(m.cards).filter(o=>o.zone==='table' && o.location===c.location && !o.attachedTo && o.owner!==c.owner && cardDefinition(m,o.id).subType==='Alien').length;
  if(c.blueprint==='9_24'){
    const alone=!!c.location && !Object.values(m.cards).some(o=>o.id!==id && o.zone==='table' && o.owner===c.owner && o.location===c.location && !o.attachedTo && ['Character','Vehicle','Starship'].includes(cardDefinition(m,o.id).type));
    // No lightsabers are admitted in the current ground card registry.
    value=5+(alone?1:0);
  }
  return Math.max(value,...mods.filter(p=>p.kind==='immunity-less-than').map(p=>p.amount));
}
