import {deployed} from './deployment';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import type {Action, Match, Resolution, Side, Window} from './types';

export function deployEffectActions(m: Match, w: Window, side: Side): Action[] {
  if(w.timing!=='phase' || m.turn.phase!=='deploy' || m.turn.side!==side)return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='4_116').map(card=>({id:'deploy-effect:'+card,handler:'deploy-effect:deploy',source:card,label:'Deploy Bad Feeling Have I',payload:{card}}));
}
export function deployEffectInitiate(m: Match, r: Resolution): void {moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function deployEffectResolve(m: Match, r: Resolution): void {
  const card=(r.action.payload as {card:string}).card;
  if(r.cancelled || !canEnterTable(m,card))moveCard(m,card,'lost');else{moveCard(m,card,'table');deployed(m,card);}
}
export function assertDeployEffects(m: Match): void {
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('deploy-effect:')){
    const p=f.action.payload as {card?:string}|null;
    if(!p?.card || f.action.handler!=='deploy-effect:deploy' || m.cards[p.card]?.blueprint!=='4_116' || m.cards[p.card].zone!=='playing' || m.cards[p.card].owner!==f.actor || f.action.source!==p.card)throw Error('Invalid deployment Effect.');
  }
}
