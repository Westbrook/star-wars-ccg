import {fourthMarkers,generator,outerHothMarker} from './hoth';
import {sitePlacements} from './board';
import {cardDefinition} from './definitions';
import {groundInitiate} from './ground';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {moveCard,shufflePile} from './state';
import {openWindow,type Context} from './runtime';
import {other} from './types';
import type {Match,Resolution,Decision,Json} from './types';
type Pending={source:CardReference;parent:string};
const data=(d:Decision)=>d.payload as unknown as Pending;
const parent=(m:Match,p:Pending)=>m.stack.find((f):f is Resolution=>f.kind==='resolution'&&f.action.id===p.parent);
/** A required Reserve deployment is a targeting prerequisite, before the
 * generator's response window. Its shield cannot protect the nested deployment. */
export function beginHothDeployment(m:Match,r:Resolution){
 const p=r.action.payload as {card?:string};
 if(r.action.handler!=='ground:site'||!p.card||!generator(m,p.card)||m.locations.some(id=>outerHothMarker(m,id)))return;
 m.stack.push({kind:'decision',side:r.actor,handler:'hoth:marker',payload:{source:referenceCard(m,p.card),parent:r.action.id} as unknown as Json});
}
function markers(m:Match,d:Decision){return fourthMarkers(m,d.side).flatMap(card=>sitePlacements(m,card).map(p=>({id:'hoth:marker:'+card+':'+p.id,label:'Deploy required '+cardDefinition(m,card).name+' · '+p.label,card,placement:p.id})));}
export function hothChoices(m:Match,d:Decision){
 if(d.handler==='hoth:marker')return markers(m,d);
 if(!m.locations.some(id=>outerHothMarker(m,id)))return [{id:'hoth:abort',label:'Return Main Power Generators to hand · prerequisite failed'}];
 return sitePlacements(m,data(d).source.id).map(p=>({id:'hoth:place:'+p.id,label:'Place Main Power Generators · '+p.label}));
}
export function hothChoose(m:Match,d:Decision,choice:string){
 const p=data(d),r=parent(m,p)!;
 if(d.handler==='hoth:marker'){
  const selected=markers(m,d).find(c=>c.id===choice);if(!selected)throw Error('Invalid required Hoth marker.');
  m.stack.push({...d,handler:'hoth:placement'});
  m.stack.push({kind:'resolution',actor:d.side,cancelled:false,action:{id:'hoth:shuffle:'+p.parent,handler:'hoth:shuffle',label:'Reshuffle Reserve Deck',payload:null}});
  m.stack.push({kind:'resolution',actor:d.side,cancelled:false,action:{id:choice,handler:'hoth:deploy',source:selected.card,label:selected.label,payload:{card:referenceCard(m,selected.card),placement:selected.placement} as unknown as Json}});
  openWindow(m,'response',other(d.side),{kind:'looked-at-cards-in-pile',side:d.side,pile:'reserve'});
 }else if(choice==='hoth:abort'){r.action.handler='hoth:failed';}
 else{(r.action.payload as {placement:string}).placement=choice.slice('hoth:place:'.length);}
}
export function hothResolve(m:Match,r:Resolution,context:Context){
 if(r.action.handler==='hoth:deploy'){
  const p=r.action.payload as unknown as {card:CardReference;placement:string};if(r.cancelled||!sameCard(m,p.card))return;
  const nested:Resolution={...r,awaitingResponses:true,action:{...r.action,handler:'ground:site',payload:{card:p.card.id,placement:p.placement}}};m.stack.push(nested);groundInitiate(m,nested);
 }else if(r.action.handler==='hoth:shuffle')shufflePile(m,r.actor,'reserve',context.entropy);
 else if(r.action.handler==='hoth:failed')moveCard(m,(r.action.payload as {card:string}).card,'hand');
 else throw Error('Unknown Hoth continuation.');
}
export function assertHothDeployment(m:Match){
 for(const f of m.stack)if(f.kind==='decision'&&f.handler.startsWith('hoth:')){
  const p=data(f);assertCardReference(m,p.source);const r=parent(m,p);
  if(!['hoth:marker','hoth:placement'].includes(f.handler)||!generator(m,p.source.id)||p.source.zone!=='playing'||!sameCard(m,p.source)||!r||r.actor!==f.side||!r.awaitingResponses||r.action.handler!=='ground:site'||(r.action.payload as {card:string}).card!==p.source.id||m.stack.indexOf(r)>=m.stack.indexOf(f))throw Error('Invalid required Hoth deployment.');
 }
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('hoth:')){
  if(f.action.handler==='hoth:deploy'){
   const p=f.action.payload as unknown as {card:CardReference;placement:string};assertCardReference(m,p.card);
   if(p.card.zone!=='reserve'||m.cards[p.card.id].owner!==f.actor||!['3_62','3_149'].includes(m.cards[p.card.id].blueprint)||f.action.source!==p.card.id||f.action.id!=='hoth:marker:'+p.card.id+':'+p.placement||f.awaitingResponses)throw Error('Invalid Hoth Reserve deployment.');
  }else if(f.action.handler==='hoth:shuffle'){
   if(f.cancelled||f.awaitingResponses||f.action.payload!==null||!m.stack.some(d=>d.kind==='decision'&&d.handler==='hoth:placement'&&d.side===f.actor&&f.action.id==='hoth:shuffle:'+data(d).parent))throw Error('Invalid Hoth reshuffle.');
  }else if(f.action.handler!=='hoth:failed'||!generator(m,(f.action.payload as {card:string}).card))throw Error('Invalid Hoth continuation.');
 }
}
