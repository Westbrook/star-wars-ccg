import identities from '../../data/native-engine/identities.json';
import {optionalActionWindow} from './action-timing';
import {battle} from './battle';
import {isGuard,moveWithAttachments,name,system} from './board';
import {attachmentGroup,capturedShipFor,capturedShips,trappedCharacters} from './captured-ship-state';
import {cardDefinition} from './definitions';
import {barred} from './ground';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {corulagAllowsGuardMove} from './otsd-locations';
import {openWindow,retireAction} from './runtime';
import {spaceLocation} from './sectors';
import {moveCard} from './state';
import {loseFromTable} from './table';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Mode='battle'|'effect'|'deployment'|'release';
type Payload={card:CardReference;mode:Mode;target:CardReference;bay?:CardReference;characters?:CardReference[];hits?:CardReference[];index?:number;actionId?:string;window?:number};
const registry=identities as Record<string,{keywords:string[]}>;
const dockingBay=(m:Match,id:string)=>m.locations.includes(id)&&m.cards[id]?.zone==='table'&&!m.cards[id].coveredBy&&!m.cards[id].blownAway&&!!registry[m.cards[id].blueprint]?.keywords.includes('DOCKING_BAY');
const key=(p:Payload)=>'alternatives:'+p.card.id+':'+p.mode+':'+p.target.id+(p.bay?':'+p.bay.id:'');
const action=(p:Payload,step='play'):Action=>({id:key(p),handler:'alternatives:'+step,source:p.card.id,label:'Alternatives To Fighting',payload:p as unknown as Json});
const queue=(m:Match,p:Payload,step:string)=>m.stack.push({kind:'resolution',actor:'light',cancelled:false,action:action(p,step)});
function pending(m:Match,p:Payload):Resolution|undefined{
 if(p.index===undefined)return;const f=m.stack[p.index],w=m.stack[p.index+1];
 return f?.kind==='resolution'&&!f.cancelled&&!f.awaitingResponses&&f.action.id===p.actionId&&w?.kind==='window'&&w.serial===p.window?f:undefined;
}
/** Current-location release is expressly included by Card2_044: a trapped
 * character at Docking Bay 327 can leave its captured ship without changing
 * locations. Relocation is unlimited and does not consume a regular move. */
