import {premiereSystems} from './premiere-setup';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {name,system,moveWithAttachments,presence} from './board';
import {attachmentGroup,capturedShips,capturedShipFor,trappedCharacters} from './captured-ship-state';
import {capacityFits,vesselRule} from './occupancy';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {escapeShipToUsed} from './table';
import {openWindow} from './runtime';
import type {Battle} from './battle';
import type {Decision,Json,Match,Resolution} from './types';

const registry=identities as Record<string,{keywords:string[]}>;
export const tractorBeam=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&!!registry[m.cards[id].blueprint]?.keywords.includes('TRACTOR_BEAM');
const held=(m:Match,id:string)=>Object.values(m.cards).some(c=>c.attachedTo===m.cards[id].capturedShip?.host&&tractorBeam(m,c.id));
type Transition={target:CardReference;mode:'release'|'steal'};
/** Capturing callers resolve the capture response window before invoking this
 * effect. Custody need not fit ordinary cargo capacity. */
export function captureStarship(m:Match,id:string,host:string):void {
 const c=m.cards[id],h=m.cards[host];
 if(!c||c.zone!=='table'||c.owner!=='light'||cardDefinition(m,id).type!=='Starship'||cardDefinition(m,id).subType.includes('Mon Calamari')||c.attachedTo||!h||h.zone!=='table'||cardDefinition(m,host).type==='Starship'&&h.owner!=='dark'||!['Starship','Location'].includes(cardDefinition(m,host).type)||cardDefinition(m,host).type==='Location'&&cardDefinition(m,host).subType!=='Site'||!Object.values(m.cards).some(b=>b.attachedTo===host&&tractorBeam(m,b.id)))throw Error('Invalid starship capture.');
 const location=cardDefinition(m,host).type==='Location'?host:h.location;
 if(!location||!m.locations.includes(location))throw Error('Captured starship needs a location.');
 const group=attachmentGroup(m,id);if(group.some(x=>x.zone!=='table'))throw Error('Invalid captured ship group.');
 const battle=m.data.battle as unknown as Battle|undefined;
 for(const card of group){
  card.zone='inactive';card.location=location;
  if(battle&&battle.stage!=='complete'){
   if(Object.values(battle.participants).some(ids=>ids.includes(card.id))&&!(battle.departed??=[]).includes(card.id))battle.departed.push(card.id);
   battle.hits=battle.hits.filter(x=>x!==card.id);
  }
 }
 c.capturedShip={host};c.attachedTo=host;delete c.aboardRole;
 openWindow(m,'response','light',{kind:'starship-captured',card:id,host});
}
/** Ships held at a planetary site return to its system; held ships in space
 * return to their current system/sector. Placement is not movement. */
