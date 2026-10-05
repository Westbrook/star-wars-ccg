import {barred} from './participation';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {relatedShip,relatedShipSites,shipSite} from './ship-sites';
import {system} from './board';
import {capital,occupants,operational,pilotAboard,roleAvailable,vesselRule,type AboardRole} from './occupancy';
import {cargoRoles} from './otsd-ships';
import {spaceLocation} from './sectors';
import type {Match,Side} from './types';

const tieModels=new Set(['TIE_LN','TIE_ADVANCED_X1','TIE_INTERCEPTOR','TIE_DEFENDER','TIE_AD','TIE_RC','TIE_SA','TIE_SF','TIE_SR','TIE_VN']);
/** Preserve duplicate model entries: a squadron receives the modifier per TIE,
 * not once per physical card (AR, Death Star Assault Squadron; PerTIEEvaluator). */
export const launchBayTIECount=(models:readonly string[])=>models.filter(model=>tieModels.has(model)).length;
export const launchBay=(m:Match,id:string)=>m.cards[id]?.blueprint==='4_165'&&shipSite(m,id)&&m.cards[id].zone==='table'&&m.locations.includes(id)&&!!relatedShip(m,id);
export const launchBayPermission=(m:Match,side:Side,site:string)=>side==='dark'&&launchBay(m,site)&&gameTextActive(m,site);
export function launchBayDeployModifier(m:Match,id:string,site:string):number {
 const c=m.cards[id];return c&&cardDefinition(m,id).type==='Starship'&&launchBayPermission(m,c.owner,site)?-2*launchBayTIECount((identities as Record<string,{models:string[]}>)[c.blueprint]?.models??[]):0;
}
/** This query is ready for Revolution's target predicate; it does not implement
 * Revolution itself. Suppressed game text also suppresses the printed immunity. */
export const launchBayImmuneToRevolution=(m:Match,site:string)=>launchBay(m,site)&&gameTextActive(m,site);
export function launchBaySpace(m:Match,site:string):string|undefined {
 if(!launchBay(m,site))return;
 const host=m.cards[relatedShip(m,site)!];
 return host.zone==='table'&&!host.attachedTo&&host.location&&spaceLocation(m,host.location)?host.location:undefined;
}
export type LaunchBayRoute={method:'land'|'takeoff';path:string[];cost:0};
/** AR p153 treats this location as a docking bay for starfighters of either
 * side, even when its game text is canceled. It is not a docking-bay identity
 * for transit or other text. Ordinary movement barriers remain caller-owned. */
export function launchBayVesselRoutes(m:Match,id:string):LaunchBayRoute[]{
 const c=m.cards[id];if(!c||c.zone!=='table'||c.attachedTo||!c.location||!vesselRule(m,id)||cardDefinition(m,id).type!=='Starship'||capital(m,id))return [];
 if(launchBay(m,c.location)){
  const to=launchBaySpace(m,c.location);return to&&pilotAboard(m,id)?[{method:'takeoff',path:[c.location,to],cost:0}]:[];
 }
 return operational(m,id)?m.locations.filter(site=>launchBaySpace(m,site)===c.location).map(site=>({method:'land',path:[c.location!,site],cost:0})):[];
}
/** The Dark-side embark/disembark text changes these two moves to unlimited.
 * It does not grant an extra shuttle, hyperspace, or landspeed movement. Pinned
 * GEMP implements takeoff but leaves unlimited landing as a TODO; AR p153 is
 * explicit about both directions. The caller must still enforce move barriers. */
export function launchBayUnlimitedMove(m:Match,id:string,method:string,from:string,to:string):boolean {
 const c=m.cards[id];if(!c||cardDefinition(m,id).type!=='Starship')return false;
 return method==='land'?launchBayPermission(m,c.owner,to)&&launchBaySpace(m,to)===from:method==='takeoff'&&launchBayPermission(m,c.owner,from)&&launchBaySpace(m,from)===to;
}
const exterior=(m:Match,id:string)=>m.locations.includes(id)&&cardDefinition(m,id).subType==='Site'&&(cardDefinition(m,id).icons as string[]).includes('Exterior');
/** These are alternate *site* endpoints, not occupied carrier slots. Per the
 * reference canShuttleTo filter, they do not consume the related ship's capacity.
 * Usage, move barriers, shields and each vehicle's destination restrictions must
 * still be checked by transport's normal pipeline. */
export function launchBayShuttleDestinations(m:Match,id:string):string[]{
 const c=m.cards[id];if(!c||c.zone!=='table'||c.attachedTo||!c.location||!['Character','Vehicle'].includes(cardDefinition(m,id).type))return [];
 const destinations:string[]=[];
 for(const bay of m.locations.filter(site=>launchBayPermission(m,c.owner,site))){
  const host=m.cards[relatedShip(m,bay)!],space=launchBaySpace(m,bay);
  if(host.owner!==c.owner||!capital(m,host.id)||!space||cardDefinition(m,space).subType!=='System')continue;
  const planetary=m.locations.filter(site=>!shipSite(m,site)&&exterior(m,site)&&!!system(m,site)&&system(m,site)===system(m,space));
  if(c.location===bay)destinations.push(...planetary);
  else if(planetary.includes(c.location))destinations.push(bay);
 }
 return [...new Set(destinations)];
}
export const launchBayShuttleFree=(m:Match,id:string,to:string)=>launchBayShuttleDestinations(m,id).includes(to);
/** The reference's ShipdocksForFreeModifier targets the related ship without
 * an owner filter. Transfer permission at the site itself remains Dark-only. */
export const launchBayDockingSource=(m:Match,host:string)=>relatedShipSites(m,host).find(site=>launchBay(m,site)&&gameTextActive(m,site));
export const launchBayShipdocksFree=(m:Match,host:string)=>!!launchBayDockingSource(m,host);
export type LaunchBayTransfer={card:string;host:string;role?:AboardRole;from:string};
/** Additional transfers for an already legal docking session. These never
 * establish docking legality or bypass destination vessel capacity. Transfers
 * to a site clear attachedTo/aboardRole; transfers from it retain normal roles. */
export function launchBayTransfers(m:Match,side:Side,a:string,b:string):LaunchBayTransfer[]{
 const result:LaunchBayTransfer[]=[];
 for(const [host,other]of [[a,b],[b,a]]){
  if(m.cards[host]?.owner!==side||m.cards[other]?.owner!==side)continue;
  for(const site of relatedShipSites(m,host).filter(site=>launchBayPermission(m,side,site))){
   for(const c of occupants(m,other).filter(c=>c.owner===side&&!barred(m,c.id)))result.push({card:c.id,host:site,from:other});
   for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&!c.attachedTo&&c.location===site&&!barred(m,c.id))){
    const type=cardDefinition(m,c.id).type;if(!['Character','Vehicle','Starship'].includes(type))continue;
    const roles:AboardRole[]=type==='Character'?['pilot','passenger']:cargoRoles(m,c.id,other);
    for(const role of roles)if(roleAvailable(m,other,c.id,role))result.push({card:c.id,host:other,role,from:site});
   }
  }
 }
 return result;
}
