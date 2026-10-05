import {name,presence} from './board';
import {deployed} from './deployment';
import {forceIcons} from './location-icons';
import {shielded} from './hoth';
import {gameTextActive} from './game-text';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import {other,type Action,type Match,type Resolution,type Side,type Window} from './types';

export const resistanceBlueprints=['6_58','6_147'];
/** Current implemented locations. Shielded Hoth locations are not battlegrounds,
 * even when both sides retain Force icons. New location families must extend
 * this classifier with their printed exceptions before admission. */
export const battleground=(m:Match,id:string)=>m.locations.includes(id)&&!shielded(m,id)&&forceIcons(m,id,'dark')>0&&forceIcons(m,id,'light')>0;
export const occupiedBattlegrounds=(m:Match,side:Side)=>m.locations.filter(id=>battleground(m,id)&&presence(m,side,id));
export function resistanceLimit(m:Match,side:Side):number|null {
 if(!Object.values(m.cards).some(c=>c.owner===side&&resistanceBlueprints.includes(c.blueprint)&&gameTextActive(m,c.id)))return null;
 return occupiedBattlegrounds(m,side).length>=3||occupiedBattlegrounds(m,other(side)).length===0?2:null;
}
export const resistanceDeployment=(m:Match,card:string):Action=>({id:'resistance:deploy:'+card,handler:'resistance:deploy',source:card,label:'Deploy '+name(m,card),payload:{card}});
export function resistanceActions(m:Match,w:Window,side:Side):Action[]{
 return w.timing==='phase'&&m.turn.phase==='deploy'&&m.turn.side===side?m.players[side].hand.filter(id=>resistanceBlueprints.includes(m.cards[id].blueprint)).map(card=>resistanceDeployment(m,card)):[];
}
export function resistanceInitiate(m:Match,r:Resolution){moveCard(m,(r.action.payload as {card:string}).card,'playing');}
export function resistanceResolve(m:Match,r:Resolution){const {card}=r.action.payload as {card:string};if(r.cancelled||!canEnterTable(m,card))moveCard(m,card,'lost');else {moveCard(m,card,'table');deployed(m,card);}}
export function assertResistance(m:Match){for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('resistance:')){
 const p=f.action.payload as {card?:string};if(f.action.handler!=='resistance:deploy'||!p?.card||!resistanceBlueprints.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==f.actor||m.cards[p.card].zone!=='playing'||f.action.id!=='resistance:deploy:'+p.card||f.action.source!==p.card||f.action.payment||f.action.unrespondable)throw Error('Invalid Resistance/Ultimatum deployment.');
}}
