import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {isModel} from './characteristics';
import {sameCard} from './identity';
import type {Deployment} from './deployment';
import type {Match} from './types';

const registry: Record<string,{personas:string[]}> = identities;
const affected = new Set(['LUKE','LEIA','HAN','CHEWIE','LANDO','YODA','OBIWAN']);
const badFeelings = (m: Match) => Object.values(m.cards).filter(c=>c.zone==='table' && !c.coveredBy && c.blueprint==='4_116');
/** Global attribute modifiers operate in every card state. Deployment-target
 * discounts are deliberately separate, so patient recovery cannot use them. */
export function deployValue(m: Match, id: string, options: {asteriskZero?: boolean} = {}): number {
  const raw=(cardDefinition(m,id).stats as Record<string,string>).deploy;
  let base: number;
  if(raw==='*' && options.asteriskZero)base=0;
  else if(raw!==undefined && Number.isFinite(Number(raw)))base=Number(raw);
  else throw Error('Deploy value needs an explicit definition: '+m.cards[id].blueprint);
  const plus=registry[m.cards[id].blueprint]?.personas.some(p=>affected.has(p)) && badFeelings(m).length ? 2 : 0;
  // Duplicate copies of the same automatic modifier are noncumulative.
  return Math.max(0,base+plus);
}
export function playProhibited(m: Match, id: string): boolean {
  return cardDefinition(m,id).name.toLowerCase().includes('bad feeling') && badFeelings(m).some(c=>c.owner!==m.cards[id].owner);
}
export function medicalDeployReduction(m: Match, id: string): number {
  if(m.cards[id].owner!=='light' || cardDefinition(m,id).subType!=='Droid' || !isModel(m,id,'MEDICAL'))return 0;
  const records=(m.data.deployments??[]) as unknown as Deployment[];
  const labs=m.locations.filter(site=>m.cards[site].blueprint==='3_60');
  const available=labs.some(site=>!records.some(d=>d.turn===m.turn.number && d.side==='light' && isModel(m,d.card.id,'MEDICAL') &&
    d.observers.some(ref=>ref.id===site && sameCard(m,ref))));
  return available?2:0;
}
