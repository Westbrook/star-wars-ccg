import {ability} from './ability';
import {adjacent,cardDefinition,name,power,system} from './board';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canEnterTable,canPlayCard} from './persona';
import {moveCard} from './state';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

export type LaserGateBinding={card:CardReference;sites:[CardReference,CardReference]};
type Deploy=LaserGateBinding;
const bindings=(m:Match)=>(m.data.laserGates??{}) as unknown as Record<string,LaserGateBinding>;
export const isLaserGate=(m:Match,id:string)=>m.cards[id]?.blueprint==='2_113';
export function laserGateSite(m:Match,id:string):boolean {
 if(m.cards[id]?.zone!=='table'||m.cards[id].coveredBy||m.cards[id].blownAway||!m.locations.includes(id))return false;
 const d=cardDefinition(m,id),icons=d.icons as string[];
 return d.subType==='Site'&&icons.includes('Interior')&&icons.includes('Mobile');
}
export const laserGateValidPair=(m:Match,a:string,b:string)=>laserGateSite(m,a)&&laserGateSite(m,b)&&adjacent(m,a,b);
export function laserGatePairs(m:Match,world?:string):[string,string][] {
 return m.locations.slice(0,-1).flatMap((a,i)=>{const b=m.locations[i+1];return laserGateValidPair(m,a,b)&&(!world||system(m,a)===world&&system(m,b)===world)?[[a,b] as [string,string]]:[];});
}
/** A Gate occupies a gap, never either site's character location. Keeping both
 * physical references prevents a removed/redeployed Gate or site reviving it. */
export function bindLaserGate(m:Match,id:string,a:string,b:string):void {
 if(!isLaserGate(m,id)||m.cards[id].zone!=='table'||!laserGateValidPair(m,a,b))throw Error('Invalid Laser Gate placement.');
 const pair=m.locations.indexOf(a)<m.locations.indexOf(b)?[a,b]:[b,a];
 m.data.laserGates={...bindings(m),[id]:{card:referenceCard(m,id),sites:pair.map(site=>referenceCard(m,site))}} as unknown as Json;
}
export function laserGatePair(m:Match,id:string):[CardReference,CardReference]|undefined {
 const p=bindings(m)[id];
 return p&&sameCard(m,p.card)&&p.sites.every(ref=>sameCard(m,ref))&&laserGateValidPair(m,p.sites[0].id,p.sites[1].id)?p.sites:undefined;
}
export const laserGateAtSite=(m:Match,id:string,site:string)=>!!laserGatePair(m,id)?.some(ref=>ref.id===site)&&gameTextActive(m,id);
export const laserGateTargetsAt=(m:Match,site:string,side?:Side)=>Object.values(m.cards).filter(c=>isLaserGate(m,c.id)&&(!side||c.owner!==side)&&laserGateAtSite(m,c.id,site)).map(c=>c.id);
export function laserGateAllowsPassage(m:Match,id:string,from:string,to:string):boolean {
 const blocked=Object.values(m.cards).some(c=>gameTextActive(m,c.id)&&isLaserGate(m,c.id)&&laserGatePair(m,c.id)?.every(ref=>ref.id===from||ref.id===to));
 if(!blocked)return true;
 const d=cardDefinition(m,id);
 // Carried cards do not themselves move. Call with the moving carrier, not
 // each passenger; Lift Tube is the sole vehicle exception in the errata.
 return d.type==='Vehicle'?d.name==='Lift Tube':d.type!=='Character'||power(m,id)+ability(m,id)>4;
}
export const laserGateAllowsPath=(m:Match,id:string,path:string[])=>path.slice(1).every((to,i)=>laserGateAllowsPassage(m,id,path[i],to));
/** Conversion changes the physical location card but preserves the gap. Call
 * after the replacement is on table and the old site has been covered. */
