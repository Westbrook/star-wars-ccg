import {cardDefinition,isSite,name,system} from './board';
import {hasCharacteristic,isModel} from './characteristics';
import {serviceActive} from './droid-service';
import {optionalActionWindow} from './action-timing';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {crewActive} from './occupancy';
import {groundPresent} from './participation';
import {cardPlayedThisTurn} from './persona';
import {assertReservePeek,peekReserve,reservePeekView,returnReservePeek,type ReservePeek} from './reserve-peek';
import {openWindow,retireAction,type Context} from './runtime';
import {moveCard,shufflePile} from './state';
import {loseFromTable} from './table';
import {other,sides,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

const supported=(bp:string)=>['1_108','1_250','1_235','1_110'].includes(bp);
const unconditional=(bp:string)=>['1_235','1_110'].includes(bp);
const names:Record<string,string[]>={'1_110':['Imperial Barrier','Wrong Turn','Retract The Bridge'],'1_235':['Report To Lord Vader','Scomp Link Access','Rebel Planners','Rebel Reinforcements','Gift Of The Mentor','Gift of the Mentor','Panic',"Don't Get Cocky",'Skywalkers','Demotion','Combined Attack','Surprise Assault'],'1_108':["We're All Gonna Be A Lot Thinner!",'Boring Conversation Anyway'],'1_250':['Scomp Link Access','Into The Garbage Chute, Flyboy']};
type Payload={card:string;mode:'peek'|'drain'|'cancel'|'table';unit?:CardReference;pile?:Side;inspection?:ReservePeek;target?:CardReference;site?:CardReference;index?:number;actionId?:string;window?:number};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const action=(step:string,p:Payload):Action=>({id:'scomp:'+step+':'+p.card+':'+p.mode+(p.unit?':'+p.unit.id:'')+(p.pile?':'+p.pile:'')+(p.target?':'+p.target.id:''),handler:'scomp:'+step,source:p.card,label:'Resolve Scomp-link Interrupt',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
const atLink=(m:Match,id:string)=>{const c=m.cards[id];return groundPresent(m,id)&&!!c.location&&(cardDefinition(m,c.location).icons as string[]).includes('Scomp Link')||!!c.aboardRole&&!!c.attachedTo&&(cardDefinition(m,c.attachedTo).icons as string[]).includes('Scomp Link');};
const eligibleUnits=(m:Match,side:Side)=>Object.values(m.cards).filter(c=>c.zone==='table'&&cardDefinition(m,c.id).type==='Character'&&crewActive(m,c.id)&&atLink(m,c.id)&&(side==='light'?c.owner===side&&(isModel(m,c.id,'ASTROMECH')||isModel(m,c.id,'VEHICLE')):cardDefinition(m,c.id).subType==='Imperial'&&hasCharacteristic(m,c.id,'LEADER')));
function pending(m:Match,p:Payload){const r=m.stack[p.index!],w=m.stack[p.index!+1];return r?.kind==='resolution'&&!r.cancelled&&!r.awaitingResponses&&r.action.id===p.actionId&&w?.kind==='window'&&w.serial===p.window&&w.event===undefined?r:undefined;}
export function scompActions(m:Match,w:Window,side:Side):Action[]{
 const result:Action[]=[],parent=m.stack.at(-2),response=w.timing==='response'&&w.event===undefined&&parent?.kind==='resolution'&&!parent.cancelled&&!parent.awaitingResponses?parent:undefined,units=eligibleUnits(m,side);
 for(const card of m.players[side].hand.filter(id=>supported(m.cards[id].blueprint))){
  const bp=m.cards[card].blueprint,offer=(p:Payload,label:string)=>result.push({...action('play',p),label:name(m,card)+' · '+label});
  if(response){const bound={index:m.stack.length-2,actionId:response.action.id,window:w.serial},site=(response.action.payload as {site?:string})?.site;
   if(!unconditional(bp)&&response.action.handler==='ground:drain'&&site&&serviceActive(m,side)&&!cardPlayedThisTurn(m,side,bp)&&Object.values(m.cards).some(c=>c.owner===side&&c.zone==='table'&&c.location===site&&cardDefinition(m,c.id).subType==='Droid'&&crewActive(m,c.id)))offer({card,mode:'drain',site:referenceCard(m,site),...bound},'cancel Force drain at '+name(m,site));
   const target=response.action.source;
   if(target&&m.cards[target].zone==='playing'&&names[bp].includes(name(m,target))&&unconditional(bp))offer({card,mode:'cancel',target:referenceCard(m,target),...bound},'cancel '+name(m,target));
   if(!unconditional(bp)&&target&&m.cards[target].zone==='playing'&&names[bp].includes(name(m,target)))for(const unit of units.filter(c=>c.location&&isSite(m,c.location)&&system(m,c.location)==='Death Star'))offer({card,mode:'cancel',...(side==='light'?{unit:referenceCard(m,unit.id)}:{}),target:referenceCard(m,target),...bound},'cancel '+name(m,target));
  }
  if(optionalActionWindow(w)&&unconditional(bp))for(const c of Object.values(m.cards))if(c.zone==='table'&&names[bp].includes(name(m,c.id)))offer({card,mode:'table',target:referenceCard(m,c.id)},'cancel '+name(m,c.id));
  if(optionalActionWindow(w)&&!unconditional(bp)){
   // Cylinder spots a leader; Scomp Link Access explicitly targets its R-unit.
   for(const unit of side==='light'?units:units.slice(0,1))for(const pile of sides)if(m.players[pile].reserve.length)offer({card,mode:'peek',...(side==='light'?{unit:referenceCard(m,unit.id)}:{}),pile},'inspect '+pile+' Reserve Deck'+(side==='light'?' with '+name(m,unit.id):''));
   for(const unit of (side==='light'?units:units.filter(c=>c.location&&isSite(m,c.location)&&system(m,c.location)==='Death Star').slice(0,1)).filter(c=>c.location&&isSite(m,c.location)&&system(m,c.location)==='Death Star'))for(const c of Object.values(m.cards))if(c.zone==='table'&&names[bp].includes(name(m,c.id)))offer({card,mode:'table',...(side==='light'?{unit:referenceCard(m,unit.id)}:{}),target:referenceCard(m,c.id)},'cancel '+name(m,c.id));
  }
 }
 return result.filter((a,i)=>result.findIndex(b=>b.id===a.id)===i);
}
export function scompInitiate(m:Match,r:Resolution){moveCard(m,data(r).card,'playing');}
export function scompResolve(m:Match,r:Resolution,context:Context){
 const p=data(r),h=r.action.handler;
 if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='scomp:play'){
  queue(m,'finish',p);
  if(p.mode==='peek'){queue(m,'inspect',p);openWindow(m,'response',other(r.actor),{kind:'before-looking-at-pile',source:p.card,side:p.pile!,pile:'reserve'});}
  else if(p.mode==='drain'){const target=pending(m,p);if(target&&sameCard(m,p.site!)){target.cancelled=true;openWindow(m,'response',other(r.actor),{kind:'force-drain-cancelled',site:p.site!.id,source:p.card});}}
  else if(p.mode==='cancel'){if(pending(m,p)&&sameCard(m,p.target!)){retireAction(m,p.index!,p.actionId!,p.window!);moveCard(m,p.target!.id,'lost');openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.target!.id,source:p.card});}}
  else if(sameCard(m,p.target!)){queue(m,'canceled',p);loseFromTable(m,[p.target!.id]);}
 }else if(h==='scomp:inspect'){
  if(m.players[p.pile!].reserve.length)m.stack.push({kind:'decision',side:r.actor,handler:'scomp:peek',payload:{...p,inspection:peekReserve(m,p.pile!,m.players[p.pile!].reserve.length,true)} as unknown as Json});
 }else if(h==='scomp:shuffle'){shufflePile(m,p.pile!,'reserve',context.entropy);openWindow(m,'response',other(r.actor),{kind:'reserve-shuffled',side:p.pile!,source:p.card});}
 else if(h==='scomp:canceled')openWindow(m,'response',other(r.actor),{kind:'card-canceled',card:p.target!.id,source:p.card});
 else if(h==='scomp:finish')moveCard(m,p.card,m.cards[p.card].blueprint==='1_110'?'lost':'used');
 else throw Error('Unknown Scomp-link continuation.');
}
export const scompChoices=()=>[{id:'scomp:finish',label:'Finish viewing and reshuffle'}];
export function scompChoose(m:Match,d:Decision,id:string){if(id!=='scomp:finish')throw Error('Invalid Scomp-link choice.');const p=data(d);returnReservePeek(m,p.inspection!);const {inspection,...next}=p;queue(m,'shuffle',next);}
export function scompView(m:Match,seat:Side){const d=m.stack.at(-1);return m.status==='playing'&&d?.kind==='decision'&&d.handler==='scomp:peek'&&d.side===seat?reservePeekView(m,data(d).inspection!):{};}
export function assertScomp(m:Match){
 for(let index=0;index<m.stack.length;index++){
  const f=m.stack[index];if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('scomp:'))continue;const p=data(f),actor=f.kind==='decision'?f.side:f.actor;
  if(!p||!supported(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==actor||m.cards[p.card].zone!=='playing'||!['peek','drain','cancel','table'].includes(p.mode)||!(f.kind==='decision'?['scomp:peek']:['scomp:play','scomp:inspect','scomp:shuffle','scomp:canceled','scomp:finish']).includes(h))throw Error('Invalid Scomp-link continuation.');
  if(f.kind==='resolution'&&(f.action.source!==p.card||f.action.id!==action(h.slice(6),p).id))throw Error('Invalid Scomp-link action.');
  if(unconditional(m.cards[p.card].blueprint)&&(!['cancel','table'].includes(p.mode)||p.unit))throw Error('Invalid named cancellation mode.');
  if(p.unit){assertCardReference(m,p.unit);if(actor!=='light'||p.unit.zone!=='table'||m.cards[p.unit.id].owner!==actor||!(isModel(m,p.unit.id,'ASTROMECH')||isModel(m,p.unit.id,'VEHICLE')))throw Error('Invalid Scomp-link R-unit.');}
  else if(actor==='light'&&!unconditional(m.cards[p.card].blueprint)&&p.mode!=='drain')throw Error('Missing Scomp-link R-unit.');
  if(p.mode==='peek'){if(!sides.includes(p.pile!))throw Error('Invalid inspected Reserve.');if(f.kind==='decision'){assertReservePeek(m,p.inspection!);if(p.inspection!.whole!==true||p.inspection!.side!==p.pile)throw Error('Invalid inspection owner.');}}
  else if(f.kind==='decision'||['scomp:inspect','scomp:shuffle'].includes(h))throw Error('Invalid Scomp-link mode.');
  if(['cancel','table'].includes(p.mode)){assertCardReference(m,p.target!);if(p.target!.zone!==(p.mode==='table'?'table':'playing')||!names[m.cards[p.card].blueprint].includes(name(m,p.target!.id)))throw Error('Invalid Scomp-link cancellation target.');}
  if(['cancel','drain'].includes(p.mode)){
   const r=m.stack[p.index!],w=m.stack[p.index!+1];if(!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=index||r?.kind!=='resolution'||r.action.id!==p.actionId||w?.kind!=='window'||w.timing!=='response'||w.event!==undefined||w.serial!==p.window)throw Error('Invalid Scomp-link response binding.');
   if(p.mode==='drain'){assertCardReference(m,p.site!);if(p.site!.zone!=='table'||r.action.handler!=='ground:drain'||(r.action.payload as {site:string}).site!==p.site!.id)throw Error('Invalid Scomp-link drain target.');}
   else if(r.action.handler!=='core:canceled'&&r.action.source!==p.target!.id)throw Error('Invalid Scomp-link pending target.');
  }
 }
}
