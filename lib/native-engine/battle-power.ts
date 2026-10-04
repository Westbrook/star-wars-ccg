import {battle} from './battle';
import {name} from './board';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {sides,type Match,type Side} from './types';
export type BattlePowerModifier={source:CardReference;side:Side;amount:number;function:string};
/** Resolved optional total-power additions last for this battle, even when the
 * spotted character leaves. They do not change that character's printed power. */
export function addBattlePower(m:Match,source:string,side:Side,amount:number,fn:string):void{
 const b=battle(m);if(!b||b.stage==='complete')throw Error('Missing battle power scope.');
 const p={source:referenceCard(m,source),side,amount,function:fn};assertModifier(m,p);(b.powerModifiers??=[]).push(p);
}
function assertModifier(m:Match,p:BattlePowerModifier){if(!p||!sides.includes(p.side)||!Number.isFinite(p.amount)||typeof p.function!=='string'||!p.function)throw Error('Invalid battle power modifier.');assertCardReference(m,p.source);}
export function assertBattlePower(m:Match){const entries=battle(m)?.powerModifiers;if(entries!==undefined){if(!Array.isArray(entries))throw Error('Invalid battle power modifiers.');entries.forEach(p=>assertModifier(m,p));}}
export function battlePowerBonus(m:Match,side:Side):number{
 const groups=new Map<string,number>();for(const p of battle(m)?.powerModifiers??[])if(p.side===side){const key=name(m,p.source.id)+':'+p.function,old=groups.get(key);if(old===undefined||Math.abs(p.amount)>Math.abs(old))groups.set(key,p.amount);}return [...groups.values()].reduce((a,b)=>a+b,0);
}
