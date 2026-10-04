import {cardDefinition} from './definitions';
import {otsdAlienLeader} from './otsd-characters';
import {nonUnique} from './characteristics';
import {gameTextActive} from './game-text';
import {crewActive} from './occupancy';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canSearch,recordFailedSearch,type Search} from './search-policy';
import {openWindow,type Context} from './runtime';
import {moveCard,shufflePile} from './state';
import type {Deployment} from './deployment';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={source:CardReference;window:number;target?:CardReference};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const search=(m:Match,id:string):Search=>({blueprint:m.cards[id].blueprint,side:m.cards[id].owner,function:'alien:upload',owner:m.cards[id].owner,pile:'reserve'});
const candidates=(m:Match,side:Side)=>m.players[side].reserve.filter(id=>cardDefinition(m,id).subType==='Alien'&&nonUnique(m,id)).sort();
const key=(p:Payload)=>'alien-search:'+p.source.id+':'+p.source.version;
const action=(step:string,p:Payload):Action=>({id:'alien-search:'+step+':'+p.source.id,handler:'alien-search:'+step,source:p.source.id,label:step,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.source.id].owner,cancelled:false,action:action(step,p)});
function deployedHere(m:Match,w:Window,id:string):boolean {
 const e=w.event as {kind?:string;card?:string;cards?:string[]}|undefined;
 return w.timing==='response'&&e?.kind==='deployed'&&(e.cards??[e.card]).includes(id)&&((m.data.deployments??[]) as unknown as Deployment[]).some(d=>d.card.id===id&&sameCard(m,d.card)&&d.serial<=w.serial);
}
export function alienSearchActions(m:Match,w:Window,side:Side):Action[]{
 if(!m.players[side].reserve.length)return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&otsdAlienLeader(c.blueprint)&&deployedHere(m,w,c.id)&&crewActive(m,c.id)&&gameTextActive(m,c.id)&&canSearch(m,search(m,c.id))).flatMap(c=>{
  const p={source:referenceCard(m,c.id),window:w.serial};return w.completed.includes(key(p))?[]:[{...action('begin',p),label:cardDefinition(m,c.id).name+' · find a non-unique alien in Reserve'}];
 });
}
export function alienSearchInitiate(m:Match,r:Resolution):void {
 const p=data(r),w=m.stack[m.stack.indexOf(r)-1];
 if(w?.kind!=='window'||w.serial!==p.window||!deployedHere(m,w,p.source.id)||w.completed.includes(key(p)))throw Error('Invalid alien search opportunity.');w.completed.push(key(p));
}
export function alienSearchResolve(m:Match,r:Resolution,context:Context):void {
 if(r.cancelled)return;const p=data(r),side=r.actor;
 if(r.action.handler==='alien-search:begin'){
  if(!m.players[side].reserve.length||!canSearch(m,search(m,p.source.id)))return;
  queue(m,'search',p);openWindow(m,'response',other(side),{kind:'before-looking-at-pile',source:p.source.id,side,pile:'reserve'});
 }else if(r.action.handler==='alien-search:search')m.stack.push({kind:'decision',side,handler:'alien-search:choose',payload:p as unknown as Json});
 else if(r.action.handler==='alien-search:take'){
  if(sameCard(m,p.target!)){moveCard(m,p.target!.id,'hand');openWindow(m,'response',other(side),{kind:'card-taken-into-hand',card:p.target!.id,source:p.source.id,from:'reserve'});}
 }else if(r.action.handler==='alien-search:shuffle'){
  shufflePile(m,side,'reserve',context.entropy);openWindow(m,'response',other(side),{kind:'reserve-shuffled',side,source:p.source.id});
 }else throw Error('Unknown alien search continuation.');
}
export function alienSearchChoices(m:Match,d:Decision){
 if(d.handler==='alien-search:verify')return [{id:'alien-search:verified',label:'Finish search verification and reshuffle'}];
 const cs=candidates(m,d.side);return cs.length?cs.map(id=>({id:'alien-search:take:'+id,label:'Take '+cardDefinition(m,id).name+' into hand'})):[{id:'alien-search:not-found',label:'No eligible alien · allow verification'}];
}
export function alienSearchChoose(m:Match,d:Decision,id:string):void {
 const p=data(d),side=m.cards[p.source.id].owner;
 if(!alienSearchChoices(m,d).some(c=>c.id===id))throw Error('Invalid alien search choice.');
 if(id==='alien-search:not-found')m.stack.push({kind:'decision',side:other(side),handler:'alien-search:verify',payload:p as unknown as Json});
 else if(id==='alien-search:verified'){recordFailedSearch(m,search(m,p.source.id));queue(m,'shuffle',p);}
 else {const target=id.slice('alien-search:take:'.length);queue(m,'shuffle',p);queue(m,'take',{...p,target:referenceCard(m,target)});openWindow(m,'response',other(side),{kind:'cards-revealed',cards:[target],source:p.source.id});}
}
export function alienSearchView(m:Match,seat:Side){
 if(m.status!=='playing')return {alienSearch:null};
 const f=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler.startsWith('alien-search:')||f.kind==='resolution'&&f.action.handler==='alien-search:take');
 if(!f||f.kind==='window')return {alienSearch:null};const p=data(f),owner=m.cards[p.source.id].owner;
 if(f.kind==='decision'&&f.handler==='alien-search:choose'&&seat!==owner)return {alienSearch:null};
 return {alienSearch:{source:cardDefinition(m,p.source.id).name,side:owner,stage:f.kind==='resolution'?'revealed':f.handler==='alien-search:verify'?'verify':'search',cards:(f.kind==='resolution'?[p.target!.id]:[...m.players[owner].reserve].sort()).map(id=>({...m.cards[id]}))}};
}
export function assertAlienSearch(m:Match):void {
 for(const f of m.stack){if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('alien-search:'))continue;
  const p=data(f);if(!p)throw Error('Missing alien search binding.');assertCardReference(m,p.source);const owner=m.cards[p.source.id].owner,actor=f.kind==='decision'?f.side:f.actor;
  const w=m.stack.find(w=>w.kind==='window'&&w.serial===p.window) as Window|undefined;
  const event=w?.event as {kind?:string;card?:string;cards?:string[]}|undefined;
  if(w?.timing!=='response'||event?.kind!=='deployed'||!(event.cards??[event.card]).includes(p.source.id)||!((m.data.deployments??[]) as unknown as Deployment[]).some(d=>d.card.id===p.source.id&&d.card.version===p.source.version&&d.serial<=w.serial))throw Error('Invalid alien search origin.');
  if(!otsdAlienLeader(m.cards[p.source.id].blueprint)||p.source.zone!=='table'||!w||m.stack.indexOf(w)>=m.stack.indexOf(f)||!w.completed.includes(key(p))||actor!==(h==='alien-search:verify'?other(owner):owner)||!(f.kind==='decision'?['alien-search:choose','alien-search:verify']:['alien-search:begin','alien-search:search','alien-search:take','alien-search:shuffle']).includes(h))throw Error('Invalid alien search continuation.');
  if(h==='alien-search:take'){assertCardReference(m,p.target!);if(p.target!.zone!=='reserve'||m.cards[p.target!.id].owner!==owner||cardDefinition(m,p.target!.id).subType!=='Alien'||!nonUnique(m,p.target!.id))throw Error('Invalid searched alien.');}else if(p.target)throw Error('Unexpected alien target.');
  if(h==='alien-search:verify'&&candidates(m,owner).length)throw Error('A successful search cannot be verified as failed.');
  if(f.kind==='resolution'&&(f.action.source!==p.source.id||f.action.id!==action(h.slice('alien-search:'.length),p).id))throw Error('Invalid alien search action.');
 }
}
