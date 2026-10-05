import {cardDefinition} from './definitions';
import {setDisarmed} from './disarmed-state';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {openWindow,type RequiredAction} from './runtime';
import {loseFromTable,tableLossCards} from './table';
import {disarmingEffect} from './weapon-carrying';
import {other,type Action,type Json,type Match,type Resolution,type Window} from './types';
export const bionicHandBonus=(m:Match,host:string)=>Object.values(m.cards).some(c=>c.blueprint==='5_12'&&c.attachedTo===host&&gameTextActive(m,c.id))?1:0;
/** Printed removal protection survives game-text cancellation. Host departure
 * and its own required loss still use the ordinary attachment cleanup. */
export const protectedDevice=(m:Match,id:string)=>m.cards[id]?.blueprint==='5_12'&&m.cards[id].zone==='table'&&!m.cards[id].coveredBy&&!m.cards[id].blownAway;
type Payload={card:CardReference;target:CardReference;window:number;cards?:string[]};
const action=(step:string,p:Payload):Action=>({id:'bionic:'+step+':'+p.card.id+':'+p.target.id,handler:'bionic:'+step,source:p.card.id,label:step==='rearm'?'Bionic Hand · rearm character':'Bionic Hand · device is lost',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card.id].owner,cancelled:false,action:action(step,p)});
export function bionicAutomatic(m:Match,w:Window):RequiredAction[]{
 if(w.timing!=='response')return [];const e=w.event as {kind?:string;card?:string;targetRef?:CardReference}|undefined;
 return Object.values(m.cards).filter(c=>c.blueprint==='5_12'&&c.attachedTo&&gameTextActive(m,c.id)).flatMap(c=>{
  const deploy=e?.kind==='deployed'&&e.card===c.id,disarm=e?.kind==='disarmed'&&e.targetRef?.id===c.attachedTo&&!!e.targetRef&&sameCard(m,e.targetRef);
  if(!deploy&&!disarm)return [];return [{...action(deploy?'rearm':'lose',{card:referenceCard(m,c.id),target:referenceCard(m,c.attachedTo!),window:w.serial}),actor:c.owner}];
 });
}
export function bionicResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,h=r.action.handler;if(r.cancelled)return;
 if(h==='bionic:rearm'){
  if(!sameCard(m,p.target))return;setDisarmed(m,p.target.id,false);
  const cards=Object.values(m.cards).filter(c=>c.zone==='table'&&c.attachedTo===p.target.id&&disarmingEffect(c.blueprint)).map(c=>c.id);
  if(cards.length){queue(m,'canceled',{...p,cards});loseFromTable(m,cards);}
 }else if(h==='bionic:canceled'){
  for(const card of p.cards!)openWindow(m,'response',other(r.actor),{kind:'card-canceled',card,source:p.card.id});
 }else if(h==='bionic:lose'){
  if(!sameCard(m,p.card))return;queue(m,'loss',p);const cards=tableLossCards(m,[p.card.id]);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.card.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card.id,cause:'disarmed'});
 }else if(h==='bionic:loss'){
  if(!sameCard(m,p.card))return;const cards=tableLossCards(m,[p.card.id]);queue(m,'lost',{...p,cards});loseFromTable(m,[p.card.id]);
 }else if(h==='bionic:lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.cards!,source:p.card.id,cause:'disarmed'});
 else throw Error('Unknown Bionic Hand continuation.');
}
export function assertBionic(m:Match):void{
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('bionic:')){
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if(!p)throw Error('Missing Bionic Hand payload.');assertCardReference(m,p.card);assertCardReference(m,p.target);
  if(p.card.zone!=='table'||p.target.zone!=='table'||m.cards[p.card.id].blueprint!=='5_12'||m.cards[p.card.id].owner!==r.actor||cardDefinition(m,p.target.id).type!=='Character'||r.action.source!==p.card.id||r.action.payment||r.action.id!==action(h.slice(7),p).id||!['bionic:rearm','bionic:canceled','bionic:lose','bionic:loss','bionic:lost'].includes(h)||!Number.isSafeInteger(p.window)||p.window<1||p.window>m.serial)throw Error('Invalid Bionic Hand continuation.');
  if(['bionic:canceled','bionic:lost'].includes(h)&&(!Array.isArray(p.cards)||!p.cards.length||new Set(p.cards).size!==p.cards.length||p.cards.some(id=>!m.cards[id]||h==='bionic:canceled'&&!disarmingEffect(m.cards[id].blueprint))))throw Error('Invalid Bionic Hand result.');
 }
}
