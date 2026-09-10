import {definition,other,printed} from './catalog';
import type {Choice,Match,Side} from './types';

// Explicit card behavior, not values inferred from printed text. These four
// weapons share a firing action; exceptional weapons require their own handler.
export const weaponRules:Record<string,{deploy:number;fire:number;bonus:number}>= {
 '1_152':{deploy:1,fire:1,bonus:0},'1_317':{deploy:1,fire:1,bonus:0},
 '1_153':{deploy:2,fire:2,bonus:1},'1_312':{deploy:2,fire:2,bonus:1},
};
export const isWeaponStudy=(s:string)=>s==='weapons'||s==='rebel-weapons';
export const hitMembers=(m:Match,side:Side)=>m.battle?.participants[side].filter(id=>m.cards[id].zone==='table'&&m.cards[id].hit)||[];
export function armoryChoices(m:Match,side:Side):Choice[]{
 if(side!==m.active)return [];
 const warriors=Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&definition(c.blueprint).icons.some(icon=>icon==='Warrior'));
 return Object.values(m.cards).flatMap(c=>{
  const rule=weaponRules[c.blueprint];if(!rule||c.owner!==side||m.players[side].force.length<rule.deploy||!['hand','table'].includes(c.zone))return [];
  const transfer=c.zone==='table';if(transfer&&!c.attachedTo)return [];
  return warriors.filter(w=>!transfer||w.id!==c.attachedTo&&w.location===m.cards[c.attachedTo!].location).map(w=>({id:(transfer?'transfer:':'equip:')+c.id+':'+w.id,card:c.id,label:(transfer?'Transfer ':'Deploy ')+definition(c.blueprint).name+' → '+definition(w.blueprint).name+' '+w.id.toUpperCase()+' · '+rule.deploy+' Force',tone:'primary' as const}));
 });
}
export function firingChoices(m:Match,side:Side):Choice[]{
 const b=m.battle!;if(!m.players[side].reserve.length)return [];
 return Object.values(m.cards).flatMap(w=>{
  const rule=weaponRules[w.blueprint],user=w.attachedTo?m.cards[w.attachedTo]:null;
  if(!rule||w.zone!=='table'||w.owner!==side||!user||user.zone!=='table'||!b.participants[side].includes(user.id)||b.fired!.includes(w.id)||b.weaponUsers![user.id]&&b.weaponUsers![user.id]!==w.id||m.players[side].force.length<rule.fire)return [];
  return b.participants[other(side)].filter(id=>m.cards[id].zone==='table'&&m.cards[id].location===user.location).map(target=>({id:'fire:'+w.id+':'+target,card:w.id,label:'Fire '+definition(w.blueprint).name+' → '+definition(m.cards[target].blueprint).name+' '+target.toUpperCase(),tone:'primary' as const,weaponPreview:{user:user.id,target,cost:rule.fire,bonus:rule.bonus,defense:printed(m.cards[target].blueprint,'ability')}}));
 });
}
