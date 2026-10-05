import {cardDefinition} from './definitions';
import {cardVersion,sameCard,referenceCard,assertCardReference,type CardReference} from './identity';
import {other,type Card,type Json,type Match,type Side} from './types';

export type UndercoverRecord={card:CardReference;sources:CardReference[];ended?:true;duel?:CardReference};
export const undercoverRecords=(m:Match)=>(m.data.undercover??[]) as unknown as UndercoverRecord[];
const current=(m:Match,id:string)=>[...undercoverRecords(m)].reverse().find(p=>p.card.id===id&&p.card.version===cardVersion(m,id)&&!p.ended);
export const undercoverSpy=(m:Match,id:string)=>!!current(m,id);
/** No ownership crossover: inactive spies retain their original player's side.
 * Missing/captive/aboard states override these exceptions rather than granting
 * ordinary inactive characters the Undercover permissions. */
export function activeUndercoverSpy(m:Match,id:string):boolean {
 const p=current(m,id),c=m.cards[id];return !!p&&!!c&&!c.captivity&&!c.attachedTo&&!c.coveredBy&&!!c.location&&m.locations.includes(c.location)&&cardDefinition(m,c.location).subType==='Site'&&(c.zone==='inactive'||c.zone==='table'&&!!p.duel&&sameCard(m,p.duel));
}
export const undercoverAt=(m:Match,side:Side,site:string):Card[]=>Object.values(m.cards).filter(c=>c.owner===side&&c.location===site&&activeUndercoverSpy(m,c.id));
export const undercoverPreventsDrain=(m:Match,drainingSide:Side,site:string)=>undercoverAt(m,other(drainingSide),site).length>0;
export const undercoverTargetable=(m:Match,id:string)=>activeUndercoverSpy(m,id)&&(!(m.data.battle as {stage:string}|undefined)||(m.data.battle as {stage:string}).stage==='complete');
/** Historical inactive references remain authentic after their card leaves. */
export const undercoverReference=(m:Match,ref:CardReference)=>!!ref&&['table','inactive'].includes(ref.zone)&&undercoverRecords(m).some(p=>p.card.id===ref.id&&p.card.version===ref.version);
export const sameUndercoverCard=(m:Match,ref:CardReference)=>sameCard(m,ref)||undercoverReference(m,ref)&&activeUndercoverSpy(m,ref.id)&&cardVersion(m,ref.id)===ref.version;
export function undercoverAttachment(m:Match,id:string):boolean {
 const type=m.cards[id]&&cardDefinition(m,id).type;if(!type||!['Weapon','Device','Creature'].includes(type)&&!type.includes('Effect'))return false;
 let c=m.cards[id];const seen=new Set<string>();while(c?.attachedTo){if(seen.has(c.id))return false;seen.add(c.id);c=m.cards[c.attachedTo];if(c&&activeUndercoverSpy(m,c.id))return true;}return false;
}
export function setUndercover(m:Match,id:string,source:string):void {
 const c=m.cards[id],s=m.cards[source];if(!c||!(c.zone==='table'||activeUndercoverSpy(m,id))||cardDefinition(m,id).type!=='Character'||!c.location||cardDefinition(m,c.location).subType!=='Site'||!s||s.zone!=='table'||s.attachedTo!==id||!['2_40','2_129'].includes(s.blueprint))throw Error('Invalid Undercover transition.');
 delete c.attachedTo;delete c.aboardRole;c.zone='inactive';
 const p=current(m,id);if(p){if(!p.sources.some(ref=>sameCard(m,ref)&&ref.id===source))p.sources.push(referenceCard(m,source));}
 else m.data.undercover=[...undercoverRecords(m),{card:referenceCard(m,id),sources:[referenceCard(m,source)]}] as unknown as Json;
 const b=m.data.battle as {stage:string;participants:Record<Side,string[]>;departed?:string[]}|undefined;
 if(b&&b.stage!=='complete'&&Object.values(b.participants).some(ids=>ids.includes(id))&&!(b.departed??=[]).includes(id))b.departed.push(id);
}
export function clearUndercover(m:Match,id:string):void {const p=current(m,id);if(p){p.ended=true;delete p.duel;}}
export function activateUndercoverDuel(m:Match,ids:string[]):CardReference[]{
 const out:CardReference[]=[];for(const id of ids)if(activeUndercoverSpy(m,id)){m.cards[id].zone='table';const ref=referenceCard(m,id);current(m,id)!.duel=ref;out.push(ref);}return out;
}
export function restoreUndercoverDuel(m:Match,refs:CardReference[]):void {for(const ref of refs){const p=current(m,ref.id);if(p&&sameCard(m,ref)){m.cards[ref.id].zone='inactive';delete p.duel;}}}
export function assertUndercoverState(m:Match):void {
 if(!Array.isArray(undercoverRecords(m)))throw Error('Invalid Undercover state.');
 const live=new Set<string>();for(const p of undercoverRecords(m)){
  assertCardReference(m,p.card);if(p.card.zone!=='inactive'||cardDefinition(m,p.card.id).type!=='Character'||!Array.isArray(p.sources)||!p.sources.length||new Set(p.sources.map(r=>r.id+':'+r.version)).size!==p.sources.length||p.ended!==undefined&&p.ended!==true)throw Error('Invalid Undercover binding.');
  for(const ref of p.sources){assertCardReference(m,ref);if(ref.zone!=='table'||!['2_40','2_129'].includes(m.cards[ref.id].blueprint)||m.cards[ref.id].owner!==m.cards[p.card.id].owner)throw Error('Invalid Undercover source.');}
  if(p.duel){assertCardReference(m,p.duel,p.card.id);if(p.duel.zone!=='table'||p.duel.version!==p.card.version||p.ended)throw Error('Invalid Undercover duel.');}
  if(!p.ended&&p.card.version===cardVersion(m,p.card.id)){
   if(live.has(p.card.id)||!activeUndercoverSpy(m,p.card.id))throw Error('Invalid current Undercover spy.');live.add(p.card.id);
   if(p.duel){const d=m.data.duel as {stage:string;characters:Record<Side,string>}|undefined;if(!d||d.stage==='complete'||!Object.values(d.characters).includes(p.card.id))throw Error('Orphaned Undercover duel.');}
  }
 }
}