function launchLocations(m:Match,id:string):string[]{
 const c=m.cards[id],at=c.location;if(!at)return [];
 const d=cardDefinition(m,at);if(d.subType==='System'||d.subType==='Sector')return [at];
 return m.locations.filter(loc=>cardDefinition(m,loc).subType==='System'&&premiereSystems[m.cards[loc].blueprint]?.system===system(m,at)&&!!system(m,at));
}
export function releaseCapturedShip(m:Match,id:string):void {
 const c=m.cards[id];if(!c?.capturedShip||c.capturedShip.pending)throw Error('Invalid captured ship release.');
 c.capturedShip.pending='release';m.stack.push({kind:'decision',side:'light',handler:'captured-ship:release',payload:{target:referenceCard(m,id),mode:'release'} as unknown as Json});
}
export function scheduleCapturedShips(m:Match):boolean {
 // One mandatory transition at a time; refreshing retains the exact choice.
 if(m.stack.some(f=>f.kind==='decision'&&f.handler.startsWith('captured-ship:')||f.kind==='resolution'&&f.action.handler.startsWith('captured-ship:')))return false;
 for(const c of capturedShips(m)){
  if(c.capturedShip!.pending)continue;
  if(!trappedCharacters(m,c.id).length){
   if(!launchLocations(m,c.id).length)continue; // No supported destination; admission remains closed.
   c.capturedShip!.pending='steal';
   const p:Transition={target:referenceCard(m,c.id),mode:'steal'};
   m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:{id:'captured-ship:steal:'+c.id,handler:'captured-ship:steal',source:c.id,label:'Steal '+name(m,c.id),payload:p as unknown as Json}});
   openWindow(m,'response','light',{kind:'about-to-steal',card:c.id,cardRef:p.target} as unknown as Json);return true;
  }
  if(!held(m,c.id)){releaseCapturedShip(m,c.id);return true;}
 }return false;
}
export function capturedShipResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Transition,c=m.cards[p.target.id];
 if(!sameCard(m,p.target)||!c.capturedShip)return;
 if(r.cancelled||trappedCharacters(m,c.id).length){delete c.capturedShip.pending;return;}
 m.stack.push({kind:'decision',side:'dark',handler:'captured-ship:steal',payload:p as unknown as Json});
}
export function capturedShipChoices(m:Match,d:Decision){
 const p=d.payload as unknown as Transition;if(!sameCard(m,p.target)||m.cards[p.target.id].capturedShip?.pending!==p.mode)return [];
 const out=launchLocations(m,p.target.id).map(id=>({id:'captured-ship:launch:'+id,label:(p.mode==='steal'?'Steal ':'Launch ')+name(m,p.target.id)+' at '+name(m,id)}));
 if(p.mode==='release')out.push({id:'captured-ship:escape',label:'Release '+name(m,p.target.id)+' · ship and all aboard cards escape to Used'});
 return out;
}
export function capturedShipChoose(m:Match,d:Decision,choice:string):void {
 if(!capturedShipChoices(m,d).some(c=>c.id===choice))throw Error('Invalid captured ship destination.');
 const p=d.payload as unknown as Transition,c=m.cards[p.target.id];
 if(choice==='captured-ship:escape'){escapeShipToUsed(m,c.id);return;}
 const location=choice.slice('captured-ship:launch:'.length),group=attachmentGroup(m,c.id);
 for(const card of group){
  if(p.mode==='steal'&&!cardDefinition(m,card.id).type.includes('Effect')){card.originalOwner??=card.owner;card.owner='dark';}
  card.zone='table';
 }
 delete c.capturedShip;delete c.attachedTo;delete c.aboardRole;
 moveWithAttachments(m,c.id,location);
 openWindow(m,'response',p.mode==='steal'?'light':'dark',{kind:p.mode==='steal'?'starship-stolen':'starship-released',card:c.id,site:location,method:'launch'});
}
export function assertCapturedShips(m:Match):void {
 const pending=new Set<string>();
 for(const f of m.stack)if(f.kind==='decision'&&f.handler.startsWith('captured-ship:')||f.kind==='resolution'&&f.action.handler.startsWith('captured-ship:')){
  const p=(f.kind==='decision'?f.payload:f.action.payload) as unknown as Transition;
  const decision:Decision={kind:'decision',side:f.kind==='decision'?f.side:f.actor,handler:f.kind==='decision'?f.handler:f.action.handler,payload:p as unknown as Json};
  if(f.kind==='resolution'&&(p.mode!=='steal'||f.action.id!=='captured-ship:steal:'+p.target?.id||f.action.source!==p.target?.id))throw Error('Invalid stealing continuation.');
  if(!p||!['release','steal'].includes(p.mode)||decision.handler!=='captured-ship:'+p.mode||decision.side!==(p.mode==='steal'?'dark':'light')||!sameCard(m,p.target)||p.target.zone!=='inactive'||pending.has(p.target.id)||!capturedShipChoices(m,decision).length)throw Error('Invalid captured ship transition.');
  assertCardReference(m,p.target);pending.add(p.target.id);
  if(p.mode==='steal'&&trappedCharacters(m,p.target.id).length)throw Error('Occupied ship cannot be stolen.');
 }
 for(const c of Object.values(m.cards)){
  if(c.originalOwner!==undefined&&cardDefinition(m,c.id).side!==c.originalOwner)throw Error('Invalid stolen-card original owner.');
  if(c.capturedShip){
   const p=c.capturedShip,h=m.cards[p.host];
   if(c.zone!=='inactive'||c.owner!=='light'||cardDefinition(m,c.id).type!=='Starship'||c.aboardRole||c.attachedTo!==p.host||!h||h.zone!=='table'||cardDefinition(m,h.id).type==='Starship'&&h.owner!=='dark'||!(cardDefinition(m,h.id).type==='Starship'||cardDefinition(m,h.id).type==='Location'&&cardDefinition(m,h.id).subType==='Site')||c.location!==(cardDefinition(m,h.id).type==='Location'?h.id:h.location)||Object.keys(p).some(k=>!['host','pending'].includes(k))||p.pending!==undefined&&(!['steal','release'].includes(p.pending)||!pending.has(c.id)))throw Error('Invalid captured ship custody.');
  }
  const root=capturedShipFor(m,c.id);
  if(root){
   if(c.zone!=='inactive'||c.location!==root.location||c.captivity)throw Error('Invalid trapped ship occupant.');
   if(c.id!==root.id&&cardDefinition(m,c.id).type==='Character'&&!c.aboardRole)throw Error('Trapped character needs an aboard role.');
   if(vesselRule(m,c.id)&&!capacityFits(m,c.id,attachmentGroup(m,c.id).filter(x=>x.attachedTo===c.id&&x.aboardRole).map(x=>({id:x.id,role:x.aboardRole!}))))throw Error('Captured ship crew exceeds capacity.');
  }
 }
}
export const capturedShipView=(m:Match)=>({capturedShips:capturedShips(m).map(c=>({id:c.id,site:c.location!,host:c.capturedShip!.host,pending:c.capturedShip!.pending??null,disembark:cardDefinition(m,c.capturedShip!.host).subType==='Site'?(presence(m,'dark',c.location!)?'blocked':'available'):null,crew:trappedCharacters(m,c.id).map(x=>x.id),attachments:attachmentGroup(m,c.id).filter(x=>x.id!==c.id).map(x=>x.id)}))});
