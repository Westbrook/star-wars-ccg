import {activeUndercoverSpy} from './undercover-state';
import {capturedShipFor} from './captured-ship-state';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {hasCharacteristic,isModel} from './characteristics';
import {isWarrior,moveWithAttachments,name} from './board';
import {capacityFits,characterPresent,isVessel,occupants,roleAvailable,type AboardRole} from './occupancy';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {placeInUsedFromTable} from './table';
import type {Battle} from './battle';
const battle=(m:Match)=>m.data.battle as unknown as Battle|undefined;
import {other,type Action,type Card,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

/** Captivity is on-table, but inactive. Attachments remain with their character
 * and become inactive too; none are discarded merely because of capture. */
export type Captivity = {escort:string} | {prison:string} | {release:true;imprisoned:boolean};
type Release = {target:CardReference;site:string;imprisoned:boolean};
export type CaptureDestination = {kind:'escape'} | {kind:'escort';id:string} | {kind:'prison';id:string};
const registry=identities as Record<string,{keywords:string[]}>;
export const captives=(m:Match)=>Object.values(m.cards).filter(c=>c.zone==='captive');
export const escorted=(m:Match,id:string)=>captives(m).filter(c=>c.captivity && 'escort' in c.captivity && c.captivity.escort===id);
export const prison=(m:Match,id:string)=>m.locations.includes(id)&&m.cards[id]?.zone==='table'&&!m.cards[id].blownAway&&!!registry[m.cards[id].blueprint]?.keywords.includes('PRISON');
export const escortEligible=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&m.cards[id].owner==='dark'&&cardDefinition(m,id).type==='Character'&&(isWarrior(m,id)||hasCharacteristic(m,id,'BOUNTY_HUNTER')||isModel(m,id,'BATTLE'));
/** Passenger slots are charged at the escort's immediate carrier, including
 * when that carrier is itself cargo. Captives never become active crew. */
export function captivePassengers(m:Match,host:string):Card[]{return captives(m).filter(c=>c.captivity&&'escort' in c.captivity&&m.cards[c.captivity.escort]?.attachedTo===host&&!!m.cards[c.captivity.escort]?.aboardRole);}
function canSeize(m:Match,escort:string,target:string):boolean{
 const e=m.cards[escort];if(!escortEligible(m,escort)||escorted(m,escort).length||e.location!==m.cards[target].location)return false;
 return !e.aboardRole||!e.attachedTo||capacityFits(m,e.attachedTo,[...occupants(m,e.attachedTo).map(c=>({id:c.id,role:c.aboardRole!})),...captivePassengers(m,e.attachedTo).map(c=>({id:c.id,role:'passenger' as const})),{id:target,role:'passenger'}]);
}
export function captureDestinations(m:Match,id:string):CaptureDestination[]{
 const c=m.cards[id];if(!c||!(c.zone==='table'||c.zone==='inactive'&&capturedShipFor(m,id))||c.owner!=='light'||cardDefinition(m,id).type!=='Character'||!c.location)return [];
 return [{kind:'escape'},...Object.values(m.cards).filter(e=>canSeize(m,e.id,id)).map(e=>({kind:'escort' as const,id:e.id})),...(prison(m,c.location)?[{kind:'prison' as const,id:c.location}]:[])];
}
function group(m:Match,id:string):Card[]{
 const ids=new Set([id]);for(let changed=true;changed;){changed=false;for(const c of Object.values(m.cards))if(c.attachedTo&&ids.has(c.attachedTo)&&!ids.has(c.id)){ids.add(c.id);changed=true;}}
 return [...ids].map(id=>m.cards[id]);
}
function endParticipation(m:Match,ids:string[]):void{
 const b=battle(m);if(!b||b.stage==='complete')return;
 for(const id of ids)if(Object.values(b.participants).some(v=>v.includes(id))&&!(b.departed??=[]).includes(id))b.departed.push(id);
 // Capture is the same on-table instance; it does not restore a hit (AR p96).
}
/** Trusted effect API. The caller supplies capture permission and its response
 * timing; destination legality is rechecked at resolution. */
export function captureCharacter(m:Match,id:string,destination:CaptureDestination):void{
 if(!captureDestinations(m,id).some(d=>JSON.stringify(d)===JSON.stringify(destination)))throw Error('Invalid capture destination.');
 if(destination.kind==='escape'){placeInUsedFromTable(m,id);return;}
 const c=m.cards[id],cards=group(m,id);
 if(cards.some(x=>x.zone!=='table'&&!(x.zone==='inactive'&&capturedShipFor(m,x.id))))throw Error('Invalid capture attachment group.');
 endParticipation(m,cards.map(c=>c.id));
 delete c.attachedTo;delete c.aboardRole;
 c.captivity=destination.kind==='escort'?{escort:destination.id}:{prison:destination.id};
 for(const card of cards)card.zone=card.id===id?'captive':'inactive';
 openWindow(m,'response','light',{kind:'captured',card:id,cardRef:referenceCard(m,id),destination:destination.kind,host:destination.id});
}
/** A character remains the same on-table instance through captivity. Duration,
 * movement and weapon-use records survive, and resume only when still valid. */
function activate(m:Match,id:string):void {for(const c of group(m,id))c.zone='table';delete m.cards[id].captivity;}
export function releaseCaptive(m:Match,id:string):void{
 const c=m.cards[id];if(c?.zone!=='captive'||!c.captivity||'release' in c.captivity||!c.location)throw Error('Invalid captive release.');
 const imprisoned='prison' in c.captivity;c.captivity={release:true,imprisoned};
 m.stack.push({kind:'decision',side:'light',handler:'captives:release',payload:{target:referenceCard(m,id),site:c.location,imprisoned} as unknown as Json});
}
/** Escort departure releases its captive unless this very loss also includes
 * the captive. This is called before removing the escort, preserving its site. */
export function releaseForDepartures(m:Match,ids:Set<string>):void{
 for(const c of captives(m))if(!ids.has(c.id)&&c.captivity&&'escort' in c.captivity&&ids.has(c.captivity.escort))releaseCaptive(m,c.id);
}
/** Whole-carrier loss also loses the captive, unlike loss of just its escort. */
export function carrierCaptives(m:Match,ids:Set<string>):string[]{
 return captives(m).filter(c=>{
  if(!c.captivity||!('escort' in c.captivity))return false;
  let e=m.cards[c.captivity.escort],seen=new Set<string>();
  while(e?.attachedTo){if(seen.has(e.id))throw Error('Cyclic captive carrier.');seen.add(e.id);e=m.cards[e.attachedTo];if(e&&ids.has(e.id)&&isVessel(m,e.id))return true;}return false;
 }).map(c=>c.id);
}
export function captiveChoices(m:Match,d:Decision){
 const p=d.payload as unknown as Release,c=m.cards[p.target.id];
 if(!sameCard(m,p.target)||!c.captivity||!('release' in c.captivity))return [];
 const out:{id:string;label:string}[]=p.imprisoned?[]:[{id:'captives:escape',label:'Release '+name(m,c.id)+' · escape to Used'}];
 if(m.locations.includes(p.site)&&cardDefinition(m,p.site).subType==='Site'){
  out.push({id:'captives:rally',label:'Release '+name(m,c.id)+' · rally at '+name(m,p.site)});
  for(const host of Object.values(m.cards).filter(h=>h.zone==='table'&&h.owner==='light'&&h.location===p.site&&isVessel(m,h.id)))for(const role of ['pilot','driver','passenger'] as AboardRole[])if(roleAvailable(m,host.id,c.id,role))out.push({id:'captives:rally:'+host.id+':'+role,label:'Rally '+name(m,c.id)+' aboard '+name(m,host.id)+' as '+role});
 }
 return out;
}
export function captiveChoose(m:Match,d:Decision,choice:string):void{
 if(!captiveChoices(m,d).some(c=>c.id===choice))throw Error('Invalid captive release choice.');
 const p=d.payload as unknown as Release,c=m.cards[p.target.id];activate(m,c.id);
 if(choice==='captives:escape'){placeInUsedFromTable(m,c.id);return;}
 const [, ,host,role]=choice.split(':');if(host){c.attachedTo=host;c.aboardRole=role as AboardRole;}
 moveWithAttachments(m,c.id,p.site);
 const b=battle(m);if(b&&b.stage!=='complete'&&b.site===p.site){
  // Unlike a card returning from a pile, a released captive may join even
  // after power has been totaled (AR Captives — Releasing).
  if(!b.participants.light.includes(c.id))b.participants.light.push(c.id);
  b.departed=b.departed?.filter(id=>id!==c.id);const existing=m.data.battles as {turn:number;sites:string[];participants:string[]}|undefined;const h=existing?.turn===m.turn.number?existing:{turn:m.turn.number,sites:[],participants:[]};if(!h.participants.includes(c.id))h.participants.push(c.id);m.data.battles=h as unknown as Json;
 }
 openWindow(m,'response',other(c.owner),{kind:'captive-released',card:c.id,site:p.site,method:'rally'});
}
/** Conversion can remove a prison's keyword without destroying its occupants. */
export function schedulePrisonRelease(m:Match):boolean{
 if(m.stack.some(f=>f.kind==='decision'&&f.handler==='captives:release'))return false;
 const c=captives(m).find(c=>c.captivity&&'prison' in c.captivity&&!prison(m,c.captivity.prison));
 if(!c)return false;releaseCaptive(m,c.id);return true;
}
export function assertCaptives(m:Match):void{
 const escorts=new Set<string>();const pending=new Set<string>();
 for(const f of m.stack)if(f.kind==='decision'&&f.handler.startsWith('captives:')){
  const p=f.payload as unknown as Release;
  if(f.handler!=='captives:release'||f.side!=='light'||!p||!p.target||!sameCard(m,p.target)||p.target.zone!=='captive'||!m.locations.includes(p.site)||typeof p.imprisoned!=='boolean'||pending.has(p.target.id))throw Error('Invalid captive release continuation.');
  assertCardReference(m,p.target);const c=m.cards[p.target.id];if(c.location!==p.site||!c.captivity||!('release' in c.captivity)||c.captivity.imprisoned!==p.imprisoned)throw Error('Invalid releasing captive.');pending.add(c.id);
 }
 for(const c of Object.values(m.cards)){
  if(c.zone==='captive'){
   if(c.owner!=='light'||cardDefinition(m,c.id).type!=='Character'||!c.location||!m.locations.includes(c.location)||c.attachedTo||c.aboardRole||!c.captivity||Object.keys(c.captivity).some(k=>!['escort','prison','release','imprisoned'].includes(k)))throw Error('Invalid captive.');
   const p=c.captivity;
   if('escort' in p){const host=m.cards[p.escort];if(Object.keys(p).length!==1||!host||host.zone!=='table'||host.owner!=='dark'||cardDefinition(m,host.id).type!=='Character'||host.location!==c.location||escorts.has(host.id))throw Error('Invalid captive escort.');escorts.add(host.id);}
   else if('prison' in p){if(Object.keys(p).length!==1||p.prison!==c.location)throw Error('Invalid imprisoned captive.');}
   else if(Object.keys(p).length!==2||p.release!==true||!pending.has(c.id))throw Error('Orphaned captive release.');
  }else if(c.captivity!==undefined)throw Error('Captivity requires an inactive captive.');
  if(c.zone==='inactive'&&!activeUndercoverSpy(m,c.id)&&!capturedShipFor(m,c.id)){
   let host=m.cards[c.attachedTo!],seen=new Set<string>([c.id]);while(host?.zone==='inactive'){if(seen.has(host.id))throw Error('Cyclic inactive attachment.');seen.add(host.id);host=m.cards[host.attachedTo!];}
   if(!host||host.zone!=='captive'||c.location!==host.location||c.aboardRole)throw Error('Inactive attachment needs a captive.');
  }
 }
}
export function captiveView(m:Match){return {captives:captives(m).map(c=>({id:c.id,site:c.location!,...c.captivity,attachments:group(m,c.id).filter(x=>x.id!==c.id).map(x=>x.id)}))};}

/** Unlimited movement between a prison and an escort present there. Taking
 * another escort's captive requires specific card permission and is not offered. */
type Transfer={target:CardReference;escort:CardReference;site:CardReference;mode:'deliver'|'take'};
export function captiveActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||side!=='dark'||m.turn.side!==side||m.turn.phase!=='move')return [];
 const result:Action[]=[];
 const add=(target:string,escort:string,site:string,mode:'deliver'|'take')=>result.push({id:'captives:'+mode+':'+target+':'+escort,handler:'captives:transfer',source:escort,label:(mode==='deliver'?'Imprison ':'Take custody of ')+name(m,target)+(mode==='deliver'?' at '+name(m,site):' with '+name(m,escort))+' · free',payload:{target:referenceCard(m,target),escort:referenceCard(m,escort),site:referenceCard(m,site),mode} as unknown as Json});
 for(const c of captives(m))if(c.captivity&&c.location&&prison(m,c.location)){
  if('escort' in c.captivity&&characterPresent(m,c.captivity.escort))add(c.id,c.captivity.escort,c.location,'deliver');
  if('prison' in c.captivity)for(const e of Object.values(m.cards))if(canSeize(m,e.id,c.id)&&characterPresent(m,e.id))add(c.id,e.id,c.location,'take');
 }return result;
}
export function captiveResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Transfer;if(r.cancelled||!sameCard(m,p.target)||!sameCard(m,p.escort)||!sameCard(m,p.site))return;
 const w:Window={kind:'window',timing:'phase',priority:'dark',passes:0,serial:m.serial,completed:[]};
 if(!captiveActions(m,w,'dark').some(a=>a.id===r.action.id))return;
 m.cards[p.target.id].captivity=p.mode==='deliver'?{prison:p.site.id}:{escort:p.escort.id};
 openWindow(m,'response','light',{kind:'captive-transferred',card:p.target.id,site:p.site.id,escort:p.escort.id,method:p.mode});
}
export function assertCaptiveTransfers(m:Match):void{
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('captives:')){
  const p=f.action.payload as unknown as Transfer;
  if(f.action.handler!=='captives:transfer'||f.actor!=='dark'||!p||!['deliver','take'].includes(p.mode))throw Error('Invalid captive transfer.');
  for(const ref of [p.target,p.escort,p.site])assertCardReference(m,ref);
  if(p.target.zone!=='captive'||p.escort.zone!=='table'||p.site.zone!=='table'||m.cards[p.target.id].owner!=='light'||m.cards[p.escort.id].owner!=='dark'||cardDefinition(m,p.target.id).type!=='Character'||cardDefinition(m,p.escort.id).type!=='Character'||cardDefinition(m,p.site.id).type!=='Location'||f.action.source!==p.escort.id||f.action.id!=='captives:'+p.mode+':'+p.target.id+':'+p.escort.id)throw Error('Invalid captive transfer binding.');
 }
}
