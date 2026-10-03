import {ability, addAbilityModifier} from './ability';
import {addCombatModifier, attritionImmunity} from './combat-modifiers';
import {battle, members} from './battle';
import {cardDefinition, name} from './board';
import {hasPersona} from './persona';
import {referenceCard, sameCard, assertCardReference, type CardReference} from './identity';
import {duel} from './duel';
import {addDuelModifier} from './duel-modifiers';
import {moveCard} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

const cards = ['5_41','5_141'];
type Payload = {card: string; target?: string; targetRef?: CardReference};
function eligible(m: Match,card: string,target: string, requireImmunity = true): boolean {
  const c=m.cards[target],b=battle(m);if(!b || b.stage!=='weapons' || cardDefinition(m,b.site).subType!=='Site' || !c || c.attachedTo || !members(m,c.owner).includes(target) || requireImmunity && attritionImmunity(m,target)<=0)return false;
  return m.cards[card].blueprint==='5_141' ? hasPersona(m,target,'VADER') : c.owner===m.cards[card].owner && ['LUKE','LEIA','ANAKIN','BEN_SOLO','MARA_SKYWALKER'].some(p=>hasPersona(m,target,p));
}
export function duelInterruptActions(m: Match, w: Window, side: Side): Action[] {
  if(w.timing!=='response')return [];
  const kind=(w.event as {kind?:string})?.kind, actions:Action[]=[];
  for(const card of m.players[side].hand.filter(id=>cards.includes(m.cards[id].blueprint))){
    if(kind==='duel-destiny-before' && duel(m)?.stage==='draws')actions.push({
      id:'duel-interrupt:add:'+card,handler:'duel-interrupt:add',source:card,label:name(m,card)+' · add one duel destiny',payload:{card},
    });
    if(kind==='battle-weapons')for(const target of Object.keys(m.cards).filter(id=>eligible(m,card,id)))actions.push({
      id:'duel-interrupt:battle:'+card+':'+target,handler:'duel-interrupt:battle',source:card,
      label:name(m,card)+' · '+name(m,target)+' adds ability to power; loses immunity and battle destiny ability',
      payload:{card,target,targetRef:referenceCard(m,target)} as unknown as Json,
    });
  }
  return actions;
}
export function duelInterruptInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as {card: string}).card, 'playing');}
export function duelInterruptResolve(m: Match, r: Resolution): void {
  const {card,target,targetRef} = r.action.payload as Payload;
  if (!r.cancelled) {
    if(r.action.handler==='duel-interrupt:add' && duel(m)?.stage==='draws')addDuelModifier(m,card,r.actor,'draws',1);
    if(r.action.handler==='duel-interrupt:battle' && target && targetRef && sameCard(m,targetRef) && eligible(m,card,target,false)){
      const amount=ability(m,target);
      addCombatModifier(m,card,target,'immunity-cancel',1);
      addCombatModifier(m,card,target,'power-add',amount);
      addAbilityModifier(m,card,target,'battle-prevent',1);
    }
  }
  moveCard(m, card, 'lost');
}
export function assertDuelInterrupts(m: Match): void {
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('duel-interrupt:')) {
    const p = r.action.payload as Payload;
    if (!['duel-interrupt:add','duel-interrupt:battle'].includes(r.action.handler) || !p || !cards.includes(m.cards[p.card]?.blueprint) ||
        m.cards[p.card].owner !== r.actor || m.cards[p.card].zone !== 'playing' || r.action.source !== p.card || r.action.handler==='duel-interrupt:add' && !duel(m)) throw Error('Invalid duel destiny Interrupt.');
    if(r.action.handler==='duel-interrupt:battle'){assertCardReference(m,p.targetRef!,p.target);if(!p.target || !battle(m) || p.targetRef?.zone!=='table')throw Error('Invalid battle Interrupt target.');}
  }
}
