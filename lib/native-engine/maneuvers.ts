import {cardDefinition} from './definitions';
import {destinyDefenseTargets} from './destiny-response';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {operational} from './occupancy';
import {addStatModifier} from './stat-modifiers';
import {moveCard} from './state';
import type {Action,Match,Resolution,Side,Window} from './types';

type Payload={card:string;target:string;targetRef?:CardReference};
const cards=['1_70','1_241'];
const hyperdrive=(m:Match,id:string)=>(cardDefinition(m,id).stats as Record<string,string>).hyperspeed!==undefined;
function eligible(m:Match,id:string,card:string):boolean{
 const c=m.cards[id];if(!c||c.zone!=='table')return false;
 const d=cardDefinition(m,id);
 return d.type==='Starship'&&d.subType.startsWith('Starfighter:')&&(d.stats as Record<string,string>).maneuver!==undefined&&operational(m,id)&&(m.cards[card].blueprint==='1_241'||hyperdrive(m,id));
}
export function maneuverActions(m:Match,w:Window,side:Side):Action[]{
 const top=w.timing==='phase'||w.timing==='response'&&(w.event as {kind?:string})?.kind==='battle-weapons';
 const targets=top?Object.keys(m.cards):destinyDefenseTargets(m,w).map(r=>r.id);
 return m.players[side].hand.filter(id=>cards.includes(m.cards[id].blueprint)).flatMap(card=>targets.filter(target=>eligible(m,target,card)).map(target=>({
  id:'maneuver:'+card+':'+target,label:cardDefinition(m,card).name+' · '+cardDefinition(m,target).name,source:card,handler:'maneuver:play',payload:{card,target},
 })));
}
export function maneuverInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;p.targetRef=referenceCard(m,p.target);moveCard(m,p.card,'playing');
}
export function maneuverResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;
 // Target legality is established at initiation. A later loss of pilot does
 // not cancel a paid action; the unpiloted statistic rules still apply.
 if(!r.cancelled&&sameCard(m,p.targetRef!)){
  addStatModifier(m,p.card,p.target,'maneuver','add',2,{function:'maneuvers'});
  if(m.cards[p.card].blueprint==='1_241')addStatModifier(m,p.card,p.target,'power','add',1,{function:'maneuvers'});
  if(hyperdrive(m,p.target))addStatModifier(m,p.card,p.target,'hyperspeed','add',2,{function:'maneuvers'});
 }
 if(m.cards[p.card].zone==='playing')moveCard(m,p.card,r.cancelled?'lost':'used');
}
export function assertManeuvers(m:Match):void{
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('maneuver:')){
  const p=r.action.payload as Payload;
  if(r.action.handler!=='maneuver:play'||!p||!cards.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==r.actor||m.cards[p.card].zone!=='playing'||r.action.source!==p.card||!m.cards[p.target]||cardDefinition(m,p.target).type!=='Starship')throw Error('Invalid maneuver Interrupt.');
  assertCardReference(m,p.targetRef!,p.target);if(p.targetRef!.zone!=='table')throw Error('Invalid maneuver target.');
 }
}
