import {activeUndercoverSpy} from './undercover-state';
import {hasPersona} from './persona';
import {groundPresent} from './participation';
import {sameCard, referenceCard, assertCardReference, type CardReference} from './identity';
import type {Match, Json} from './types';
type Suppression={source:CardReference;target:CardReference;turn:number;duration:'turn'|'source'};
const suppressions=(m:Match)=>(m.data.gameTextSuppressions??[]) as unknown as Suppression[];
/** Trusted effect API; table-instance identity prevents a returned card inheriting cancellation. */
export function suppressGameText(m:Match,source:string,target:string,duration:Suppression['duration']='turn'):void {
 const p:Suppression={source:referenceCard(m,source),target:referenceCard(m,target),turn:m.turn.number,duration};
 if(p.source.zone!=='table'||p.target.zone!=='table')throw Error('Text suppression needs table cards.');
 m.data.gameTextSuppressions=[...suppressions(m).filter(x=>sameCard(m,x.target)&&(x.duration==='turn'?x.turn===m.turn.number:sameCard(m,x.source))),p] as unknown as Json;
}
export const suppressedGameText=(m:Match,id:string)=>suppressions(m).some(p=>p.target.id===id&&sameCard(m,p.target)&&(p.duration==='turn'?p.turn===m.turn.number:sameCard(m,p.source)));
export function assertTextSuppressions(m:Match):void {
 if(!Array.isArray(suppressions(m)))throw Error('Invalid game text suppressions.');
 for(const p of suppressions(m)){
  if(!p||!['turn','source'].includes(p.duration)||!Number.isSafeInteger(p.turn)||p.turn<1||p.turn>m.turn.number)throw Error('Invalid text suppression.');
  assertCardReference(m,p.source);assertCardReference(m,p.target);if(p.source.zone!=='table'||p.target.zone!=='table')throw Error('Invalid text suppression binding.');
 }
}
export const canceledTexts=(m:Match)=>(m.data.canceledGameText??[]) as unknown as CardReference[];
/** Cancellation changes only game text, not printed attributes, icons, lore,
 * or another card's modifiers. Its required rule action records the change. */
export function gameTextActive(m: Match, id: string): boolean {
  const c=m.cards[id];
  return !!c && (c.zone==='table'||activeUndercoverSpy(m,id)) && !c.coveredBy && !c.blownAway && !suppressedGameText(m,id) && !canceledTexts(m).some(ref=>ref.id===id&&sameCard(m,ref));
}
/** Praji must be present; the named droid need only be at his location
 * (AR p43). This provider currently describes ground locations. */
export function textCancelers(m:Match,id:string):string[]{
  const c=m.cards[id];if(!c||c.zone!=='table'||c.coveredBy||!c.location||!(hasPersona(m,id,'C3PO')||hasPersona(m,id,'R2D2')))return [];
  return Object.values(m.cards).filter(p=>p.blueprint==='1_167'&&p.location===c.location&&groundPresent(m,p.id)&&gameTextActive(m,p.id)).map(p=>p.id);
}
