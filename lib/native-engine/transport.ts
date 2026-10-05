import {liftTube} from './lift-tube';
import {mainCorridorActive} from './executor-sites';
import {launchBay,launchBayShuttleDestinations,launchBayShuttleFree} from './launch-bay';
import {relatedShip,shipSite,uniqueShipSitePersona} from './ship-sites';
import {deployWithoutPresence} from './board';
import {otsdDeployModifier,cargoRoles} from './otsd-ships';
import {forceIcons} from './location-icons';
import {movesFree} from './movement-costs';
import {hothDeployModifier} from './hoth-text';
import {shieldDeployment,shieldMovement} from './hoth';
import {bespinDeployModifier} from './bespin';
import {spaceLocation,sectorsAt} from './sectors';
import {deployValue} from './deploy-costs';
import {cardDefinition} from './definitions';
import {capital,inCargo,occupants,roleAvailable,vesselRule,pilotAboard,crewActive,type AboardRole} from './occupancy';
import {moveWithAttachments,name,system,presence} from './board';
import {premiereLocations} from './premiere-setup';
import {vehicleDestination} from './vessel-travel';
import {canMove,record,barred,usage,pendingReactSite,reactionSources,canDeployAsReact,registerReact,resolveCancelledReact,cancelDrainAfterReact} from './ground';
import {canEnterTable,canPlayCard,hasPersona} from './persona';
import {deployed} from './deployment';
import {referenceCard,assertCardReference,sameCard,cardVersion,type CardReference} from './identity';
import {moveCard} from './state';
import {openWindow} from './runtime';
import {other,type Match,type Action,type Side,type Window,type Resolution,type Json} from './types';
type Mode='shuttle'|'embark'|'disembark'|'bridge'|'ship-site'|'corridor'|'deploy';
type Payload={card:CardReference;origin:CardReference;target:CardReference;location:CardReference;role?:AboardRole;previous?:AboardRole;mode:Mode;react?:true;grant?:CardReference;corridor?:CardReference;bay?:CardReference;carrier?:CardReference;shipSite?:CardReference;fromLocation?:CardReference};
const characterRoles:AboardRole[]=['pilot','driver','passenger'];
const regular=(p:Payload)=>p.mode==='shuttle'||p.mode==='ship-site'||p.mode==='corridor';
const exterior=(m:Match,id:string)=>cardDefinition(m,id).subType==='Site'&&(cardDefinition(m,id).icons as string[]).includes('Exterior');
const flightPilot=pilotAboard;
const carriers=(m:Match,side:Side)=>Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&!c.attachedTo&&capital(m,c.id)&&c.location&&spaceLocation(m,c.location));
const key=(p:Payload)=>'transport:'+p.mode+':'+p.card.id+':'+p.target.id+(p.role?':'+p.role:'')+(p.corridor?':via:'+p.corridor.id:'')+(p.react?':react:via:'+p.grant!.id:'');
function selected(m:Match,id:string,target:string,mode:Mode,role?:AboardRole):Payload{
 const c=m.cards[id],site=mode==='ship-site'?[c.location,target].find(site=>!!site&&shipSite(m,site)):undefined,bay=mode==='shuttle'?[c.location,target].find(site=>!!site&&launchBay(m,site)):undefined;return {...(site?{shipSite:referenceCard(m,site),carrier:referenceCard(m,relatedShip(m,site)!),fromLocation:referenceCard(m,c.location!)}:{}),...(bay?{bay:referenceCard(m,bay),carrier:referenceCard(m,relatedShip(m,bay)!)}:{}),card:referenceCard(m,id),origin:referenceCard(m,c.attachedTo??c.location??target),target:referenceCard(m,target),location:referenceCard(m,cardDefinition(m,target).type==='Location'?target:m.cards[target].location!),mode,...(role?{role}:{}),...(c.aboardRole?{previous:c.aboardRole}:{})};
}
function options(m:Match,side:Side,checkUsage=true):Payload[]{
 const out:Payload[]=[],ships=carriers(m,side),add=(id:string,to:string,mode:Mode,roles:AboardRole[])=>{for(const role of roles)if(roleAvailable(m,to,id,role))out.push(selected(m,id,to,mode,role));};
 for(const c of Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&!barred(m,c.id))){
  const d=cardDefinition(m,c.id),isCharacter=d.type==='Character';
  // Main Corridor grants a separate free regular location-text move. Its named
  // Executor sites are unique sites, not a generic bay attached to Executor.
  if(side==='dark'&&(isCharacter||d.type==='Vehicle'||d.type==='Starship')&&(!checkUsage||canMove(m,c.id))&&(isCharacter||liftTube(m,c.id)||pilotAboard(m,c.id)||d.type==='Vehicle'&&occupants(m,c.id).some(crew=>crew.aboardRole==='driver'&&crewActive(m,crew.id)))){
   for(const corridor of m.locations.filter(site=>mainCorridorActive(m,site))){
    const hull=relatedShip(m,corridor),destinations=[...m.locations.filter(site=>site!==corridor&&uniqueShipSitePersona(m,site)==='EXECUTOR'),...(hull&&m.cards[hull].owner===side?[hull]:[])];
    const origin=c.attachedTo??c.location;
    const targets=origin===corridor?destinations:origin&&destinations.includes(origin)?[corridor]:[];
    for(const target of targets){
     const location=cardDefinition(m,target).type==='Location';
     if(location){if(!isCharacter&&!(d.type==='Vehicle'&&vehicleDestination(m,c.id,target)))continue;out.push({...selected(m,c.id,target,'corridor'),corridor:referenceCard(m,corridor),fromLocation:referenceCard(m,c.location!)});}
     else if(!liftTube(m,c.id))for(const role of isCharacter?characterRoles:cargoRoles(m,c.id,target))if(roleAvailable(m,target,c.id,role))out.push({...selected(m,c.id,target,'corridor',role),corridor:referenceCard(m,corridor),fromLocation:referenceCard(m,c.location!)});
    }
   }
  }
  if((isCharacter||d.type==='Vehicle'&&!liftTube(m,c.id))&&(!checkUsage||canMove(m,c.id))){
   for(const to of launchBayShuttleDestinations(m,c.id).filter(to=>isCharacter||vehicleDestination(m,c.id,to)))out.push(selected(m,c.id,to,'shuttle'));
   if(!c.attachedTo&&c.location&&exterior(m,c.location))for(const ship of ships.filter(h=>cardDefinition(m,h.location!).subType==='System'&&system(m,h.location!)===system(m,c.location!)))add(c.id,ship.id,'shuttle',isCharacter?characterRoles:['vehicle']);
   if(c.attachedTo&&cardDefinition(m,c.location!).subType==='System'&&ships.some(h=>h.id===c.attachedTo))for(const site of m.locations.filter(site=>exterior(m,site)&&system(m,site)===system(m,c.location!)&&(isCharacter||vehicleDestination(m,c.id,site))))out.push(selected(m,c.id,site,'shuttle'));
  }
  // AR p68: a related ship/site transfer is free but uses the card's regular
  // move. A site is not a capacity slot, and an absent related hull grants none.
  // AR p92 gives unpiloted craft no exception for this movement. Check crew
  // aboard rather than operational(), because cargo is classified as landed.
  if((isCharacter||d.type==='Vehicle'&&!liftTube(m,c.id)||d.type==='Starship')&&(isCharacter||pilotAboard(m,c.id)||d.type==='Vehicle'&&occupants(m,c.id).some(crew=>crew.aboardRole==='driver'&&crewActive(m,crew.id)))&&(!checkUsage||canMove(m,c.id))){
   for(const site of m.locations.filter(site=>shipSite(m,site))){
    const host=relatedShip(m,site),h=host&&m.cards[host];
    if(!h||h.owner!==side||h.zone!=='table'||!h.location||!vesselRule(m,h.id))continue;
    if(!c.attachedTo&&c.location===site)add(c.id,h.id,'ship-site',isCharacter?characterRoles:cargoRoles(m,c.id,h.id));
    if(c.attachedTo===h.id&&c.aboardRole&&(isCharacter||d.type==='Vehicle'&&vehicleDestination(m,c.id,site)||d.type==='Starship'&&!capital(m,c.id)&&launchBay(m,site)))out.push(selected(m,c.id,site,'ship-site'));
   }
  }
  if(isCharacter&&c.attachedTo){
   const parent=m.cards[c.attachedTo];
   if(inCargo(m,parent.id)&&parent.attachedTo)add(c.id,parent.attachedTo,'bridge',characterRoles);
   if(ships.some(h=>h.id===parent.id))for(const cargo of occupants(m,parent.id).filter(cargo=>inCargo(m,cargo.id)))add(c.id,cargo.id,'bridge',characterRoles);
  }
  if(d.type==='Starship'&&!capital(m,c.id)){
   if(!c.attachedTo&&c.location&&spaceLocation(m,c.location))for(const host of ships.filter(h=>h.location===c.location))add(c.id,host.id,'embark',cargoRoles(m,c.id,host.id));
   if(inCargo(m,c.id)&&flightPilot(m,c.id)&&c.location&&spaceLocation(m,c.location))out.push(selected(m,c.id,c.location,'disembark'));
  }
 }
 return out.filter(p=>p.mode!=='shuttle'||!shieldMovement(m,side,m.cards[p.card.id].location!,p.location.id));
}
export function cargoDeploysAt(m:Match,id:string,host:string,ignorePresence=false,role?:AboardRole):boolean {
 const ship=m.cards[host],r=vesselRule(m,id);if(liftTube(m,id)||!r||!ship||shieldDeployment(m,id,ship.location!)||!carriers(m,m.cards[id].owner).some(h=>h.id===host))return false;
 if(r.world&&(system(m,ship.location!)!==r.world||cardDefinition(m,ship.location!).subType!=='Site'))return false;
 return !!(ignorePresence||deployWithoutPresence(m,m.cards[id].owner,ship.location!)||forceIcons(m,ship.location!,m.cards[id].owner)||presence(m,m.cards[id].owner,ship.location!))&&cargoRoles(m,id,host).some(r=>(!role||r===role)&&roleAvailable(m,host,id,r));
}
function deployOptions(m:Match,side:Side,site?:string,grant?:string):Payload[]{
 const out:Payload[]=[];
 for(const id of m.players[side].hand.filter(id=>vesselRule(m,id)&&canPlayCard(m,id)&&(!grant||canDeployAsReact(m,id))))for(const ship of carriers(m,side).filter(h=>!site||h.location===site)){
  for(const role of cargoRoles(m,id,ship.id))if(cargoDeploysAt(m,id,ship.id,false,role))out.push({...selected(m,id,ship.id,'deploy',role),...(grant?{react:true as const,grant:referenceCard(m,grant)}:{})});
 }return out;
}
export function transportActions(m:Match,w:Window,side:Side):Action[]{
 const site=pendingReactSite(m,w,side);
 if(!site&&(w.timing!=='phase'||side!==m.turn.side||!['deploy','move'].includes(m.turn.phase)))return [];
 const choices=site?reactionSources(m,site,side).flatMap(grant=>deployOptions(m,side,site,grant)):m.turn.phase==='deploy'?deployOptions(m,side):options(m,side);
 return choices.map(p=>{
  const cost=p.mode==='deploy'?Math.max(0,deployValue(m,p.card.id)+bespinDeployModifier(m,p.card.id,p.location.id)+hothDeployModifier(m,p.card.id,p.location.id)+otsdDeployModifier(m,p.card.id,p.location.id)):p.mode==='shuttle'&&!launchBayShuttleFree(m,p.card.id,p.location.id)&&!movesFree(m,p.card.id,p.location.id)?1+sectorsAt(m,system(m,p.location.id)!,'cloud').length:0;
  const verb={deploy:'Deploy',shuttle:'Shuttle',embark:'Embark',disembark:'Disembark',bridge:'Move','ship-site':'Move',corridor:'Move'}[p.mode];
  return {id:key(p),handler:p.mode==='deploy'?'transport:deploy':'transport:begin',source:p.card.id,payload:p as unknown as Json,payment:{[side]:cost},label:verb+' '+name(m,p.card.id)+' to '+name(m,p.target.id)+(p.role?' as '+p.role:'')+' · '+(cost?cost+' Force':'free')+(p.corridor?' via Main Corridor':'')+(p.react?' as a react using '+name(m,p.grant!.id):'')};
 }).filter(a=>(a.payment[side]??0)<=m.players[side].force.length);
}
export function transportInitiate(m:Match,r:Resolution){if(r.action.handler==='transport:deploy'){const p=r.action.payload as unknown as Payload;if(p.react)registerReact(m,p.card.id);moveCard(m,p.card.id,'playing');}}
const destinationStill=(m:Match,p:Payload)=>sameCard(m,p.target)&&sameCard(m,p.location)&&(cardDefinition(m,p.target.id).type==='Location'||m.cards[p.target.id].location===p.location.id);
const bound=(m:Match,p:Payload)=>(!p.corridor||sameCard(m,p.corridor)&&sameCard(m,p.fromLocation!)&&m.cards[p.card.id].location===p.fromLocation!.id)&&(!p.shipSite||sameCard(m,p.shipSite)&&sameCard(m,p.carrier!)&&sameCard(m,p.fromLocation!)&&relatedShip(m,p.shipSite.id)===p.carrier!.id&&m.cards[p.card.id].location===p.fromLocation!.id)&&(!p.bay||sameCard(m,p.bay)&&sameCard(m,p.carrier!)&&relatedShip(m,p.bay.id)===p.carrier!.id)&&sameCard(m,p.card)&&sameCard(m,p.origin)&&destinationStill(m,p)&&(m.cards[p.card.id].attachedTo??m.cards[p.card.id].location)===p.origin.id&&m.cards[p.card.id].aboardRole===p.previous;
const available=(m:Match,side:Side,p:Payload)=>options(m,side,false).some(x=>key(x)===key(p));
export function transportResolve(m:Match,r:Resolution){
 if(resolveCancelledReact(m,r))return;
 const p=r.action.payload as unknown as Payload,c=m.cards[p.card.id];
 if(r.action.handler==='transport:deploy'){
  if(r.cancelled||!destinationStill(m,p)||!canEnterTable(m,c.id)||!cargoDeploysAt(m,c.id,p.target.id,false,p.role)){moveCard(m,c.id,'lost');return;}
  moveCard(m,c.id,'table');c.attachedTo=p.target.id;c.aboardRole=p.role;c.location=p.location.id;if(p.react)cancelDrainAfterReact(m,r.actor,{react:true,card:c.id,site:p.location.id});deployed(m,c.id);return;
 }
 if(r.cancelled||!bound(m,p)||!available(m,r.actor,p))return;
 if(r.action.handler==='transport:begin'){
  if(regular(p)){if(!canMove(m,c.id))return;record(m).moved.push(c.id);}
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
  const p=f.action.payload as unknown as Payload;if(!p||!['transport:begin','transport:finish','transport:deploy'].includes(f.action.handler)||!['shuttle','embark','disembark','bridge','ship-site','corridor','deploy'].includes(p.mode))throw Error('Invalid transport continuation.');
  for(const ref of [p.card,p.origin,p.target,p.location])assertCardReference(m,ref);
  if(m.cards[p.card.id].owner!==f.actor||f.action.source!==p.card.id||f.action.id!==key(p)||p.location.zone!=='table'||cardDefinition(m,p.location.id).type!=='Location'||p.origin.zone!=='table'||p.target.zone!=='table'||p.card.zone!==(p.mode==='deploy'?'hand':'table')||(p.mode==='deploy')!==(f.action.handler==='transport:deploy'))throw Error('Invalid transport binding.');
  if(p.bay){assertCardReference(m,p.bay);assertCardReference(m,p.carrier!);if(p.mode!=='shuttle'||p.bay.zone!=='table'||m.cards[p.bay.id].blueprint!=='4_165'||p.carrier!.zone!=='table'||sameCard(m,p.bay)&&sameCard(m,p.carrier!)&&relatedShip(m,p.bay.id)!==p.carrier!.id||![p.origin.id,p.target.id].includes(p.bay.id))throw Error('Invalid Launch Bay shuttle binding.');}else if(p.carrier&&p.mode!=='ship-site')throw Error('Unexpected transport carrier.');
  if(p.mode==='ship-site'){
   assertCardReference(m,p.shipSite!);assertCardReference(m,p.carrier!);assertCardReference(m,p.fromLocation!);
   if(p.bay||p.shipSite!.zone!=='table'||p.carrier!.zone!=='table'||p.fromLocation!.zone!=='table'||cardDefinition(m,p.fromLocation!.id).type!=='Location'||!shipSite(m,p.shipSite!.id)||!vesselRule(m,p.carrier!.id)||m.cards[p.carrier!.id].owner!==f.actor||!([p.origin.id,p.target.id].includes(p.shipSite!.id))||!([p.origin.id,p.target.id].includes(p.carrier!.id))||sameCard(m,p.shipSite!)&&sameCard(m,p.carrier!)&&relatedShip(m,p.shipSite!.id)!==p.carrier!.id||JSON.stringify(f.action.payment)!==JSON.stringify({[f.actor]:0}))throw Error('Invalid related ship-site movement.');
   if(p.origin.id===p.shipSite!.id?p.fromLocation!.id!==p.origin.id||p.previous!==undefined:!p.previous)throw Error('Invalid related ship-site origin.');
   const type=cardDefinition(m,p.card.id).type;
   if(p.role&&(type==='Character'?!['pilot','passenger'].includes(p.role):!cargoRoles(m,p.card.id,p.carrier!.id).includes(p.role)))throw Error('Invalid related ship-site capacity role.');
  }else if(p.shipSite||p.fromLocation&&p.mode!=='corridor')throw Error('Unexpected ship-site movement binding.');
  if(p.mode==='corridor'){
   assertCardReference(m,p.corridor!);assertCardReference(m,p.fromLocation!);
   const otherEndpoint=p.origin.id===p.corridor!.id?p.target.id:p.origin.id;
   if(f.actor!=='dark'||p.corridor!.zone!=='table'||m.cards[p.corridor!.id].blueprint!=='4_162'||p.fromLocation!.zone!=='table'||cardDefinition(m,p.fromLocation!.id).type!=='Location'||![p.origin.id,p.target.id].includes(p.corridor!.id)||otherEndpoint===p.corridor!.id||!(uniqueShipSitePersona(m,otherEndpoint)==='EXECUTOR'||cardDefinition(m,otherEndpoint).type==='Starship'&&hasPersona(m,otherEndpoint,'EXECUTOR'))||p.bay||p.shipSite||p.carrier||p.react||JSON.stringify(f.action.payment)!==JSON.stringify({dark:0}))throw Error('Invalid Main Corridor movement.');
   const originSite=cardDefinition(m,p.origin.id).type==='Location',type=cardDefinition(m,p.card.id).type;
   if(originSite?p.fromLocation!.id!==p.origin.id||p.previous!==undefined:!p.previous)throw Error('Invalid Main Corridor origin.');
   if(p.role&&(type==='Character'?!['pilot','passenger'].includes(p.role):!cargoRoles(m,p.card.id,p.target.id).includes(p.role)))throw Error('Invalid Main Corridor capacity role.');
  }else if(p.corridor)throw Error('Unexpected Main Corridor permission.');
  if(p.react!==undefined){if(p.react!==true||p.mode!=='deploy'||!p.grant)throw Error('Invalid cargo deployment react.');assertCardReference(m,p.grant);if(p.grant.zone!=='table'||m.cards[p.grant.id].owner!==f.actor||!['1_6','1_201'].includes(m.cards[p.grant.id].blueprint))throw Error('Invalid cargo react permission.');}else if(p.grant)throw Error('Unexpected cargo react permission.');
  const targetLocation=cardDefinition(m,p.target.id).type==='Location';
  if(targetLocation?p.role!==undefined:!vesselRule(m,p.target.id)||m.cards[p.target.id].owner!==f.actor||p.role===undefined)throw Error('Invalid transport destination.');
  if(p.mode==='deploy'&&(m.cards[p.card.id].zone!=='playing'||cardVersion(m,p.card.id)!==p.card.version+1||!vesselRule(m,p.card.id)||!cargoRoles(m,p.card.id,p.target.id).includes(p.role!)))throw Error('Invalid cargo deployment.');
  if(f.action.handler==='transport:finish'&&regular(p)&&!usage(m).moved.includes(p.card.id))throw Error('Missing shuttle movement use.');
  if(p.role!==undefined&&!['pilot','driver','passenger','vehicle','starship'].includes(p.role)||p.previous!==undefined&&!['pilot','driver','passenger','vehicle','starship'].includes(p.previous))throw Error('Invalid transport capacity.');
 }
}
