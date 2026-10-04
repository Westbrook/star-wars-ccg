import identities from '../../data/native-engine/identities.json';
import {optionalActionWindow} from './action-timing';
import {battle,members} from './battle';
import {cardDefinition,name} from './board';
import {isModel} from './characteristics';
import {belowDecks} from './occupancy';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canSearch,recordFailedSearch,type Search} from './search-policy';
import {openWindow,type Context} from './runtime';
import {moveCard,shufflePile} from './state';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;mode:'search'|'tie';target?:CardReference;site?:CardReference;window?:number;lost?:string[]};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const search=(m:Match,p:Payload):Search=>({blueprint:m.cards[p.card].blueprint,side:m.cards[p.card].owner,owner:m.cards[p.card].owner,function:'mentor:lightsaber',pile:'reserve'});
const lightsaber=(m:Match,id:string)=>cardDefinition(m,id).type==='Weapon'&&(identities as Record<string,{keywords:string[]}>)[m.cards[id].blueprint]?.keywords.includes('LIGHTSABER');
const candidates=(m:Match,side:Side)=>m.players[side].reserve.filter(id=>lightsaber(m,id)).sort();
const action=(step:string,p:Payload):Action=>({id:'mentor:'+step+':'+p.card+':'+p.mode+(p.target?':'+p.target.id:''),handler:'mentor:'+step,source:p.card,label:'Resolve '+nameFor(p),payload:p as unknown as Json});
const nameFor=(p:Payload)=>p.mode==='search'?'lightsaber search':'TIE loss';
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
export function mentorActions(m:Match,w:Window,side:Side):Action[]{
 const result:Action[]=[],b=battle(m),parent=m.stack.at(-2),initial=w.timing==='response'&&w.event===undefined&&b?.stage==='begin'&&b.initiator!==side&&parent?.kind==='resolution'&&parent.action.handler==='battle:begin'&&!parent.cancelled&&!parent.awaitingResponses;
 for(const card of m.players[side].hand){
  if(m.cards[card].blueprint==='1_82'&&optionalActionWindow(w)&&m.players[side].reserve.length&&canSearch(m,{blueprint:'1_82',side,owner:side,function:'mentor:lightsaber',pile:'reserve'})){const p:Payload={card,mode:'search'};result.push({...action('play',p),label:name(m,card)+' · use 1 Force to find a lightsaber',payment:{[side]:1}});}
  if(m.cards[card].blueprint==='1_76'&&initial&&['System','Sector'].includes(cardDefinition(m,b!.site).subType))for(const target of sides.flatMap(s=>members(m,s)).filter(id=>isModel(m,id,'TIE_LN')&&!m.cards[id].attachedTo&&!belowDecks(m,id))){const p:Payload={card,mode:'tie',target:referenceCard(m,target),site:referenceCard(m,b!.site),window:w.serial};result.push({...action('play',p),label:name(m,card)+' · make '+name(m,target)+' lost'});}
 }
 return result;
}
export function mentorInitiate(m:Match,r:Resolution){moveCard(m,data(r).card,'playing');}
export function mentorResolve(m:Match,r:Resolution,context:Context){
 const p=data(r),h=r.action.handler;if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='mentor:play'){
  queue(m,'finish',p);
  if(p.mode==='search'){if(m.players[r.actor].reserve.length&&canSearch(m,search(m,p))){queue(m,'search',p);openWindow(m,'response',other(r.actor),{kind:'before-looking-at-pile',side:r.actor,pile:'reserve',source:p.card});}}
  else if(sameCard(m,p.target!)&&sameCard(m,p.site!)&&m.cards[p.target!.id].location===p.site!.id){queue(m,'lose',p);const cards=tableLossCards(m,[p.target!.id]);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.target!.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,site:p.site!.id,cause:'dont-get-cocky'});}
 }else if(h==='mentor:search'){
  if(m.players[r.actor].reserve.length&&canSearch(m,search(m,p)))m.stack.push({kind:'decision',side:r.actor,handler:'mentor:choose',payload:p as unknown as Json});
 }else if(h==='mentor:take'){
  if(sameCard(m,p.target!)){moveCard(m,p.target!.id,'hand');openWindow(m,'response',other(r.actor),{kind:'card-taken-into-hand',card:p.target!.id,from:'reserve',source:p.card});}
 }else if(h==='mentor:shuffle'){shufflePile(m,r.actor,'reserve',context.entropy);openWindow(m,'response',other(r.actor),{kind:'reserve-shuffled',side:r.actor,source:p.card});}
 else if(h==='mentor:lose'){
  if(sameCard(m,p.target!)&&sameCard(m,p.site!)&&m.cards[p.target!.id].location===p.site!.id){const lost=tableLossCards(m,[p.target!.id]);queue(m,'lost',{...p,lost});loseFromTable(m,[p.target!.id]);}
 }else if(h==='mentor:lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.lost!,cardRefs:p.lost!.map(id=>referenceCard(m,id)),source:p.card,site:p.site!.id,cause:'dont-get-cocky'});
 else if(h==='mentor:finish')moveCard(m,p.card,'lost');
 else throw Error('Unknown mentor Interrupt continuation.');
}
export function mentorChoices(m:Match,d:Decision){
 if(d.handler==='mentor:verify')return [{id:'mentor:verified',label:'Finish search verification and reshuffle'}];
 const cs=candidates(m,d.side);return cs.length?cs.map(id=>({id:'mentor:take:'+id,label:'Take '+name(m,id)+' into hand'})):[{id:'mentor:not-found',label:'No lightsaber found · allow verification'}];
}
export function mentorChoose(m:Match,d:Decision,id:string){
 const p=data(d),side=m.cards[p.card].owner;if(!mentorChoices(m,d).some(c=>c.id===id))throw Error('Invalid lightsaber choice.');
 if(id==='mentor:not-found')m.stack.push({kind:'decision',side:other(side),handler:'mentor:verify',payload:p as unknown as Json});
 else if(id==='mentor:verified'){recordFailedSearch(m,search(m,p));queue(m,'shuffle',p);}
 else {const target=id.slice('mentor:take:'.length);queue(m,'shuffle',p);queue(m,'take',{...p,target:referenceCard(m,target)});openWindow(m,'response',other(side),{kind:'cards-revealed',cards:[target],source:p.card});}
}
export function mentorView(m:Match,seat:Side){
 if(m.status!=='playing')return {mentorSearch:null};
 const f=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler.startsWith('mentor:')||f.kind==='resolution'&&f.action.handler==='mentor:take');
 if(!f||f.kind==='window')return {mentorSearch:null};const p=data(f),side=m.cards[p.card].owner;
 if(f.kind==='decision'&&f.handler==='mentor:choose'&&seat!==side)return {mentorSearch:null};
 return {mentorSearch:{source:name(m,p.card),side,stage:f.kind==='resolution'?'revealed':f.handler==='mentor:verify'?'verify':'search',cards:(f.kind==='resolution'?[p.target!.id]:[...m.players[side].reserve].sort()).map(id=>({...m.cards[id]}))}};
}
export function assertMentor(m:Match){
 for(let i=0;i<m.stack.length;i++){
  const f=m.stack[i];if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('mentor:'))continue;
  const p=data(f),actor=f.kind==='decision'?f.side:f.actor,owner=m.cards[p?.card]?.owner;
  if(!p||!['search','tie'].includes(p.mode)||m.cards[p.card]?.blueprint!==(p.mode==='search'?'1_82':'1_76')||m.cards[p.card].zone!=='playing'||actor!==(h==='mentor:verify'?other(owner):owner)||!(f.kind==='decision'?['mentor:choose','mentor:verify']:['mentor:play','mentor:search','mentor:take','mentor:shuffle','mentor:lose','mentor:lost','mentor:finish']).includes(h))throw Error('Invalid mentor Interrupt continuation.');
  if(f.kind==='resolution'&&(f.action.source!==p.card||f.action.id!==action(h.slice(7),p).id||h==='mentor:play'&&(p.mode==='search'?f.action.payment?.[owner]!==1:!!f.action.payment)))throw Error('Invalid mentor action.');
  if(p.mode==='search'){
   if(p.site||p.window!==undefined||p.lost||['mentor:lose','mentor:lost'].includes(h))throw Error('Invalid mentor search mode.');
   if(h==='mentor:take'){assertCardReference(m,p.target!);if(p.target!.zone!=='reserve'||m.cards[p.target!.id].owner!==owner||!lightsaber(m,p.target!.id))throw Error('Invalid searched lightsaber.');}else if(p.target)throw Error('Unexpected lightsaber target.');
   if(h==='mentor:verify'&&candidates(m,owner).length)throw Error('A successful search cannot be verified as failed.');
  }else{
   if(f.kind==='decision'||['mentor:search','mentor:take','mentor:shuffle'].includes(h))throw Error('Invalid Cocky mode.');
   assertCardReference(m,p.target!);assertCardReference(m,p.site!);if(p.target!.zone!=='table'||!isModel(m,p.target!.id,'TIE_LN')||p.site!.zone!=='table'||!['System','Sector'].includes(cardDefinition(m,p.site!.id).subType))throw Error('Invalid Cocky target.');
   const index=m.stack.findIndex(w=>w.kind==='window'&&w.serial===p.window),w=m.stack[index],parent=m.stack[index-1];if(!Number.isSafeInteger(p.window)||index<0||index>=i||w?.kind!=='window'||w.timing!=='response'||w.event!==undefined||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||battle(m)?.site!==p.site!.id||battle(m)?.initiator===owner)throw Error('Invalid Cocky response binding.');
   if(p.lost&&(h!=='mentor:lost'||!Array.isArray(p.lost)||!p.lost.includes(p.target!.id)||new Set(p.lost).size!==p.lost.length||p.lost.some(id=>!m.cards[id])))throw Error('Invalid Cocky loss group.');
  }
 }
}
