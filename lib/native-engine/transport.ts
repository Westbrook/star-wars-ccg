import {deployValue} from './deploy-costs';
import {cardDefinition} from './definitions';
import {capital,inCargo,occupants,roleAvailable,vesselRule,pilotAboard,type AboardRole} from './occupancy';
import {moveWithAttachments,name,system,presence} from './board';
import {premiereLocations} from './premiere-setup';
import {vehicleDestination} from './vessel-travel';
import {canMove,record,barred,usage,pendingReactSite,reactionSources,canDeployAsReact,registerReact,resolveCancelledReact,cancelDrainAfterReact} from './ground';
import {canEnterTable,canPlayCard} from './persona';
import {deployed} from './deployment';
import {referenceCard,assertCardReference,sameCard,cardVersion,type CardReference} from './identity';
import {moveCard} from './state';
import {openWindow} from './runtime';
import {other,type Match,type Action,type Side,type Window,type Resolution,type Json} from './types';
type Mode='shuttle'|'embark'|'disembark'|'bridge'|'deploy';
type Payload={card:CardReference;origin:CardReference;target:CardReference;location:CardReference;role?:AboardRole;previous?:AboardRole;mode:Mode;react?:true;grant?:CardReference};
const characterRoles:AboardRole[]=['pilot','driver','passenger'];
const cargoRole=(m:Match,id:string):AboardRole=>cardDefinition(m,id).type==='Vehicle'?'vehicle':'starship';
const exterior=(m:Match,id:string)=>cardDefinition(m,id).subType==='Site'&&(cardDefinition(m,id).icons as string[]).includes('Exterior');
const flightPilot=pilotAboard;
const carriers=(m:Match,side:Side)=>Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&!c.attachedTo&&capital(m,c.id)&&c.location&&cardDefinition(m,c.location).subType==='System');
const key=(p:Payload)=>'transport:'+p.mode+':'+p.card.id+':'+p.target.id+(p.role?':'+p.role:'')+(p.react?':react:via:'+p.grant!.id:'');
function selected(m:Match,id:string,target:string,mode:Mode,role?:AboardRole):Payload{
 const c=m.cards[id];return {card:referenceCard(m,id),origin:referenceCard(m,c.attachedTo??c.location??target),target:referenceCard(m,target),location:referenceCard(m,cardDefinition(m,target).type==='Location'?target:m.cards[target].location!),mode,...(role?{role}:{}),...(c.aboardRole?{previous:c.aboardRole}:{})};
}
function options(m:Match,side:Side,checkUsage=true):Payload[]{
 const out:Payload[]=[],ships=carriers(m,side),add=(id:string,to:string,mode:Mode,roles:AboardRole[])=>{for(const role of roles)if(roleAvailable(m,to,id,role))out.push(selected(m,id,to,mode,role));};
 for(const c of Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&!barred(m,c.id))){
  const d=cardDefinition(m,c.id),isCharacter=d.type==='Character';
  if((isCharacter||d.type==='Vehicle')&&(!checkUsage||canMove(m,c.id))){
   if(!c.attachedTo&&c.location&&exterior(m,c.location))for(const ship of ships.filter(h=>system(m,h.location!)===system(m,c.location!)))add(c.id,ship.id,'shuttle',isCharacter?characterRoles:['vehicle']);
   if(c.attachedTo&&ships.some(h=>h.id===c.attachedTo))for(const site of m.locations.filter(site=>exterior(m,site)&&system(m,site)===system(m,c.location!)&&(isCharacter||vehicleDestination(m,c.id,site))))out.push(selected(m,c.id,site,'shuttle'));
  }
  if(isCharacter&&c.attachedTo){
   const parent=m.cards[c.attachedTo];
   if(inCargo(m,parent.id)&&parent.attachedTo)add(c.id,parent.attachedTo,'bridge',characterRoles);
   if(ships.some(h=>h.id===parent.id))for(const cargo of occupants(m,parent.id).filter(cargo=>inCargo(m,cargo.id)))add(c.id,cargo.id,'bridge',characterRoles);
  }
  if(d.type==='Starship'&&!capital(m,c.id)){
   if(!c.attachedTo&&c.location&&cardDefinition(m,c.location).subType==='System')for(const host of ships.filter(h=>h.location===c.location))add(c.id,host.id,'embark',['starship']);
   if(inCargo(m,c.id)&&flightPilot(m,c.id)&&c.location&&cardDefinition(m,c.location).subType==='System')out.push(selected(m,c.id,c.location,'disembark'));
  }
 }
 return out;
}
export function cargoDeploysAt(m:Match,id:string,host:string,ignorePresence=false):boolean {
 const ship=m.cards[host],r=vesselRule(m,id);if(!r||!ship||!carriers(m,m.cards[id].owner).some(h=>h.id===host))return false;
 if(r.world&&(system(m,ship.location!)!==r.world||cardDefinition(m,ship.location!).subType!=='Site'))return false;
 return !!(ignorePresence||premiereLocations[m.cards[ship.location!].blueprint]?.icons[m.cards[id].owner]||presence(m,m.cards[id].owner,ship.location!))&&roleAvailable(m,host,id,cargoRole(m,id));
}
function deployOptions(m:Match,side:Side,site?:string,grant?:string):Payload[]{
 const out:Payload[]=[];
 for(const id of m.players[side].hand.filter(id=>vesselRule(m,id)&&canPlayCard(m,id)&&(!grant||canDeployAsReact(m,id))))for(const ship of carriers(m,side).filter(h=>!site||h.location===site)){
  if(cargoDeploysAt(m,id,ship.id))out.push({...selected(m,id,ship.id,'deploy',cargoRole(m,id)),...(grant?{react:true as const,grant:referenceCard(m,grant)}:{})});
 }return out;
}
export function transportActions(m:Match,w:Window,side:Side):Action[]{
 const site=pendingReactSite(m,w,side);
 if(!site&&(w.timing!=='phase'||side!==m.turn.side||!['deploy','move'].includes(m.turn.phase)))return [];
 const choices=site?reactionSources(m,site,side).flatMap(grant=>deployOptions(m,side,site,grant)):m.turn.phase==='deploy'?deployOptions(m,side):options(m,side);
 return choices.map(p=>{
  const cost=p.mode==='deploy'?deployValue(m,p.card.id):p.mode==='shuttle'?1:0;
  const verb={deploy:'Deploy',shuttle:'Shuttle',embark:'Embark',disembark:'Disembark',bridge:'Move'}[p.mode];
  return {id:key(p),handler:p.mode==='deploy'?'transport:deploy':'transport:begin',source:p.card.id,payload:p as unknown as Json,payment:{[side]:cost},label:verb+' '+name(m,p.card.id)+' to '+name(m,p.target.id)+(p.role?' as '+p.role:'')+' · '+(cost?cost+' Force':'free')+(p.react?' as a react using '+name(m,p.grant!.id):'')};
 }).filter(a=>(a.payment[side]??0)<=m.players[side].force.length);
}
export function transportInitiate(m:Match,r:Resolution){if(r.action.handler==='transport:deploy'){const p=r.action.payload as unknown as Payload;if(p.react)registerReact(m,p.card.id);moveCard(m,p.card.id,'playing');}}
const destinationStill=(m:Match,p:Payload)=>sameCard(m,p.target)&&sameCard(m,p.location)&&(cardDefinition(m,p.target.id).type==='Location'||m.cards[p.target.id].location===p.location.id);
const bound=(m:Match,p:Payload)=>sameCard(m,p.card)&&sameCard(m,p.origin)&&destinationStill(m,p)&&(m.cards[p.card.id].attachedTo??m.cards[p.card.id].location)===p.origin.id&&m.cards[p.card.id].aboardRole===p.previous;
const available=(m:Match,side:Side,p:Payload)=>options(m,side,false).some(x=>key(x)===key(p));
export function transportResolve(m:Match,r:Resolution){
 if(resolveCancelledReact(m,r))return;
 const p=r.action.payload as unknown as Payload,c=m.cards[p.card.id];
 if(r.action.handler==='transport:deploy'){
  if(r.cancelled||!destinationStill(m,p)||!canEnterTable(m,c.id)||!cargoDeploysAt(m,c.id,p.target.id)){moveCard(m,c.id,'lost');return;}
  moveCard(m,c.id,'table');c.attachedTo=p.target.id;c.aboardRole=p.role;c.location=p.location.id;if(p.react)cancelDrainAfterReact(m,r.actor,{react:true,card:c.id,site:p.location.id});deployed(m,c.id);return;
 }
 if(r.cancelled||!bound(m,p)||!available(m,r.actor,p))return;
 if(r.action.handler==='transport:begin'){
  if(p.mode==='shuttle'){if(!canMove(m,c.id))return;record(m).moved.push(c.id);}
  m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:{...r.action,handler:'transport:finish'}});
  openWindow(m,'response',other(r.actor),{kind:'transport-moving',card:c.id,from:c.location!,site:p.location.id,method:p.mode});return;
 }
 if(r.action.handler!=='transport:finish')throw Error('Unknown transport action.');
 const from=c.location!;delete c.attachedTo;delete c.aboardRole;
 if(p.role){c.attachedTo=p.target.id;c.aboardRole=p.role;}
 moveWithAttachments(m,c.id,p.location.id);
 openWindow(m,'response',other(r.actor),{kind:'moved',card:c.id,from,site:p.location.id,method:p.mode});
}
export function assertTransport(m:Match){
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('transport:')){
  const p=f.action.payload as unknown as Payload;if(!p||!['transport:begin','transport:finish','transport:deploy'].includes(f.action.handler)||!['shuttle','embark','disembark','bridge','deploy'].includes(p.mode))throw Error('Invalid transport continuation.');
  for(const ref of [p.card,p.origin,p.target,p.location])assertCardReference(m,ref);
  if(m.cards[p.card.id].owner!==f.actor||f.action.source!==p.card.id||f.action.id!==key(p)||p.location.zone!=='table'||cardDefinition(m,p.location.id).type!=='Location'||p.origin.zone!=='table'||p.target.zone!=='table'||p.card.zone!==(p.mode==='deploy'?'hand':'table')||(p.mode==='deploy')!==(f.action.handler==='transport:deploy'))throw Error('Invalid transport binding.');
  if(p.react!==undefined){if(p.react!==true||p.mode!=='deploy'||!p.grant)throw Error('Invalid cargo deployment react.');assertCardReference(m,p.grant);if(p.grant.zone!=='table'||m.cards[p.grant.id].owner!==f.actor||!['1_6','1_201'].includes(m.cards[p.grant.id].blueprint))throw Error('Invalid cargo react permission.');}else if(p.grant)throw Error('Unexpected cargo react permission.');
  const targetLocation=cardDefinition(m,p.target.id).type==='Location';
  if(targetLocation?p.role!==undefined:!vesselRule(m,p.target.id)||m.cards[p.target.id].owner!==f.actor||p.role===undefined)throw Error('Invalid transport destination.');
  if(p.mode==='deploy'&&(m.cards[p.card.id].zone!=='playing'||cardVersion(m,p.card.id)!==p.card.version+1||!vesselRule(m,p.card.id)||p.role!==cargoRole(m,p.card.id)))throw Error('Invalid cargo deployment.');
  if(f.action.handler==='transport:finish'&&p.mode==='shuttle'&&!usage(m).moved.includes(p.card.id))throw Error('Missing shuttle movement use.');
  if(p.role!==undefined&&!['pilot','driver','passenger','vehicle','starship'].includes(p.role)||p.previous!==undefined&&!['pilot','driver','passenger','vehicle','starship'].includes(p.previous))throw Error('Invalid transport capacity.');
 }
}
