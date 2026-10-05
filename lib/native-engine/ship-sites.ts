import {cardDefinition} from './definitions';
import {isModel} from './characteristics';
import {gameTextActive} from './game-text';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import {deployed} from './deployment';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Link={site:CardReference;host:CardReference};
type Deploy={card:CardReference;host:CardReference;index:number};
const links=(m:Match)=>(m.data.shipSites??{}) as unknown as Record<string,Link>;
export const shipSite=(m:Match,id:string)=>m.cards[id]?.blueprint==='4_165';
export const starDestroyer=(m:Match,id:string)=>!!m.cards[id]&&['IMPERIAL_CLASS_STAR_DESTROYER','VICTORY_CLASS_STAR_DESTROYER','SUPER_CLASS_STAR_DESTROYER','VENATOR_CLASS_STAR_DESTROYER'].some(model=>isModel(m,id,model));
export function relatedShip(m:Match,site:string):string|undefined {const p=links(m)[site];return p&&sameCard(m,p.site)&&sameCard(m,p.host)?p.host.id:undefined;}
export const relatedShipSites=(m:Match,host:string)=>m.locations.filter(id=>relatedShip(m,id)===host);
export const shipSiteGroup=(m:Match,id:string)=>{const host=relatedShip(m,id);return host?'ship:'+host:undefined;};
export const beamCustodyHosts=(m:Match,site:string)=>[site,...(relatedShip(m,site)?[relatedShip(m,site)!]:[])];
export function captureDestinations(m:Match,host:string):string[]{const bays=relatedShipSites(m,host).filter(id=>m.cards[id].blueprint==='4_165'&&gameTextActive(m,id));return bays.length?bays:[host];}
export function registerShipSite(m:Match,site:string,host:string):void {
 if(!shipSite(m,site)||m.cards[site].zone!=='table'||!m.locations.includes(site)||m.cards[host]?.zone!=='table'||!starDestroyer(m,host))throw Error('Invalid ship-site relationship.');
 m.data.shipSites={...links(m),[site]:{site:referenceCard(m,site),host:referenceCard(m,host)}} as unknown as Json;
}
const key=(p:Deploy)=>'ship-site:deploy:'+p.card.id+':'+p.host.id+':'+p.index;
export function shipSiteActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='deploy')return [];
 return m.players[side].hand.filter(id=>shipSite(m,id)).flatMap(id=>Object.values(m.cards).filter(c=>c.zone==='table'&&starDestroyer(m,c.id)).flatMap(host=>{
  const group=relatedShipSites(m,host.id),first=group.length?m.locations.indexOf(group[0]):m.locations.length;
  return Array.from({length:group.length+1},(_,i)=>{const p:Deploy={card:referenceCard(m,id),host:referenceCard(m,host.id),index:first+i};return {id:key(p),handler:'ship-site:deploy',source:id,label:'Deploy '+cardDefinition(m,id).name+' aboard '+cardDefinition(m,host.id).name+(group.length?' · bay position '+(i+1):''),payload:p as unknown as Json};});
 }));
}
export function shipSiteInitiate(m:Match,r:Resolution){const p=r.action.payload as unknown as Deploy;moveCard(m,p.card.id,'playing');}
export function shipSiteResolve(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Deploy;
 if(r.cancelled||!sameCard(m,p.host)||!canEnterTable(m,p.card.id)){moveCard(m,p.card.id,'lost');return;}
 const group=relatedShipSites(m,p.host.id),index=group.length?Math.max(m.locations.indexOf(group[0]),Math.min(p.index,m.locations.indexOf(group.at(-1)!)+1)):m.locations.length;
 moveCard(m,p.card.id,'table');m.locations.splice(index,0,p.card.id);registerShipSite(m,p.card.id,p.host.id);deployed(m,p.card.id);
}
/** Only nonunique sites are lost with their particular host. Unique ship-site
 * groups will need their separate persistent relationship rules. */
export function shipSiteDependents(m:Match,hosts:Set<string>):string[]{
 const sites=m.locations.filter(id=>shipSite(m,id)&&hosts.has(relatedShip(m,id)??''));
 return [...sites,...Object.values(m.cards).filter(c=>sites.includes(c.location??'')||sites.includes(c.coveredBy??'')).map(c=>c.id)];
}
export function assertShipSites(m:Match):void {
 const raw=m.data.shipSites;if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw Error('Invalid ship-site relationships.');
 for(const [id,p]of Object.entries(links(m))){
  assertCardReference(m,p.site,id);assertCardReference(m,p.host);
  if(!shipSite(m,id)||p.site.zone!=='table'||p.host.zone!=='table'||!starDestroyer(m,p.host.id))throw Error('Invalid ship-site binding.');
  if(sameCard(m,p.site)&&(!sameCard(m,p.host)||!m.locations.includes(id)))throw Error('Ship site lost its related vessel.');
 }
 if(m.locations.filter(id=>shipSite(m,id)).length>3)throw Error('Launch Bay play limit exceeded.');
 for(const id of m.locations)if(shipSite(m,id)&&!relatedShip(m,id))throw Error('Ship site requires a related vessel.');
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('ship-site:')){
  const p=f.action.payload as unknown as Deploy;
  if(!p||f.action.handler!=='ship-site:deploy'||f.action.id!==key(p)||f.action.source!==p.card.id||f.actor!==m.cards[p.card.id]?.owner||f.action.payment||f.action.unrespondable)throw Error('Invalid ship-site deployment.');
  assertCardReference(m,p.card);assertCardReference(m,p.host);
  if(!shipSite(m,p.card.id)||p.card.zone!=='hand'||p.host.zone!=='table'||!starDestroyer(m,p.host.id)||m.cards[p.card.id].zone!=='playing'||!Number.isSafeInteger(p.index)||p.index<0)throw Error('Invalid ship-site deployment target.');
 }
}
export function shipSitesView(m:Match){return {shipSites:Object.fromEntries(m.locations.filter(id=>shipSite(m,id)).map(id=>[id,{host:relatedShip(m,id)!}]))};}
