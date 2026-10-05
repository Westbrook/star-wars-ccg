import type {Battle} from './battle';
import {cardDefinition} from './definitions';
import {pendingForfeiture} from './forfeiture';
import {activeChewbacca as active} from './chewbacca-state';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {lossParent,lossTargets,preventLoss} from './loss-prevention';
import type {RequiredAction} from './runtime';
import {placeInUsedFromTable,tableLossCards} from './table';
import type {Action,Json,Match,Resolution,Window} from './types';

const battle=(m:Match)=>m.data.battle as Battle|undefined;
type Payload={source:CardReference;target:CardReference;site:CardReference;window:number;forfeiture?:string};
const repairable=(m:Match,id:string)=>['Starship','Vehicle'].includes(cardDefinition(m,id).type)||cardDefinition(m,id).type==='Character'&&cardDefinition(m,id).subType==='Droid';
function qualifies(m:Match,source:string,target:string):boolean{
 const c=m.cards[source],t=m.cards[target];return active(m,source)&&t?.zone==='table'&&repairable(m,target)&&c.owner===t.owner&&!!t.location&&t.location===c.location&&cardDefinition(m,t.location).subType==='Site'&&!!battle(m)?.hits.includes(target);
}
const action=(p:Payload):Action=>({id:'chewbacca:repair:'+p.source.id+':'+p.target.id+':'+p.window,handler:'chewbacca:repair',source:p.source.id,label:'Chewbacca · place '+p.target.id+' in Used instead',payload:p as unknown as Json});
export function chewbaccaAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;forfeiture?:string}|undefined;if(w.timing!=='response'||!['about-to-forfeit','about-to-lose'].includes(e?.kind??''))return [];
 const f=e?.kind==='about-to-forfeit'&&e.forfeiture?pendingForfeiture(m,e.forfeiture):undefined;
 const targets=f?(f.destination==='lost'?[f.target]:[]):e?.kind==='about-to-lose'&&lossParent(m,w.serial)?lossTargets(w):[];
 return targets.filter(ref=>sameCard(m,ref)&&ref.zone==='table').flatMap(target=>Object.values(m.cards).filter(c=>qualifies(m,c.id,target.id)).map(source=>{
  const p:Payload={source:referenceCard(m,source.id),target,site:referenceCard(m,m.cards[target.id].location!),window:w.serial,...(f?{forfeiture:f.id}:{})};
  return {...action(p),label:'Chewbacca · place '+cardDefinition(m,target.id).name+' in Used instead',actor:source.owner};
 }));
}
export function chewbaccaResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;if(r.cancelled||!sameCard(m,p.target))return;
 if(p.forfeiture){const f=pendingForfeiture(m,p.forfeiture);if(f&&f.target.id===p.target.id&&f.target.version===p.target.version&&f.destination==='lost')f.destination='used';return;}
 const parent=lossParent(m,p.window),w=m.stack.find(f=>f.kind==='window'&&f.serial===p.window);if(!parent||w?.kind!=='window')return;
 // Dependents still go to Lost during this replacement. Prevent the suspended
 // original loss from trying to remove those same departed physical cards again.
 const group=new Set(tableLossCards(m,[p.target.id]));
 for(const ref of lossTargets(w))if(group.has(ref.id))preventLoss(m,p.window,ref);
 placeInUsedFromTable(m,p.target.id);
}
export function assertChewbacca(m:Match):void{
 for(const [i,f]of m.stack.entries())if(f.kind!=='window'&&(f.kind==='resolution'?f.action.handler:f.handler).startsWith('chewbacca:')){
  if(f.kind!=='resolution'||f.action.handler!=='chewbacca:repair')throw Error('Unknown Chewbacca continuation.');
  const p=f.action.payload as unknown as Payload;if(!p)throw Error('Invalid Chewbacca replacement.');
  for(const ref of [p.source,p.target,p.site]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid Chewbacca table reference.');}
  const wi=m.stack.findIndex(w=>w.kind==='window'&&w.serial===p.window),w=m.stack[wi];
  if(wi<0||wi>=i||w.kind!=='window'||w.timing!=='response'||m.cards[p.source.id].blueprint!=='2_3'||m.cards[p.source.id].owner!==f.actor||m.cards[p.target.id].owner!==f.actor||!repairable(m,p.target.id)||cardDefinition(m,p.site.id).subType!=='Site'||f.action.id!==action(p).id||f.action.source!==p.source.id||f.action.payment||f.action.unrespondable)throw Error('Invalid Chewbacca source or action.');
  const e=w.event as {kind?:string;forfeiture?:string};
  if(p.forfeiture){const original=m.stack[wi-1];if(e.kind!=='about-to-forfeit'||e.forfeiture!==p.forfeiture||original?.kind!=='resolution'||original.action.handler!=='forfeiture:leave')throw Error('Invalid Chewbacca forfeiture.');const target=(original.action.payload as unknown as {target:CardReference}).target;if(target.id!==p.target.id||target.version!==p.target.version)throw Error('Unbound Chewbacca forfeiture target.');}
  else if(e.kind!=='about-to-lose'||!lossParent(m,p.window)||!lossTargets(w).some(ref=>ref.id===p.target.id&&ref.version===p.target.version&&ref.zone===p.target.zone))throw Error('Unbound Chewbacca loss target.');
 }
}
