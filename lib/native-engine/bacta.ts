import {cardDefinition, name, printed} from './board';
import {deployed} from './deployment';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

const blueprint = '3_32';
type Payload = {card: string; source?: CardReference; target?: CardReference};
type Usage = {source: CardReference; turn: number};
const uses = (m: Match) => (m.data.bactaUses ?? []) as unknown as Usage[];
const used = (m: Match, id: string) => uses(m).some(u=>u.turn===m.turn.number && u.source.id===id && sameCard(m,u.source));
const patient = (m: Match, id: string) => Object.values(m.cards).find(c=>c.zone==='stacked' && c.stackedOn===id);
const nonDroid = (m: Match, id: string) => cardDefinition(m,id).type==='Character' && cardDefinition(m,id).subType!=='Droid';
/** This is an attribute query, not deployment to a site. Site discounts and
 * deployment permissions do not apply; a printed asterisk is zero (AR p138). */
export function bactaCost(m: Match, tank: string, target: string): number {
  const value=(cardDefinition(m,target).stats as Record<string,string>).deploy;
  const base=value==='*'?0:printed(m,target,'deploy');
  const fx=Object.values(m.cards).filter(c=>c.zone==='table' && c.owner===m.cards[tank].owner && c.blueprint==='3_9').length;
  return Math.max(0,base-2*fx);
}
const action = (step: string, p: Payload, label: string): Action => ({id:'bacta:'+step+':'+p.card+(p.target?':'+p.target.id:''),handler:'bacta:'+step,source:p.card,label,payload:p as unknown as Json});
const ready = (m: Match, p: Payload) => !!p.source && sameCard(m,p.source) && !patient(m,p.card) && !!p.target && sameCard(m,p.target) && p.target.zone==='lost';
export function bactaActions(m: Match, w: Window, side: Side): Action[] {
  const result: Action[]=[];
  const tanks=Object.values(m.cards).filter(c=>c.zone==='table' && c.owner===side && c.blueprint===blueprint);
  if(w.timing==='phase' && m.turn.side===side && m.turn.phase==='deploy'){
    for(const card of m.players[side].hand.filter(id=>m.cards[id].blueprint===blueprint))result.push({...action('deploy',{card},'Deploy Bacta Tank · use 4 Force'),payment:{[side]:4}});
    for(const tank of tanks){const c=patient(m,tank.id);if(c && !used(m,tank.id)){const cost=bactaCost(m,tank.id,c.id);result.push({...action('recover',{card:tank.id,source:referenceCard(m,tank.id),target:referenceCard(m,c.id)},'Bacta Tank · return '+name(m,c.id)+' to hand · use '+cost+' Force'),payment:{[side]:cost}});}}
  }
  const e=w.event as {kind?:string;card?:string;cards?:string[];cardRef?:CardReference;cardRefs?:CardReference[]}|undefined;
  if(w.timing==='response' && e && ['forfeited','character-lost','cards-lost'].includes(e.kind??'')){
    for(const id of e.cards??(e.card?[e.card]:[]))if(m.cards[id]?.zone==='lost' && m.cards[id].owner===side && nonDroid(m,id) &&
      (!e.cardRef || e.cardRef.id===id && sameCard(m,e.cardRef)) && (!e.cardRefs || e.cardRefs.some(r=>r.id===id && sameCard(m,r))))
      for(const tank of tanks.filter(t=>!patient(m,t.id)))result.push(action('save',{card:tank.id,source:referenceCard(m,tank.id),target:referenceCard(m,id)},'Bacta Tank · save '+name(m,id)));
  }
  return result;
}
export function bactaInitiate(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as Payload;
  if(r.action.handler==='bacta:deploy')moveCard(m,p.card,'playing');
  else if(r.action.handler==='bacta:recover')m.data.bactaUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.source!,turn:m.turn.number}] as unknown as Json;
}
export function bactaResolve(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if(h==='bacta:deploy'){
    if(r.cancelled || !canEnterTable(m,p.card))moveCard(m,p.card,'lost');else{moveCard(m,p.card,'table');deployed(m,p.card);}return;
  }
  if(r.cancelled)return;
  if(h==='bacta:save'){
    if(ready(m,p)){
      m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action('place',p,'Place patient on Bacta Tank')});
      openWindow(m,'response',other(r.actor),{kind:'about-to-remove-just-lost',card:p.target!.id,source:p.card});
    }
  }else if(h==='bacta:place'){
    if(ready(m,p)){
      moveCard(m,p.target!.id,'stacked');m.cards[p.target!.id].stackedOn=p.card;
      openWindow(m,'response',other(r.actor),{kind:'card-stacked',card:p.target!.id,source:p.card});
    }
  }else if(h==='bacta:recover'){
    if(sameCard(m,p.source!) && sameCard(m,p.target!) && m.cards[p.target!.id].stackedOn===p.card){
      moveCard(m,p.target!.id,'hand');openWindow(m,'response',other(r.actor),{kind:'card-to-hand',card:p.target!.id,source:p.card});
    }
  }else throw Error('Unknown Bacta Tank action.');
}
export function assertBacta(m: Match): void {
  if(m.data.bactaUses!==undefined && !Array.isArray(m.data.bactaUses))throw Error('Invalid Bacta usage.');
  const seen=new Set<string>();
  for(const u of uses(m)){
    if(!u || !Number.isSafeInteger(u.turn) || u.turn<1 || u.turn>m.turn.number)throw Error('Invalid Bacta usage turn.');
    assertCardReference(m,u.source);const key=u.source.id+':'+u.source.version+':'+u.turn;
    if(u.source.zone!=='table' || m.cards[u.source.id].blueprint!==blueprint || seen.has(key))throw Error('Invalid Bacta usage source.');seen.add(key);
  }
  const hosts=new Set<string>();
  for(const c of Object.values(m.cards).filter(c=>c.zone==='stacked')){
    const host=m.cards[c.stackedOn!];
    if(!host || host.zone!=='table' || host.blueprint!==blueprint || host.owner!==c.owner || !nonDroid(m,c.id) || hosts.has(host.id))throw Error('Invalid Bacta patient.');hosts.add(host.id);
  }
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('bacta:')){
    const p=f.action.payload as unknown as Payload,h=f.action.handler;
    if(!p || m.cards[p.card]?.blueprint!==blueprint || m.cards[p.card].owner!==f.actor || f.action.source!==p.card || !['bacta:deploy','bacta:save','bacta:place','bacta:recover'].includes(h))throw Error('Invalid Bacta continuation.');
    if(h==='bacta:deploy'){if(m.cards[p.card].zone!=='playing')throw Error('Invalid Bacta deployment.');}
    else{
      assertCardReference(m,p.source!,p.card);assertCardReference(m,p.target!);
      if(p.source!.zone!=='table' || p.target!.zone!==(h==='bacta:recover'?'stacked':'lost') || m.cards[p.target!.id].owner!==f.actor || !nonDroid(m,p.target!.id))throw Error('Invalid Bacta target.');
      if(h==='bacta:recover' && !uses(m).some(u=>u.turn===m.turn.number && u.source.id===p.card && u.source.version===p.source!.version))throw Error('Missing Bacta usage.');
    }
  }
}
