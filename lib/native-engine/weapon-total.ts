import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {assertCardReference,type CardReference} from './identity';
import type {Action,Match} from './types';

/** An active weapon's printed continuous total modifier, distinct from the
 * arithmetic of an already initiated firing action (rifles and Ion Cannon). */
export type WeaponTotal={weapon:CardReference;target:CardReference};
const supported=['3_158','3_75','1_159','1_323'];
export function assertWeaponTotal(m:Match,c:WeaponTotal):void{
 if(!c)throw Error('Missing weapon total context.');
 assertCardReference(m,c.weapon);assertCardReference(m,c.target);
 if(c.weapon.zone!=='table'||c.target.zone!=='table'||!supported.includes(m.cards[c.weapon.id].blueprint))throw Error('Invalid weapon total context.');
}
export function weaponTotalModifier(m:Match,c:WeaponTotal):number{
 // Continuous self-text follows the selected physical weapon's current active
 // state, including a return during responses (executed GEMP observation).
 // Other copies have different IDs and cannot supply this contribution.
 if(!gameTextActive(m,c.weapon.id))return 0;
 return printedWeaponTotal(m,c);
}
export function printedWeaponTotal(m:Match,c:WeaponTotal):number{
 const target=cardDefinition(m,c.target.id),character=['Character','Creature'].includes(target.type),capital=target.type==='Starship'&&target.subType.startsWith('Capital:');
 switch(m.cards[c.weapon.id].blueprint){
  case '3_158':return target.type==='Vehicle'?2:character?1:0;
  case '3_75':return character?2:0;
  case '1_159':return target.type==='Starship'&&!capital?1:0;
  case '1_323':return capital?-2:-5;
  default:return 0;
 }
}
export const hasWeaponTotal=(m:Match,id:string)=>supported.includes(m.cards[id]?.blueprint);

/** A saved continuation may not swap either physical reference under a shot. */
export function assertWeaponTotalBinding(m:Match,c:WeaponTotal,next:Action):void{
 const index=(next.payload as {index?:number})?.index;
 const shot=next.handler==='heavy:result'?(m.data.heavyShots as unknown as {weapon:CardReference;target:CardReference}[]|undefined)?.[index!]:next.handler==='space-weapon:result'?(m.data.battle as unknown as {starshipShots?:{weaponRef:CardReference;targetRef:CardReference}[]}|undefined)?.starshipShots?.[index!]:undefined;
 if(!shot||!Number.isSafeInteger(index))throw Error('Invalid continuous weapon shot binding.');
 const expected='weaponRef' in shot?{weapon:shot.weaponRef,target:shot.targetRef}:shot;
 for(const key of ['weapon','target'] as const)if(c[key].id!==expected[key].id||c[key].version!==expected[key].version||c[key].zone!==expected[key].zone)throw Error('Invalid continuous weapon instance.');
}
