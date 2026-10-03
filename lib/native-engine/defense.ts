import {ability} from './ability';
import {cardDefinition} from './definitions';
import {characterAttribute, printedStat, statModifiers} from './stat-modifiers';
import type {Match} from './types';
/** AR p76: defense is the highest applicable current attribute, then its own
 * modifiers. Changing defense never changes ability, armor, or maneuver. */
export function defenseValue(m:Match,id:string):number{
 if(cardDefinition(m,id).type!=='Character')throw Error('Non-character defense requires its card-type rules.');
 const base=Math.max(ability(m,id),characterAttribute(m,id,'armor'),characterAttribute(m,id,'maneuver'),printedStat(m,id,'defense')??0);
 const mods=statModifiers(m,id,'defense');
 const protectedFrom=(source:string)=>mods.some(p=>p.kind==='prevent-reduce'&&(p.by==='both'||p.by===m.cards[source].owner));
 let value=base,positive=0;
 for(const p of mods.filter(p=>p.kind==='add')){if(p.amount>=0||!protectedFrom(p.source.id))value+=p.amount;if(p.amount>0)positive+=p.amount;}
 for(const p of mods.filter(p=>p.kind==='minimum'))if(p.amount<=base+positive)value=Math.max(value,p.amount);
 for(const p of mods.filter(p=>p.kind==='maximum'))if(p.amount<base+positive)value=Math.min(value,p.amount);
 const resets=mods.filter(p=>p.kind==='reset'&&(p.amount>=value||!protectedFrom(p.source.id)));
 if(resets.length)value=Math.min(...resets.map(p=>p.amount));
 if(mods.some(p=>p.kind==='base-cap'))value=Math.min(value,base);
 return Math.max(0,value);
}