function canReleaseTo(m:Match,id:string,to:string):boolean{
 const c=m.cards[id];if(!c||!c.location||!dockingBay(m,to))return false;
 if(c.location===to)return true;
 return !barred(m,id)&&(!isGuard(c.blueprint)||corulagAllowsGuardMove(m,id))&&!['Dagobah','Ahch-To'].includes(system(m,c.location)??'')&&!['Dagobah','Ahch-To'].includes(system(m,to)??'');
}
const escapeGroup=(m:Match,ship:string,bay:string)=>trappedCharacters(m,ship).filter(c=>canReleaseTo(m,c.id,bay));
export function alternativesActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='light')return [];
 const result:Action[]=[],f=m.stack.at(-2),b=battle(m),responding=w.timing==='response'&&w.event===undefined&&f?.kind==='resolution'&&!f.cancelled&&!f.awaitingResponses?f:undefined;
 for(const id of m.players.light.hand.filter(id=>m.cards[id].blueprint==='2_44')){
  const card=referenceCard(m,id),binding={index:m.stack.length-2,actionId:responding?.action.id,window:w.serial};
  if(responding?.action.handler==='battle:begin'&&b?.stage==='begin'&&!b.besieged&&spaceLocation(m,b.site)&&m.players.light.force.length>=3){
   const p:Payload={card,mode:'battle',target:referenceCard(m,b.site),...binding};result.push({...action(p),payment:{light:3},label:'Alternatives To Fighting · cancel battle · use 3 Force'});
  }
  if(responding?.action.handler==='besieged:deploy'&&responding.action.source&&m.cards[responding.action.source].zone==='playing'){
   const p:Payload={card,mode:'deployment',target:referenceCard(m,responding.action.source),...binding};result.push({...action(p),label:'Alternatives To Fighting · cancel Besieged deployment'});
  }
  if(!optionalActionWindow(w))continue;
  for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&c.blueprint==='2_117'))result.push({...action({card,mode:'effect',target:referenceCard(m,c.id)}),label:'Alternatives To Fighting · cancel Besieged ('+c.id+')'});
  for(const ship of capturedShips(m).filter(c=>!c.capturedShip!.pending))for(const bay of m.locations.filter(id=>dockingBay(m,id))){
   const characters=escapeGroup(m,ship.id,bay).map(c=>referenceCard(m,c.id));if(!characters.length)continue;
   const p:Payload={card,mode:'release',target:referenceCard(m,ship.id),bay:referenceCard(m,bay),characters};
   result.push({...action(p),label:'Alternatives To Fighting · release '+characters.length+' from '+name(m,ship.id)+' to '+name(m,bay)});
  }
 }return result;
}
export function alternativesInitiate(m:Match,r:Resolution):void {const p=r.action.payload as unknown as Payload;moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);}
const remaining=(m:Match,p:Payload)=>sameCard(m,p.target)&&m.cards[p.target.id].capturedShip&&sameCard(m,p.bay!)?(p.characters??[]).filter(ref=>sameCard(m,ref)&&capturedShipFor(m,ref.id)?.id===p.target.id&&canReleaseTo(m,ref.id,p.bay!.id)):[];
export function alternativesResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload,h=r.action.handler;
 if(h==='alternatives:finish'){if(sameCard(m,p.card))moveCard(m,p.card.id,'lost');return;}
 if(h==='alternatives:cancel'){if(!r.cancelled&&sameCard(m,p.target)){queue(m,p,'event');loseFromTable(m,[p.target.id]);}return;}
 if(h==='alternatives:event'){openWindow(m,'response','dark',{kind:'card-canceled',card:p.target.id,source:p.card.id});return;}
 if(h==='alternatives:hit-loss'){if(!r.cancelled){const ids=(p.hits??[]).filter(ref=>sameCard(m,ref)).map(ref=>ref.id);if(ids.length)loseFromTable(m,ids);}return;}
 if(h==='alternatives:release'){
  if(r.cancelled)return;
  const refs=remaining(m,p),b=battle(m);if(!refs.length)return;
  // Reactivate the personal attachments as a group; preserve physical card
  // instances and leave vehicles/starships aboard the captured hull.
  for(const ref of refs){const c=m.cards[ref.id],group=attachmentGroup(m,c.id);for(const item of group){
   if(item.zone==='inactive')item.zone='table';
   if(b&&b.stage!=='complete'&&b.participants.light.includes(item.id)&&!(b.departed??=[]).includes(item.id))b.departed.push(item.id);
  }delete c.attachedTo;delete c.aboardRole;moveWithAttachments(m,c.id,p.bay!.id);}
  openWindow(m,'response','dark',{kind:'relocated',cards:refs.map(r=>r.id),site:p.bay!.id,source:p.card.id,method:'alternatives'});
  // The shared hit-departure interruption handles any released hit character.
  // Retain the legacy hit-loss resolver above for already-saved continuations.
  return;
 }
 if(h!=='alternatives:play')throw Error('Unknown Alternatives To Fighting continuation.');
 if(r.cancelled){if(sameCard(m,p.card))moveCard(m,p.card.id,'lost');return;}
 queue(m,p,'finish');
 if(p.mode==='release'){
  const refs=remaining(m,p);if(!refs.length)return;queue(m,p,'release');openWindow(m,'response','dark',{kind:'relocating',cards:refs.map(r=>r.id),site:p.bay!.id,source:p.card.id,method:'alternatives'});return;
 }
 if(!sameCard(m,p.target))return;
 if(p.mode==='battle'){
  const f=pending(m,p);if(f?.action.handler!=='battle:begin'||battle(m)?.besieged||battle(m)?.stage!=='begin')return;
  f.cancelled=true;openWindow(m,'response','dark',{kind:'battle-canceled',site:p.target.id,source:p.card.id});
 }else if(p.mode==='deployment'){
  if(pending(m,p)?.action.handler!=='besieged:deploy')return;retireAction(m,p.index!,p.actionId!,p.window!);moveCard(m,p.target.id,'lost');openWindow(m,'response','dark',{kind:'card-canceled',card:p.target.id,source:p.card.id});
 }else {queue(m,p,'cancel');openWindow(m,'response','dark',{kind:'about-to-be-canceled-on-table',card:p.target.id,source:p.card.id});}
}
export function assertAlternatives(m:Match):void{
 for(const [i,f]of m.stack.entries())if(f.kind==='resolution'&&f.action.handler.startsWith('alternatives:')){
  const p=f.action.payload as unknown as Payload,h=f.action.handler;
  if(!p||!['alternatives:play','alternatives:finish','alternatives:release','alternatives:event','alternatives:cancel','alternatives:hit-loss'].includes(h)||!['battle','effect','deployment','release'].includes(p.mode)||f.actor!=='light'||f.action.source!==p.card?.id||f.action.id!==key(p)||f.action.unrespondable)throw Error('Invalid Alternatives To Fighting continuation.');
  assertCardReference(m,p.card);assertCardReference(m,p.target);
  if(m.cards[p.card.id].blueprint!=='2_44'||m.cards[p.card.id].owner!=='light'||p.card.zone!=='playing'||!sameCard(m,p.card))throw Error('Invalid Alternatives To Fighting source.');
  if(h==='alternatives:play'?(p.mode==='battle'?f.action.payment?.light!==3||f.action.payment?.dark!==undefined:!!f.action.payment):!!f.action.payment)throw Error('Invalid Alternatives To Fighting cost.');
  if(p.mode==='battle'||p.mode==='deployment'){
   if(!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=i||!Number.isSafeInteger(p.window))throw Error('Invalid Alternatives response binding.');
   const frame=m.stack[p.index!],w=m.stack[p.index!+1];if(frame?.kind!=='resolution'||frame.action.id!==p.actionId||w?.kind!=='window'||w.serial!==p.window||w.timing!=='response'||w.event!==undefined)throw Error('Invalid Alternatives response opportunity.');
   if(p.mode==='battle'?(frame.action.handler!=='battle:begin'||(frame.action.payload as {site:string}).site!==p.target.id||p.target.zone!=='table'||!spaceLocation(m,p.target.id)||!!battle(m)?.besieged):!['besieged:deploy','core:canceled'].includes(frame.action.handler)||p.target.zone!=='playing'||m.cards[p.target.id].blueprint!=='2_117'||frame.action.handler==='besieged:deploy'&&frame.action.source!==p.target.id)throw Error('Invalid Alternatives cancellation target.');
  }else if(p.index!==undefined||p.window!==undefined||p.actionId!==undefined)throw Error('Unexpected Alternatives response binding.');
  if(p.mode==='effect'&&(p.target.zone!=='table'||m.cards[p.target.id].blueprint!=='2_117'))throw Error('Invalid Besieged target.');
  if(p.mode==='release'){
   assertCardReference(m,p.bay!);if(p.target.zone!=='inactive'||cardDefinition(m,p.target.id).type!=='Starship'||p.bay!.zone!=='table'||!registry[m.cards[p.bay!.id].blueprint]?.keywords.includes('DOCKING_BAY')||!Array.isArray(p.characters)||!p.characters.length||new Set(p.characters.map(r=>r.id)).size!==p.characters.length)throw Error('Invalid released crew binding.');
   for(const ref of p.characters){assertCardReference(m,ref);if(!['table','inactive'].includes(ref.zone)||m.cards[ref.id].owner!=='light'||cardDefinition(m,ref.id).type!=='Character')throw Error('Invalid released character.');}
  }else if(p.characters||p.bay)throw Error('Unexpected released crew.');
  if(p.hits!==undefined){if(h!=='alternatives:hit-loss'||p.mode!=='release'||!p.hits.length||new Set(p.hits.map(r=>r.id)).size!==p.hits.length)throw Error('Invalid released hit group.');for(const ref of p.hits){assertCardReference(m,ref);if(ref.zone!=='table'||!p.characters?.some(c=>c.id===ref.id))throw Error('Invalid released hit target.');}}else if(h==='alternatives:hit-loss')throw Error('Missing released hit group.');
  if(['alternatives:release','alternatives:hit-loss'].includes(h)&&p.mode!=='release'||['alternatives:event','alternatives:cancel'].includes(h)&&p.mode!=='effect')throw Error('Invalid Alternatives continuation mode.');
 }
}
