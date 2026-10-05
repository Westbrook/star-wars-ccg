import {addCombatModifier} from './combat-modifiers';
import {battle, members} from './battle';
import {battleAtSite} from './participation';
import {besiegedParticipant} from './captured-ship-state';
import {hasCharacteristic} from './characteristics';
import {moveCard} from './state';
import type {Action, Match, Resolution, Side, Window} from './types';
const troopers=(m:Match,side:Side)=>members(m,side).filter(id=>(!m.cards[id].attachedTo || besiegedParticipant(m,id)) && hasCharacteristic(m,id,'TROOPER'));
export function trooperAssaultActions(m:Match,w:Window,side:Side):Action[]{
  const b=battle(m),parent=m.stack.at(-2);
  if(w.timing!=='response' || w.event!==undefined || parent?.kind!=='resolution' || parent.action.handler!=='battle:begin' || parent.cancelled || parent.awaitingResponses || !b || b.stage!=='begin' || !battleAtSite(m) || !troopers(m,side).length)return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='5_159').map(card=>({id:'trooper-assault:'+card,handler:'trooper-assault:play',source:card,label:'Trooper Assault · present troopers gain +2 power and immunity this turn',payload:{card}}));
}
export function trooperAssaultInitiate(m:Match,r:Resolution):void{moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function trooperAssaultResolve(m:Match,r:Resolution):void{
  const {card}=r.action.payload as {card:string};
  if(!r.cancelled)for(const target of troopers(m,r.actor)){
    addCombatModifier(m,card,target,'power-add',2);
    addCombatModifier(m,card,target,'immunity-full',1);
  }
  moveCard(m,card,r.cancelled?'lost':'used');
}
export function assertTrooperAssault(m:Match):void{
  for(const r of m.stack)if(r.kind==='resolution' && r.action.handler.startsWith('trooper-assault:')){
    const p=r.action.payload as {card:string};
    if(r.action.handler!=='trooper-assault:play' || !p || m.cards[p.card]?.blueprint!=='5_159' || m.cards[p.card].owner!==r.actor || m.cards[p.card].zone!=='playing' || r.action.source!==p.card || !battle(m))throw Error('Invalid Trooper Assault.');
  }
}
