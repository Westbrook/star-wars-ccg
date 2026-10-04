import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {premiereSystems,premiereSites} from './premiere-setup';
import type {Match,Json} from './types';
import {sectorDefinitions,caveDefinitions,type SectorKind} from './sector-definitions';
export {sectorDefinitions} from './sector-definitions';
type Sector={card:CardReference;system:string};
type Cave={card:CardReference;sector:CardReference};
const records=(m:Match)=>(m.data.sectors??[]) as unknown as Sector[];
const caves=(m:Match)=>(m.data.caves??[]) as unknown as Cave[];
export const sectorFamily=(m:Match,id:string)=>sectorDefinitions[m.cards[id]?.blueprint]?.family;
export const sectorKind=(m:Match,id:string)=>sectorDefinitions[m.cards[id]?.blueprint]?.kind;
export const isCave=(m:Match,id:string)=>!!caveDefinitions[m.cards[id]?.blueprint];
export const caveSector=(m:Match,id:string)=>caves(m).find(c=>c.card.id===id&&sameCard(m,c.card)&&sameCard(m,c.sector))?.sector.id;
export const sectorSystem=(m:Match,id:string)=>sectorDefinitions[m.cards[id]?.blueprint]?.system||records(m).find(s=>s.card.id===id&&sameCard(m,s.card))?.system;
/** Physical table grouping is distinct from being part of a named planet. */
export const locationGroup=(m:Match,id:string):string|undefined=>isCave(m,id)?sectorSystem(m,caveSector(m,id)??''):sectorSystem(m,id)??(premiereSystems[m.cards[id]?.blueprint]??premiereSites[m.cards[id]?.blueprint])?.system;
export function registerSector(m:Match,id:string,system:string):void{
 m.data.sectors=[...records(m).filter(s=>s.card.id!==id),{card:referenceCard(m,id),system}] as unknown as Json;
}
export function registerCave(m:Match,id:string,sector:string):void{
 m.data.caves=[...caves(m).filter(c=>c.card.id!==id),{card:referenceCard(m,id),sector:referenceCard(m,sector)}] as unknown as Json;
}
export function convertSectorRelationships(m:Match,old:string,id:string):void{
 for(const c of caves(m))if(c.sector.id===old&&sameCard(m,c.sector))c.sector=referenceCard(m,id);
}
export const sectorsAt=(m:Match,system:string,kind:SectorKind)=>m.locations.filter(id=>sectorKind(m,id)===kind&&sectorSystem(m,id)===system);
export function sectorRank(m:Match,id:string):number|undefined{return sectorFamily(m,id)==='big-one'||isCave(m,id)?6:sectorFamily(m,id)==='city'?2.5:sectorKind(m,id)==='cloud'?3:sectorKind(m,id)==='asteroid'||isCave(m,id)?5:undefined;}
/** A cave is an off-row branch. Keep its serialized entry beside its host;
 * movement along the sector row ignores that entry. */
