import {ability} from './ability';
import {laserGateAllowsPassage} from './laser-gate';
import {battle} from './battle';
import {adjacent,cardDefinition,moveWithAttachments,name} from './board';
import {canLandspeed,record} from './ground';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {belowDecks} from './occupancy';
import {groundPresent} from './participation';
import {openWindow} from './runtime';
import {loseFromTable,tableLossCards} from './table';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={source:CardReference;target:CardReference;site:CardReference;window:number;from?:CardReference;to?:CardReference;origin?:CardReference;lost?:string[]};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const action=(step:string,p:Payload):Action=>({id:'obi:'+step+':'+p.source.id+':'+p.target.id+(p.to?':'+p.to.id:''),handler:'obi:'+step,source:p.source.id,label:'Resolve Obi-Wan Kenobi',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor=m.cards[p.source.id].owner,respondable=false)=>m.stack.push({kind:'resolution',actor,cancelled:false,...(respondable?{awaitingResponses:true}:{}),action:action(step,p)});
const used=(m:Match,id:string)=>(battle(m)?.obiWanUses??[]).some(ref=>ref.id===id&&sameCard(m,ref));
const routes=(m:Match,p:Payload)=>sameCard(m,p.target)&&!belowDecks(m,p.target.id)&&canLandspeed(m,p.target.id)&&m.cards[p.target.id].location?m.locations.filter(to=>adjacent(m,m.cards[p.target.id].location!,to)&&laserGateAllowsPassage(m,p.target.id,m.cards[p.target.id].location!,to)):[];

export function obiWanActions(m:Match,w:Window,side:Side):Action[]{
 const b=battle(m),parent=m.stack.at(-2);
 if(!b||b.stage!=='begin'||w.timing!=='response'||w.event!==undefined||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||parent.cancelled||parent.awaitingResponses||!m.locations.some(id=>adjacent(m,b.site,id)))return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&c.blueprint==='1_21'&&c.location===b.site&&groundPresent(m,c.id)&&gameTextActive(m,c.id)&&!used(m,c.id)).flatMap(source=>Object.values(m.cards).filter(c=>c.owner!==side&&c.location===b.site&&groundPresent(m,c.id)&&ability(m,c.id)===1).map(target=>{
  const p:Payload={source:referenceCard(m,source.id),target:referenceCard(m,target.id),site:referenceCard(m,b.site),window:w.serial};
  return {...action('use',p),label:'Obi-Wan Kenobi · use 1 Force to make '+name(m,target.id)+' move away or be lost',payment:{[side]:1}};
 }));
}
export function obiWanInitiate(m:Match,r:Resolution){if(r.action.handler==='obi:use'){const p=data(r);if(used(m,p.source.id))throw Error('Obi-Wan already responded to this battle.');(battle(m)!.obiWanUses??=[]).push(p.source);}}
function lose(m:Match,p:Payload){
 if(!sameCard(m,p.target))return;
 queue(m,'lose',p);const cards=tableLossCards(m,[p.target.id]);
 openWindow(m,'response',other(m.cards[p.source.id].owner),{kind:'about-to-lose',card:p.target.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.source.id,site:m.cards[p.target.id].location??p.site.id,cause:'obi-wan'});
}
export function obiWanResolve(m:Match,r:Resolution){
 const p=data(r),h=r.action.handler;if(r.cancelled)return;
 if(h==='obi:use'){
  if(!sameCard(m,p.target))return;
  if(routes(m,p).length)m.stack.push({kind:'decision',side:m.cards[p.target.id].owner,handler:'obi:choose',payload:p as unknown as Json});else lose(m,p);
 }else if(h==='obi:move'){
  if(sameCard(m,p.target)&&sameCard(m,p.from!)&&sameCard(m,p.to!)&&sameCard(m,p.origin!)&&(m.cards[p.target.id].attachedTo??m.cards[p.target.id].location)===p.origin!.id&&m.cards[p.target.id].location===p.from!.id&&routes(m,p).includes(p.to!.id)){
   delete m.cards[p.target.id].attachedTo;delete m.cards[p.target.id].aboardRole;moveWithAttachments(m,p.target.id,p.to!.id);record(m).moved.push(p.target.id);
   openWindow(m,'response',other(r.actor),{kind:'moved',card:p.target.id,from:p.from!.id,site:p.to!.id});
  }
 }else if(h==='obi:lose'){
  if(sameCard(m,p.target)){const lost=tableLossCards(m,[p.target.id]);queue(m,'lost',{...p,lost});loseFromTable(m,[p.target.id]);}
 }else if(h==='obi:lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.lost!,cardRefs:p.lost!.map(id=>referenceCard(m,id)),source:p.source.id,site:p.site.id,cause:'obi-wan'});
 else throw Error('Unknown Obi-Wan continuation.');
}
export function obiWanChoices(m:Match,d:Decision){const p=data(d);return [...routes(m,p).map(to=>({id:'obi:move:'+to,label:'Move '+name(m,p.target.id)+' to '+name(m,to)+' · free'})),{id:'obi:lose',label:'Lose '+name(m,p.target.id)+' instead'}];}
export function obiWanChoose(m:Match,d:Decision,id:string){
 const p=data(d);if(!obiWanChoices(m,d).some(c=>c.id===id))throw Error('Invalid Obi-Wan choice.');
 if(id==='obi:lose')lose(m,p);
 else {const target=m.cards[p.target.id];queue(m,'move',{...p,from:referenceCard(m,target.location!),to:referenceCard(m,id.slice(9)),origin:referenceCard(m,target.attachedTo??target.location!)},d.side,true);}
}
export function assertObiWan(m:Match){
 const refs=battle(m)?.obiWanUses??[],seen=new Set<string>();if(!Array.isArray(refs))throw Error('Invalid Obi-Wan usage.');
 for(const ref of refs){assertCardReference(m,ref);const key=ref.id+':'+ref.version;if(ref.zone!=='table'||m.cards[ref.id].blueprint!=='1_21'||seen.has(key))throw Error('Invalid Obi-Wan source.');seen.add(key);}
 for(let i=0;i<m.stack.length;i++){
  const f=m.stack[i];if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('obi:'))continue;
  const p=data(f);if(!p||!(f.kind==='decision'?['obi:choose']:['obi:use','obi:move','obi:lose','obi:lost']).includes(h))throw Error('Invalid Obi-Wan continuation.');
  for(const ref of [p.source,p.target,p.site]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid Obi-Wan table reference.');}
  const source=m.cards[p.source.id],target=m.cards[p.target.id],owner=source.owner;
  if(source.blueprint!=='1_21'||target.owner===owner||cardDefinition(m,target.id).type!=='Character'||!refs.some(ref=>ref.id===p.source.id&&ref.version===p.source.version))throw Error('Invalid Obi-Wan target binding.');
  const index=m.stack.findIndex(w=>w.kind==='window'&&w.serial===p.window),w=m.stack[index],parent=m.stack[index-1];
  if(!Number.isSafeInteger(p.window)||index<0||index>=i||w?.kind!=='window'||w.timing!=='response'||w.event!==undefined||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||battle(m)?.site!==p.site.id)throw Error('Invalid Obi-Wan initiation window.');
  if(f.kind==='decision'?f.side!==target.owner:f.actor!==(h==='obi:move'?target.owner:owner)||f.action.id!==action(h.slice(4),p).id||f.action.source!==source.id)throw Error('Invalid Obi-Wan actor or action.');
  if(f.kind==='resolution'&&(h==='obi:use'?f.action.payment?.[owner]!==1||Object.keys(f.action.payment).length!==1:f.action.payment!==undefined))throw Error('Invalid Obi-Wan payment.');
  if(h==='obi:move'){for(const ref of [p.from!,p.to!,p.origin!]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid Obi-Wan route.');}if(p.from!.id===p.to!.id)throw Error('Invalid Obi-Wan destination.');}else if(p.from||p.to||p.origin)throw Error('Unexpected Obi-Wan route.');
  if(h==='obi:lost'){if(!Array.isArray(p.lost)||!p.lost.includes(target.id)||new Set(p.lost).size!==p.lost.length||p.lost.some(id=>!m.cards[id]))throw Error('Invalid Obi-Wan loss group.');}else if(p.lost)throw Error('Unexpected Obi-Wan loss group.');
 }
}
