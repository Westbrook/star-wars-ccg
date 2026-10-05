import {name} from './board';
import {cardDefinition} from './definitions';
import {occupiedBattlegrounds} from './resistance';
import {immuneToCardTitle} from './card-immunity';
import {gameTextActive} from './game-text';
import {canEnterTable} from './persona';
import {deployed} from './deployment';
import {moveCard} from './state';
import type {Action,Match,Resolution,Side,Window} from './types';

export const battlePlanBlueprints=['8_35','8_118'];
/** Occupation, not control: contested locations count. Sectors do not replace
 * the required system. Battleground classification excludes shielded sites. */
export function occupiesGroundAndSpace(m:Match,side:Side):boolean {
 const locations=occupiedBattlegrounds(m,side);
 return locations.some(id=>cardDefinition(m,id).subType==='Site')&&locations.some(id=>cardDefinition(m,id).subType==='System');
}
const planOnTable=(m:Match)=>Object.values(m.cards).some(c=>c.blueprint==='8_35'&&c.zone==='table'&&!c.coveredBy&&!c.blownAway);
const affects=(m:Match,source:string,location:string)=>gameTextActive(m,source)&&(m.cards[source].blueprint!=='8_118'||!immuneToCardTitle(m,location,'Battle Order'));
export function forceDrainCost(m:Match,side:Side,location:string):number {
 if(occupiesGroundAndSpace(m,side))return 0;
 return Object.values(m.cards).some(c=>battlePlanBlueprints.includes(c.blueprint)&&affects(m,c.id,location)&&(c.blueprint==='8_35'||!planOnTable(m)))?3:0;
}
/** Printed "may" retains the normal paid battle as a separate legal choice. */
export const mayBattleForFree=(m:Match,side:Side,location:string)=>Object.values(m.cards).some(c=>c.owner===side&&battlePlanBlueprints.includes(c.blueprint)&&affects(m,c.id,location));
export const battlePlanDeployment=(m:Match,card:string):Action=>({id:'battle-plan:deploy:'+card,handler:'battle-plan:deploy',source:card,label:'Deploy '+name(m,card),payload:{card}});
export const battlePlanActions=(m:Match,w:Window,side:Side):Action[]=>w.timing==='phase'&&m.turn.phase==='deploy'&&m.turn.side===side?m.players[side].hand.filter(id=>battlePlanBlueprints.includes(m.cards[id].blueprint)).map(card=>battlePlanDeployment(m,card)):[];
export function battlePlanInitiate(m:Match,r:Resolution){moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function battlePlanResolve(m:Match,r:Resolution){const {card}=r.action.payload as {card:string};if(r.cancelled||!canEnterTable(m,card))moveCard(m,card,'lost');else {moveCard(m,card,'table');deployed(m,card);}}
export function assertBattlePlan(m:Match){for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('battle-plan:')){
 const p=f.action.payload as {card?:string};if(f.action.handler!=='battle-plan:deploy'||!p?.card||!battlePlanBlueprints.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==f.actor||m.cards[p.card].zone!=='playing'||f.action.id!=='battle-plan:deploy:'+p.card||f.action.source!==p.card||f.action.payment||f.action.unrespondable)throw Error('Invalid Battle Plan/Order deployment.');
}}
