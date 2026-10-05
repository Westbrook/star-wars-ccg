import {cardDefinition} from './definitions';
import {optionalActionWindow} from './action-timing';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canSearch,recordFailedSearch,type Search} from './search-policy';
import {openWindow,type Context} from './runtime';
import {moveCard,shufflePile} from './state';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

export const effectSearchBlueprints=['6_77','6_160'];
type Payload={card:string;target?:CardReference};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const search=(m:Match,id:string):Search=>({blueprint:m.cards[id].blueprint,side:m.cards[id].owner,function:'effect-search:upload',owner:m.cards[id].owner,pile:'reserve'});
const isEffect=(m:Match,id:string)=>['Effect','Utinni Effect','Immediate Effect','Mobile Effect'].includes(cardDefinition(m,id).type);
const candidates=(m:Match,side:Side)=>m.players[side].reserve.filter(id=>isEffect(m,id)).sort();
const action=(step:string,p:Payload):Action=>({id:'effect-search:'+step+':'+p.card,handler:'effect-search:'+step,source:p.card,label:'Resolve Effect search',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
export function effectSearchActions(m:Match,w:Window,side:Side):Action[]{
 if(!optionalActionWindow(w)||!m.players[side].reserve.length)return [];
 return m.players[side].hand.filter(id=>effectSearchBlueprints.includes(m.cards[id].blueprint)&&canSearch(m,search(m,id))).map(card=>({...action('play',{card}),label:cardDefinition(m,card).name+' · use 3 Force to find an Effect',payment:{[side]:3}}));
}
export function effectSearchInitiate(m:Match,r:Resolution){moveCard(m,data(r).card,'playing');}
export function effectSearchResolve(m:Match,r:Resolution,context:Context){
 const p=data(r),side=m.cards[p.card].owner,h=r.action.handler;
 if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='effect-search:play'){
  queue(m,'finish',p);
  if(m.players[side].reserve.length&&canSearch(m,search(m,p.card))){queue(m,'inspect',p);openWindow(m,'response',other(side),{kind:'before-looking-at-pile',source:p.card,side,pile:'reserve'});}
 }else if(h==='effect-search:inspect')m.stack.push({kind:'decision',side,handler:'effect-search:choose',payload:p as unknown as Json});
 else if(h==='effect-search:take'){
  if(sameCard(m,p.target!)){moveCard(m,p.target!.id,'hand');openWindow(m,'response',other(side),{kind:'card-taken-into-hand',card:p.target!.id,source:p.card,from:'reserve'});}
 }else if(h==='effect-search:shuffle'){
  shufflePile(m,side,'reserve',context.entropy);openWindow(m,'response',other(side),{kind:'reserve-shuffled',side,source:p.card});
 }else if(h==='effect-search:finish')moveCard(m,p.card,'used');
 else throw Error('Unknown Effect search continuation.');
}
export function effectSearchChoices(m:Match,d:Decision){
 if(d.handler==='effect-search:verify')return [{id:'effect-search:verified',label:'Finish search verification and reshuffle'}];
 const cs=candidates(m,d.side);return cs.length?cs.map(id=>({id:'effect-search:take:'+id,label:'Take '+cardDefinition(m,id).name+' into hand'})):[{id:'effect-search:not-found',label:'No eligible Effect · allow verification'}];
}
export function effectSearchChoose(m:Match,d:Decision,id:string){
 const p=data(d),side=m.cards[p.card].owner;
 if(!effectSearchChoices(m,d).some(c=>c.id===id))throw Error('Invalid Effect search choice.');
 if(id==='effect-search:not-found')m.stack.push({kind:'decision',side:other(side),handler:'effect-search:verify',payload:p as unknown as Json});
 else if(id==='effect-search:verified'){recordFailedSearch(m,search(m,p.card));queue(m,'shuffle',p);}
 else {const target=id.slice('effect-search:take:'.length);queue(m,'shuffle',p);queue(m,'take',{...p,target:referenceCard(m,target)});openWindow(m,'response',other(side),{kind:'cards-revealed',cards:[target],source:p.card});}
}
export function effectSearchView(m:Match,seat:Side){
 if(m.status!=='playing')return {effectSearch:null};
 const f=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler.startsWith('effect-search:')||f.kind==='resolution'&&f.action.handler==='effect-search:take');
 if(!f||f.kind==='window')return {effectSearch:null};const p=data(f),owner=m.cards[p.card].owner;
 if(f.kind==='decision'&&seat!==f.side)return {effectSearch:null};
 return {effectSearch:{source:cardDefinition(m,p.card).name,side:owner,stage:f.kind==='resolution'?'revealed':f.handler==='effect-search:verify'?'verify':'search',cards:(f.kind==='resolution'?[p.target!.id]:[...m.players[owner].reserve].sort()).map(id=>({...m.cards[id]}))}};
}
export function assertEffectSearch(m:Match){
 for(const f of m.stack){if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('effect-search:'))continue;
  const p=data(f),owner=m.cards[p?.card]?.owner;
  if(!p||!effectSearchBlueprints.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].zone!=='playing'||(f.kind==='decision'?f.side:f.actor)!==(h==='effect-search:verify'?other(owner):owner)||!(f.kind==='decision'?['effect-search:choose','effect-search:verify']:['effect-search:play','effect-search:inspect','effect-search:take','effect-search:shuffle','effect-search:finish']).includes(h))throw Error('Invalid Effect search continuation.');
  if(h==='effect-search:take'){assertCardReference(m,p.target!);if(p.target!.zone!=='reserve'||m.cards[p.target!.id].owner!==owner||!isEffect(m,p.target!.id))throw Error('Invalid searched Effect.');}else if(p.target)throw Error('Unexpected Effect search target.');
  if(h==='effect-search:verify'&&candidates(m,owner).length)throw Error('A successful Effect search cannot be verified as failed.');
  if(f.kind==='resolution'&&(f.action.source!==p.card||f.action.id!==action(h.slice('effect-search:'.length),p).id||f.action.unrespondable||JSON.stringify(f.action.payment)!==JSON.stringify(h==='effect-search:play'?{[owner]:3}:undefined)))throw Error('Invalid Effect search action.');
 }
}
