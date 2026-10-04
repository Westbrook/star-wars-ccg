import products from '../data/native-engine/sealed-products.json';
import cards from '../data/native-engine/sealed-cards.json';
import {secureEntropy,shuffled,type Entropy} from './native-engine/random';
import type {Side} from './native-engine/types';
export const sealedProductId=products.id;
export const sealedCatalog=new Map(cards.map(c=>[c.gempId,c]));
export type OpenedPack={name:string;cards:string[]};
export type SealedAllocation=Record<Side,OpenedPack[]>;
/** GEMP collates each rarity group from a shuffled weighted sheet, without
 * replacement within that sheet. Repeated printed entries are intentional. */
export function collateBooster(rarities:Record<string,string[]>,entropy:Entropy=secureEntropy):string[]{
 return ([['U',4,2],['R',1,2],['C',10,3]] as const).flatMap(([kind,count,max])=>{
  const sheet:string[]=[];for(let n=1;n<=max;n++)for(let copy=0;copy<n;copy++)sheet.push(...(rarities[kind+n]??[]));
  return shuffled(sheet,entropy).slice(0,count);
 });
}
export function openBooster(set:'1'|'2',entropy:Entropy=secureEntropy):string[]{
 // Keep every printed card. Pinned GEMP removes blueprints it has not yet
 // implemented; engine admission is a separate concern from physical packs.
 return collateBooster(products.sets[set],entropy);
}
export function openOtsd(entropy:Entropy=secureEntropy):OpenedPack[]{
 return [{name:'OTSD premium cards',cards:[...products.sets['106'].PM]},...Array.from({length:4},(_,i)=>({name:'Premiere pack '+(i+1),cards:openBooster('1',entropy)})),{name:'A New Hope pack',cards:openBooster('2',entropy)}];
}
/** Two players each supply one OTSD. Exchange off-side cards privately before
 * projecting either pool; the shared stored allocation is never sent whole. */
export function allocateOtsd(entropy:Entropy=secureEntropy):SealedAllocation{
 const packs=[...openOtsd(entropy).map(p=>({...p,name:'Box 1 · '+p.name})),...openOtsd(entropy).map(p=>({...p,name:'Box 2 · '+p.name}))];
 return Object.fromEntries((['light','dark'] as const).map(side=>[side,packs.map(p=>({...p,cards:p.cards.filter(bp=>sealedCatalog.get(bp)?.side===side)}))])) as SealedAllocation;
}
export function poolContains(inventory:readonly string[],selected:readonly string[]):boolean{
 const counts=new Map<string,number>();for(const bp of inventory)counts.set(bp,(counts.get(bp)??0)+1);
 for(const bp of selected){const n=counts.get(bp)??0;if(!n)return false;counts.set(bp,n-1)}return true;
}
