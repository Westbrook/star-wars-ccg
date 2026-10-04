import {optionalActionWindow} from './action-timing';
import {battle,members} from './battle';
import {cardDefinition,isGuard,isSite,moveWithAttachments,name,system} from './board';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {corulagAllowsGuardMove} from './otsd-locations';
import {barred} from './participation';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {loseFromTable,tableLossCards} from './table';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;mode:'relocate'|'crush';origin?:CardReference;destination?:CardReference;targets:CardReference[];window?:number;index?:number;selected?:CardReference;lost?:string[]};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const action=(step:string,p:Payload):Action=>({id:'compactor:'+step+':'+p.card,handler:'compactor:'+step,source:p.card,label:step==='play'?(p.mode==='crush'?'Crush everything in the Trash Compactor':'Relocate your characters to the Trash Compactor'):'Resolve '+p.mode,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
const compactors=(m:Match)=>m.locations.filter(id=>m.cards[id].blueprint==='1_125'&&!m.cards[id].coveredBy&&!m.cards[id].blownAway);
// Relocation is unlimited movement, not landspeed or a regular move. Existing
// movement prohibitions still apply; spending a regular move does not prohibit it.
const canRelocate=(m:Match,id:string)=>!barred(m,id)&&(!isGuard(m.cards[id].blueprint)||corulagAllowsGuardMove(m,id));
const movers=(m:Match,p:Payload)=>sameCard(m,p.origin!)&&sameCard(m,p.destination!)&&compactors(m).includes(p.destination!.id)?p.targets.filter(ref=>sameCard(m,ref)&&m.cards[ref.id].location===p.origin!.id&&members(m,'light').includes(ref.id)&&canRelocate(m,ref.id)):[];
const remaining=(m:Match,p:Payload)=>p.targets.filter(ref=>sameCard(m,ref));
export function compactorActions(m:Match,w:Window,side:Side):Action[]{
 const sites=compactors(m);if(!sites.length)return [];
 const result:Action[]=[],b=battle(m),parent=m.stack.at(-2);
 for(const card of m.players[side].hand){
  if(m.cards[card].blueprint==='1_278'&&optionalActionWindow(w))result.push({...action('play',{card,mode:'crush',targets:[]}),label:name(m,card)+' · crush the Trash Compactor'});
  if(m.cards[card].blueprint!=='1_89'||w.timing!=='response'||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||parent.cancelled||parent.awaitingResponses||b?.stage!=='begin'||!isSite(m,b.site)||system(m,b.site)!=='Death Star'||sites.includes(b.site))continue;
  const targets=members(m,side).filter(id=>cardDefinition(m,id).type==='Character'&&canRelocate(m,id)).map(id=>referenceCard(m,id));
  if(targets.length)result.push({...action('play',{card,mode:'relocate',targets,origin:referenceCard(m,b.site),destination:referenceCard(m,sites[0]),window:w.serial,index:0}),label:name(m,card)+' · relocate '+targets.length+' characters'});
 }
 return result;
}
export function compactorInitiate(m:Match,r:Resolution){moveCard(m,data(r).card,'playing');}
export function compactorResolve(m:Match,r:Resolution){
 const p=data(r),h=r.action.handler;
 if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='compactor:play'){
  queue(m,'finish',p);
  if(p.mode==='relocate')queue(m,'before-move',p);
  else {
   // Snapshot at results, after responses to playing the Interrupt. The actor
   // chooses each root in GEMP; attachments leave simultaneously with that root.
   const sites=compactors(m),targets=Object.values(m.cards).filter(c=>c.zone==='table'&&sites.includes(c.location!)&&['Character','Creature','Vehicle','Starship','Weapon','Device'].includes(cardDefinition(m,c.id).type)).map(c=>referenceCard(m,c.id));
   queue(m,'next',{...p,targets});
  }
 }else if(h==='compactor:before-move'){
  if(p.index!<p.targets.length){const target=p.targets[p.index!];queue(m,'before-move',{...p,index:p.index!+1});if(movers(m,p).some(ref=>ref.id===target.id))openWindow(m,'response','dark',{kind:'relocating',card:target.id,cardRef:target,source:p.card,from:p.origin!.id,site:p.destination!.id});}
  else queue(m,'move',p);
 }else if(h==='compactor:move'){
  const cards=movers(m,p).map(ref=>ref.id);
  for(const id of cards){delete m.cards[id].attachedTo;delete m.cards[id].aboardRole;moveWithAttachments(m,id,p.destination!.id);}
  if(cards.length)openWindow(m,'response','dark',{kind:'moved',cards,from:p.origin!.id,site:p.destination!.id,method:'relocation',source:p.card});
 }else if(h==='compactor:next'){
  if(remaining(m,p).length)m.stack.push({kind:'decision',side:r.actor,handler:'compactor:choose',payload:p as unknown as Json});
 }else if(h==='compactor:attachments'){
  if(!sameCard(m,p.selected!))return;
  queue(m,'lose',p);const cards=tableLossCards(m,[p.selected!.id]).filter(id=>id!==p.selected!.id);
  if(cards.length)openWindow(m,'response',other(r.actor),{kind:'about-to-lose',cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,allCards:true,cause:'compactor'});
 }else if(h==='compactor:lose'){
  if(sameCard(m,p.selected!)){const lost=tableLossCards(m,[p.selected!.id]);queue(m,'lost',{...p,lost});loseFromTable(m,[p.selected!.id]);}
 }else if(h==='compactor:lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.lost!,cardRefs:p.lost!.map(id=>referenceCard(m,id)),source:p.card,allCards:true,cause:'compactor'});
 else if(h==='compactor:finish')moveCard(m,p.card,p.mode==='crush'?'lost':'used');
 else throw Error('Unknown Trash Compactor continuation.');
}
export const compactorChoices=(m:Match,d:Decision)=>remaining(m,data(d)).map(ref=>({id:'crush:'+ref.id,label:'Crush '+name(m,ref.id)+' · '+(m.cards[ref.id].owner===d.side?'your card':"opponent’s card")}));
export function compactorChoose(m:Match,d:Decision,id:string){
 const p=data(d),selected=remaining(m,p).find(ref=>'crush:'+ref.id===id);if(!selected)throw Error('Invalid compactor target.');
 queue(m,'next',{...p,targets:p.targets.filter(ref=>ref.id!==selected.id)});queue(m,'attachments',{...p,selected});
 openWindow(m,'response',other(d.side),{kind:'about-to-lose',card:selected.id,cards:[selected.id],cardRefs:[selected],source:p.card,allCards:true,cause:'compactor'});
}
export function assertCompactor(m:Match){
 for(const f of m.stack){
  if(f.kind==='window')continue;const h=f.kind==='resolution'?f.action.handler:f.handler;if(!h.startsWith('compactor:'))continue;
  const p=data(f),side=f.kind==='resolution'?f.actor:f.side;
  if(!p||!['relocate','crush'].includes(p.mode)||m.cards[p.card]?.blueprint!==(p.mode==='relocate'?'1_89':'1_278')||m.cards[p.card].owner!==side||m.cards[p.card].zone!=='playing'||!Array.isArray(p.targets)||new Set(p.targets.map(ref=>ref.id)).size!==p.targets.length)throw Error('Invalid compactor continuation.');
  const steps=p.mode==='relocate'?['play','before-move','move','finish']:['play','next','attachments','lose','lost','finish'];
  if(f.kind==='resolution'&&(!steps.includes(h.slice(10))||f.action.id!==action(h.slice(10),p).id||f.action.source!==p.card)||f.kind==='decision'&&(h!=='compactor:choose'||p.mode!=='crush'||!remaining(m,p).length))throw Error('Invalid compactor frame.');
  for(const ref of p.targets){assertCardReference(m,ref);if(ref.zone!=='table'||!(p.mode==='relocate'?m.cards[ref.id].owner===side&&cardDefinition(m,ref.id).type==='Character':['Character','Creature','Vehicle','Starship','Weapon','Device'].includes(cardDefinition(m,ref.id).type)))throw Error('Invalid compactor group.');}
  if(p.mode==='relocate'){
   assertCardReference(m,p.origin!);assertCardReference(m,p.destination!);
   const wi=m.stack.findIndex(frame=>frame.kind==='window'&&frame.serial===p.window),w=m.stack[wi],parent=m.stack[wi-1];
   if(p.origin!.zone!=='table'||p.destination!.zone!=='table'||p.origin!.id===p.destination!.id||!isSite(m,p.origin!.id)||system(m,p.origin!.id)!=='Death Star'||m.cards[p.destination!.id].blueprint!=='1_125'||!p.targets.length||!Number.isSafeInteger(p.index)||p.index!<0||p.index!>p.targets.length||w?.kind!=='window'||w.timing!=='response'||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||(parent.action.payload as {site:string}).site!==p.origin!.id)throw Error('Invalid relocation binding.');
  }else if(['compactor:attachments','compactor:lose','compactor:lost'].includes(h)){
   assertCardReference(m,p.selected!);if(!p.targets.some(ref=>ref.id===p.selected!.id&&ref.version===p.selected!.version)||p.selected!.zone!=='table')throw Error('Invalid crushing target.');
   if(h==='compactor:lost'&&(!Array.isArray(p.lost)||!p.lost.includes(p.selected!.id)||new Set(p.lost).size!==p.lost.length||p.lost.some(id=>!m.cards[id]||!['leaving','lost'].includes(m.cards[id].zone))))throw Error('Invalid crushing losses.');
  }
 }
}
