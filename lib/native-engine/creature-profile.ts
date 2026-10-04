import {cardDefinition} from './definitions';
import type {Match} from './types';
/** Explicit card rules, not admission. Ferocity is never creature power. */
export const creatureProfiles:Record<string,{defense:number;ferocity?:number;draws:number;ground:boolean}>={
 '4_6':{defense:3,draws:2,ground:false},'4_112':{defense:3,draws:2,ground:false},
 '6_48':{defense:4,ferocity:3,draws:0,ground:true},'6_138':{defense:5,ferocity:4,draws:0,ground:true},
};
export const creatureProfile=(m:Match,id:string)=>creatureProfiles[m.cards[id]?.blueprint];
export const supportedCreature=(m:Match,id:string)=>!!creatureProfile(m,id);
export function creatureDefense(m:Match,id:string):number {
 const rule=creatureProfile(m,id);if(!rule||cardDefinition(m,id).type!=='Creature')throw Error('Creature needs explicit defense rules.');return rule.defense;
}
