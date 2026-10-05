import {controlledCentralCore} from './central-core';
import {referenceCard,assertCardReference,type CardReference} from './identity';
import type {Json} from './types';
import {deployed} from './deployment';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import {name} from './board';
import type {Action, Match, Resolution, Side, Window} from './types';

type Payload={card:string;freeFrom?:CardReference};
const costs: Record<string, number> = {'4_116':0,'1_232':3};

export function deployEffectActions(m: Match, w: Window, side: Side): Action[] {
  if(w.timing!=='phase' || m.turn.phase!=='deploy' || m.turn.side!==side)return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint in costs).map(card=>{const freeFrom=m.cards[card].blueprint==='1_232'?controlledCentralCore(m,side):undefined,cost=freeFrom?0:costs[m.cards[card].blueprint];return {id:'deploy-effect:'+card,handler:'deploy-effect:deploy',source:card,label:'Deploy '+name(m,card)+(freeFrom?' · free through Central Core':''),payload:{card,...(freeFrom?{freeFrom:referenceCard(m,freeFrom)}:{})} as unknown as Json,...(cost?{payment:{[side]:cost}}:{})};});
}
export function deployEffectInitiate(m: Match, r: Resolution): void {moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function deployEffectResolve(m: Match, r: Resolution): void {
  const card=(r.action.payload as {card:string}).card;
  if(r.cancelled || !canEnterTable(m,card))moveCard(m,card,'lost');else{moveCard(m,card,'table');deployed(m,card);}
}
export function assertDeployEffects(m: Match): void {
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('deploy-effect:')){
    const p=f.action.payload as unknown as Payload|null;
    if(!p?.card || f.action.handler!=='deploy-effect:deploy' || !(m.cards[p.card]?.blueprint in costs) || m.cards[p.card].zone!=='playing' || m.cards[p.card].owner!==f.actor || f.action.source!==p.card || f.action.id!=='deploy-effect:'+p.card)throw Error('Invalid deployment Effect.');
    if(p.freeFrom){assertCardReference(m,p.freeFrom);if(p.freeFrom.zone!=='table'||m.cards[p.freeFrom.id].blueprint!=='1_283'||m.cards[p.card].blueprint!=='1_232')throw Error('Invalid Central Core free deployment.');}
    const cost=p.freeFrom?0:costs[m.cards[p.card].blueprint];
    if(cost ? f.action.payment?.[f.actor]!==cost || Object.keys(f.action.payment).length!==1 : f.action.payment!==undefined)throw Error('Invalid deployment Effect payment.');
  }
}
