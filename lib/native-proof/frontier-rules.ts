import type {Match,Side} from './types';
import {other} from './catalog';

export const isFrontierStudy=(s:string)=>['jawa-bargain','dune-sea','desert-patrol'].includes(s);
export const isJawa=(blueprint:string)=>blueprint==='1_12'||blueprint==='1_182';
// Closed ground pool: no vehicles, retrieval, unique Dark characters, or weapons.
export const frontierPool=(side:Side)=>side==='light'?['1_12','101_2','1_28','1_26','1_105']:['1_182','1_196','1_194','1_170','1_181','1_249'];
export function jawaPayment(m:Match,side:Side,site:string):Record<Side,number>{
 const cost={light:0,dark:0};cost[side]=1;
 if(!(side==='light'&&m.cards[site].blueprint==='1_131'))cost[other(side)]=1;
 return cost;
}
export function destinyRequirement(m:Match,side:Side){
 return isFrontierStudy(m.scenario)&&side==='dark'&&m.battle&&m.cards[m.battle.site].blueprint==='1_130'?6:4;
}
