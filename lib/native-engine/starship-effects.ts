import {cardDefinition,name} from './board';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {occupants} from './occupancy';
import {actingPilot} from './piloting';
import {canEnterTable,canPlayCard,hasPersona} from './persona';
import {moveCard} from './state';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Deploy={card:string;target:CardReference};
export const starshipEffectBlueprints=['1_65'];
const targetAvailable=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&!m.cards[id].coveredBy&&!m.cards[id].blownAway&&cardDefinition(m,id).type==='Starship';
const key=(p:Deploy)=>'starship-effect:deploy:'+p.card+':'+p.target.id;
/** Current errata permits deployment on your starship. Once attached, an Effect
 * retains its owner after theft and its printed modifiers still affect the host. */
export function starshipEffectActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='deploy'||m.players[side].force.length<1)return [];
 return m.players[side].hand.filter(id=>starshipEffectBlueprints.includes(m.cards[id].blueprint)&&canPlayCard(m,id)).flatMap(card=>Object.keys(m.cards).filter(id=>targetAvailable(m,id)&&m.cards[id].owner===side).map(target=>{
  const p:Deploy={card,target:referenceCard(m,target)};
  return {id:key(p),handler:'starship-effect:deploy',source:card,label:'Deploy '+name(m,card)+' on '+name(m,target)+' · 1 Force',payload:p as unknown as Json,payment:{[side]:1}};
 }));
}
export function starshipEffectInitiate(m:Match,r:Resolution):void{moveCard(m,(r.action.payload as unknown as Deploy).card,'playing');}
export function starshipEffectResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Deploy;
 if(r.cancelled||!sameCard(m,p.target)||!targetAvailable(m,p.target.id)||m.cards[p.target.id].owner!==r.actor||!canEnterTable(m,p.card)){moveCard(m,p.card,'lost');return;}
 moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.target.id;m.cards[p.card].location=m.cards[p.target.id].location;deployed(m,p.card);
}
/** Printed normal text only; doubling and other cards' text changes are not
 * inferred. A named pilot's identity still qualifies if their own text is off. */
export function starshipEffectBonus(m:Match,host:string,stat:'power'|'forfeit'|'armor'|'maneuver'):number{
 if(!Object.values(m.cards).some(c=>c.blueprint==='1_65'&&c.attachedTo===host&&gameTextActive(m,c.id)))return 0;
 if(stat==='armor'||stat==='maneuver')return 2;
 return hasPersona(m,host,'FALCON')&&occupants(m,host).some(c=>actingPilot(m,c.id)&&['HAN','LANDO','CHEWIE'].some(persona=>hasPersona(m,c.id,persona)))?2:0;
}
export function assertStarshipEffects(m:Match):void{
 for(const c of Object.values(m.cards))if(c.zone==='table'&&starshipEffectBlueprints.includes(c.blueprint)){
  if(!c.attachedTo||!['table','inactive'].includes(m.cards[c.attachedTo]?.zone)||cardDefinition(m,c.attachedTo).type!=='Starship'||c.location!==m.cards[c.attachedTo].location||c.aboardRole)throw Error('Invalid starship Effect attachment.');
 }
 for(const f of m.stack)if(f.kind!=='window'&&(f.kind==='resolution'?f.action.handler:f.handler).startsWith('starship-effect:')){
  if(f.kind!=='resolution'||f.action.handler!=='starship-effect:deploy')throw Error('Unknown starship Effect continuation.');
  const p=f.action.payload as unknown as Deploy;
  if(!p||!starshipEffectBlueprints.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].zone!=='playing'||m.cards[p.card].owner!==f.actor||f.action.source!==p.card||f.action.id!==key(p)||f.action.unrespondable||f.action.payment?.[f.actor]!==1||Object.keys(f.action.payment).length!==1)throw Error('Invalid starship Effect deployment.');
  assertCardReference(m,p.target);if(p.target.zone!=='table'||cardDefinition(m,p.target.id).type!=='Starship')throw Error('Invalid starship Effect target.');
 }
}
