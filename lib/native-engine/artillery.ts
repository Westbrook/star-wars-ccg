import identities from '../../data/native-engine/identities.json';
import {isModel} from './characteristics';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {groundPresent} from './participation';
import type {Match} from './types';

export const artillery=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).type==='Weapon'&&cardDefinition(m,id).subType==='Artillery';
/** Power is a firing condition, not a permanent assignment or a spent resource.
 * A power droid/fusion generator retains its identity when its text is canceled. */
export function artilleryPowerSources(m:Match,id:string):string[]{
 const c=m.cards[id];if(!c||c.zone!=='table'||!artillery(m,id)||!c.location)return [];
 const sources=Object.values(m.cards).filter(s=>s.zone==='table'&&s.owner===c.owner&&s.location===c.location&&(
  isModel(m,s.id,'POWER')&&groundPresent(m,s.id)||
  (identities as Record<string,{keywords:string[]}>)[s.blueprint]?.keywords.includes('FUSION_GENERATOR')&&!!s.attachedTo&&groundPresent(m,s.attachedTo)
 )).map(s=>s.id);
 if(c.owner==='light'&&m.cards[c.location]?.blueprint==='3_61'&&gameTextActive(m,c.location))sources.push(c.location);
 return sources;
}
export const artilleryView=(m:Match)=>({artillery:Object.fromEntries(Object.values(m.cards).filter(c=>c.zone==='table'&&artillery(m,c.id)).map(c=>[c.id,{powered:artilleryPowerSources(m,c.id).length>0,sources:artilleryPowerSources(m,c.id).map(id=>cardDefinition(m,id).name)}]))});
