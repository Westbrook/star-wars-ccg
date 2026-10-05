import {cardDefinition,locationOrder,name,system} from './board';
import {controlledCentralCore} from './central-core';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {bindLaserGate,isLaserGate,laserGatePair,laserGatePairs,type LaserGateBinding} from './laser-gate';
import {openWindow,retireAction} from './runtime';
import {moveCard} from './state';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:CardReference;mode:'rearrange'|'cancel';sites?:CardReference[];layout?:CardReference[];freeCore?:CardReference;cost?:number;order?:string[];target?:CardReference;index?:number;actionId?:string;window?:number;gates?:LaserGateBinding[];gateIndex?:number};
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
 if(![1,-1].some(direction=>locationOrder(m,proposed(m,p,[...order,...remaining.slice().sort((a,b)=>direction*(rank(a)-rank(b)))]))))return false;
 if(!p.gates?.length)return true;
 // The optional Gate relocation ruling does not say where a declined Gate
 // stays if rearrangement separates its sites. Preserve those pairs until
 // that broader layout interaction has an authoritative implementation.
 for(const gate of p.gates){
  const indices=gate.sites.map(ref=>order.indexOf(ref.id));
  if(indices.every(i=>i>=0)&&Math.abs(indices[0]-indices[1])!==1)return false;
  if(indices.filter(i=>i>=0).length===1&&Math.max(...indices)!==order.length-1)return false;
 }
 if(!remaining.length)return true;
 if(p.gates.every(gate=>gate.sites.every(ref=>order.includes(ref.id))))return true;
 return remaining.some(id=>completable(m,p,[...order,id]));
}
const gateSnapshots=(m:Match)=>Object.values(m.cards).filter(c=>c.zone==='table'&&isLaserGate(m,c.id)).flatMap(c=>{const pair=laserGatePair(m,c.id);return pair?.every(ref=>system(m,ref.id)==='Death Star')?[{card:referenceCard(m,c.id),sites:pair}]:[];});
export function retractBridgeActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark')return [];
 const result:Action[]=[],sites=interiors(m),parent=m.stack.at(-2);
 for(const id of m.players[side].hand.filter(id=>m.cards[id].blueprint==='2_138')){
  const card=referenceCard(m,id);
  const gates=gateSnapshots(m),unboundGate=Object.values(m.cards).some(c=>c.zone==='table'&&isLaserGate(m,c.id)&&!laserGatePair(m,c.id));
  if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy'&&sites.length>0&&!unboundGate){
   const core=controlledCentralCore(m,side),cost=core?0:sites.length;
   if(m.players[side].force.length>=cost)result.push(action({card,mode:'rearrange',sites:sites.map(id=>referenceCard(m,id)),layout:m.locations.filter(id=>system(m,id)==='Death Star').map(id=>referenceCard(m,id)),...(core?{freeCore:referenceCard(m,core)}:{}),cost,...(gates.length?{gates}:{})}));
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
 // Cards can enter/leave play in the initiation response window. Only the
 // current Gate instances receive the effect's optional relocation choices.
 const gates=gateSnapshots(m);if(gates.length)p.gates=gates;else delete p.gates;
 m.stack.push({kind:'decision',handler:'retract:order',side:r.actor,payload:{...p,order:[]} as unknown as Json});
}
export function retractBridgeChoices(m:Match,d:Decision){
 const p=payload(d);
 if(d.handler==='retract:relocate'){
  const gate=p.gates![p.gateIndex!];
  return [{id:'retract:gate:keep',label:'Keep Laser Gate between its sites',card:gate.card.id},...laserGatePairs(m,'Death Star').filter(pair=>!pair.every(site=>gate.sites.some(ref=>ref.id===site))).map(pair=>({id:'retract:gate:'+pair.join(':'),label:'Relocate Laser Gate between '+name(m,pair[0])+' and '+name(m,pair[1]),card:gate.card.id}))];
 }
 return p.sites!.filter(ref=>!p.order!.includes(ref.id)&&completable(m,p,[...p.order!,ref.id])).map(ref=>({id:'retract:site:'+ref.id,label:'Place '+name(m,ref.id)+' '+(p.order!.length?'next':'first'),card:ref.id}));
}
function finish(m:Match,d:Decision,p:Payload){moveCard(m,p.card.id,'lost');openWindow(m,'response',other(d.side),{kind:'sites-rearranged',source:p.card.id,sites:p.order!});}
export function retractBridgeChoose(m:Match,d:Decision,id:string):void {
 if(!retractBridgeChoices(m,d).some(c=>c.id===id))throw Error('Invalid Death Star site arrangement.');
 const p=payload(d);
 if(d.handler==='retract:relocate'){
  const gate=p.gates![p.gateIndex!];
  if(!sameCard(m,p.card)||!sameCard(m,gate.card)||gate.sites.some(ref=>!sameCard(m,ref)))throw Error('Stale Laser Gate relocation.');
  if(id!=='retract:gate:keep'){
   const pair=laserGatePairs(m,'Death Star').find(pair=>'retract:gate:'+pair.join(':')===id)!;
   bindLaserGate(m,gate.card.id,pair[0],pair[1]);
  }
  if(p.gateIndex!+1<p.gates!.length)m.stack.push({...d,payload:{...p,gateIndex:p.gateIndex!+1} as unknown as Json});
  else finish(m,d,p);
  return;
 }
 const order=[...p.order!,id.slice('retract:site:'.length)];
 if(order.length<p.sites!.length){m.stack.push({...d,payload:{...p,order} as unknown as Json});return;}
 const ids=new Set(order);let next=0;m.locations=m.locations.map(site=>ids.has(site)?order[next++]:site);
 // Every occupant, attachment, captive and marker keeps its physical site ID.
 if(p.gates?.length)m.stack.push({...d,handler:'retract:relocate',payload:{...p,order,gateIndex:0} as unknown as Json});
 else finish(m,d,{...p,order});
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
   if(p.gates!==undefined){
    if(!Array.isArray(p.gates)||!p.gates.length||new Set(p.gates.map(g=>g.card?.id)).size!==p.gates.length)throw Error('Invalid Gate relocation list.');
    for(const gate of p.gates){assertCardReference(m,gate.card);if(gate.card.zone!=='table'||!isLaserGate(m,gate.card.id)||!Array.isArray(gate.sites)||gate.sites.length!==2||gate.sites[0]?.id===gate.sites[1]?.id)throw Error('Invalid Gate relocation source.');for(const ref of gate.sites){assertCardReference(m,ref);if(ref.zone!=='table'||!p.sites.some(site=>JSON.stringify(site)===JSON.stringify(ref)))throw Error('Invalid Gate relocation site.');}}
   }
   if(f.kind==='decision'){
    if(!['retract:order','retract:relocate'].includes(h)||!Array.isArray(p.order)||new Set(p.order).size!==p.order.length||p.order.some(id=>!p.sites!.some(ref=>ref.id===id))||p.sites.some(ref=>!sameCard(m,ref))||!completable(m,p,p.order))throw Error('Invalid rearrangement choice.');
    if(h==='retract:order'&&(p.order.length>=p.sites.length||p.gateIndex!==undefined)||h==='retract:relocate'&&(p.order.length!==p.sites.length||!Number.isSafeInteger(p.gateIndex)||p.gateIndex!<0||p.gateIndex!>=(p.gates?.length??0)))throw Error('Invalid Gate relocation position.');
    const outstanding=p.gates?.slice(h==='retract:relocate'?p.gateIndex:0)??[];
    for(const gate of outstanding){const pair=laserGatePair(m,gate.card.id);if(!sameCard(m,gate.card)||!pair||!gate.sites.every(ref=>pair.some(current=>JSON.stringify(current)===JSON.stringify(ref))))throw Error('Stale Gate relocation binding.');}
    const expectedGates=gateSnapshots(m).map(g=>g.card.id).sort();if(JSON.stringify(expectedGates)!==JSON.stringify((p.gates??[]).map(g=>g.card.id).sort()))throw Error('Incomplete Gate relocation list.');
   }
   if(f.kind==='resolution'&&(p.order!==undefined||p.gateIndex!==undefined))throw Error('Unexpected rearrangement choice.');
  }else{
   if(f.kind!=='resolution'||p.sites!==undefined||p.layout!==undefined||p.freeCore!==undefined||p.cost!==undefined||p.order!==undefined||p.gates!==undefined||p.gateIndex!==undefined)throw Error('Invalid bridge cancellation mode.');
   assertCardReference(m,p.target!);const r=m.stack[p.index!],w=m.stack[p.index!+1];
   if(p.target!.zone!=='playing'||m.cards[p.target!.id].blueprint!=='1_101'||!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=index||r?.kind!=='resolution'||r.action.id!==p.actionId||!['edge:play','core:canceled'].includes(r.action.handler)||r.action.handler==='edge:play'&&r.action.source!==p.target!.id||w?.kind!=='window'||w.serial!==p.window||w.timing!=='response'||w.event!==undefined)throw Error('Invalid On The Edge cancellation binding.');
  }
 }
}
