import {ability} from './ability';
import {name} from './board';
import {battle,battleHistory,battleInitiate,type Battle} from './battle';
import {mayBattleForFree} from './battle-plan';
import {attachmentGroup,capturedShipFor,capturedShips,trappedCharacters} from './captured-ship-state';
import {cardDefinition} from './definitions';
import {deployed} from './deployment';
import {suppressedGameText,canceledTexts} from './game-text';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {characterPresent} from './occupancy';
import {battleProhibited} from './participation';
import {canEnterTable} from './persona';
import {queueForcePayment} from './runtime';
import {starDestroyer} from './ship-sites';
import {moveCard} from './state';
import type {Action,Decision,Json,Match,Resolution,Side,Window} from './types';

type Selection={ship:CardReference;effect:CardReference;host:CardReference;selected:CardReference[]};
type Deploy={card:CardReference;target:CardReference};
const effectLive=(m:Match,id:string)=>m.cards[id]?.blueprint==='2_117'&&m.cards[id].zone==='table'&&!suppressedGameText(m,id)&&!canceledTexts(m).some(r=>r.id===id&&sameCard(m,r));
export function besiegedHistoryKey(m:Match,ship:string):string {
 const host=m.cards[ship].capturedShip!.host;return cardDefinition(m,host).type==='Location'?name(m,host):'besieged:'+host;
}
export function besiegedDarkCandidates(m:Match,ship:string):string[]{
 const target=m.cards[ship],host=target?.capturedShip?.host;if(!host)return [];
 const isShip=cardDefinition(m,host).type==='Starship';
 if(isShip?!starDestroyer(m,host):!['1_285','1_124','4_165'].includes(m.cards[host].blueprint))return [];
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner==='dark'&&cardDefinition(m,c.id).type==='Character'&&!c.coveredBy&&!battleProhibited(m,c.id)&&!battleHistory(m).participants.includes(c.id)&&(isShip?c.attachedTo===host&&!!c.aboardRole:c.location===host&&characterPresent(m,c.id))).map(c=>c.id);
}
const validSelection=(m:Match,p:Selection)=>sameCard(m,p.ship)&&sameCard(m,p.effect)&&sameCard(m,p.host)&&effectLive(m,p.effect.id)&&m.cards[p.effect.id].attachedTo===p.ship.id&&m.cards[p.ship.id].capturedShip?.host===p.host.id&&!m.cards[p.ship.id].capturedShip?.pending;
function canBegin(m:Match,p:Selection):boolean{return validSelection(m,p)&&(!battle(m)||battle(m)!.stage==='complete')&&!battleHistory(m).sites.includes(besiegedHistoryKey(m,p.ship.id))&&trappedCharacters(m,p.ship.id).reduce((n,c)=>n+ability(m,c.id),0)>=1&&besiegedDarkCandidates(m,p.ship.id).reduce((n,id)=>n+ability(m,id),0)>=1;}
export function besiegedActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||side!=='dark'||m.turn.side!==side)return [];
 if(m.turn.phase==='deploy')return m.players.dark.hand.filter(id=>m.cards[id].blueprint==='2_117').flatMap(id=>capturedShips(m).filter(c=>!c.capturedShip!.pending).map(c=>({id:'besieged:deploy:'+id+':'+c.id,handler:'besieged:deploy',source:id,label:'Deploy Besieged on '+name(m,c.id),payload:{card:referenceCard(m,id),target:referenceCard(m,c.id)} as unknown as Json})));
 if(m.turn.phase!=='battle')return [];
 return capturedShips(m).flatMap(c=>Object.values(m.cards).filter(e=>e.attachedTo===c.id&&effectLive(m,e.id)).flatMap(e=>{const p:Selection={ship:referenceCard(m,c.id),effect:referenceCard(m,e.id),host:referenceCard(m,c.capturedShip!.host),selected:[]};return canBegin(m,p)&&(m.players.dark.force.length||mayBattleForFree(m,'dark',c.location!))?[{id:'besieged:select:'+e.id+':'+c.id,handler:'besieged:select',source:e.id,label:'Besiege '+name(m,c.id)+' · choose characters',payload:p as unknown as Json,unrespondable:true as const}]:[];}));
}
export function besiegedInitiate(m:Match,r:Resolution):void {if(r.action.handler==='besieged:deploy')moveCard(m,(r.action.payload as unknown as Deploy).card.id,'playing');}
export function besiegedResolve(m:Match,r:Resolution):void {
 if(r.action.handler==='besieged:select'){if(!r.cancelled&&canBegin(m,r.action.payload as unknown as Selection))m.stack.push({kind:'decision',side:'dark',handler:'besieged:select',payload:r.action.payload});return;}
 const p=r.action.payload as unknown as Deploy;
 if(r.cancelled||!sameCard(m,p.target)||!m.cards[p.target.id].capturedShip||!canEnterTable(m,p.card.id)){moveCard(m,p.card.id,'lost');return;}
 moveCard(m,p.card.id,'table');m.cards[p.card.id].attachedTo=p.target.id;m.cards[p.card.id].location=m.cards[p.target.id].location;deployed(m,p.card.id);
}
export function besiegedChoices(m:Match,d:Decision){
 const p=d.payload as unknown as Selection;if(!canBegin(m,p))return [{id:'besieged:cancel',label:'Cancel battle selection'}];
 const candidates=besiegedDarkCandidates(m,p.ship.id),selected=p.selected.filter(r=>sameCard(m,r)&&candidates.includes(r.id));
 const out=candidates.filter(id=>!selected.some(r=>r.id===id)).map(id=>({id:'besieged:add:'+id,label:'Include '+name(m,id)}));
 if(selected.reduce((n,r)=>n+ability(m,r.id),0)>=1){if(m.players.dark.force.length)out.push({id:'besieged:begin',label:'Begin Besieged battle · use 1 Force'});if(mayBattleForFree(m,'dark',m.cards[p.ship.id].location!))out.push({id:'besieged:begin-free',label:'Begin Besieged battle · free'});}
 out.push({id:'besieged:cancel',label:'Cancel battle selection'});return out;
}
export function besiegedChoose(m:Match,d:Decision,id:string):void {
 if(!besiegedChoices(m,d).some(c=>c.id===id))throw Error('Invalid Besieged choice.');
 const p=d.payload as unknown as Selection;if(id==='besieged:cancel')return;
 if(id.startsWith('besieged:add:')){p.selected.push(referenceCard(m,id.slice('besieged:add:'.length)));m.stack.push(d);return;}
 const resolution:Resolution={kind:'resolution',actor:'dark',cancelled:false,awaitingResponses:true,action:{id:'battle:besieged:'+p.ship.id,handler:'battle:begin',source:p.effect.id,label:'Besieged battle aboard '+name(m,p.ship.id),payload:{site:m.cards[p.ship.id].location!,besieged:p} as unknown as Json,...(id==='besieged:begin'?{payment:{dark:1}}:{})}};
 m.stack.push(resolution);battleInitiate(m,resolution);queueForcePayment(m,resolution,resolution.action.payment??{});
}
/** Activate the trapped characters and their personal attachments, never ships
 * or vehicles. State changes do not create a new table instance. */
