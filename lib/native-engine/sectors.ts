import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {premiereSystems,premiereSites} from './premiere-setup';
import type {Match,Json} from './types';

import {sectorDefinitions,type SectorKind} from './sector-definitions';
export {sectorDefinitions} from './sector-definitions';
type Sector={card:CardReference;system:string};
const records=(m:Match)=>(m.data.sectors??[]) as unknown as Sector[];
export const sectorKind=(m:Match,id:string)=>sectorDefinitions[m.cards[id]?.blueprint]?.kind;
export const sectorSystem=(m:Match,id:string)=>records(m).find(s=>s.card.id===id&&sameCard(m,s.card))?.system;
/** Table grouping includes asteroids, but named-planet effects do not. */
export const locationGroup=(m:Match,id:string)=>sectorSystem(m,id)??(premiereSystems[m.cards[id]?.blueprint]??premiereSites[m.cards[id]?.blueprint])?.system;
export function registerSector(m:Match,id:string,system:string):void{
 m.data.sectors=[...records(m).filter(s=>s.card.id!==id),{card:referenceCard(m,id),system}] as unknown as Json;
}
export const sectorsAt=(m:Match,system:string,kind:SectorKind)=>m.locations.filter(id=>sectorKind(m,id)===kind&&sectorSystem(m,id)===system);
export function sectorRank(m:Match,id:string):number|undefined{return sectorKind(m,id)==='cloud'?3:sectorKind(m,id)==='asteroid'?5:undefined;}
export function sectorPlacements(m:Match,id:string):{id:string;label:string;index:number;sector:string}[]{
 const kind=sectorKind(m,id);if(!kind)return [];
 return m.locations.filter(at=>{const r=premiereSystems[m.cards[at].blueprint];return r&&!r.mobile&&(cardDefinition(m,at).icons as string[]).includes('Planet');}).flatMap(at=>{
  const system=premiereSystems[m.cards[at].blueprint].system,group=m.locations.filter(x=>locationGroup(m,x)===system);
  if(sectorsAt(m,system,kind).length>=3)return [];
  const first=m.locations.indexOf(group[0]),rank=(x:string)=>sectorRank(m,x)??(premiereSystems[m.cards[x].blueprint]?4:(cardDefinition(m,x).icons as string[]).includes('Interior')?((cardDefinition(m,x).icons as string[]).includes('Exterior')?1:0):2);
  return Array.from({length:group.length+1},(_,i)=>i).filter(i=>{const ranks=group.map(rank);ranks.splice(i,0,kind==='cloud'?3:5);return ranks.every((v,n)=>!n||v>=ranks[n-1])||ranks.every((v,n)=>!n||v<=ranks[n-1]);}).map(i=>({id:'sector:'+system+':'+(first+i),label:system+' · '+(i===group.length?'after '+cardDefinition(m,group.at(-1)!).name:'before '+cardDefinition(m,group[i]).name),index:first+i,sector:system}));
 });
}
export const spaceLocation=(m:Match,id:string)=>cardDefinition(m,id).subType==='System'||!!sectorKind(m,id);
export function sectorAdmits(m:Match,vessel:string,location:string):boolean{
 const kind=sectorKind(m,location),d=cardDefinition(m,vessel);
 if(kind==='asteroid')return d.type==='Starship';
 if(kind!=='cloud')return false;
 return d.type==='Starship'&&!d.subType.startsWith('Capital:')||d.type==='Vehicle'&&['Shuttle','Cloud Car','Patrol'].includes(d.subType)&&Number((d.stats as Record<string,string>).landspeed)>0;
}
/** Lowest cloud replaces the system as the landing/takeoff endpoint. */
export function landingEndpoint(m:Match,group:string):string|undefined{
 const clouds=sectorsAt(m,group,'cloud'),at=m.locations.find(id=>premiereSystems[m.cards[id].blueprint]?.system===group);
 if(!clouds.length)return at;
 // Cloud groups can be oriented either way; the lowest is farthest from system.
 if(at)return clouds.sort((a,b)=>Math.abs(m.locations.indexOf(b)-m.locations.indexOf(at))-Math.abs(m.locations.indexOf(a)-m.locations.indexOf(at)))[0];
 return undefined;
}
export function sectorPaths(m:Match,vessel:string,from:string):string[][]{
 const group=locationGroup(m,from),kind=sectorKind(m,from);if(!group||!spaceLocation(m,from))return [];
 const fighter=cardDefinition(m,vessel).type==='Starship'&&!cardDefinition(m,vessel).subType.startsWith('Capital:'),out:string[][]=[];
 for(const direction of [-1,1]){
  const path=[from];
  for(let n=1;n<=(kind&&fighter?2:1);n++){
   const to=m.locations[m.locations.indexOf(from)+direction*n];if(!to||locationGroup(m,to)!==group)break;
   if(sectorKind(m,to)){
    if(!sectorAdmits(m,vessel,to)||kind&&sectorKind(m,to)!==kind)break;
    path.push(to);out.push([...path]);
   }else if(n===1&&kind&&premiereSystems[m.cards[to].blueprint]&&cardDefinition(m,vessel).type==='Starship'){out.push([...path,to]);break;}
   else break;
  }
 }
 return out;
}
export function cloudStatModifier(m:Match,id:string):number{
 const c=m.cards[id],at=c?.location;
 return c?.zone==='table'&&!c.attachedTo&&cardDefinition(m,id).type==='Starship'&&at&&sectorKind(m,at)==='cloud'&&gameTextActive(m,at)?-2:0;
}
export function assertSectors(m:Match):void{
 const list=records(m);if(!Array.isArray(list)||new Set(list.map(s=>s?.card?.id)).size!==list.length)throw Error('Invalid sector records.');
 for(const s of list){assertCardReference(m,s.card);if(s.card.zone!=='table'||!sectorKind(m,s.card.id)||typeof s.system!=='string'||!Object.values(premiereSystems).some(p=>p.system===s.system&&!p.mobile))throw Error('Invalid related sector system.');}
 for(const id of m.locations)if(sectorKind(m,id)&&!sectorSystem(m,id))throw Error('Sector needs its related system.');
 for(const group of new Set(list.map(s=>s.system)))for(const kind of ['cloud','asteroid'] as const)if(sectorsAt(m,group,kind).length>3)throw Error('Sector diamond limit exceeded.');
}
export function sectorsView(m:Match){return {sectors:Object.fromEntries(m.locations.filter(id=>sectorKind(m,id)).map(id=>[id,{kind:sectorKind(m,id)!,system:sectorSystem(m,id)!}]))};}
