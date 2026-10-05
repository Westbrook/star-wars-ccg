import {adjacent,cardDefinition,moveWithAttachments,name} from './board';
import {hasCharacteristic} from './characteristics';
import {deployed} from './deployment';
import {canLandspeed,record} from './ground';
import {shieldMovement} from './hoth';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {laserGateAllowsPassage} from './laser-gate';
import {movesFree} from './movement-costs';
import {canEnterTable} from './persona';
import {openWindow,type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {activeUndercoverSpy,undercoverRecords,setUndercover,clearUndercover,assertUndercoverState,sameUndercoverCard} from './undercover-state';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Deploy={card:CardReference;target:CardReference};
type SpyAction={target:CardReference;from?:CardReference;to?:CardReference};
const undercoverCard=(m:Match,id:string)=>['2_40','2_129'].includes(m.cards[id]?.blueprint);
const eligible=(m:Match,id:string,side:Side)=>m.cards[id]?.owner===side&&(m.cards[id].zone==='table'||activeUndercoverSpy(m,id))&&cardDefinition(m,id).type==='Character'&&hasCharacteristic(m,id,'SPY')&&!!m.cards[id].location&&cardDefinition(m,m.cards[id].location!).subType==='Site';
const act=(step:string,p:Deploy|SpyAction,label:string,source?:string,payment?:Partial<Record<Side,number>>):Action=>({id:'undercover:'+step+':'+('card'in p?p.card.id+':':'')+p.target.id+('to'in p&&p.to?':'+p.to.id:''),handler:'undercover:'+step,label,payload:p as unknown as Json,...(source?{source}:{}),...(payment?{payment}:{})});
export function undercoverActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase')return [];const out:Action[]=[];
 if(side===m.turn.side&&m.turn.phase==='deploy'){
  for(const card of m.players[side].hand.filter(id=>undercoverCard(m,id)))for(const c of Object.values(m.cards).filter(c=>eligible(m,c.id,side)))out.push(act('deploy',{card:referenceCard(m,card),target:referenceCard(m,c.id)},'Deploy Undercover on '+name(m,c.id),card));
  for(const c of Object.values(m.cards).filter(c=>c.owner===side&&activeUndercoverSpy(m,c.id)))out.push(act('break',{target:referenceCard(m,c.id)},'Break cover · '+name(m,c.id)));
 }
 if(side!==m.turn.side&&m.turn.phase==='move')for(const c of Object.values(m.cards).filter(c=>c.owner===side&&activeUndercoverSpy(m,c.id)&&canLandspeed(m,c.id)))for(const to of m.locations.filter(to=>adjacent(m,c.location!,to)&&!shieldMovement(m,side,c.location!,to)&&laserGateAllowsPassage(m,c.id,c.location!,to)))out.push(act('move',{target:referenceCard(m,c.id),from:referenceCard(m,c.location!),to:referenceCard(m,to)},'Move undercover '+name(m,c.id)+' to '+name(m,to),undefined,{[side]:movesFree(m,c.id,to)?0:1}));
 return out;
}
export function undercoverInitiate(m:Match,r:Resolution):void {if(r.action.handler==='undercover:deploy'){const p=r.action.payload as unknown as Deploy;moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);}}
/** Breaking cover is a state change, never a fresh table instance. */
export function breakCover(m:Match,id:string):void {
 if(!activeUndercoverSpy(m,id))return;const sources=undercoverRecords(m).filter(p=>p.card.id===id&&!p.ended).flatMap(p=>p.sources).filter(r=>sameCard(m,r)&&m.cards[r.id].attachedTo===id).map(r=>r.id);
 clearUndercover(m,id);m.cards[id].zone='table';if(sources.length)loseFromTable(m,[...new Set(sources)]);openWindow(m,'response',other(m.cards[id].owner),{kind:'cover-broken',card:id});
}
export function undercoverResolve(m:Match,r:Resolution):void {
 if(r.action.handler==='undercover:deploy'){
  const p=r.action.payload as unknown as Deploy;if(!sameCard(m,p.card))return;
  if(r.cancelled||!sameUndercoverCard(m,p.target)||!eligible(m,p.target.id,r.actor)||!canEnterTable(m,p.card.id)){moveCard(m,p.card.id,'lost');return;}
  moveCard(m,p.card.id,'table');m.cards[p.card.id].attachedTo=p.target.id;m.cards[p.card.id].location=m.cards[p.target.id].location;deployed(m,p.card.id);setUndercover(m,p.target.id,p.card.id);return;
 }
 const p=r.action.payload as unknown as SpyAction;if(r.cancelled||!sameUndercoverCard(m,p.target)||!activeUndercoverSpy(m,p.target.id))return;
 if(r.action.handler==='undercover:break'){breakCover(m,p.target.id);return;}
 if(r.action.handler==='undercover:move'){
  const c=m.cards[p.target.id];if(!p.from||!p.to||!sameCard(m,p.from)||!sameCard(m,p.to)||c.location!==p.from.id||!canLandspeed(m,c.id)||!adjacent(m,p.from.id,p.to.id)||shieldMovement(m,r.actor,p.from.id,p.to.id)||!laserGateAllowsPassage(m,c.id,p.from.id,p.to.id))return;
  moveWithAttachments(m,c.id,p.to.id);record(m).moved.push(c.id);openWindow(m,'response',other(r.actor),{kind:'moved',card:c.id,from:p.from.id,site:p.to.id});return;
 }throw Error('Unknown Undercover action.');
}
export function undercoverAutomatic(m:Match,_w:Window):RequiredAction[]{return Object.values(m.cards).filter(c=>activeUndercoverSpy(m,c.id)&&!m.stack.some(f=>f.kind==='resolution'&&f.action.handler==='undercover:break'&&(f.action.payload as unknown as SpyAction).target.id===c.id)&&(!hasCharacteristic(m,c.id,'SPY')||!undercoverRecords(m).some(p=>p.card.id===c.id&&!p.ended&&p.sources.some(r=>sameCard(m,r)&&m.cards[r.id].attachedTo===c.id)))).map(c=>({...act('break',{target:referenceCard(m,c.id)},'Break cover · '+name(m,c.id)),actor:c.owner}));}
export function assertUndercover(m:Match):void {
 assertUndercoverState(m);for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('undercover:')){
  const p=f.action.payload as unknown as Deploy&SpyAction;assertCardReference(m,p.target);if(!['table','inactive'].includes(p.target.zone)||cardDefinition(m,p.target.id).type!=='Character'||m.cards[p.target.id].owner!==f.actor)throw Error('Invalid Undercover action target.');
  if(f.action.handler==='undercover:deploy'){assertCardReference(m,p.card);if(p.card.zone!=='playing'||!undercoverCard(m,p.card.id)||m.cards[p.card.id].owner!==f.actor||f.action.source!==p.card.id||f.action.payment||f.action.unrespondable)throw Error('Invalid Undercover deployment.');}
  else if(f.action.handler==='undercover:move'){assertCardReference(m,p.from!);assertCardReference(m,p.to!);if(p.from!.zone!=='table'||p.to!.zone!=='table'||p.from!.id===p.to!.id||!f.action.payment||Object.keys(f.action.payment).some(s=>s!==f.actor)||![0,1].includes(f.action.payment[f.actor]!))throw Error('Invalid Undercover movement.');}
  else if(f.action.handler!=='undercover:break'||f.action.payment||f.action.source||f.action.unrespondable)throw Error('Invalid Undercover continuation.');
 }
}
export const undercoverView=(m:Match)=>({undercoverSpies:Object.values(m.cards).filter(c=>activeUndercoverSpy(m,c.id)).map(c=>({id:c.id,site:c.location!,sources:undercoverRecords(m).filter(p=>p.card.id===c.id&&!p.ended).flatMap(p=>p.sources).filter(r=>sameCard(m,r)).map(r=>r.id),dueling:c.zone==='table'}))});
