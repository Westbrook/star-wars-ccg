import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {sameCard,type CardReference} from './identity';
import type {Match} from './types';

export type NavigationLoss={serial:number;source:CardReference;ship:CardReference;astromech?:CardReference;window:number;stage:'pending'|'destiny'|'complete';destiny?:number|null;success?:boolean;lost?:boolean};
export const navigationLosses=(m:Match)=>(m.data.navigationLosses??[]) as unknown as NavigationLoss[];
/** The cancellation and replacement slot are one continuous Effect. A returned
 * source/ship cannot inherit the previous visit's grant. */
export const navigationLossActive=(m:Match,p:NavigationLoss)=>p.stage==='complete'&&p.success===true&&!p.astromech&&sameCard(m,p.source)&&sameCard(m,p.ship)&&m.cards[p.source.id].attachedTo===p.ship.id&&gameTextActive(m,p.source.id);
export const addedAstromechCapacity=(m:Match,ship:string)=>navigationLosses(m).some(p=>p.ship.id===ship&&navigationLossActive(m,p))?1:0;
export const hasNavComputer=(m:Match,ship:string)=>cardDefinition(m,ship).type==='Starship'&&(cardDefinition(m,ship).icons as string[]).includes('Nav Computer')&&!navigationLosses(m).some(p=>p.ship.id===ship&&navigationLossActive(m,p));
