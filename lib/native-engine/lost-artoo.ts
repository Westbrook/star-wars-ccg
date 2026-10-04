import {cardDefinition} from './definitions';
import {deployed} from './deployment';
import {drawDestiny} from './destiny';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {isModel} from './characteristics';
import {occupants} from './occupancy';
import {hasNavComputer,navigationLosses,navigationLossActive,type NavigationLoss} from './navigation';
import {canEnterTable} from './persona';
import {openWindow,type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable,tableLossCards} from './table';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;ship:CardReference;astromech?:CardReference;serial?:number;total?:number|null};
const action=(step:string,p:Payload):Action=>({id:'lost-artoo:'+step+':'+p.card+':'+p.ship.id+':'+(p.astromech?.id??'nav'),handler:'lost-artoo:'+step,source:p.card,label:'Resolve I’ve Lost Artoo!',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(step,p)});
const targetLive=(m:Match,p:Payload)=>sameCard(m,p.ship)&&(p.astromech?sameCard(m,p.astromech)&&m.cards[p.astromech.id].attachedTo===p.ship.id:hasNavComputer(m,p.ship.id));
export function lostArtooActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark'||w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='deploy')return [];
 return m.players.dark.hand.filter(id=>m.cards[id].blueprint==='1_218').flatMap(card=>Object.values(m.cards).filter(c=>c.zone==='table'&&!c.coveredBy&&cardDefinition(m,c.id).type==='Starship').flatMap(c=>{
  const targets:(CardReference|undefined)[]=[...(hasNavComputer(m,c.id)?[undefined]:[]),...occupants(m,c.id).filter(d=>isModel(m,d.id,'ASTROMECH')).map(d=>referenceCard(m,d.id))];
  return targets.map(astromech=>({...action('deploy',{card,ship:referenceCard(m,c.id),...(astromech?{astromech}:{})}),label:'I’ve Lost Artoo! · '+cardDefinition(m,c.id).name+' · '+(astromech?cardDefinition(m,astromech.id).name:'navigation computer')+' · 1 Force',payment:{dark:1}}));
 }));
}
export function lostArtooInitiate(m:Match,r:Resolution):void{if(r.action.handler==='lost-artoo:deploy')moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
export function lostArtooAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;card?:string}|undefined;if(w.timing!=='response'||e?.kind!=='deployed')return [];
 return navigationLosses(m).filter(p=>p.source.id===e.card&&p.window===w.serial&&p.stage==='pending'&&sameCard(m,p.source)&&gameTextActive(m,p.source.id)).map(p=>({...action('draw',{card:p.source.id,ship:p.ship,...(p.astromech?{astromech:p.astromech}:{}),serial:p.serial}),label:'I’ve Lost Artoo! · draw destiny',actor:'dark'}));
}
export function lostArtooResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,h=r.action.handler;
 if(h==='lost-artoo:deploy'){
  if(r.cancelled||!canEnterTable(m,p.card)||!targetLive(m,p)){moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.ship.id;m.cards[p.card].location=m.cards[p.ship.id].location;
  const entry:NavigationLoss={serial:++m.serial,source:referenceCard(m,p.card),ship:p.ship,...(p.astromech?{astromech:p.astromech}:{}),window:m.serial+1,stage:'pending'};
  m.data.navigationLosses=[...navigationLosses(m),entry] as unknown as Json;deployed(m,p.card);return;
 }
 const d=navigationLosses(m).find(x=>x.serial===p.serial);if(!d)throw Error('Missing navigation loss.');
 if(r.cancelled)return;
 if(h==='lost-artoo:draw'){d.stage='destiny';drawDestiny(m,'dark',p.card,'lost-artoo',action('result',p));}
 else if(h==='lost-artoo:result'){
  d.destiny=p.total??null;d.success=d.destiny!==null&&d.destiny>1;d.stage='complete';
  if(d.success&&!d.astromech)return;
  queue(m,'finish',p);
  if(d.success&&d.astromech&&sameCard(m,d.astromech)){
   queue(m,'lose',p);const cards=tableLossCards(m,[d.astromech.id]);openWindow(m,'response','light',{kind:'about-to-lose',card:d.astromech.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,cause:'lost-artoo'} as unknown as Json);
  }
 }else if(h==='lost-artoo:lose'){
  if(d.astromech&&sameCard(m,d.astromech)){d.lost=true;queue(m,'lost',p);loseFromTable(m,[d.astromech.id]);}
 }else if(h==='lost-artoo:lost')openWindow(m,'response',other(m.cards[d.astromech!.id].owner),{kind:'character-lost',card:d.astromech!.id,source:p.card,cause:'lost-artoo'});
 else if(h==='lost-artoo:finish'){if(sameCard(m,d.source))loseFromTable(m,[p.card]);}
 else throw Error('Unknown navigation loss continuation.');
}
export function lostArtooView(m:Match){const d=navigationLosses(m).at(-1);return {capacityReturns:((m.data.capacityReturns??[]) as unknown as {name:string;turn:number}[]).filter(p=>p.turn===m.turn.number).map(p=>p.name),navigationLoss:d?{ship:cardDefinition(m,d.ship.id).name,target:d.astromech?cardDefinition(m,d.astromech.id).name:'Navigation computer',stage:d.stage,destiny:d.destiny??null,success:!!d.success,active:navigationLossActive(m,d),lost:!!d.lost}:null};}
const sameRef=(a:CardReference|undefined,b:CardReference|undefined)=>a?.id===b?.id&&a?.zone===b?.zone&&a?.version===b?.version;
export function assertLostArtoo(m:Match):void{
 if(m.data.navigationLosses!==undefined&&!Array.isArray(m.data.navigationLosses))throw Error('Invalid navigation history.');
 const seen=new Set<number>();
 for(const d of navigationLosses(m)){
  assertCardReference(m,d.source);assertCardReference(m,d.ship);if(d.astromech)assertCardReference(m,d.astromech);
  if(!Number.isSafeInteger(d.serial)||d.serial<1||d.serial>m.serial||seen.has(d.serial)||!Number.isSafeInteger(d.window)||d.window<=d.serial||d.window>m.serial||m.cards[d.source.id].blueprint!=='1_218'||d.source.zone!=='table'||d.ship.zone!=='table'||cardDefinition(m,d.ship.id).type!=='Starship'||d.astromech&&(d.astromech.zone!=='table'||!isModel(m,d.astromech.id,'ASTROMECH'))||!['pending','destiny','complete'].includes(d.stage))throw Error('Invalid navigation loss record.');seen.add(d.serial);
  if(d.stage==='complete'&&(d.destiny===undefined||d.destiny!==null&&(!Number.isFinite(d.destiny)||d.destiny<0)||d.success!==(d.destiny!==null&&d.destiny>1))||d.lost!==undefined&&(d.lost!==true||!d.success||!d.astromech))throw Error('Invalid navigation outcome.');
 }
 const check=(p:Payload)=>{
  const d=navigationLosses(m).find(x=>x.serial===p.serial);
  if(!d||p.card!==d.source.id||!sameRef(p.ship,d.ship)||!sameRef(p.astromech,d.astromech))throw Error('Invalid navigation continuation bindings.');return d;
 };
 for(const r of m.stack)if(r.kind==='resolution'){
  if(r.action.handler.startsWith('destiny:')){const f=r.action.payload as {source?:string;side?:Side;category?:string;next?:{handler:string;payload:Payload}};if(f.next?.handler==='lost-artoo:result'){const d=check(f.next.payload);if(d.stage!=='destiny'||f.source!==d.source.id||f.side!=='dark'||f.category!=='lost-artoo')throw Error('Invalid navigation destiny.');}continue;}
  if(!r.action.handler.startsWith('lost-artoo:'))continue;
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if(!p||r.actor!=='dark'||m.cards[p.card]?.blueprint!=='1_218'||r.action.source!==p.card||!['deploy','draw','result','lose','lost','finish'].some(x=>h==='lost-artoo:'+x)||r.action.id!==action(h.slice(11),p).id)throw Error('Invalid navigation action.');
  assertCardReference(m,p.ship);if(p.astromech)assertCardReference(m,p.astromech);
  if(p.ship.zone!=='table'||cardDefinition(m,p.ship.id).type!=='Starship'||p.astromech&&(p.astromech.zone!=='table'||!isModel(m,p.astromech.id,'ASTROMECH')))throw Error('Invalid navigation target.');
  if(h==='lost-artoo:deploy'){if(m.cards[p.card].zone!=='playing'||p.serial!==undefined||r.action.payment?.dark!==1)throw Error('Invalid navigation deployment.');}
  else{const d=check(p);if(h==='lost-artoo:draw'&&!m.stack.some(w=>w.kind==='window'&&w.serial===d.window&&w.completed.includes(r.action.id)&&(w.event as {kind?:string;card?:string})?.kind==='deployed'&&(w.event as {card:string}).card===p.card))throw Error('Missing navigation deployment trigger.');}
 }
}
