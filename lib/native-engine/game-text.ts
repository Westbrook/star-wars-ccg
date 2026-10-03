import {hasPersona} from './persona';
import {groundPresent} from './participation';
import {sameCard, type CardReference} from './identity';
import type {Match} from './types';
export const canceledTexts=(m:Match)=>(m.data.canceledGameText??[]) as unknown as CardReference[];
/** Cancellation changes only game text, not printed attributes, icons, lore,
 * or another card's modifiers. Its required rule action records the change. */
export function gameTextActive(m: Match, id: string): boolean {
  const c=m.cards[id];
  return !!c && c.zone==='table' && !c.coveredBy && !canceledTexts(m).some(ref=>ref.id===id&&sameCard(m,ref));
}
/** Praji must be present; the named droid need only be at his location
 * (AR p43). This provider currently describes ground locations. */
export function textCancelers(m:Match,id:string):string[]{
  const c=m.cards[id];if(!c||c.zone!=='table'||c.coveredBy||!c.location||!(hasPersona(m,id,'C3PO')||hasPersona(m,id,'R2D2')))return [];
  return Object.values(m.cards).filter(p=>p.blueprint==='1_167'&&p.location===c.location&&groundPresent(m,p.id)&&gameTextActive(m,p.id)).map(p=>p.id);
}
