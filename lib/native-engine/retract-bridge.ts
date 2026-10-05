import {cardDefinition,locationOrder,name,system} from './board';
import {controlledCentralCore} from './central-core';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {openWindow,retireAction} from './runtime';
import {moveCard} from './state';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:CardReference;mode:'rearrange'|'cancel';sites?:CardReference[];layout?:CardReference[];freeCore?:CardReference;cost?:number;order?:string[];target?:CardReference;index?:number;actionId?:string;window?:number};
const payload=(f:Resolution|Decision)=>('action'in f?f.action.payload:f.payload) as unknown as Payload;
const action=(p:Payload):Action=>({id:'retract:play:'+p.card.id+':'+p.mode+(p.target?':'+p.target.id:''),handler:'retract:play',source:p.card.id,label:p.mode==='cancel'?'Retract The Bridge · cancel On The Edge':'Retract The Bridge · rearrange Death Star sites',payload:p as unknown as Json,...(p.mode==='rearrange'?{payment:{dark:p.cost!}}:{})});
const interiors=(m:Match)=>m.locations.filter(id=>system(m,id)==='Death Star'&&cardDefinition(m,id).subType==='Site'&&(cardDefinition(m,id).icons as string[]).includes('Interior'));
const pending=(m:Match,p:Payload)=>{const r=m.stack[p.index!],w=m.stack[p.index!+1];return r?.kind==='resolution'&&!r.cancelled&&!r.awaitingResponses&&r.action.id===p.actionId&&r.action.handler==='edge:play'&&r.action.source===p.target?.id&&w?.kind==='window'&&w.timing==='response'&&w.event===undefined&&w.serial===p.window?r:undefined;};
function proposed(m:Match,p:Payload,order:string[]){const ids=new Set(p.sites!.map(r=>r.id));let n=0;return m.locations.filter(id=>system(m,id)==='Death Star').map(id=>ids.has(id)?order[n++]:id);}
function completable(m:Match,p:Payload,order:string[]):boolean {
 const remaining=p.sites!.map(r=>r.id).filter(id=>!order.includes(id));
 // All ordinary Death Star interiors have one rank; Docking Bay 327 has
 // both icons. Testing each orientation avoids factorial permutation work.
 const rank=(id:string)=>(cardDefinition(m,id).icons as string[]).includes('Exterior')?1:0;
 return [1,-1].some(direction=>locationOrder(m,proposed(m,p,[...order,...remaining.slice().sort((a,b)=>direction*(rank(a)-rank(b)))])));
}
export function retractBridgeActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark')return [];
 const result:Action[]=[],sites=interiors(m),parent=m.stack.at(-2);
 for(const id of m.players[side].hand.filter(id=>m.cards[id].blueprint==='2_138')){
  const card=referenceCard(m,id);
  // Laser Gate is not yet implemented. Its mandatory relocation choices must
  // be implemented before this mode can run on a board containing that card.
  const gate=Object.values(m.cards).some(c=>c.zone==='table'&&c.blueprint==='2_113');
  if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy'&&sites.length>0&&!gate){
   const core=controlledCentralCore(m,side),cost=core?0:sites.length;
   if(m.players[side].force.length>=cost)result.push(action({card,mode:'rearrange',sites:sites.map(id=>referenceCard(m,id)),layout:m.locations.filter(id=>system(m,id)==='Death Star').map(id=>referenceCard(m,id)),...(core?{freeCore:referenceCard(m,core)}:{}),cost}));
  }
  if(w.timing==='response'&&w.event===undefined&&parent?.kind==='resolution'&&!parent.cancelled&&!parent.awaitingResponses&&parent.action.handler==='edge:play'&&parent.action.source&&m.cards[parent.action.source].zone==='playing')
   result.push(action({card,mode:'cancel',target:referenceCard(m,parent.action.source),index:m.stack.length-2,actionId:parent.action.id,window:w.serial}));
 }
 return result;
}
export function retractBridgeInitiate(m:Match,r:Resolution):void {
 const p=payload(r);moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);
}
export function retractBridgeResolve(m:Match,r:Resolution):void {
 const p=payload(r);if(!sameCard(m,p.card))return;
 if(r.cancelled){moveCard(m,p.card.id,'lost');return;}
 if(p.mode==='cancel'){
  if(pending(m,p)&&sameCard(m,p.target!)){retireAction(m,p.index!,p.actionId!,p.window!);moveCard(m,p.target!.id,'lost');openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.target!.id,source:p.card.id});}
  moveCard(m,p.card.id,'lost');return;
 }
 if(p.sites!.some(ref=>!sameCard(m,ref)||!m.locations.includes(ref.id))){moveCard(m,p.card.id,'lost');return;}
 m.stack.push({kind:'decision',handler:'retract:order',side:r.actor,payload:{...p,order:[]} as unknown as Json});
}
export function retractBridgeChoices(m:Match,d:Decision){
 const p=payload(d);return p.sites!.filter(ref=>!p.order!.includes(ref.id)&&completable(m,p,[...p.order!,ref.id])).map(ref=>({id:'retract:site:'+ref.id,label:'Place '+name(m,ref.id)+' '+(p.order!.length?'next':'first'),card:ref.id}));
}
export function retractBridgeChoose(m:Match,d:Decision,id:string):void {
 if(!retractBridgeChoices(m,d).some(c=>c.id===id))throw Error('Invalid Death Star site arrangement.');
 const p=payload(d),order=[...p.order!,id.slice('retract:site:'.length)];
 if(order.length<p.sites!.length){m.stack.push({...d,payload:{...p,order} as unknown as Json});return;}
 const ids=new Set(order);let next=0;m.locations=m.locations.map(site=>ids.has(site)?order[next++]:site);
 // Every occupant, attachment, captive and marker keeps its physical site ID.
 moveCard(m,p.card.id,'lost');openWindow(m,'response',other(d.side),{kind:'sites-rearranged',source:p.card.id,sites:order});
}
export function assertRetractBridge(m:Match):void {
 for(const [index,f]of m.stack.entries()){
  if(f.kind==='window')continue;const h=f.kind==='resolution'?f.action.handler:f.handler;if(!h.startsWith('retract:'))continue;
  const p=payload(f),actor=f.kind==='resolution'?f.actor:f.side;
  if(!p||actor!=='dark'||!['rearrange','cancel'].includes(p.mode)||m.cards[p.card?.id]?.blueprint!=='2_138'||m.cards[p.card.id].owner!==actor)throw Error('Invalid Retract The Bridge source.');
  assertCardReference(m,p.card);if(p.card.zone!=='playing'||!sameCard(m,p.card))throw Error('Stale Retract The Bridge source.');
  if(f.kind==='resolution'&&(h!=='retract:play'||f.action.source!==p.card.id||f.action.id!==action(p).id||f.action.unrespondable||JSON.stringify(f.action.payment)!==JSON.stringify(action(p).payment)))throw Error('Invalid Retract The Bridge action.');
  if(p.mode==='rearrange'){
   if(!Array.isArray(p.layout)||!p.layout.length||new Set(p.layout.map(r=>r.id)).size!==p.layout.length||!Array.isArray(p.sites)||!p.sites.length||new Set(p.sites.map(r=>r.id)).size!==p.sites.length||![0,p.sites.length].includes(p.cost!)||p.target!==undefined||p.index!==undefined||p.actionId!==undefined||p.window!==undefined)throw Error('Invalid rearrangement targets.');
   for(const ref of p.layout){assertCardReference(m,ref);if(ref.zone!=='table'||system(m,ref.id)!=='Death Star')throw Error('Invalid Death Star layout snapshot.');}
   const expected=p.layout.filter(ref=>cardDefinition(m,ref.id).subType==='Site'&&(cardDefinition(m,ref.id).icons as string[]).includes('Interior'));
   if(JSON.stringify(expected)!==JSON.stringify(p.sites))throw Error('Incomplete rearrangement targets.');
   if(p.layout.every(ref=>sameCard(m,ref))&&m.locations.filter(id=>system(m,id)==='Death Star').some(id=>!p.layout!.some(ref=>ref.id===id)))throw Error('Missing Death Star layout site.');
   if(p.freeCore){assertCardReference(m,p.freeCore);if(p.freeCore.zone!=='table'||m.cards[p.freeCore.id].blueprint!=='1_283'||p.cost!==0)throw Error('Invalid free Core snapshot.');}
   else if(p.cost!==p.sites.length)throw Error('Missing free Core snapshot.');
   for(const ref of p.sites){assertCardReference(m,ref);if(ref.zone!=='table'||system(m,ref.id)!=='Death Star'||cardDefinition(m,ref.id).subType!=='Site'||!(cardDefinition(m,ref.id).icons as string[]).includes('Interior'))throw Error('Invalid rearrangement site.');}
   if(f.kind==='decision'&&(h!=='retract:order'||!Array.isArray(p.order)||p.order.length>=p.sites.length||new Set(p.order).size!==p.order.length||p.order.some(id=>!p.sites!.some(ref=>ref.id===id))||p.sites.some(ref=>!sameCard(m,ref))||!completable(m,p,p.order)))throw Error('Invalid rearrangement choice.');
   if(f.kind==='resolution'&&p.order!==undefined)throw Error('Unexpected rearrangement choice.');
  }else{
   if(f.kind!=='resolution'||p.sites!==undefined||p.layout!==undefined||p.freeCore!==undefined||p.cost!==undefined||p.order!==undefined)throw Error('Invalid bridge cancellation mode.');
   assertCardReference(m,p.target!);const r=m.stack[p.index!],w=m.stack[p.index!+1];
   if(p.target!.zone!=='playing'||m.cards[p.target!.id].blueprint!=='1_101'||!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=index||r?.kind!=='resolution'||r.action.id!==p.actionId||!['edge:play','core:canceled'].includes(r.action.handler)||r.action.handler==='edge:play'&&r.action.source!==p.target!.id||w?.kind!=='window'||w.serial!==p.window||w.timing!=='response'||w.event!==undefined)throw Error('Invalid On The Edge cancellation binding.');
  }
 }
}
