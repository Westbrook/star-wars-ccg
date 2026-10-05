import {bionicHandBonus} from './bionic-hand';
import {cardDefinition} from './definitions';
import type {Action,Match} from './types';
export type CharacterWeaponTotal={weapon:string;host:string};
/** The firing user belongs to the initiated shot, not the weapon's current
 * attachment. GEMP queries that physical user's current attached modifiers. */
export function characterWeaponTotalContext(m:Match,next:Action):CharacterWeaponTotal|undefined{
 if(!Object.values(m.cards).some(c=>c.blueprint==='5_12'))return;
 const index=(next.payload as {index?:number})?.index;if(!Number.isSafeInteger(index))return;
 const b=m.data.battle as unknown as {shots?:CharacterWeaponTotal[];saberShots?:CharacterWeaponTotal[];gaffiShots?:CharacterWeaponTotal[]}|undefined;
 if(next.handler==='creature-weapon:result'||next.handler==='sniping:result'){
  const s=((next.handler==='sniping:result'?m.data.snipingShots:m.data.creatureShots) as unknown as {weapon:{id:string};host:{id:string}}[]|undefined)?.[index!];
  return s?{weapon:s.weapon.id,host:s.host.id}:undefined;
 }
 const s=next.handler==='battle:shot-result'?b?.shots?.[index!]:next.handler==='saber:result'?b?.saberShots?.[index!]:next.handler==='gaffi:result'?b?.gaffiShots?.[index!]:undefined;
 return s?.host?{weapon:s.weapon,host:s.host}:undefined;
}
export function characterWeaponTotalModifier(m:Match,c:CharacterWeaponTotal):number{
 const weapon=cardDefinition(m,c.weapon);return weapon.type==='Weapon'&&weapon.subType==='Character'?bionicHandBonus(m,c.host):0;
}
export function assertCharacterWeaponTotal(m:Match,c:CharacterWeaponTotal,next:Action):void{
 const expected=characterWeaponTotalContext(m,next);
 if(!c||!expected||c.weapon!==expected.weapon||c.host!==expected.host||!m.cards[c.weapon]||!m.cards[c.host]||cardDefinition(m,c.host).type!=='Character')throw Error('Invalid character weapon total binding.');
}
