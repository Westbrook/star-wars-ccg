import {cardDefinition} from './definitions';
import {deployed} from './deployment';
import {hasCharacteristic} from './characteristics';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {premiereLocations} from './premiere-setup';
import {canEnterTable} from './persona';
import {moveCard} from './state';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Payload={card:string;target:CardReference};
const planet=(m:Match,id:string)=>m.locations.includes(id)&&cardDefinition(m,id).subType==='System'&&(cardDefinition(m,id).icons as string[]).includes('Planet');
export const sunsdowns=(m:Match)=>Object.values(m.cards).filter(c=>c.blueprint==='1_230'&&gameTextActive(m,c.id)&&!!c.attachedTo&&planet(m,c.attachedTo));
export function sunsdownAt(m:Match,site:string):boolean {
  if(!m.locations.includes(site)||cardDefinition(m,site).subType!=='Site')return false;
  const group=premiereLocations[m.cards[site].blueprint]?.system;
  return !!group&&sunsdowns(m).some(c=>premiereLocations[m.cards[c.attachedTo!].blueprint]?.system===group);
}
/** Derived live condition; the explicit list remains for older component saves.
 * Card effects never append into that list, so departure cannot leave stale night. */
export const nighttimeSites=(m:Match):string[]=>[...new Set([...(m.data.nighttimeSites as string[]|undefined??[]),...m.locations.filter(id=>sunsdownAt(m,id))])];
export const sunsdownSpyFree=(m:Match,id:string,site:string)=>sunsdowns(m).length>0&&hasCharacteristic(m,id,'SPY')&&nighttimeSites(m).includes(site);
export const nighttimeView=(m:Match)=>({nighttime:nighttimeSites(m)});
const action=(p:Payload):Action=>({id:'sunsdown:deploy:'+p.card+':'+p.target.id,handler:'sunsdown:deploy',source:p.card,label:'Deploy Sunsdown',payload:p as unknown as Json});
export function sunsdownActions(m:Match,w:Window,side:Side):Action[]{
  if(side!==m.turn.side||m.turn.phase!=='deploy'||w.timing!=='phase')return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='1_230').flatMap(card=>m.locations.filter(id=>planet(m,id)).map(id=>({...action({card,target:referenceCard(m,id)}),label:'Deploy Sunsdown on '+cardDefinition(m,id).name})));
}
export function sunsdownInitiate(m:Match,r:Resolution):void {moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
export function sunsdownResolve(m:Match,r:Resolution):void {
  const p=r.action.payload as unknown as Payload;
  if(r.cancelled||!sameCard(m,p.target)||!planet(m,p.target.id)||!canEnterTable(m,p.card)){moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.target.id;deployed(m,p.card);
}
export function assertSunsdown(m:Match):void {
  for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('sunsdown:')){
    const p=f.action.payload as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='1_230'||m.cards[p.card].zone!=='playing'||m.cards[p.card].owner!==f.actor||f.action.source!==p.card||f.action.handler!=='sunsdown:deploy')throw Error('Invalid Sunsdown deployment.');
    assertCardReference(m,p.target);if(p.target.zone!=='table'||cardDefinition(m,p.target.id).subType!=='System'||f.action.id!==action(p).id)throw Error('Invalid Sunsdown target.');
  }
  for(const c of Object.values(m.cards).filter(c=>c.blueprint==='1_230'&&c.zone==='table')){
    const host=c.attachedTo&&m.cards[c.attachedTo];
    if(c.location||!host||host.zone!=='table'||cardDefinition(m,host.id).subType!=='System'||!(cardDefinition(m,host.id).icons as string[]).includes('Planet'))throw Error('Sunsdown must be attached to a planet system.');
  }
}
