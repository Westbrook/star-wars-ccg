import type {Battle} from './battle';
import {battleMembers} from './participation';
import {gameTextActive} from './game-text';
import {redFiveImmunity,redTwoImmunity} from './piloting';
import {armedWithLightsaber} from './weapon-state';
import {attachedArmor} from './armor-equipment';
import {cardDefinition} from './definitions';
import {referenceCard, sameCard, assertCardReference, type CardReference} from './identity';
import type {Json, Match, Side} from './types';

type Kind = 'power-add' | 'immunity-less-than' | 'immunity-full' | 'immunity-cancel' | 'immunity-exact' | 'immunity-change' | 'immunity-limit' | 'immunity-uncancelable';
export type CombatModifier = {source: CardReference; target: CardReference; kind: Kind; amount: number;
  turn: number; duration: 'turn' | 'source'; function: string; cumulative: boolean};
const entries = (m: Match) => (m.data.combatModifiers ?? []) as unknown as CombatModifier[];
function assertModifier(m: Match, p: CombatModifier): void {
  if (!p || !['power-add','immunity-less-than','immunity-full','immunity-cancel','immunity-exact','immunity-change','immunity-limit','immunity-uncancelable'].includes(p.kind) || !Number.isFinite(p.amount) ||
      ['immunity-less-than','immunity-exact','immunity-limit'].includes(p.kind) && p.amount < 0 || ['immunity-full','immunity-cancel','immunity-uncancelable'].includes(p.kind) && p.amount !== 1 ||
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
function additive(mods: CombatModifier[],m: Match): number {
  const grouped=new Map<string,number>();let result=0;
  for(const p of mods){
    if(p.cumulative){result+=p.amount;continue;}
    const key=cardDefinition(m,p.source.id).name+':'+p.function,prior=grouped.get(key);
    if(prior===undefined || Math.abs(p.amount)>Math.abs(prior))grouped.set(key,p.amount);
  }
  return result+[...grouped.values()].reduce((n,v)=>n+v,0);
}
export const combatPowerBonus = (m: Match,id: string): number => additive(active(m,id).filter(p=>p.kind==='power-add'),m);
/** Current ground immunity; the battle separately freezes protection at damage
 * entry. Infinity is query-only and is never written into saved state. */
export function attritionImmunityValues(m: Match,id: string): {lessThan:number;exact:number} {
  const c=m.cards[id],none={lessThan:0,exact:0};if(c?.zone!=='table')return none;
  const mods=active(m,id);
  if(mods.some(p=>p.kind==='immunity-cancel') && !mods.some(p=>p.kind==='immunity-uncancelable'))return none;
  const fixed:Record<string,number>={'1_171':3,'1_4':3,'3_3':3,'1_21':5,'4_1':4};
  let value=Math.max(c.blueprint==='1_17'&&gameTextActive(m,id)?2:0,c.blueprint==='3_155'&&gameTextActive(m,id)?4:0,c.blueprint==='4_167'&&gameTextActive(m,id)?12:0,fixed[c.blueprint]??0,gameTextActive(m,id)?({'1_19':3,'1_168':5} as Record<string,number>)[c.blueprint]??0:0,redFiveImmunity(m,id),redTwoImmunity(m,id));
  if(c.blueprint==='4_103' && c.location)value=Object.values(m.cards).filter(o=>o.zone==='table' && o.location===c.location && !o.attachedTo && o.owner!==c.owner && cardDefinition(m,o.id).subType==='Alien').length;
  if(c.blueprint==='9_24'){
    const alone=!!c.location && !Object.values(m.cards).some(o=>o.id!==id && o.zone==='table' && o.owner===c.owner && o.location===c.location && !o.attachedTo && ['Character','Vehicle','Starship'].includes(cardDefinition(m,o.id).type));
    value=5+(alone?1:0)+(armedWithLightsaber(m,id)?1:0);
  }
  const baseLess=['9_109','4_2'].includes(c.blueprint) || mods.some(p=>p.kind==='immunity-full') ? Infinity : Math.max(value,attachedArmor(m,id).length?3:0,...mods.filter(p=>p.kind==='immunity-less-than').map(p=>p.amount));
  const baseExact=Math.max(0,...mods.filter(p=>p.kind==='immunity-exact').map(p=>p.amount));
  const change=additive(mods.filter(p=>p.kind==='immunity-change'),m);
  const less=baseLess>0?baseLess+change:0,exact=baseExact>0?baseExact+change:0;
  // GEMP's production queries compare the changed value with the other raw
  // grant. Caps apply afterward to less-than immunity, never exact immunity.
  const limit=Math.min(Infinity,...mods.filter(p=>p.kind==='immunity-limit').map(p=>p.amount));
  return {lessThan:Math.max(0,baseExact>0 && less<=baseExact?0:Math.min(less,limit)),exact:Math.max(0,exact<baseLess?0:exact)};
}

export const attritionImmunity = (m: Match,id: string): number => attritionImmunityValues(m,id).lessThan;
export const hasAttritionImmunity = (m: Match,id: string): boolean => {const v=attritionImmunityValues(m,id);return v.lessThan>0 || v.exact>0;};
export const immuneToAttrition = (m: Match,id: string,amount:number): boolean => {const v=attritionImmunityValues(m,id);return v.exact>0?v.exact===amount:v.lessThan>amount;};

/** Premiere Vader changes each actual battle draw, not draw entitlement. The
 * source must still participate, even when piloting or in a Besieged party. */
export function battleDestinyBonus(m:Match,side:Side):number {
 const b=m.data.battle as Battle|undefined;
 return b&&b.stage!=='complete'&&battleMembers(m,side).some(id=>m.cards[id].blueprint==='1_168'&&gameTextActive(m,id))?1:0;
}
/** Pending draw adjustments remain live until that individual draw completes.
 * Interrupt changes stay in the stored value; this replaces only Vader's
 * original continuous contribution. Completed/substituted draws are fixed. */
export function currentBattleDestiny(m:Match,side:Side,initial?:number):number|null {
 const b=m.data.battle as Battle|undefined;if(!b)return null;
 const pending=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='battle:destiny-finish'&&(f.action.payload as {side?:Side}).side===side);
 const previous=initial??(pending?.kind==='resolution'?(pending.action.payload as {continuousBattleBonus?:number}).continuousBattleBonus:undefined);
 const value=b.destiny[side];
 return value===null||previous===undefined?value:value+battleDestinyBonus(m,side)-previous;
}