export function convertLaserGateSite(m:Match,old:string,replacement:string):void {
 if(m.cards[old]?.coveredBy!==replacement||!laserGateSite(m,replacement))return;
 for(const [id,p]of Object.entries(bindings(m)))if(sameCard(m,p.card)&&p.sites.every(ref=>sameCard(m,ref))&&p.sites.some(ref=>ref.id===old)){
  const pair=p.sites.map(ref=>ref.id===old?replacement:ref.id);
  if(laserGateValidPair(m,pair[0],pair[1]))bindLaserGate(m,id,pair[0],pair[1]);
 }
}
/** Until placement relative to an existing Gate has an official ruling, a
 * generic site insertion may not silently choose which side of it to occupy. */
export const laserGateSeparates=(m:Match,a:string,b:string)=>Object.values(m.cards).some(c=>laserGatePair(m,c.id)?.every(ref=>ref.id===a||ref.id===b));
const key=(p:Deploy)=>'laser-gate:deploy:'+p.card.id+':'+p.sites.map(ref=>ref.id).join(':');
export function laserGateActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='deploy')return [];
 return m.players[side].hand.filter(id=>isLaserGate(m,id)&&canPlayCard(m,id)).flatMap(id=>laserGatePairs(m).map(pair=>{
  const p:Deploy={card:referenceCard(m,id),sites:pair.map(site=>referenceCard(m,site)) as Deploy['sites']};
  return {id:key(p),handler:'laser-gate:deploy',source:id,label:'Deploy Laser Gate between '+name(m,pair[0])+' and '+name(m,pair[1]),payload:p as unknown as Json};
 }));
}
export function laserGateInitiate(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Deploy;moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);
}
export function laserGateResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Deploy;if(!sameCard(m,p.card))return;
 if(r.cancelled||p.sites.some(ref=>!sameCard(m,ref))||!laserGateValidPair(m,p.sites[0].id,p.sites[1].id)||!canEnterTable(m,p.card.id)){moveCard(m,p.card.id,'lost');return;}
 moveCard(m,p.card.id,'table');bindLaserGate(m,p.card.id,p.sites[0].id,p.sites[1].id);deployed(m,p.card.id);
}
function assertBinding(m:Match,p:LaserGateBinding,zone:'table'|'playing'):void {
 if(!p||!Array.isArray(p.sites)||p.sites.length!==2||p.sites[0]?.id===p.sites[1]?.id)throw Error('Invalid Laser Gate sites.');
 assertCardReference(m,p.card);if(!isLaserGate(m,p.card.id)||p.card.zone!==zone)throw Error('Invalid Laser Gate source.');
 for(const ref of p.sites){assertCardReference(m,ref);const d=cardDefinition(m,ref.id),icons=d.icons as string[];if(ref.zone!=='table'||d.subType!=='Site'||!icons.includes('Mobile')||!icons.includes('Interior'))throw Error('Invalid Laser Gate site reference.');}
}
export function assertLaserGate(m:Match):void {
 const raw=m.data.laserGates;if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw Error('Invalid Laser Gate state.');
 for(const [id,p]of Object.entries(bindings(m))){assertBinding(m,p,'table');if(id!==p.card.id)throw Error('Invalid Laser Gate binding key.');}
 for(const c of Object.values(m.cards))if(c.zone==='table'&&isLaserGate(m,c.id)&&!c.coveredBy&&!c.blownAway){
  const p=bindings(m)[c.id];if(!p||!sameCard(m,p.card)||!laserGatePair(m,c.id)||c.location||c.attachedTo)throw Error('Laser Gate needs its physical gap binding.');
 }
 for(const f of m.stack)if(f.kind!=='window'&&(f.kind==='resolution'?f.action.handler:f.handler).startsWith('laser-gate:')){
  if(f.kind!=='resolution'||f.action.handler!=='laser-gate:deploy')throw Error('Unknown Laser Gate continuation.');
  const p=f.action.payload as unknown as Deploy;assertBinding(m,p,'playing');
  if(f.actor!==m.cards[p.card.id].owner||f.action.source!==p.card.id||f.action.id!==key(p)||f.action.payment||f.action.unrespondable)throw Error('Invalid Laser Gate deployment.');
 }
}
export function laserGatesView(m:Match){return {laserGates:Object.fromEntries(Object.keys(bindings(m)).flatMap(id=>{const pair=laserGatePair(m,id);return pair?[[id,{sites:pair.map(ref=>ref.id),active:gameTextActive(m,id)}]]:[];}))};}
