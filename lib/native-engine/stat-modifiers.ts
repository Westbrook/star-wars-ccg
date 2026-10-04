import {cardDefinition} from './definitions';
import {attachedArmor} from './armor-equipment';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {sides, type Json, type Match, type Side} from './types';
export type Statistic = 'destiny' | 'defense' | 'armor' | 'maneuver' | 'forfeit' | 'hyperspeed' | 'power';
export type StatKind = 'add' | 'define' | 'reset' | 'base-double' | 'prevent-reduce' | 'prevent-increase' | 'minimum' | 'maximum' | 'increase-limit' | 'printed-cap' | 'base-cap';
export type StatModifier = {source: CardReference; target: CardReference; stat: Statistic; kind: StatKind; amount: number;
 duration: 'turn' | 'source'; turn: number; function: string; cumulative: boolean; by: Side | 'both'};
const allowed: Record<Statistic, StatKind[]> = {
 destiny:['add','reset'], hyperspeed:['add'], power:['add'],
 defense:['add','reset','prevent-reduce','minimum','maximum','base-cap'],
 armor:['add','define','reset','base-double'], maneuver:['add','define','reset','base-double'],
 forfeit:['add','define','reset','base-double','prevent-reduce','prevent-increase','increase-limit','printed-cap'],
};
const entries=(m:Match)=>(m.data.statModifiers??[]) as unknown as StatModifier[];
function assertModifier(m:Match,p:StatModifier):void{
 if(!p || !allowed[p.stat]?.includes(p.kind) || !Number.isFinite(p.amount) || p.kind!=='add' && p.amount<0 ||
    ['base-double','prevent-reduce','prevent-increase','printed-cap','base-cap'].includes(p.kind) && p.amount!==1 ||
    !['turn','source'].includes(p.duration) || !Number.isSafeInteger(p.turn) || p.turn<1 || p.turn>m.turn.number ||
    !p.function || typeof p.function!=='string' || typeof p.cumulative!=='boolean' || ![...sides,'both'].includes(p.by) ||
    p.by!=='both' && (p.stat!=='defense' || p.kind!=='prevent-reduce'))throw Error('Invalid statistic modifier.');
 assertCardReference(m,p.source);assertCardReference(m,p.target);
 const type=cardDefinition(m,p.target.id).type;
 const validTarget=type==='Character'?!['power','hyperspeed'].includes(p.stat):['Starship','Vehicle'].includes(type)&&['maneuver','hyperspeed','power'].includes(p.stat)&&p.kind==='add';
 if(p.target.zone!=='table' || !validTarget || p.duration==='source' && p.source.zone!=='table')throw Error('Invalid statistic source or target.');
}
/** Trusted rule effects only: public commands cannot supply values. */
export function addStatModifier(m:Match,source:string,target:string,stat:Statistic,kind:StatKind,amount:number,
 options:{duration?:'turn'|'source';function?:string;cumulative?:boolean;by?:Side|'both'}={}):void{
 const p:StatModifier={source:referenceCard(m,source),target:referenceCard(m,target),stat,kind,amount,turn:m.turn.number,
  duration:options.duration??'turn',function:options.function??kind,cumulative:options.cumulative??false,by:options.by??'both'};
 assertModifier(m,p);m.data.statModifiers=[...entries(m).filter(p=>p.duration==='source'||p.turn===m.turn.number),p] as unknown as Json;
}
export function assertStatModifiers(m:Match):void{
 if(m.data.statModifiers!==undefined&&!Array.isArray(m.data.statModifiers))throw Error('Invalid statistic modifiers.');
 entries(m).forEach(p=>assertModifier(m,p));
}
export function statModifiers(m:Match,id:string,stat:Statistic):StatModifier[]{
 const active=entries(m).filter(p=>p.target.id===id&&p.stat===stat&&sameCard(m,p.target)&&(p.duration==='turn'?p.turn===m.turn.number:sameCard(m,p.source)));
 if(stat==='armor')for(const p of attachedArmor(m,id))active.push({...p,stat,kind:p.mode,amount:5,duration:'source',function:'attached-armor',cumulative:false,by:'both'});
 const grouped=new Map<string,StatModifier>(),result:StatModifier[]=[];
 for(const p of active){
  if(p.cumulative){result.push(p);continue;}
  const key=cardDefinition(m,p.source.id).name+':'+p.function+':'+p.kind+':'+p.by,prior=grouped.get(key);
  if(!prior || (['reset','maximum','increase-limit'].includes(p.kind)?p.amount<prior.amount:Math.abs(p.amount)>Math.abs(prior.amount)))grouped.set(key,p);
 }
 return [...result,...grouped.values()];
}
export const printedStat=(m:Match,id:string,stat:string):number|undefined=>{
 const value=(cardDefinition(m,id).stats as Record<string,string>)[stat];
 if(value===undefined)return undefined;if(!Number.isFinite(Number(value)))throw Error('Statistic needs a printed-value provider: '+stat);return Number(value);
};
/** A defined/reset zero is an existing attribute; an additive modifier alone
 * cannot supply an attribute to a character that does not have it. */
export function hasCharacterArmor(m:Match,id:string):boolean{
 return printedStat(m,id,'armor')!==undefined || statModifiers(m,id,'armor').some(p=>p.kind==='define'||p.kind==='reset');
}
/** Armor and maneuver are not invented by additive modifiers. A definition can
 * provide a missing attribute; a reset wins over additions and competing resets. */
export function characterAttribute(m:Match,id:string,stat:'armor'|'maneuver'):number{
 if(cardDefinition(m,id).type!=='Character')throw Error('Non-character attribute rules are not implemented.');
 if(stat==='maneuver' && !(Number(printedStat(m,id,stat))>0))return 0;
 const mods=statModifiers(m,id,stat),resets=mods.filter(p=>p.kind==='reset');
 if(resets.length)return Math.min(...resets.map(p=>p.amount));
 let value=printedStat(m,id,stat);
 for(const p of mods.filter(p=>p.kind==='define'))value=p.amount;
 if(value===undefined)return 0;
 return Math.max(0,value*(mods.some(p=>p.kind==='base-double')?2:1)+mods.filter(p=>p.kind==='add').reduce((n,p)=>n+p.amount,0));
}

/** Current table-character destiny, after an owning action selects any alternate
 * printed value. This is distinct from modifiers to a just-drawn destiny. */
export function characterDestinyValue(m: Match,id: string,printedValue: number): number {
 if(cardDefinition(m,id).type!=='Character'||!Number.isFinite(printedValue)||printedValue<0)throw Error('Invalid character destiny.');
 const mods=statModifiers(m,id,'destiny'),resets=mods.filter(p=>p.kind==='reset');
 return Math.max(0,resets.length?Math.min(...resets.map(p=>p.amount)):printedValue+mods.filter(p=>p.kind==='add').reduce((n,p)=>n+p.amount,0));
}

/** Shared physical-instance and noncumulative rules for ship/vehicle additions. */
export const vesselStatBonus=(m:Match,id:string,stat:'maneuver'|'hyperspeed'|'power')=>statModifiers(m,id,stat).reduce((n,p)=>n+p.amount,0);
