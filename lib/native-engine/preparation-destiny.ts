import {battle} from './battle';
import {name} from './board';
import {destinyInWindow,pendingDestiny} from './destiny-response';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {moveCard} from './state';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

/** USED functions only. Their STARTING Effect searches are a separate provider;
 * these definitions do not admit decks or bypass the setup coverage gate. */
export const preparationBlueprint=(side:Side)=>side==='dark'?'9_139':'9_51';
type Payload={card:string;index:number;actionId:string;window:number;draw:CardReference};
const action=(p:Payload,label:string):Action=>({id:'preparation:destiny:'+p.card,handler:'preparation:destiny',source:p.card,label,payload:p as unknown as Json});
function bound(m:Match,p:Payload){
 const r=m.stack[p.index],w=m.stack[p.index+1];
 if(r?.kind!=='resolution'||r.action.handler!=='battle:destiny-finish'||r.action.id!==p.actionId||w?.kind!=='window'||w.serial!==p.window)return;
 const e=w.event as {kind?:string;side?:Side;card?:string}|undefined;
 return w.timing==='response'&&e?.kind==='battle-destiny-drawn'&&e.side===r.actor&&e.card===p.draw.id?r:undefined;
}
export function preparationActions(m:Match,w:Window,side:Side):Action[]{
 const d=destinyInWindow(m,w),e=w.event as {kind?:string;side?:Side;card?:string}|undefined;
 if(!d||d.value===null||d.substituted||d.side!==side||e?.kind!=='battle-destiny-drawn'||!e.card||d.resolution.action.handler!=='battle:destiny-finish')return [];
 const draw=(d.resolution.action.payload as {reference?:CardReference}).reference??(d.resolution.action.payload as {flow?:{reference?:CardReference}}).flow?.reference??(m.cards[e.card]?.zone==='destiny'?referenceCard(m,e.card):undefined);if(!draw)return [];
 return m.players[side].hand.filter(id=>m.cards[id].blueprint===preparationBlueprint(side)).map(card=>action({card,index:m.stack.indexOf(d.resolution),actionId:d.resolution.action.id,window:w.serial,draw:{...draw}},name(m,card)+' · add 1 to your battle destiny'));
}
export function preparationInitiate(m:Match,r:Resolution){moveCard(m,(r.action.payload as Payload).card,'playing');}
export function preparationResolve(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Payload,target=bound(m,p),d=target&&pendingDestiny(m,target);
 // A nested cancellation/redraw invalidates this exact draw. Never modify the
 // replacement draw or a nested Sense destiny. Physical relocation alone does
 // not cancel the pending numerical result.
 if(!r.cancelled&&d&&d.side===r.actor&&d.value!==null&&!d.substituted)battle(m)!.destiny[r.actor]=d.value+1;
 moveCard(m,p.card,r.cancelled?'lost':'used');
}
export function assertPreparations(m:Match){
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('preparation:')){
  const p=r.action.payload as unknown as Payload;
  if(!p||r.action.handler!=='preparation:destiny'||m.cards[p.card]?.blueprint!==preparationBlueprint(r.actor)||m.cards[p.card].owner!==r.actor||m.cards[p.card].zone!=='playing'||r.action.source!==p.card||r.action.id!==action(p,'').id||r.action.payment||r.action.unrespondable||!Number.isSafeInteger(p.index)||p.index<0||p.index>=m.stack.indexOf(r)||!Number.isSafeInteger(p.window)||!p.draw)throw Error('Invalid preparation destiny response.');
  assertCardReference(m,p.draw);const target=bound(m,p),original=target&&((target.action.payload as {reference?:CardReference}).reference??(target.action.payload as {flow?:{reference?:CardReference}}).flow?.reference);
  if(original&&(original.id!==p.draw.id||original.version!==p.draw.version||original.zone!==p.draw.zone))throw Error('Invalid preparation draw instance.');
  if(!target||target.actor!==r.actor||p.draw.zone!=='destiny'||m.cards[p.draw.id].owner!==r.actor||(target.action.payload as {card?:string}).card!==p.draw.id)throw Error('Invalid preparation destiny binding.');
 }
}