export function caveOrder(m:Match,order:string[]):boolean{return order.every((id,i)=>!isCave(m,id)||order[i-1]===caveSector(m,id));}
export type SectorPlacement={id:string;label:string;index?:number;sector?:string;replace?:string;cave?:string};
export function cavePlacements(m:Match,id:string):SectorPlacement[]{
 if(!isCave(m,id))return [];
 return m.locations.filter(at=>sectorFamily(m,at)==='big-one').flatMap<SectorPlacement>(at=>{const existing=m.locations.find(c=>caveSector(m,c)===at);return existing?(m.cards[existing].owner===m.cards[id].owner?[]:[{id:'over:'+existing,label:'Convert cave at '+sectorSystem(m,at),replace:existing,cave:at}]):[{id:'cave:'+at,label:'Beside Big One at '+sectorSystem(m,at),index:m.locations.indexOf(at)+1,cave:at}];});
}
export function sectorPlacements(m:Match,id:string):SectorPlacement[]{
 const def=sectorDefinitions[m.cards[id]?.blueprint];if(!def)return [];
 const duplicate=def.unique&&m.locations.find(at=>sectorFamily(m,at)===def.family);
 if(duplicate)return m.cards[duplicate].owner===m.cards[id].owner?[]:[{id:'over:'+duplicate,label:'Convert '+cardDefinition(m,duplicate).name,replace:duplicate,sector:def.system}];
 const systems=def.unique?[def.system]:m.locations.filter(at=>{const r=premiereSystems[m.cards[at].blueprint];return r&&!r.mobile&&(cardDefinition(m,at).icons as string[]).includes('Planet');}).map(at=>premiereSystems[m.cards[at].blueprint].system);
 return systems.flatMap(system=>{
  const group=m.locations.filter(x=>locationGroup(m,x)===system);
  const conversions:SectorPlacement[]=group.filter(x=>sectorFamily(m,x)===def.family&&m.cards[x].owner!==m.cards[id].owner).map(at=>({id:'over:'+at,label:'Convert '+cardDefinition(m,at).name+' at '+system,replace:at,sector:system}));
  if(group.filter(x=>sectorFamily(m,x)===def.family).length>=def.limit)return conversions;
  if(!group.length)return [{id:'sector:'+system+':'+m.locations.length,label:'Start the '+system+' group',index:m.locations.length,sector:system}];
  const first=m.locations.indexOf(group[0]),rank=(x:string)=>sectorRank(m,x)??(premiereSystems[m.cards[x].blueprint]?4:0);
  return [...conversions,...Array.from({length:group.length+1},(_,i)=>i).filter(i=>{const order=[...group];order.splice(i,0,id);const ranks=order.map(rank);return caveOrder(m,order)&&(ranks.every((v,n)=>!n||v>=ranks[n-1])||ranks.every((v,n)=>!n||v<=ranks[n-1]));}).map(i=>({id:'sector:'+system+':'+(first+i),label:system+' · '+(i===group.length?'after '+cardDefinition(m,group.at(-1)!).name:'before '+cardDefinition(m,group[i]).name),index:first+i,sector:system}))];
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
 if(!group)return undefined;
 const clouds=sectorsAt(m,group,'cloud'),at=m.locations.find(id=>premiereSystems[m.cards[id].blueprint]?.system===group);
 if(!clouds.length)return at;
 const city=clouds.find(id=>sectorFamily(m,id)==='city');if(city)return city;
 if(at)return clouds.sort((a,b)=>Math.abs(m.locations.indexOf(b)-m.locations.indexOf(at))-Math.abs(m.locations.indexOf(a)-m.locations.indexOf(at)))[0];
 return undefined;
}
export function sectorPaths(m:Match,vessel:string,from:string):string[][]{
 const group=locationGroup(m,from),kind=sectorKind(m,from);if(!group||!spaceLocation(m,from))return [];
 const row=m.locations.filter(id=>!isCave(m,id));
 const fighter=cardDefinition(m,vessel).type==='Starship'&&!cardDefinition(m,vessel).subType.startsWith('Capital:'),out:string[][]=[];
 for(const direction of [-1,1]){
  const path=[from];
  for(let n=1;n<=(kind&&fighter?2:1);n++){
   const to=row[row.indexOf(from)+direction*n];if(!to||locationGroup(m,to)!==group)break;
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
 return c?.zone==='table'&&!c.attachedTo&&cardDefinition(m,id).type==='Starship'&&at&&sectorFamily(m,at)==='clouds'&&gameTextActive(m,at)?-2:0;
}
export function assertSectors(m:Match):void{
 const list=records(m);if(!Array.isArray(list)||new Set(list.map(s=>s?.card?.id)).size!==list.length)throw Error('Invalid sector records.');
 for(const s of list){assertCardReference(m,s.card);const fixed=sectorDefinitions[m.cards[s.card.id]?.blueprint]?.system;if(s.card.zone!=='table'||!sectorKind(m,s.card.id)||typeof s.system!=='string'||fixed&&fixed!==s.system||!Object.values(premiereSystems).some(p=>p.system===s.system&&!p.mobile))throw Error('Invalid related sector system.');}
 for(const id of m.locations)if(sectorKind(m,id)&&!sectorSystem(m,id))throw Error('Sector needs its related system.');
 for(const id of m.locations){const d=sectorDefinitions[m.cards[id].blueprint];if(d&&m.locations.filter(at=>sectorFamily(m,at)===d.family&&sectorSystem(m,at)===sectorSystem(m,id)).length>d.limit)throw Error('Sector diamond limit exceeded.');}
 const cs=caves(m);if(!Array.isArray(cs)||new Set(cs.map(c=>c.card?.id)).size!==cs.length)throw Error('Invalid cave records.');
 for(const c of cs){assertCardReference(m,c.card);assertCardReference(m,c.sector);if(!isCave(m,c.card.id)||sectorFamily(m,c.sector.id)!=='big-one'||c.card.zone!=='table'||c.sector.zone!=='table')throw Error('Invalid cave relationship.');}
 for(const id of m.locations.filter(id=>isCave(m,id))){const at=caveSector(m,id);if(!at||!m.locations.includes(at)||m.locations.filter(c=>caveSector(m,c)===at).length!==1)throw Error('Cave requires its own Big One.');}
 if(!caveOrder(m,m.locations))throw Error('Cave separated from Big One.');
}
export function sectorsView(m:Match){return {sectors:Object.fromEntries(m.locations.filter(id=>sectorKind(m,id)).map(id=>[id,{kind:sectorKind(m,id)!,system:sectorSystem(m,id)!}])),caves:Object.fromEntries(m.locations.filter(id=>isCave(m,id)).map(id=>[id,{sector:caveSector(m,id)!,system:locationGroup(m,id)!}]))};}
