import {cardDefinition} from './definitions';
import {controls,isSite,name,system} from './board';
import {nonUnique} from './characteristics';
import {optionalActionWindow} from './action-timing';
import {queueForceLoss} from './ground';
import {lossLedger} from './loss';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canSearch,recordFailedSearch,type Search} from './search-policy';
import {openWindow,retireAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

const supported=(bp:string)=>['106_5','106_17'].includes(bp);
const cancellable:Record<string,string[]>={
 '106_5':['Counter Assault',"It's Worse",'Elis Helrot','Tallon Roll','Limited Resources','Scanning Crew'],
 '106_17':['Surprise Assault','It Could Be Worse','Nabrun Leids','Collision!','Hyper Escape'],
};
type Payload={card:string;mode:'drain'|'cancel'|'table'|'search';target?:CardReference;index?:number;actionId?:string;window?:number;site?:CardReference;parent?:number;paid?:boolean};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const policy=(m:Match,p:Payload):Search=>({blueprint:m.cards[p.card].blueprint,side:m.cards[p.card].owner,owner:m.cards[p.card].owner,function:'orders:starfighter',pile:'lost'});
const candidates=(m:Match,side:Side)=>m.players[side].lost.filter(id=>cardDefinition(m,id).type==='Starship'&&cardDefinition(m,id).subType.startsWith('Starfighter:')&&nonUnique(m,id)).sort();
const action=(step:string,p:Payload):Action=>({id:'orders:'+step+':'+p.card+':'+p.mode+(p.target?':'+p.target.id:''),handler:'orders:'+step,source:p.card,label:'Resolve '+nameForStep(step),payload:p as unknown as Json});
const nameForStep=(step:string)=>step==='search'?'starfighter search':'OTSD Interrupt';
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
function pending(m:Match,p:Payload):Resolution|undefined {
 const r=m.stack[p.index!],w=m.stack[p.index!+1];return r?.kind==='resolution'&&!r.cancelled&&!r.awaitingResponses&&r.action.id===p.actionId&&w?.kind==='window'&&w.serial===p.window&&w.event===undefined?r:undefined;
}
function relatedControlledSystem(m:Match,side:Side,site:string):boolean{
 return isSite(m,site)&&m.locations.some(id=>cardDefinition(m,id).subType==='System'&&system(m,id)===system(m,site)&&controls(m,side,id));
}
export function ordersActions(m:Match,w:Window,side:Side):Action[]{
 const actions:Action[]=[],parent=m.stack.at(-2),response=w.timing==='response'&&w.event===undefined&&parent?.kind==='resolution'&&!parent.cancelled&&!parent.awaitingResponses?parent:undefined;
 for(const card of m.players[side].hand.filter(id=>supported(m.cards[id].blueprint))){
  const bp=m.cards[card].blueprint,base={card},offer=(p:Payload,label:string,payment?:Partial<Record<Side,number>>)=>actions.push({...action('play',p),label:name(m,card)+' · '+label,...(payment?{payment}:{})});
  if(response){const bound={index:m.stack.length-2,actionId:response.action.id,window:w.serial},site=(response.action.payload as {site?:string})?.site;
   if(response.action.handler==='ground:drain'&&site&&relatedControlledSystem(m,side,site))offer({...base,mode:'drain',site:referenceCard(m,site),...bound},'USED · cancel Force drain at '+name(m,site));
   const target=response.action.source;if(target&&m.cards[target].zone==='playing'&&cancellable[bp].includes(name(m,target)))offer({...base,mode:'cancel',target:referenceCard(m,target),...bound},'LOST · cancel '+name(m,target));
  }
  if(optionalActionWindow(w)){
   for(const c of Object.values(m.cards))if(c.zone==='table'&&cancellable[bp].includes(name(m,c.id)))offer({...base,mode:'table',target:referenceCard(m,c.id)},'LOST · cancel '+name(m,c.id));
   const p:Payload={...base,mode:'search'};if(m.players[side].lost.length&&canSearch(m,policy(m,p))&&(bp==='106_17'||m.players[side].force.length>=3))offer(p,'LOST · '+(bp==='106_17'?'lose 1 Force':'use 3 Force')+' to recover a non-unique starfighter',bp==='106_5'?{[side]:3}:undefined);
  }
 }
 return actions;
}
export function ordersInitiate(m:Match,r:Resolution):void {
 const p=data(r);moveCard(m,p.card,'playing');
 if(p.mode==='search'&&m.cards[p.card].blueprint==='106_17'){
  p.parent=m.stack.indexOf(r);p.paid=false;queue(m,'cost-paid',p);queueForceLoss(m,{side:r.actor,remaining:1,source:p.card,site:null,reductionUsed:false,ledger:lossLedger(1,'effect',true)});
 }
}
export function ordersResolve(m:Match,r:Resolution):void {
 const p=data(r),h=r.action.handler;
 if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='orders:cost-paid'){
  const root=m.stack[p.parent!];if(root?.kind!=='resolution'||!root.awaitingResponses||root.action.id!==action('play',p).id)throw Error('Missing Tarkin cost parent.');data(root).paid=true;return;
 }
 if(h==='orders:play'){
  queue(m,'finish',p);
  if(p.mode==='search'){if(canSearch(m,policy(m,p))&&m.players[r.actor].lost.length){queue(m,'search',p);openWindow(m,'response',other(r.actor),{kind:'before-looking-at-pile',source:p.card,side:r.actor,pile:'lost'});}return;}
  if(p.mode==='drain'){
   const target=pending(m,p);if(target&&sameCard(m,p.site!)){target.cancelled=true;openWindow(m,'response',other(r.actor),{kind:'force-drain-cancelled',site:p.site!.id,source:p.card});}
  }else if(p.mode==='cancel'){
   const target=pending(m,p);if(target&&sameCard(m,p.target!)){retireAction(m,p.index!,p.actionId!,p.window!);moveCard(m,p.target!.id,'lost');openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.target!.id,source:p.card});}
  }else if(sameCard(m,p.target!)){queue(m,'canceled',p);loseFromTable(m,[p.target!.id]);}
 }else if(h==='orders:search')m.stack.push({kind:'decision',side:r.actor,handler:'orders:choose',payload:p as unknown as Json});
 else if(h==='orders:take'){
  if(sameCard(m,p.target!)){moveCard(m,p.target!.id,'hand');openWindow(m,'response',other(r.actor),{kind:'card-taken-into-hand',card:p.target!.id,source:p.card,from:'lost'});}
 }else if(h==='orders:canceled')openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.target!.id,source:p.card});
 else if(h==='orders:finish')moveCard(m,p.card,p.mode==='drain'?'used':'lost');
 else throw Error('Unknown OTSD Interrupt continuation.');
}
export function ordersChoices(m:Match,d:Decision){const targets=candidates(m,d.side);return targets.length?targets.map(id=>({id:'orders:take:'+id,label:'Take '+name(m,id)+' from Lost Pile into hand'})):[{id:'orders:not-found',label:'No eligible starfighter · finish search'}];}
export function ordersChoose(m:Match,d:Decision,id:string):void{
 const p=data(d);if(!ordersChoices(m,d).some(c=>c.id===id))throw Error('Invalid starfighter choice.');
 if(id==='orders:not-found'){recordFailedSearch(m,policy(m,p));return;}
 const target=id.slice('orders:take:'.length);queue(m,'take',{...p,target:referenceCard(m,target)});openWindow(m,'response',other(d.side),{kind:'cards-revealed',cards:[target],source:p.card});
}
export function assertOrders(m:Match):void{
 for(let index=0;index<m.stack.length;index++){
  const f=m.stack[index];if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('orders:'))continue;const p=data(f),actor=f.kind==='decision'?f.side:f.actor;
  if(!p||!supported(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==actor||m.cards[p.card].zone!=='playing'||!['drain','cancel','table','search'].includes(p.mode)||!(f.kind==='decision'?['orders:choose']:['orders:play','orders:cost-paid','orders:search','orders:take','orders:canceled','orders:finish']).includes(h))throw Error('Invalid OTSD Interrupt continuation.');
  if(f.kind==='resolution'&&(f.action.source!==p.card||f.action.id!==action(h.slice(7),p).id))throw Error('Invalid OTSD Interrupt action.');
  if(p.target){assertCardReference(m,p.target);if(p.mode==='search'?(h!=='orders:take'||p.target.zone!=='lost'||m.cards[p.target.id].owner!==actor||!nonUnique(m,p.target.id)||!cardDefinition(m,p.target.id).subType.startsWith('Starfighter:')):!cancellable[m.cards[p.card].blueprint].includes(name(m,p.target.id))||p.target.zone!==(p.mode==='table'?'table':'playing'))throw Error('Invalid OTSD cancellation/search target.');}
  else if(['cancel','table'].includes(p.mode)||h==='orders:take')throw Error('Missing OTSD Interrupt target.');
  if(p.mode==='drain'||p.mode==='cancel'){
   const target=m.stack[p.index!],w=m.stack[p.index!+1];if(!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=index||target?.kind!=='resolution'||target.action.id!==p.actionId||w?.kind!=='window'||w.timing!=='response'||w.event!==undefined||w.serial!==p.window)throw Error('Invalid OTSD response binding.');
   if(p.mode==='drain'){assertCardReference(m,p.site!);if(p.site!.zone!=='table'||target.action.handler!=='ground:drain'||(target.action.payload as {site:string}).site!==p.site!.id)throw Error('Invalid drain target.');}
   else if(target.action.handler!=='core:canceled'&&target.action.source!==p.target!.id)throw Error('Invalid pending Interrupt target.');
  }
  if(p.mode==='search'&&m.cards[p.card].blueprint==='106_17'){
   if(typeof p.paid!=='boolean'||!Number.isSafeInteger(p.parent)||p.parent!<0||p.parent!>index||h==='orders:play'&&f.kind==='resolution'&&!f.awaitingResponses&&!f.cancelled&&!p.paid)throw Error('Unpaid Tarkin search.');
  }
  if(f.kind==='decision'&&p.mode!=='search'||['orders:search','orders:take','orders:cost-paid'].includes(h)&&p.mode!=='search')throw Error('Invalid search mode.');
 }
}
