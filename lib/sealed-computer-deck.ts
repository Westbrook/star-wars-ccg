import {sealedCatalog,poolContains} from './sealed-products';
import {SealedError} from './native-sealed';
import type {Rules} from './native-engine/runtime';
import type {Side} from './native-engine/types';
export const sealedDeckPolicy='sealed-balanced-1';
/** A construction heuristic, not card legality or effect interpretation. It sees
 * only the computer's own allocation and current server admission registry. */
export function buildSealedComputerDeck(inventory:readonly string[],side:Side,rules:Rules):string[]{
 const eligible=inventory.filter(bp=>sealedCatalog.get(bp)?.side===side&&rules.supports(bp)&&rules.definition(bp).side===side);
 if(eligible.length<40)throw new SealedError('The computer’s sealed pool does not yet have enough verified cards for a match.',422,'COMPUTER_DECK_NOT_ADMITTED');
 const value=(bp:string)=>{const c=sealedCatalog.get(bp)!,stats=c.stats as Record<string,string|undefined>,number=(s:string)=>Number.isFinite(Number(stats[s]))?Number(stats[s]):0;
  return c.type==='Character'?number('ability')*2+number('power')+number('forfeit')*.3-number('deploy')*.8+((c.icons as string[]).includes('Pilot')?2:0):c.type==='Starship'?number('power')+number('forfeit')*.3-number('deploy')*.8+((c.icons as string[]).includes('Pilot')?3:0):number('destiny');
 };
 const available=eligible.map((bp,index)=>({bp,index})).sort((a,b)=>value(b.bp)-value(a.bp)||a.bp.localeCompare(b.bp)||a.index-b.index),selected:{bp:string;index:number}[]=[],used=new Set<number>();
 const take=(count:number,accept:(bp:string)=>boolean,distinct=false)=>{
  const names=new Set<string>();for(const c of available){if(!count||selected.length===40)break;const name=sealedCatalog.get(c.bp)!.name;if(used.has(c.index)||!accept(c.bp)||distinct&&names.has(name))continue;selected.push(c);used.add(c.index);names.add(name);count--;}
 };
 const type=(bp:string)=>sealedCatalog.get(bp)!.type;
 // Favor varied locations and enough characters to establish presence. Piloted
 // ships gain preference when space locations are available; fill only from
 // actual remaining copies, even in an unusually sparse pool.
 take(6,bp=>type(bp)==='Location',true);
 take(18,bp=>type(bp)==='Character');
 const hasSystem=selected.some(c=>sealedCatalog.get(c.bp)!.subType==='System');
 if(hasSystem)take(6,bp=>type(bp)==='Starship');
 take(40,bp=>['Character',...(hasSystem?['Starship']:[]),'Interrupt','Effect'].includes(type(bp)));
 take(40,()=>true);
 const cards=selected.map(c=>c.bp);if(cards.length!==40||!poolContains(inventory,cards))throw Error('Invalid computer sealed construction.');return cards;
}
