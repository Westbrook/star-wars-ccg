import {definition,printed} from './catalog';
import type {Choice,Frame,Match,Side} from './types';
export const isLossStudy=(s:string)=>['reduce-drain','reduce-damage','talz-rescue'].includes(s);
export function lossAmount(m:Match,source:'drain'|'battle',side:Side){
 return source==='battle'?m.battle!.damage[side]:(m.stack.find(f=>f.kind==='drain') as Extract<Frame,{kind:'drain'}>).remaining;
}
// Only the two authored reduction fixtures carry It Could Be Worse. Amounts
// above the remaining loss are legal in GEMP; UI makes the unused excess clear.
export function lossResponses(m:Match,source:'drain'|'battle',side:Side):Choice[]{
 const amount=lossAmount(m,source,side),choices:Choice[]=[];
 if(['reduce-drain','reduce-damage'].includes(m.scenario)&&side==='light'&&amount>0){
  for(const card of m.players.light.hand.filter(id=>m.cards[id].blueprint==='1_90'))for(let cost=1;cost<=m.players.light.force.length;cost++)choices.push({id:`reduce:${card}:${cost}`,card,label:`It Could Be Worse ${card.toUpperCase()} · use ${cost} Force`,tone:'primary',reductionPreview:{cost,remaining:Math.max(0,amount-(m.lossStudy?.reduction?0:cost)),duplicate:!!m.lossStudy?.reduction,attrition:source==='battle'?m.battle!.attrition[side]:0}});
 }
 if(m.scenario==='talz-rescue'&&source==='battle'&&side==='light'){
  const b=m.battle!,members=b.participants.light.filter(id=>m.cards[id].zone==='table'&&m.cards[id].location===b.site);
  for(const talz of members.filter(id=>m.cards[id].blueprint==='1_31'))for(const target of members.filter(id=>id!==talz&&m.cards[id].hit))choices.push({id:`rescue:${talz}:${target}`,card:talz,rescueTarget:target,label:`Forfeit Talz ${talz.toUpperCase()} · restore ${definition(m.cards[target].blueprint).name} ${target.toUpperCase()}`,tone:'primary',lossPreview:{kind:'forfeit',value:printed('1_31','forfeit'),attrition:Math.max(0,b.attrition.light-4),damage:Math.max(0,b.damage.light-4)}});
 }
 return choices;
}
