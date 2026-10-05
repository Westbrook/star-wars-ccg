import {assertDisarmed,setDisarmed} from './disarmed-state';
import {attachmentAttempt,assertAttachmentAttempt,validAttachmentAttempt,type AttachmentAttempt} from './attachment';
import {attached,cardDefinition,isSite,name} from './board';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {groundPresent} from './participation';
import {openWindow,type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable,tableLossCards} from './table';
import {disarmingEffect} from './weapon-carrying';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;target:CardReference;source?:CardReference;attachment?:AttachmentAttempt;window?:number;lost?:string[];weapons?:CardReference[]};
type Usage={source:CardReference;window:number};
const uses=(m:Match)=>(m.data.evazanUses??[]) as unknown as Usage[];
const data=(r:Resolution)=>r.action.payload as unknown as Payload;
const action=(step:string,p:Payload):Action=>({id:'disarm:'+step+':'+p.card+':'+p.target.id,handler:'disarm:'+step,source:p.card,label:step==='deploy'?'Disarmed · disarm '+p.target.id:step==='operate'?'Dr. Evazan · operate on '+p.target.id:'Resolve disarming',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
const weapons=(m:Match,id:string)=>attached(m,id).filter(c=>cardDefinition(m,c.id).type==='Weapon').map(c=>c.id);
const armed=(m:Match,id:string)=>groundPresent(m,id)&&weapons(m,id).length>0;
function targets(m:Match,side:Side){return Object.values(m.cards).filter(c=>c.owner!==side&&armed(m,c.id)&&c.location&&isSite(m,c.location)&&Object.values(m.cards).some(own=>own.owner===side&&own.location===c.location&&armed(m,own.id)));}
export function disarmActions(m:Match,w:Window,side:Side):Action[]{
 const result:Action[]=[];
 if(w.timing==='phase'&&m.turn.phase==='control')for(const card of m.players[side].hand.filter(id=>disarmingEffect(m.cards[id].blueprint)))for(const target of targets(m,side)){
  const a=action('deploy',{card,target:referenceCard(m,target.id)});a.label='Disarmed · disarm '+name(m,target.id);result.push(a);
 }
 const e=w.event as {kind?:string;target?:string;targetRef?:CardReference}|undefined;
 if(w.timing==='response'&&['hit','disarmed'].includes(e?.kind??'')&&e?.targetRef&&e.targetRef.id===e.target&&sameCard(m,e.targetRef)&&groundPresent(m,e.target!))for(const source of Object.values(m.cards).filter(c=>c.owner===side&&c.blueprint==='1_172'&&c.id!==e.target&&groundPresent(m,c.id)&&gameTextActive(m,c.id)&&c.location===m.cards[e.target!].location&&!uses(m).some(u=>u.window===w.serial&&u.source.id===c.id&&sameCard(m,u.source)))){
  const a=action('operate',{card:source.id,source:referenceCard(m,source.id),target:e.targetRef,window:w.serial});a.label='Dr. Evazan · operate on '+name(m,e.target!)+' · character is lost';result.push(a);
 }
 return result;
}
export function disarmAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;card?:string}|undefined,c=m.cards[e?.card??''];
 if(w.timing!=='response'||e?.kind!=='deployed'||!c||!disarmingEffect(c.blueprint)||!gameTextActive(m,c.id)||!c.attachedTo)return [];
 return [{...action('apply',{card:c.id,source:referenceCard(m,c.id),target:referenceCard(m,c.attachedTo),window:w.serial}),label:'Disarm '+name(m,c.attachedTo),actor:c.owner}];
}
export function disarmInitiate(m:Match,r:Resolution){const p=data(r);
 if(r.action.handler==='disarm:deploy'){moveCard(m,p.card,'playing');p.attachment=attachmentAttempt(m,p.card,p.target.id);}
 if(r.action.handler==='disarm:operate')m.data.evazanUses=[...uses(m).filter(u=>m.stack.some(w=>w.kind==='window'&&w.serial===u.window)),{source:p.source!,window:p.window!}] as unknown as Json;
}
export function disarmResolve(m:Match,r:Resolution){
 const p=data(r),h=r.action.handler;if(r.cancelled){if(h==='disarm:deploy'&&m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(h==='disarm:deploy'){
  if(!validAttachmentAttempt(m,p.attachment!)||!sameCard(m,p.target)){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.target.id;m.cards[p.card].location=m.cards[p.target.id].location;deployed(m,p.card);
 }else if(h==='disarm:apply'){
  if(!sameCard(m,p.target))return;setDisarmed(m,p.target.id,true);
  const ws=weapons(m,p.target.id),refs=ws.map(id=>referenceCard(m,id));queue(m,'weapons',{...p,weapons:refs});
  if(ws.length){const cards=tableLossCards(m,ws);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,cause:'disarmed',allCards:true});}
 }else if(h==='disarm:weapons'){
  const remaining=p.weapons!.filter(ref=>sameCard(m,ref)).map(ref=>ref.id),lost=tableLossCards(m,remaining);queue(m,'disarmed',{...p,lost});
  if(lost.length){queue(m,'weapons-lost',{...p,lost});loseFromTable(m,remaining);}
 }else if(h==='disarm:weapons-lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.lost!,source:p.card,cause:'disarmed'});
 else if(h==='disarm:disarmed'){if(sameCard(m,p.target))openWindow(m,'response',other(r.actor),{kind:'disarmed',target:p.target.id,targetRef:p.target,source:p.card} as unknown as Json);}
 else if(h==='disarm:operate'){
  if(!sameCard(m,p.target))return;queue(m,'lose',p);const cards=tableLossCards(m,[p.target.id]);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.target.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,site:m.cards[p.target.id].location!,cause:'evazan'});
 }else if(h==='disarm:lose'){
  if(sameCard(m,p.target)){const lost=tableLossCards(m,[p.target.id]);queue(m,'lost',{...p,lost});loseFromTable(m,[p.target.id]);}
 }else if(h==='disarm:lost')openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:p.lost!,source:p.card,cause:'evazan'});
 else throw Error('Unknown disarm continuation.');
}
export function assertDisarm(m:Match){
 assertDisarmed(m);
 if(!Array.isArray(uses(m)))throw Error('Invalid Evazan usage.');const seen=new Set<string>();
 for(const u of uses(m)){assertCardReference(m,u.source);const key=u.source.id+':'+u.source.version+':'+u.window;if(m.cards[u.source.id].blueprint!=='1_172'||u.source.zone!=='table'||!Number.isSafeInteger(u.window)||u.window<1||u.window>m.serial||seen.has(key))throw Error('Invalid Evazan usage.');seen.add(key);}
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('disarm:')){
  const p=data(r),h=r.action.handler,operation=['disarm:operate','disarm:lose','disarm:lost'].includes(h);
  if(!p||!m.cards[p.card]||m.cards[p.card].owner!==r.actor||r.action.source!==p.card||r.action.payment||r.action.id!==action(h.slice(7),p).id||!['disarm:deploy','disarm:apply','disarm:weapons','disarm:weapons-lost','disarm:disarmed','disarm:operate','disarm:lose','disarm:lost'].includes(h))throw Error('Invalid disarm action.');
  assertCardReference(m,p.target);if(p.target.zone!=='table'||cardDefinition(m,p.target.id).type!=='Character'||(operation?m.cards[p.card].blueprint!=='1_172':!disarmingEffect(m.cards[p.card].blueprint)))throw Error('Invalid disarm target or source.');
  if(h==='disarm:deploy'){assertAttachmentAttempt(m,p.attachment!,p.card,p.target.id);if(p.source||p.window!==undefined||m.cards[p.card].zone!=='playing'||m.cards[p.target.id].owner===r.actor)throw Error('Invalid Disarmed deployment.');}
  else {assertCardReference(m,p.source!,p.card);if(p.source!.zone!=='table'||!Number.isSafeInteger(p.window)||!m.stack.some(w=>w.kind==='window'&&w.serial===p.window))throw Error('Invalid disarm response window.');}
  if(!operation&&h!=='disarm:deploy'){const w=m.stack.find(w=>w.kind==='window'&&w.serial===p.window) as Window,e=w.event as {kind?:string;card?:string};if(w.timing!=='response'||e?.kind!=='deployed'||e.card!==p.card)throw Error('Invalid Disarmed deployment trigger.');}
  if(operation){const w=m.stack.find(w=>w.kind==='window'&&w.serial===p.window) as Window,e=w.event as {kind?:string;target?:string;targetRef?:CardReference};if(w.timing!=='response'||!['hit','disarmed'].includes(e?.kind??'')||e.target!==p.target.id||e.targetRef?.id!==p.target.id||e.targetRef?.zone!==p.target.zone||e.targetRef?.version!==p.target.version||p.card===p.target.id||!uses(m).some(u=>u.window===p.window&&u.source.id===p.card&&u.source.version===p.source!.version))throw Error('Invalid Evazan response binding.');}
  if(['disarm:weapons','disarm:weapons-lost','disarm:disarmed'].includes(h)&&!Array.isArray(p.weapons))throw Error('Missing disarm weapon group.');
  if(['disarm:weapons-lost','disarm:disarmed','disarm:lost'].includes(h)&&!Array.isArray(p.lost))throw Error('Missing disarm loss group.');
  if(p.weapons!==undefined){if(!Array.isArray(p.weapons)||new Set(p.weapons.map(ref=>ref.id)).size!==p.weapons.length)throw Error('Invalid disarm weapons');for(const ref of p.weapons){assertCardReference(m,ref);if(ref.zone!=='table'||cardDefinition(m,ref.id).type!=='Weapon')throw Error('Invalid disarm weapon reference.');}}
  if(p.lost!==undefined&&(!Array.isArray(p.lost)||new Set(p.lost).size!==p.lost.length||p.lost.some(id=>!m.cards[id])))throw Error('Invalid disarmed loss group.');
 }
}
