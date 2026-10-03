import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {insertsIn} from './reserve-inserts';
import {openWindow, queueForcePayment, retireAction} from './runtime';
import {moveCard} from './state';
import {type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload={card:string;mode:'insert'|'reveal'|'battle'|'drain';index:number;actionId:string;window:number;target?:CardReference};
const action=(step:string,p:Payload):Action=>({id:'telepathy:'+step+':'+p.card+':'+p.actionId,handler:'telepathy:'+step,source:p.card,label:'Projective Telepathy · '+(p.mode==='insert'||p.mode==='reveal'?'cancel Anger, Fear, Aggression':'use 2 Force or cancel '+(p.mode==='battle'?'battle':'Force drain')),payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(step,p)});
function pending(m:Match,p:Payload):Resolution|undefined{
  const f=m.stack[p.index],w=m.stack[p.index+1];
  if(f?.kind!=='resolution'||f.cancelled||f.awaitingResponses||f.action.id!==p.actionId||w?.kind!=='window'||w.serial!==p.window)return;
  if(p.target&&!sameCard(m,p.target))return;
  return f;
}
export function telepathyActions(m:Match,w:Window,side:Side):Action[]{
  if(side!=='dark'||w.timing!=='response')return [];
  const f=m.stack.at(-2),e=w.event as {kind?:string;card?:string}|undefined;
  if(f?.kind!=='resolution'||f.cancelled||f.awaitingResponses||f.actor!=='light')return [];
  const target=f.action.source,mode=e?.kind==='insert-revealed'&&f.action.handler==='insert:result'&&m.cards[e.card!]?.blueprint==='4_16'?'reveal':
    !e&&f.action.handler==='insert:deploy'&&m.cards[target!]?.blueprint==='4_16'?'insert':
    !e&&f.action.handler==='battle:begin'?'battle':!e&&f.action.handler==='ground:drain'?'drain':null;
  if(!mode)return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='5_149').map(card=>action('play',{card,mode,index:m.stack.length-2,actionId:f.action.id,window:w.serial,...(mode==='insert'||mode==='reveal'?{target:referenceCard(m,target!)}:{})}));
}
export function telepathyInitiate(m:Match,r:Resolution):void{moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
function cancel(m:Match,p:Payload):void{
  const f=pending(m,p);if(!f)return;
  if(p.mode==='insert'){
    retireAction(m,p.index,p.actionId,p.window);moveCard(m,p.target!.id,'lost');
    openWindow(m,'response','light',{kind:'card-canceled',card:p.target!.id,source:p.card});
  }else if(p.mode==='reveal'){
    if(!insertsIn(m,'dark').some(x=>x.card.id===p.target!.id&&x.revealed))return;
    moveCard(m,p.target!.id,'lost');openWindow(m,'response','light',{kind:'card-canceled',card:p.target!.id,source:p.card});
  }else{
    f.cancelled=true;
    openWindow(m,'response','light',{kind:p.mode==='battle'?'battle-canceled':'force-drain-cancelled',site:(f.action.payload as {site:string}).site,source:p.card});
  }
}
export function telepathyResolve(m:Match,r:Resolution):void{
  const p=r.action.payload as unknown as Payload,step=r.action.handler;
  if(r.cancelled){if(step==='telepathy:play'&&m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
  if(step==='telepathy:finish'){moveCard(m,p.card,'used');return;}
  if(step==='telepathy:paid')return;
  if(step!=='telepathy:play')throw Error('Unknown Telepathy continuation.');
  queue(m,'finish',p);
  if(!pending(m,p))return;
  if(p.mode==='insert'||p.mode==='reveal'||m.players.light.force.length<2)cancel(m,p);
  else m.stack.push({kind:'decision',side:'light',handler:'telepathy:choose',payload:p as unknown as Json});
}
export function telepathyChoices(m:Match,d:Decision){
  const p=d.payload as unknown as Payload;
  return [...(pending(m,p)&&m.players.light.force.length>=2?[{id:'telepathy:pay',label:'Use 2 Force · continue this '+(p.mode==='battle'?'battle':'Force drain')}]:[]),{id:'telepathy:cancel',label:'Cancel this '+(p.mode==='battle'?'battle':'Force drain')}];
}
export function telepathyChoose(m:Match,d:Decision,id:string):void{
  if(!telepathyChoices(m,d).some(x=>x.id===id))throw Error('Invalid Telepathy choice.');
  const p=d.payload as unknown as Payload;
  if(id==='telepathy:cancel'){cancel(m,p);return;}
  const r:Resolution={kind:'resolution',actor:'light',cancelled:false,awaitingResponses:true,action:{...action('paid',p),unrespondable:true,payment:{light:2}}};
  m.stack.push(r);queueForcePayment(m,r,r.action.payment!);
}
export function assertTelepathy(m:Match):void{
  for(const [i,f]of m.stack.entries()){
    const h=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!h.startsWith('telepathy:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='5_149'||m.cards[p.card].owner!=='dark'||m.cards[p.card].zone!=='playing'||!['insert','reveal','battle','drain'].includes(p.mode)||!Number.isSafeInteger(p.index)||p.index<0||p.index>=i)throw Error('Invalid Telepathy continuation.');
    const target=m.stack[p.index],w=m.stack[p.index+1];
    if(target?.kind!=='resolution'||target.actor!=='light'||target.action.id!==p.actionId||w?.kind!=='window'||w.timing!=='response'||w.serial!==p.window)throw Error('Invalid Telepathy binding.');
    const expected=p.mode==='insert'?'insert:deploy':p.mode==='reveal'?'insert:result':p.mode==='battle'?'battle:begin':'ground:drain';
    if(target.action.handler!==expected&&!(p.mode==='insert'&&target.action.handler==='core:canceled'))throw Error('Wrong Telepathy target action.');
    if(p.mode==='insert'||p.mode==='reveal'){
      assertCardReference(m,p.target!);if(m.cards[p.target!.id].blueprint!=='4_16'||p.target!.zone!==(p.mode==='insert'?'playing':'table')||target.action.handler!=='core:canceled'&&target.action.source!==p.target!.id)throw Error('Invalid Telepathy insert.');
    }else if(p.target!==undefined)throw Error('Unexpected Telepathy card target.');
    if(p.mode==='reveal'?(w.event as {kind?:string;card?:string})?.kind!=='insert-revealed'||(w.event as {card?:string})?.card!==p.target!.id:w.event!==undefined)throw Error('Invalid Telepathy opportunity.');
    if(f.kind==='decision'){if(h!=='telepathy:choose'||f.side!=='light'||!['battle','drain'].includes(p.mode))throw Error('Invalid Telepathy decision.');}
    else if(f.kind==='resolution'){
      if(!['telepathy:play','telepathy:finish','telepathy:paid'].includes(h)||f.actor!==(h==='telepathy:paid'?'light':'dark')||f.action.source!==p.card||f.action.id!==action(h.slice(10),p).id)throw Error('Invalid Telepathy action.');
      if(h==='telepathy:paid'&&(!['battle','drain'].includes(p.mode)||f.action.payment?.light!==2||f.action.payment.dark!==undefined||f.action.unrespondable!==true))throw Error('Invalid Telepathy payment.');
    }
  }
}
