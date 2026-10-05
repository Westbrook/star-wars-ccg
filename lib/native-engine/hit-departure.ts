import {battleMembers} from './participation';
import type {Battle} from './battle';
import {assertCardReference,cardVersion,referenceCard,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {lossPrevented,type PreventedLoss} from './loss-prevention';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Json,type Match,type Resolution} from './types';

type Payload={targets:CardReference[];site:CardReference;serial:number;losses?:CardReference[]};
export type HitDepartureEvent={serial:number;window:number;targets:CardReference[];resolved:boolean;replacements?:{target:CardReference;location:string|null;prevention:PreventedLoss}[]};
const handler='hit-departure:lose';
const battle=(m:Match)=>m.data.battle as Battle|undefined;
const onTable=['table','captive','inactive','stacked'];
const same=(a:CardReference,b:CardReference)=>a.id===b.id&&a.zone===b.zone&&a.version===b.version;
const physical=(m:Match,ref:CardReference)=>onTable.includes(m.cards[ref.id]?.zone)&&cardVersion(m,ref.id)===ref.version;
/** Movement and exclusion do not restore a hit. Actual departure from table
 * does: leaveTable clears the old instance, as do explicit restoration effects.
 * AR p96 requires immediate loss outside battle, before relocation responses or
 * another mandatory transition (for example stealing an emptied captured ship).
 */
