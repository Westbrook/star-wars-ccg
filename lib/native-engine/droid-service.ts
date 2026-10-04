import {cardDefinition,controls,forfeit,name} from './board';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canEnterTable} from './persona';
import {openWindow,type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

export const serviceBlueprint=(bp:string)=>['106_3','106_14'].includes(bp);
export const serviceActive=(m:Match,side:Side)=>Object.values(m.cards).some(c=>c.owner===side&&serviceBlueprint(c.blueprint)&&gameTextActive(m,c.id));
/** Satisfying a loss is not reducing it. A zero-forfeit droid pays zero, and
 * only the lost physical card generates a loss event. Unresolved destiny is
 * still Life Force; table forfeiture and attached-card loss do not use this. */
export function forceLossCredit(m:Match,id:string):number{
 const c=m.cards[id];
 return ['hand','reserve','force','used','destiny'].includes(c.zone)&&cardDefinition(m,id).subType==='Droid'&&serviceActive(m,c.owner)?Math.max(0,Math.trunc(forfeit(m,id))):1;
}
type Payload={card:string;target?:CardReference;reference?:CardReference};
const action=(step:string,p:Payload):Action=>({id:'service:'+step+':'+p.card+(p.target?':'+p.target.id:'')+(p.reference?':'+p.reference.version:''),handler:'service:'+step,source:p.card,label:step==='deploy'?'Deploy droid service Effect':'Cancel droid service Effect',payload:p as unknown as Json});
export function serviceActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='deploy'||m.turn.side!==side)return [];
 return m.players[side].hand.filter(id=>serviceBlueprint(m.cards[id].blueprint)).flatMap(card=>m.locations.filter(id=>m.cards[id].owner!==side).map(id=>({...action('deploy',{card,target:referenceCard(m,id)}),label:'Deploy '+name(m,card)+' on '+name(m,id)})));
}
export function serviceAutomatic(m:Match,_w:Window):RequiredAction[]{
 return Object.values(m.cards).filter(c=>serviceBlueprint(c.blueprint)&&gameTextActive(m,c.id)&&!!c.attachedTo&&controls(m,other(c.owner),c.attachedTo)).map(c=>({...action('cancel',{card:c.id,reference:referenceCard(m,c.id)}),actor:c.owner,unrespondable:true}));
}
export function serviceInitiate(m:Match,r:Resolution){if(r.action.handler==='service:deploy')moveCard(m,(r.action.payload as Payload).card,'playing');}
export function serviceResolve(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='service:deploy'){
  if(r.cancelled||!sameCard(m,p.target!)||!m.locations.includes(p.target!.id)||!canEnterTable(m,p.card)){moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.target!.id;m.cards[p.card].location=p.target!.id;deployed(m,p.card);
 }else if(r.action.handler==='service:cancel'){
  if(!r.cancelled&&sameCard(m,p.reference!)){m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action('canceled',p)});loseFromTable(m,[p.card]);}
 }else if(r.action.handler==='service:canceled')openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.card,source:p.card});
 else throw Error('Unknown service Effect continuation.');
}
export function assertService(m:Match){
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('service:')){
  const p=f.action.payload as unknown as Payload,h=f.action.handler;
  if(!p||!serviceBlueprint(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==f.actor||f.action.source!==p.card||!['service:deploy','service:cancel','service:canceled'].includes(h)||f.action.id!==action(h.slice(8),p).id)throw Error('Invalid service Effect continuation.');
  if(h==='service:deploy'){assertCardReference(m,p.target!);if(m.cards[p.card].zone!=='playing'||p.target!.zone!=='table'||cardDefinition(m,p.target!.id).type!=='Location'||m.cards[p.target!.id].owner===f.actor)throw Error('Invalid service deployment target.');}
  else{assertCardReference(m,p.reference!,p.card);if(p.reference!.zone!=='table')throw Error('Invalid service Effect reference.');}
 }
}

export const serviceView=(m:Match,seat:Side)=>({forceLossCredits:Object.fromEntries(m.players[seat].hand.map(id=>[id,forceLossCredit(m,id)]))});
