import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {crewActive} from './occupancy';
import {openWindow,type RequiredAction} from './runtime';
import {ionizedShip,restoreIonDamage} from './stat-modifiers';
import {other,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={source:CardReference;target:CardReference;turn:number;window:number};
const droid=(m:Match,id:string)=>['2_15','2_101'].includes(m.cards[id]?.blueprint);
const action=(m:Match,p:Payload)=>({id:'ion-repair:'+p.source.id+':'+p.source.version+':'+p.target.id+':'+p.target.version,handler:'ion-repair:restore',source:p.source.id,label:cardDefinition(m,p.source.id).name+' · repair '+cardDefinition(m,p.target.id).name,payload:p as unknown as Json});
/** Printed automatic "during your control phase" actions resolve at its end.
 * The phase snapshot excludes newly arriving/returning copies. */
export function ionRepairAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;phase?:string;side?:Side;sources?:CardReference[]}|undefined;
 if(w.timing!=='response'||e?.kind!=='phase-end'||e.phase!=='control')return [];
 return (e.sources??[]).filter(ref=>droid(m,ref.id)&&sameCard(m,ref)&&m.cards[ref.id].owner===e.side&&gameTextActive(m,ref.id)&&crewActive(m,ref.id)).flatMap(source=>{
  const c=m.cards[source.id],ship=m.cards[c.attachedTo!],target=e.sources?.find(ref=>ref.id===ship?.id&&sameCard(m,ref));
  if(!c.aboardRole||!ship||!target||ship.owner!==c.owner||cardDefinition(m,ship.id).type!=='Starship'||!ionizedShip(m,ship.id))return [];
  const p={source,target,turn:m.turn.number,window:w.serial};return [{...action(m,p),actor:c.owner}];
 });
}
export function ionRepairResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload;
 // Once initiated, source departure or loss of text does not undo the repair.
 // The original target must still exist; a returning ship is a new instance.
 if(!r.cancelled&&sameCard(m,p.target)){
  restoreIonDamage(m,p.target.id);
  openWindow(m,'response',other(r.actor),{kind:'attributes-restored',source:p.source.id,target:p.target.id,cause:'ion-repair'});
 }
}
export function assertIonRepair(m:Match):void {
 for(const [i,r] of m.stack.entries())if(r.kind==='resolution'&&r.action.handler.startsWith('ion-repair:')){
  const p=r.action.payload as unknown as Payload,parent=m.stack.slice(0,i).find(f=>f.kind==='window'&&f.serial===p?.window);
  if(!p||r.action.handler!=='ion-repair:restore'||!droid(m,p.source?.id)||r.action.source!==p.source.id||r.actor!==m.cards[p.source.id].owner||!Number.isSafeInteger(p.turn)||p.turn!==m.turn.number||!Number.isSafeInteger(p.window)||!parent||parent.kind!=='window'||!parent.completed.includes(r.action.id))throw Error('Invalid ion repair continuation.');
  assertCardReference(m,p.source);assertCardReference(m,p.target);
  const e=parent.event as {kind?:string;phase?:string;side?:Side;sources?:CardReference[]};
  if(p.source.zone!=='table'||p.target.zone!=='table'||cardDefinition(m,p.target.id).type!=='Starship'||m.cards[p.target.id].owner!==r.actor||r.action.id!==action(m,p).id||e?.kind!=='phase-end'||e.phase!=='control'||e.side!==r.actor||!e.sources?.some(ref=>ref.id===p.source.id&&ref.version===p.source.version)||!e.sources?.some(ref=>ref.id===p.target.id&&ref.version===p.target.version))throw Error('Invalid ion repair bindings.');
 }
}
