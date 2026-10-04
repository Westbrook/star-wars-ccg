import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {crewActive} from './occupancy';
import {openWindow,type Context} from './runtime';
import {canSearch,recordFailedSearch,type Search} from './search-policy';
import {moveCard,shufflePile} from './state';
import type {Action,Decision,Json,Match,Resolution,Side,Window} from './types';

type Payload={source:CardReference;target?:CardReference};
const search:Search={blueprint:'2_23',side:'light',function:'wedge:corellian-slip',owner:'light',pile:'reserve'};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const slips=(m:Match)=>m.players.light.reserve.filter(id=>m.cards[id].blueprint==='2_47').sort();
const action=(step:string,p:Payload):Action=>({id:'wedge:'+step+':'+p.source.id,handler:'wedge:'+step,source:p.source.id,label:'Wedge · search for Corellian Slip',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:'light',cancelled:false,action:action(step,p)});
export function wedgeActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='light'||!m.players.light.force.length||!m.players.light.reserve.length||!canSearch(m,search)||w.timing!=='phase'&&!(w.timing==='response'&&(w.event as {kind?:string})?.kind==='battle-weapons'))return [];
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.blueprint==='2_23'&&crewActive(m,c.id)&&gameTextActive(m,c.id)).map(c=>({...action('begin',{source:referenceCard(m,c.id)}),label:'Wedge · find Corellian Slip · 1 Force',payment:{light:1}}));
}
export function wedgeResolve(m:Match,r:Resolution,context:Context):void {
 if(r.cancelled)return;
 const p=data(r),h=r.action.handler;
 if(h==='wedge:begin'){
  if(!m.players.light.reserve.length||!canSearch(m,search))return;
  queue(m,'search',p);openWindow(m,'response','dark',{kind:'before-looking-at-pile',source:p.source.id,side:'light',pile:'reserve'});
 }else if(h==='wedge:search'){
  m.stack.push({kind:'decision',side:'light',handler:'wedge:choose',payload:p as unknown as Json});
 }else if(h==='wedge:take'){
  if(sameCard(m,p.target!)){moveCard(m,p.target!.id,'hand');openWindow(m,'response','dark',{kind:'card-taken-into-hand',card:p.target!.id,source:p.source.id,from:'reserve'});}
 }else if(h==='wedge:shuffle'){
  shufflePile(m,'light','reserve',context.entropy);openWindow(m,'response','dark',{kind:'reserve-shuffled',side:'light',source:p.source.id});
 }else throw Error('Unknown Wedge search continuation.');
}
export function wedgeChoices(m:Match,d:Decision){
 if(d.handler==='wedge:verify')return [{id:'wedge:verified',label:'Finish search verification and reshuffle'}];
 const candidates=slips(m);
 return candidates.length?candidates.map(id=>({id:'wedge:take:'+id,label:'Take Corellian Slip into hand'})):[{id:'wedge:not-found',label:'No Corellian Slip · allow verification'}];
}
export function wedgeChoose(m:Match,d:Decision,id:string):void {
 const p=data(d);
 if(id==='wedge:not-found')m.stack.push({kind:'decision',side:'dark',handler:'wedge:verify',payload:p as unknown as Json});
 else if(id==='wedge:verified'){recordFailedSearch(m,search);queue(m,'shuffle',p);}
 else {
  const target=id.slice('wedge:take:'.length);if(!slips(m).includes(target))throw Error('Invalid Wedge search selection.');
  queue(m,'shuffle',p);queue(m,'take',{...p,target:referenceCard(m,target)});
  openWindow(m,'response','dark',{kind:'cards-revealed',cards:[target],source:p.source.id});
 }
}
export function wedgeView(m:Match,seat:Side){
 if(m.status!=='playing')return {wedgeSearch:null};
 const f=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler.startsWith('wedge:')||f.kind==='resolution'&&f.action.handler==='wedge:take');
 if(!f||f.kind==='window')return {wedgeSearch:null};
 if(f.kind==='resolution'){const p=data(f);return {wedgeSearch:{stage:'revealed',cards:[{...m.cards[p.target!.id]}]}};}
 if(f.handler==='wedge:choose'&&seat!=='light')return {wedgeSearch:null};
 // Search reveals membership, never the hidden order of Reserve.
 return {wedgeSearch:{stage:f.handler==='wedge:verify'?'verify':'search',cards:[...m.players.light.reserve].sort().map(id=>({...m.cards[id]}))}};
}
export function assertWedge(m:Match):void {
 for(const f of m.stack){if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('wedge:'))continue;
  const p=data(f),side=f.kind==='decision'?f.side:f.actor;
  if(!p||m.cards[p.source?.id]?.blueprint!=='2_23'||m.cards[p.source.id].owner!=='light'||side!==(h==='wedge:verify'?'dark':'light')||(f.kind==='decision'?!['wedge:choose','wedge:verify'].includes(h):!['wedge:begin','wedge:search','wedge:take','wedge:shuffle'].includes(h)))throw Error('Invalid Wedge search continuation.');
  assertCardReference(m,p.source);if(p.source.zone!=='table')throw Error('Invalid search source.');
  if(h==='wedge:take'){assertCardReference(m,p.target!);if(p.target!.zone!=='reserve'||m.cards[p.target!.id].owner!=='light'||m.cards[p.target!.id].blueprint!=='2_47')throw Error('Invalid searched card.');}else if(p.target)throw Error('Unexpected search target.');
  if(h==='wedge:verify'&&slips(m).length)throw Error('A successful search cannot be verified as failed.');
  if(f.kind==='resolution'&&(f.action.source!==p.source.id||f.action.id!==action(h.slice(6),p).id))throw Error('Invalid search action.');
 }
}
