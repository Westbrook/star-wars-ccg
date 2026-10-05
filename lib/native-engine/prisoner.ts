import {prisonerShipActions,prisonerShipInitiate,prisonerShipResolve,prisonerShipChoices,prisonerShipChoose,assertPrisonerShip} from './prisoner-ship';
import {cardDefinition} from './definitions';
import {name} from './board';
import {battleMembers} from './participation';
import {captureCharacter,captureDestinations,type CaptureDestination} from './captives';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {lossParent,lossTargets,preventLoss} from './loss-prevention';
import {restoreToNormal} from './restoration';
import {openWindow} from './runtime';
import {moveCard} from './state';
import type {Action,Decision,Json,Match,Resolution,Side,Window} from './types';

type Payload={card:CardReference;target:CardReference;window:number};
const action=(p:Payload,step='play'):Action=>({id:'prisoner:'+p.card.id+':'+p.target.id+':'+step,handler:'prisoner:'+step,source:p.card.id,label:'We Have A Prisoner · capture '+p.target.id,payload:p as unknown as Json});
const queue=(m:Match,p:Payload,step:string)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(p,step)});
const targetEligible=(m:Match,ref:CardReference)=>sameCard(m,ref)&&cardDefinition(m,ref.id).type==='Character'&&battleMembers(m,'light').includes(ref.id)&&captureDestinations(m,ref.id).length>0;
/** Both card modes use the same Interrupt play/cancellation pipeline. */
export function prisonerActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark'||w.timing!=='response'||!lossParent(m,w.serial))return prisonerShipActions(m,w,side);
 const parent=lossParent(m,w.serial)!;
 const targets=lossTargets(w).filter(ref=>targetEligible(m,ref)&&!parent.preventedLosses?.some(p=>p.target.id===ref.id));
 return m.players.dark.hand.filter(id=>m.cards[id].blueprint==='2_142').flatMap(id=>targets.map(target=>{
  const p:Payload={card:referenceCard(m,id),target,window:w.serial};
  return {...action(p),payment:{dark:1},label:name(m,id)+' · capture '+name(m,target.id)};
 }));
}
export function prisonerInitiate(m:Match,r:Resolution):void{
 if(r.action.handler.startsWith('prisoner:ship-')){prisonerShipInitiate(m,r);return;}
 const p=r.action.payload as unknown as Payload;moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);
}
export function prisonerResolve(m:Match,r:Resolution):void{
 if(r.action.handler.startsWith('prisoner:ship-')){prisonerShipResolve(m,r);return;}
 const p=r.action.payload as unknown as Payload,h=r.action.handler;
 if(h==='prisoner:play'){
  if(r.cancelled){moveCard(m,p.card.id,'lost');return;}
  queue(m,p,'finish');
  if(!targetEligible(m,p.target)||!lossParent(m,p.window))return;
  preventLoss(m,p.window,p.target);restoreToNormal(m,p.target.id);queue(m,p,'capture');
  openWindow(m,'response','light',{kind:'restored-to-normal',card:p.target.id,cardRef:p.target,source:p.card.id} as unknown as Json);
 }else if(h==='prisoner:capture'){
  if(!sameCard(m,p.target)||!captureDestinations(m,p.target.id).length)return;
  queue(m,p,'destination');
  openWindow(m,'response','light',{kind:'about-to-capture',card:p.target.id,cardRef:p.target,source:p.card.id} as unknown as Json);
 }else if(h==='prisoner:destination'){
  if(sameCard(m,p.target)&&captureDestinations(m,p.target.id).length)m.stack.push({kind:'decision',side:'dark',handler:'prisoner:destination',payload:p as unknown as Json});
 }else if(h==='prisoner:finish'){
  if(sameCard(m,p.card))moveCard(m,p.card.id,'lost');
 }else throw Error('Unknown capture Interrupt continuation.');
}
const destinationId=(d:CaptureDestination)=>'prisoner:'+d.kind+('id' in d?':'+d.id:'');
export function prisonerChoices(m:Match,d:Decision){
 if(d.handler.startsWith('prisoner:ship-'))return prisonerShipChoices(m,d);
 const p=d.payload as unknown as Payload;
 return sameCard(m,p.target)?captureDestinations(m,p.target.id).map(destination=>({id:destinationId(destination),label:destination.kind==='escape'?'Escape · place '+name(m,p.target.id)+' in Used':destination.kind==='escort'?'Seize · '+name(m,destination.id)+' ('+destination.id+') escorts '+name(m,p.target.id):'Imprison at '+name(m,destination.id)})):[];
}
export function prisonerChoose(m:Match,d:Decision,choice:string):void{
 if(d.handler.startsWith('prisoner:ship-')){prisonerShipChoose(m,d,choice);return;}
 const p=d.payload as unknown as Payload,destination=captureDestinations(m,p.target.id).find(x=>destinationId(x)===choice);
 if(!sameCard(m,p.target)||!destination)throw Error('Invalid capture choice.');
 captureCharacter(m,p.target.id,destination);
}
export function assertPrisoner(m:Match):void{
 assertPrisonerShip(m);
 for(const [index,f] of m.stack.entries())if((f.kind==='resolution'&&f.action.handler.startsWith('prisoner:'))||(f.kind==='decision'&&f.handler.startsWith('prisoner:'))){
  if((f.kind==='resolution'?f.action.handler:f.handler).startsWith('prisoner:ship-'))continue;
  const p=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as Payload,h=f.kind==='resolution'?f.action.handler:f.handler;
  if(!p||!['prisoner:play','prisoner:capture','prisoner:destination','prisoner:finish'].includes(h)||!Number.isSafeInteger(p.window)||m.cards[p.card?.id]?.blueprint!=='2_142')throw Error('Invalid capture Interrupt.');
  assertCardReference(m,p.card);assertCardReference(m,p.target);
  if(p.card.zone!=='playing'||!sameCard(m,p.card)||p.target.zone!=='table'||m.cards[p.card.id].owner!=='dark'||m.cards[p.target.id].owner!=='light'||cardDefinition(m,p.target.id).type!=='Character')throw Error('Invalid capture Interrupt references.');
  const i=m.stack.findIndex(q=>q.kind==='window'&&q.serial===p.window),w=m.stack[i];
  if(i<0||i>=index||w.kind!=='window'||!lossTargets(w).some(ref=>ref.id===p.target.id&&ref.version===p.target.version&&ref.zone===p.target.zone)||!lossParent(m,p.window))throw Error('Invalid capture Interrupt loss binding.');
  if(['prisoner:capture','prisoner:destination'].includes(h)&&!lossParent(m,p.window)!.preventedLosses?.some(x=>x.target.id===p.target.id&&x.target.version===p.target.version))throw Error('Capture continuation has not replaced its original loss.');
  if(f.kind==='resolution'){
   if(f.actor!=='dark'||f.action.source!==p.card.id||f.action.id!==action(p,h.slice(9)).id||h==='prisoner:play'&&(f.action.payment?.dark!==1||f.action.payment?.light!==undefined))throw Error('Invalid capture Interrupt action.');
  }else if(f.side!=='dark'||h!=='prisoner:destination'||!prisonerChoices(m,f).length)throw Error('Invalid capture destination decision.');
 }
}