function outside(m:Match,id:string):boolean {
 const b=battle(m);return !!b&&b.hits.includes(id)&&onTable.includes(m.cards[id]?.zone)&&
  (b.stage==='complete'||!sides.some(side=>battleMembers(m,side).includes(id)));
}
export function scheduleHitDeparture(m:Match):boolean {
 const b=battle(m);if(!b)return false;
 // A required rule is triggered by an event, not a perpetual state-based loss.
 // Keep the completed replacement only for that hit episode, destination and
 // table instance. Restoration/re-entry/new instance removes its protection.
 for(const event of b.hitDepartures??[])if(event.replacements)event.replacements=event.replacements.filter(r=>sameCard(m,r.target)&&outside(m,r.target.id)&&r.location===(m.cards[r.target.id].location??null));
 // A saved legacy Alternatives loss already owns its response and replacement.
 if(m.stack.some(f=>f.kind==='resolution'&&(f.action.handler.startsWith('hit-departure:')||f.action.handler==='alternatives:hit-loss')))return false;
 const targets=b.hits.filter(id=>outside(m,id)&&!b.hitDepartures?.some(e=>e.replacements?.some(r=>r.target.id===id))).map(id=>referenceCard(m,id));
 if(!targets.length)return false;
 const p:Payload={targets,site:referenceCard(m,b.site),serial:++m.serial},actor=m.cards[targets[0].id].owner;
 m.stack.push({kind:'resolution',actor,cancelled:false,action:{id:handler+':'+p.serial,handler,label:'Lose hit cards outside battle',payload:p as unknown as Json}});
 const cards=tableLossCards(m,targets.map(ref=>ref.id));
 openWindow(m,'response',other(actor),{kind:'about-to-lose',cards,cardRefs:cards.filter(id=>onTable.includes(m.cards[id].zone)).map(id=>referenceCard(m,id)),site:b.site,cause:'hit-outside-battle'} as unknown as Json);
 (b.hitDepartures??=[]).push({serial:p.serial,window:m.serial,targets:structuredClone(targets),resolved:false});
 return true;
}
export function hitDepartureResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='hit-departure:result'){
  const cards=(p.losses??[]).filter(ref=>m.cards[ref.id].zone==='lost'&&cardVersion(m,ref.id)===ref.version+2).map(ref=>ref.id);
  if(cards.length)openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards,site:p.site.id,cause:'hit-outside-battle'});
  return;
 }
 // Restoration, removal and a new table visit during responses all invalidate
 // this obligation. loseFromTable honors this resolution's loss replacements.
 const event=battle(m)?.hitDepartures?.find(e=>e.serial===p.serial);
 if(!event||event.resolved)throw Error('Missing hit departure event.');
 event.resolved=true;
 const ids=p.targets.filter(ref=>physical(m,ref)&&outside(m,ref.id)).map(ref=>ref.id);
 // Current card replacements restore hit themselves. This also honors the
 // core contract for a future replacement which only prevents this one loss.
 event.replacements=ids.filter(id=>lossPrevented(m,id)).flatMap(id=>{
  const prevention=r.preventedLosses?.find(p=>p.target.id===id);return prevention?[{target:referenceCard(m,id),location:m.cards[id].location??null,prevention:structuredClone(prevention)}]:[];
 });
 if(!r.cancelled&&ids.length){
  const refs=tableLossCards(m,ids).map(id=>referenceCard(m,id));
  const result:Resolution={kind:'resolution',actor:r.actor,cancelled:false,action:{id:'hit-departure:result:'+p.serial,handler:'hit-departure:result',label:'Resolve hit card losses',payload:{...p,losses:refs} as unknown as Json}};
  m.stack.push(result);const lost=loseFromTable(m,ids);
  (result.action.payload as unknown as Payload).losses=refs.filter(ref=>lost.includes(ref.id));
 }
}
export function assertHitDeparture(m:Match):void {
 const events=battle(m)?.hitDepartures??[],serials=new Set<number>();
 if(!Array.isArray(events))throw Error('Invalid hit departure history.');
 for(const e of events){
  if(!e||!Number.isSafeInteger(e.serial)||e.serial<1||serials.has(e.serial)||!Number.isSafeInteger(e.window)||e.window!==e.serial+1||e.window>m.serial||typeof e.resolved!=='boolean'||!Array.isArray(e.targets)||!e.targets.length||new Set(e.targets.map(r=>r.id)).size!==e.targets.length)throw Error('Invalid hit departure event.');
  serials.add(e.serial);for(const ref of e.targets){assertCardReference(m,ref);if(!onTable.includes(ref.zone))throw Error('Invalid historical hit target.');}
  if(e.replacements!==undefined){if(!e.resolved||!Array.isArray(e.replacements)||new Set(e.replacements.map(r=>r.target.id)).size!==e.replacements.length)throw Error('Invalid handled hit loss.');for(const r of e.replacements){assertCardReference(m,r.target);assertCardReference(m,r.prevention?.target);if(!e.targets.some(t=>same(t,r.prevention.target))||r.prevention.window!==e.window||r.target.id!==r.prevention.target.id||r.target.version!==r.prevention.target.version||!onTable.includes(r.target.zone)||r.location!==null&&!m.cards[r.location])throw Error('Invalid handled hit loss provenance.');}}
  if(!e.resolved&&!m.stack.some(f=>f.kind==='resolution'&&f.action.handler===handler&&(f.action.payload as unknown as Payload).serial===e.serial))throw Error('Orphaned hit departure event.');
 }
 let found=false;
 for(const [i,f] of m.stack.entries())if(f.kind==='resolution'&&f.action.handler.startsWith('hit-departure:')){
  const p=f.action.payload as unknown as Payload,w=m.stack[i+1];
  const result=f.action.handler==='hit-departure:result';
  if(found||![handler,'hit-departure:result'].includes(f.action.handler)||f.cancelled||f.awaitingResponses||f.action.payment||f.action.source||f.action.unrespondable||!p||!Number.isSafeInteger(p.serial)||p.serial<1||p.serial>m.serial||f.action.id!==f.action.handler+':'+p.serial||!Array.isArray(p.targets)||!p.targets.length||new Set(p.targets.map(ref=>ref.id)).size!==p.targets.length)throw Error('Invalid departed hit loss.');
  found=true;assertCardReference(m,p.site);if(p.site.zone!=='table'||p.site.id!==battle(m)?.site)throw Error('Invalid departed hit battle.');
  const event=events.find(e=>e.serial===p.serial);if(!event||event.resolved!==result||JSON.stringify(event.targets)!==JSON.stringify(p.targets))throw Error('Unbound hit departure event.');
  const refs=w?.kind==='window'?(w.event as {cardRefs?:CardReference[]})?.cardRefs:undefined;
  for(const ref of p.targets){assertCardReference(m,ref);if(!onTable.includes(ref.zone)||!result&&!refs?.some(r=>r.id===ref.id&&r.zone===ref.zone&&r.version===ref.version))throw Error('Invalid departed hit target.');}
  if(!sides.includes(f.actor)||!result&&(w?.kind!=='window'||w.serial!==event.window||w.timing!=='response'||(w.event as {kind?:string;cause?:string})?.kind!=='about-to-lose'||(w.event as {cause?:string}).cause!=='hit-outside-battle'))throw Error('Invalid departed hit loss response.');
  if(result){if(!Array.isArray(p.losses)||new Set(p.losses.map(r=>r.id)).size!==p.losses.length)throw Error('Invalid completed hit losses.');for(const ref of p.losses){assertCardReference(m,ref);if(!onTable.includes(ref.zone))throw Error('Invalid completed hit target.');}}
  else if(p.losses!==undefined)throw Error('Premature hit loss results.');
 }
}
