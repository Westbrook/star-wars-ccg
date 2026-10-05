import {cardDefinition} from './definitions';
import {name} from './board';
import {optionalActionWindow} from './action-timing';
import {capturedShips,capturedShipFor,trappedCharacters} from './captured-ship-state';
import {captureCharacter,captureDestinations,type CaptureDestination} from './captives';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {moveCard} from './state';
import type {Action,Decision,Json,Match,Resolution,Side,Window} from './types';

type Payload={card:CardReference;target:CardReference;count:number;remaining?:CardReference[];chosen?:CardReference};
const action=(p:Payload,step:string):Action=>({id:'prisoner:ship-'+step+':'+p.card.id+':'+p.target.id,handler:'prisoner:ship-'+step,source:p.card.id,label:'We Have A Prisoner · capture the crew',payload:p as unknown as Json});
const queue=(m:Match,p:Payload,step:string)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(p,step)});
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const remaining=(m:Match,p:Payload)=>(p.remaining??[]).filter(ref=>sameCard(m,ref)&&capturedShipFor(m,ref.id)?.id===p.target.id&&captureDestinations(m,ref.id).length);
export function prisonerShipActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark'||!optionalActionWindow(w))return [];
 return m.players.dark.hand.filter(id=>m.cards[id].blueprint==='2_142').flatMap(id=>capturedShips(m).flatMap(ship=>{
  const count=trappedCharacters(m,ship.id).length;if(!count)return [];
  const p:Payload={card:referenceCard(m,id),target:referenceCard(m,ship.id),count};
  return [{...action(p,'play'),payment:{dark:2*count},label:name(m,id)+' · capture '+count+' aboard '+name(m,ship.id)+' · use '+2*count+' Force'}];
 }));
}
export function prisonerShipInitiate(m:Match,r:Resolution):void{const p=data(r);moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);}
export function prisonerShipResolve(m:Match,r:Resolution):void{
 const p=data(r),h=r.action.handler;
 if(h==='prisoner:ship-play'){
  if(r.cancelled){moveCard(m,p.card.id,'lost');return;}
  queue(m,p,'finish');
  if(sameCard(m,p.target)&&m.cards[p.target.id].capturedShip){p.remaining=trappedCharacters(m,p.target.id).map(c=>referenceCard(m,c.id));queue(m,p,'next');}
 }else if(h==='prisoner:ship-next'){
  const refs=remaining(m,p);if(refs.length)m.stack.push({kind:'decision',side:'dark',handler:'prisoner:ship-order',payload:{...p,remaining:refs} as unknown as Json});
 }else if(h==='prisoner:ship-destination'){
  if(p.chosen&&remaining(m,p).some(ref=>ref.id===p.chosen!.id))m.stack.push({kind:'decision',side:'dark',handler:'prisoner:ship-destination',payload:p as unknown as Json});
 }else if(h==='prisoner:ship-finish'){
  if(sameCard(m,p.card))moveCard(m,p.card.id,'lost');
 }else throw Error('Unknown captured crew continuation.');
}
const destinationId=(d:CaptureDestination)=>'prisoner:'+d.kind+('id' in d?':'+d.id:'');
export function prisonerShipChoices(m:Match,d:Decision){
 const p=data(d);
 if(d.handler==='prisoner:ship-order')return remaining(m,p).map(ref=>({id:'prisoner:ship-character:'+ref.id,label:'Capture '+name(m,ref.id)+' ('+ref.id+') next'}));
 if(!p.chosen||!remaining(m,p).some(ref=>ref.id===p.chosen!.id))return [];
 return captureDestinations(m,p.chosen.id).map(dest=>({id:destinationId(dest),label:dest.kind==='escape'?'Escape · place '+name(m,p.chosen!.id)+' in Used':dest.kind==='escort'?'Seize · '+name(m,dest.id)+' ('+dest.id+') escorts '+name(m,p.chosen!.id):'Imprison at '+name(m,dest.id)}));
}
export function prisonerShipChoose(m:Match,d:Decision,choice:string):void{
 if(!prisonerShipChoices(m,d).some(c=>c.id===choice))throw Error('Invalid captured crew choice.');
 const p=data(d);
 if(d.handler==='prisoner:ship-order'){
  const chosen=remaining(m,p).find(ref=>'prisoner:ship-character:'+ref.id===choice)!;
  // Continue with the other characters even when this capture is prevented.
  queue(m,{...p,remaining:remaining(m,p).filter(ref=>ref.id!==chosen.id)},'next');
  queue(m,{...p,chosen},'destination');
  openWindow(m,'response','light',{kind:'about-to-capture',card:chosen.id,cardRef:chosen,source:p.card.id} as unknown as Json);
 }else captureCharacter(m,p.chosen!.id,captureDestinations(m,p.chosen!.id).find(x=>destinationId(x)===choice)!);
}
export function assertPrisonerShip(m:Match):void{
 for(const f of m.stack)if((f.kind==='resolution'&&f.action.handler.startsWith('prisoner:ship-'))||(f.kind==='decision'&&f.handler.startsWith('prisoner:ship-'))){
  const p=data(f),h=f.kind==='resolution'?f.action.handler:f.handler;
  if(!p||!['play','finish','next','order','destination'].some(step=>h==='prisoner:ship-'+step)||!Number.isSafeInteger(p.count)||p.count<1||p.count>m.deckSize||m.cards[p.card?.id]?.blueprint!=='2_142')throw Error('Invalid captured crew Interrupt.');
  for(const ref of [p.card,p.target,...(p.remaining??[]),...(p.chosen?[p.chosen]:[])])assertCardReference(m,ref);
  if(p.card.zone!=='playing'||!sameCard(m,p.card)||m.cards[p.card.id].owner!=='dark'||p.target.zone!=='inactive'||cardDefinition(m,p.target.id).type!=='Starship')throw Error('Invalid captured crew source or ship.');
  if(p.remaining&&(new Set(p.remaining.map(r=>r.id)).size!==p.remaining.length||p.remaining.some(r=>r.zone!=='inactive'||cardDefinition(m,r.id).type!=='Character'||m.cards[r.id].owner!=='light')))throw Error('Invalid captured crew targets.');
  if(p.chosen&&!p.remaining?.some(ref=>JSON.stringify(ref)===JSON.stringify(p.chosen)))throw Error('Unbound captured crew choice.');
  if(f.kind==='resolution'){
   if(f.actor!=='dark'||f.action.source!==p.card.id||f.action.id!==action(p,h.slice('prisoner:ship-'.length)).id||h==='prisoner:ship-play'&&(f.action.payment?.dark!==2*p.count||f.action.payment?.light!==undefined))throw Error('Invalid captured crew action.');
  }else if(f.side!=='dark'||!['prisoner:ship-order','prisoner:ship-destination'].includes(h)||!prisonerShipChoices(m,f).length)throw Error('Invalid captured crew decision.');
 }
}