export function beginBesieged(m:Match,b:Battle,p:Selection):void {
 if(!validSelection(m,p)||!p.selected.length||p.selected.some(r=>!sameCard(m,r)||!besiegedDarkCandidates(m,p.ship.id).includes(r.id)))throw Error('Invalid Besieged battle selection.');
 const light=trappedCharacters(m,p.ship.id).map(c=>c.id),active=[...new Set(light.flatMap(id=>attachmentGroup(m,id).filter(c=>c.zone==='inactive'&&!['Starship','Vehicle'].includes(cardDefinition(m,c.id).type)).map(c=>c.id)))];
 for(const id of active)m.cards[id].zone='table';
 b.besieged={ship:p.ship,effect:p.effect,host:p.host,selected:p.selected,activated:active.map(id=>referenceCard(m,id))};b.participants={dark:p.selected.map(r=>r.id),light};
 const history=battleHistory(m);history.sites.push(besiegedHistoryKey(m,p.ship.id));history.participants.push(...b.participants.dark,...b.participants.light);m.data.battles=history as unknown as Json;
}
export function endBesieged(m:Match,b:Battle):void {
 if(!b.besieged)return;
 for(const ref of b.besieged.activated)if(sameCard(m,ref)&&m.cards[b.besieged.ship.id]?.capturedShip&&attachmentGroup(m,b.besieged.ship.id).some(c=>c.id===ref.id))m.cards[ref.id].zone='inactive';
}
export function assertBesieged(m:Match):void {
 for(const f of m.stack)if(f.kind!=='window'&&(f.kind==='decision'?f.handler:f.action.handler).startsWith('besieged:')){
  const handler=f.kind==='decision'?f.handler:f.action.handler,p=(f.kind==='decision'?f.payload:f.action.payload) as unknown as Selection&Deploy;
  if(handler==='besieged:deploy'){
   assertCardReference(m,p.card);assertCardReference(m,p.target);if(f.kind!=='resolution'||f.actor!=='dark'||p.card.zone!=='hand'||p.target.zone!=='inactive'||m.cards[p.card.id].blueprint!=='2_117'||m.cards[p.card.id].zone!=='playing'||f.action.source!==p.card.id||f.action.id!=='besieged:deploy:'+p.card.id+':'+p.target.id||f.action.payment||f.action.unrespondable)throw Error('Invalid Besieged deployment.');
  }else if(handler==='besieged:select'){
   for(const ref of [p.ship,p.effect,p.host,...p.selected])assertCardReference(m,ref);
   if(!Array.isArray(p.selected)||(f.kind==='decision'?f.side:f.actor)!=='dark'||p.ship.zone!=='inactive'||p.effect.zone!=='table'||p.host.zone!=='table'||m.cards[p.effect.id].blueprint!=='2_117'||new Set(p.selected.map(r=>r.id)).size!==p.selected.length||p.selected.some(r=>r.zone!=='table'||m.cards[r.id].owner!=='dark'||cardDefinition(m,r.id).type!=='Character'))throw Error('Invalid Besieged selection.');
   if(f.kind==='decision'&&(!validSelection(m,p)||p.selected.some(r=>!sameCard(m,r)||!besiegedDarkCandidates(m,p.ship.id).includes(r.id))))throw Error('Invalid saved Besieged selection.');
  }else throw Error('Invalid Besieged continuation.');
 }
 const b=battle(m),p=b?.besieged;if(!b||!p)return;
 for(const r of [p.ship,p.effect,p.host,...p.selected,...p.activated])assertCardReference(m,r);
 if(!p.selected.length||b.initiator!=='dark'||p.ship.zone!=='inactive'||p.effect.zone!=='table'||p.host.zone!=='table'||m.cards[p.effect.id].blueprint!=='2_117'||cardDefinition(m,p.ship.id).type!=='Starship'||new Set(p.selected.map(r=>r.id)).size!==p.selected.length||new Set(p.activated.map(r=>r.id)).size!==p.activated.length||JSON.stringify(b.participants.dark)!==JSON.stringify(p.selected.map(r=>r.id))||p.activated.some(r=>r.zone!=='table'||['Starship','Vehicle'].includes(cardDefinition(m,r.id).type))||[...b.participants.dark,...b.participants.light].some(id=>cardDefinition(m,id).type!=='Character')||b.participants.light.some(id=>!p.activated.some(r=>r.id===id)))throw Error('Invalid Besieged battle.');
 if(b.stage!=='complete'&&sameCard(m,p.ship))for(const r of p.activated)if(sameCard(m,r)){
  // A release can move an active Besieged participant and its personal cards
  // without changing their table instance. Keep that departure in the battle
  // history instead of requiring the released group to remain trapped aboard.
  const participant=b.participants.light.find(id=>attachmentGroup(m,id).some(c=>c.id===r.id));
  if(!participant||capturedShipFor(m,r.id)?.id!==p.ship.id&&!b.departed?.includes(participant)||cardDefinition(m,r.id).type==='Character'&&!b.participants.light.includes(r.id))throw Error('Invalid activated trapped card.');
 }
}
