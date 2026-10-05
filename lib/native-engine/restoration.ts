import {sameCard,type CardReference} from './identity';
import {restoreWeaponForfeit} from './forfeit';
import type {Battle} from './battle';
import type {Json,Match} from './types';

/** Restore resolved, instance-bound effects without redeploying the card.
 * Source-duration entries model continuous text and must continue to apply;
 * attachments, movement limits and weapon-use records retain their identity. */
export function restoreToNormal(m:Match,id:string):void {
  if(m.cards[id]?.zone!=='table')return;
  const b=m.data.battle as unknown as Battle|undefined;
  if(b)b.hits=b.hits.filter(target=>target!==id);
  restoreWeaponForfeit(m,id);
  for(const key of ['statModifiers','combatModifiers','abilityModifiers','characteristics','gameTextSuppressions','retrievalRestrictions']){
    const entries=m.data[key] as unknown as {target:CardReference;duration:string}[]|undefined;
    if(entries)m.data[key]=entries.filter(p=>p.target.id!==id||!sameCard(m,p.target)||p.duration==='source') as unknown as Json;
  }
}
