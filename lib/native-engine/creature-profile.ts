import {gameTextActive} from './game-text';
import {cardDefinition} from './definitions';
import type {Match} from './types';
/** Explicit card rules, not admission. Ferocity is never creature power. */
export const creatureProfiles:Record<string,{defense:number;ferocity?:number;draws:number;ground:boolean;species:string;avoidsOwnCharacters?:boolean}>={
 '4_6':{defense:3,draws:2,ground:false,species:'space-slug'},'4_112':{defense:3,draws:2,ground:false,species:'space-slug'},
 '6_48':{defense:4,ferocity:3,draws:0,ground:true,species:'worrt',avoidsOwnCharacters:true},'6_138':{defense:5,ferocity:4,draws:0,ground:true,species:'bubo',avoidsOwnCharacters:true},
 '3_93':{defense:3,ferocity:3,draws:1,ground:true,species:'wampa'},'7_212':{defense:4,ferocity:3,draws:0,ground:true,species:'wampa'},
};
export const creatureProfile=(m:Match,id:string)=>creatureProfiles[m.cards[id]?.blueprint];
export const supportedCreature=(m:Match,id:string)=>!!creatureProfile(m,id);
export function creatureDefense(m:Match,id:string):number {
 const rule=creatureProfile(m,id);if(!rule||cardDefinition(m,id).type!=='Creature')throw Error('Creature needs explicit defense rules.');return rule.defense;
}

/** Variable ferocity is defined by game text; fixed ferocity is printed. */
export function ferocityPlan(m:Match,id:string){const p=creatureProfile(m,id);return p.draws&&!gameTextActive(m,id)?{base:0,draws:0}:{base:p.ferocity??0,draws:p.draws};}
export const ferocityValue=(m:Match,id:string,total:number|null)=>creatureProfile(m,id).draws&&!gameTextActive(m,id)?0:Math.max(0,ferocityPlan(m,id).base+(total??0));
