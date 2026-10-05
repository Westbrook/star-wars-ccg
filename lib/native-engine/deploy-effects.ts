import {deployed} from './deployment';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import {name} from './board';
import type {Action, Match, Resolution, Side, Window} from './types';

const costs: Record<string, number> = {'4_116':0,'1_232':3};

export function deployEffectActions(m: Match, w: Window, side: Side): Action[] {
  if(w.timing!=='phase' || m.turn.phase!=='deploy' || m.turn.side!==side)return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint in costs).map(card=>({id:'deploy-effect:'+card,handler:'deploy-effect:deploy',source:card,label:'Deploy '+name(m,card),payload:{card},...(costs[m.cards[card].blueprint]?{payment:{[side]:costs[m.cards[card].blueprint]}}:{})}));
}
export function deployEffectInitiate(m: Match, r: Resolution): void {moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function deployEffectResolve(m: Match, r: Resolution): void {
  const card=(r.action.payload as {card:string}).card;
  if(r.cancelled || !canEnterTable(m,card))moveCard(m,card,'lost');else{moveCard(m,card,'table');deployed(m,card);}
}
export function assertDeployEffects(m: Match): void {
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('deploy-effect:')){
    const p=f.action.payload as {card?:string}|null;
    if(!p?.card || f.action.handler!=='deploy-effect:deploy' || !(m.cards[p.card]?.blueprint in costs) || m.cards[p.card].zone!=='playing' || m.cards[p.card].owner!==f.actor || f.action.source!==p.card || f.action.id!=='deploy-effect:'+p.card)throw Error('Invalid deployment Effect.');
    const cost=costs[m.cards[p.card].blueprint];
    if(cost ? f.action.payment?.[f.actor]!==cost || Object.keys(f.action.payment).length!==1 : f.action.payment!==undefined)throw Error('Invalid deployment Effect payment.');
  }
}
