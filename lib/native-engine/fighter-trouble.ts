import type {Battle} from './battle';
import {cardDefinition} from './definitions';
import {drawDestiny,validDraw,type Draw} from './destiny';
import {destinyInWindow,pendingDestiny} from './destiny-response';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {operational} from './occupancy';
import {vesselManeuver} from './piloting';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {loseFromTable,tableLossCards} from './table';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Payload={card:string;target:string;targetRef?:CardReference;site:string;window:number;serial?:number;draw?:Draw;total?:number|null};
type Bonus={source:CardReference;window:number;pendingIndex:number;pendingId:string;serial:number};
export type FighterTrouble={serial:number;source:string;target:CardReference;name:string;site:string;stage:'destiny'|'result'|'loss'|'complete';draw?:Draw;destiny?:number|null;maneuver?:number|null;success?:boolean;departed?:boolean;lost?:boolean;prevented?:boolean;bonuses:number[]};
export const fighterTrouble=(m:Match)=>m.data.fighterTrouble as FighterTrouble|undefined;
const fighter=(m:Match,id:string)=>cardDefinition(m,id).type==='Starship'&&cardDefinition(m,id).subType.startsWith('Starfighter:')&&(cardDefinition(m,id).stats as Record<string,string>).maneuver!==undefined;
const action=(step:string,p:Payload):Action=>({id:'fighter-trouble:'+step+':'+p.card+':'+p.target,label:'Resolve I’ve Got A Problem Here',handler:'fighter-trouble:'+step,source:p.card,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(step,p)});
function pending(m:Match,p:Bonus):Resolution|undefined{
 const r=m.stack[p.pendingIndex],w=m.stack[p.pendingIndex+1];
 return r?.kind==='resolution'&&r.action.id===p.pendingId&&r.action.handler==='destiny:finish'&&w?.kind==='window'&&w.serial===p.window?r:undefined;
}
export function fighterTroubleActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark')return [];
 const out:Action[]=[],b=m.data.battle as Battle|undefined;
 if(w.timing==='response'&&(w.event as {kind?:string})?.kind==='battle-ended'&&b?.stage==='complete'&&!b.cancelled&&['System','Sector'].includes(cardDefinition(m,b.site).subType)){
  for(const card of m.players.dark.hand.filter(id=>m.cards[id].blueprint==='1_253'))for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner==='light'&&c.location===b.site&&fighter(m,c.id))){
   const a=action('play',{card,target:c.id,site:b.site,window:w.serial});a.label='I’ve Got A Problem Here · '+cardDefinition(m,c.id).name+' · 1 Force';a.payment={dark:1};out.push(a);
  }
 }
 const d=fighterTrouble(m),draw=destinyInWindow(m,w);
 if(d?.stage==='destiny'&&draw?.side==='dark'&&draw.value!==null&&!draw.substituted&&sameCard(m,d.target)&&m.cards[d.target.id].blueprint==='2_72'&&operational(m,d.target.id)&&gameTextActive(m,d.target.id)&&!d.bonuses.includes(w.serial)){
  const p=draw.resolution.action.payload as {source:string;category:string;next:{handler:string;payload:Payload}};
  if(p.category==='fighter-trouble'&&p.source===d.source&&p.next.handler==='fighter-trouble:result'&&p.next.payload.serial===d.serial){
   const bonus:Bonus={source:referenceCard(m,d.target.id),window:w.serial,pendingIndex:m.stack.indexOf(draw.resolution),pendingId:draw.resolution.action.id,serial:d.serial};
   out.push({id:'fighter-trouble:bonus:'+d.target.id,label:'Red 6 · add 2 to this destiny',source:d.target.id,handler:'fighter-trouble:bonus',payload:bonus as unknown as Json});
  }
 }
 return out;
}
export function fighterTroubleInitiate(m:Match,r:Resolution):void{
 if(r.action.handler==='fighter-trouble:bonus'){const p=r.action.payload as unknown as Bonus,d=fighterTrouble(m);if(!d||d.bonuses.includes(p.window))throw Error('Red 6 already used for this draw.');d.bonuses.push(p.window);return;}
 const p=r.action.payload as unknown as Payload;p.targetRef=referenceCard(m,p.target);moveCard(m,p.card,'playing');
}
export function fighterTroubleResolve(m:Match,r:Resolution):void{
 if(r.action.handler==='fighter-trouble:bonus'){
  const p=r.action.payload as unknown as Bonus,target=pending(m,p),draw=target&&pendingDestiny(m,target);
  // The initiated modifier survives its source leaving. Failed, canceled and
  // substituted draws cannot receive a numerical destiny modifier.
  if(!r.cancelled&&draw&&draw.value!==null&&!draw.substituted)(target!.action.payload as unknown as {draw:Draw}).draw.value=draw.value+2;
  return;
 }
 const p=r.action.payload as unknown as Payload,h=r.action.handler;
 if(h==='fighter-trouble:play'){
  if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
  const d:FighterTrouble={serial:++m.serial,source:p.card,target:p.targetRef!,name:cardDefinition(m,p.target).name,site:p.site,stage:'destiny',bonuses:[]};m.data.fighterTrouble=d as unknown as Json;p.serial=d.serial;queue(m,'finish',p);drawDestiny(m,'dark',p.card,'fighter-trouble',action('result',p));return;
 }
 const d=fighterTrouble(m);if(!d||p.serial!==d.serial)throw Error('Missing fighter trouble.');
 if(h==='fighter-trouble:finish'){d.stage='complete';if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
 if(r.cancelled){if(h==='fighter-trouble:lose')d.prevented=true;return;}
 if(h==='fighter-trouble:result'){
  d.draw=p.draw!;d.destiny=p.total!;d.departed=!sameCard(m,d.target);d.maneuver=d.departed?null:vesselManeuver(m,d.target.id);d.success=!d.departed&&d.destiny!==null&&d.maneuver!==null&&d.destiny>d.maneuver;d.stage='result';queue(m,'loss',p);openWindow(m,'response','light',{kind:'fighter-trouble-result',source:p.card,target:p.target});
 }else if(h==='fighter-trouble:loss'){
  d.stage='loss';if(!d.success||!sameCard(m,d.target))return;queue(m,'lose',p);const cards=tableLossCards(m,[p.target]);openWindow(m,'response','light',{kind:'about-to-lose',card:p.target,cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,site:p.site,cause:'fighter-trouble'});
 }else if(h==='fighter-trouble:lose'){
  if(sameCard(m,d.target)){d.lost=true;queue(m,'lost',p);loseFromTable(m,[p.target]);}
 }else if(h==='fighter-trouble:lost')openWindow(m,'response','dark',{kind:'starship-lost',card:p.target,source:p.card,site:p.site,cause:'fighter-trouble'});
 else throw Error('Unknown fighter trouble continuation.');
}
export function fighterTroubleView(m:Match){const d=fighterTrouble(m);if(!d)return {fighterTrouble:null};return {fighterTrouble:{name:d.name,stage:d.stage,destiny:d.destiny??null,maneuver:d.maneuver??null,drawn:d.draw!==undefined,departed:!!d.departed,lost:!!d.lost,prevented:!!d.prevented}};}
export function assertFighterTrouble(m:Match):void{
 const d=fighterTrouble(m);
 if(d){
  assertCardReference(m,d.target);if(!Number.isSafeInteger(d.serial)||d.serial<1||d.serial>m.serial||m.cards[d.source]?.blueprint!=='1_253'||m.cards[d.target.id].owner!=='light'||d.target.zone!=='table'||!fighter(m,d.target.id)||!m.locations.includes(d.site)||typeof d.name!=='string'||!['destiny','result','loss','complete'].includes(d.stage)||!Array.isArray(d.bonuses)||d.bonuses.some(n=>!Number.isSafeInteger(n)||n<1||n>m.serial)||new Set(d.bonuses).size!==d.bonuses.length)throw Error('Invalid fighter trouble record.');
  if(d.stage!=='destiny'&&(!d.draw||!validDraw(m,d.draw,'dark')||d.destiny===undefined||d.destiny!==null&&(!Number.isFinite(d.destiny)||d.destiny<0)||d.maneuver===undefined||d.maneuver!==null&&(!Number.isFinite(d.maneuver)||d.maneuver<0)||typeof d.departed!=='boolean'||d.success!==(!d.departed&&d.destiny!==null&&d.maneuver!==null&&d.destiny>d.maneuver)))throw Error('Invalid fighter trouble result.');
  if(d.lost!==undefined&&(d.lost!==true||!d.success)||d.prevented!==undefined&&typeof d.prevented!=='boolean')throw Error('Invalid fighter loss result.');
 }
 // A saved general destiny continuation must retain this action's original
 // target and response window, not just a plausible handler name.
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('destiny:')){
  const flow=r.action.payload as {source?:string;side?:Side;category?:string;next?:{handler:string;payload:Payload}},p=flow.next?.payload;
  if(flow.next?.handler!=='fighter-trouble:result')continue;
  if(!d||d.stage!=='destiny'||!p||p.serial!==d.serial||p.card!==d.source||flow.source!==d.source||flow.side!=='dark'||flow.category!=='fighter-trouble'||p.target!==d.target.id||p.site!==d.site||p.targetRef?.id!==d.target.id||p.targetRef.version!==d.target.version||p.targetRef.zone!=='table'||!m.stack.some(f=>f.kind==='window'&&f.serial===p.window&&(f.event as {kind?:string})?.kind==='battle-ended'))throw Error('Invalid fighter destiny continuation.');
 }
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('fighter-trouble:')){
  if(r.actor!=='dark')throw Error('Invalid fighter trouble actor.');
  if(r.action.handler==='fighter-trouble:bonus'){
   const p=r.action.payload as unknown as Bonus;assertCardReference(m,p.source);const target=pending(m,p),flow=target?.action.payload as {source?:string;category?:string;next?:{handler:string;payload:Payload}}|undefined;
   if(!d||p.serial!==d.serial||!Number.isSafeInteger(p.pendingIndex)||p.pendingIndex<0||p.pendingIndex>=m.stack.indexOf(r)||!target||flow?.category!=='fighter-trouble'||flow.source!==d.source||flow.next?.handler!=='fighter-trouble:result'||flow.next.payload.serial!==d.serial||!d.bonuses.includes(p.window)||p.source.zone!=='table'||p.source.id!==d.target.id||p.source.version!==d.target.version||m.cards[p.source.id].blueprint!=='2_72'||r.action.source!==p.source.id)throw Error('Invalid Red 6 destiny binding.');
   continue;
  }
  const p=r.action.payload as unknown as Payload;
  if(!p||m.cards[p.card]?.blueprint!=='1_253'||m.cards[p.card].owner!=='dark'||m.cards[p.card].zone!=='playing'||r.action.source!==p.card||!['play','result','loss','lose','lost','finish'].some(x=>r.action.handler==='fighter-trouble:'+x)||!m.locations.includes(p.site)||!Number.isSafeInteger(p.window))throw Error('Invalid fighter trouble continuation.');
  const window=m.stack.find(f=>f.kind==='window'&&f.serial===p.window) as Window|undefined;
  if(!window||window.timing!=='response'||(window.event as {kind?:string})?.kind!=='battle-ended'||(m.data.battle as Battle|undefined)?.site!==p.site)throw Error('Invalid post-battle response binding.');
  assertCardReference(m,p.targetRef!,p.target);if(p.targetRef!.zone!=='table'||m.cards[p.target].owner!=='light'||!fighter(m,p.target))throw Error('Invalid fighter trouble target.');
  if(r.action.handler!=='fighter-trouble:play'&&(!d||p.serial!==d.serial||p.card!==d.source||p.target!==d.target.id))throw Error('Stale fighter trouble continuation.');
 }
}
