import {attachmentAttempt,assertAttachmentAttempt,validAttachmentAttempt,type AttachmentAttempt} from './attachment';
import {battle,members} from './battle';
import {cardDefinition,name} from './board';
import {isModel} from './characteristics';
import {defenseValue} from './defense';
import {deployed} from './deployment';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {beginDestinySequence,assertDestinyScope} from './destiny-limits';
import {pendingReactSite,reactionSources,canDeployAsReact,registerReact} from './ground';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {belowDecks,capital,operational} from './occupancy';
import {hasPersona} from './persona';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {canUseWeapon,useWeapon} from './weapon-state';
import {other,sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

/** Ship mounts. Mobile-system mounts remain gated with mobile-system integration. */
export const starshipWeapons:Record<string,{deploy:number;fire:number;draws:number}>={
 '1_158':{deploy:1,fire:1,draws:1},'1_159':{deploy:2,fire:1,draws:1},'1_323':{deploy:3,fire:2,draws:2},
};
export type StarshipShot={weapon:string;host:string;target:string;side:Side;weaponRef:CardReference;targetRef:CardReference;scope?:string;draws:Draw[];total:number|null;modifier:number;defense?:number;outcome:'pending'|'canceled'|'invalid'|'miss'|'hit'};
type Payload={card:string;target:string;site:string;transfer?:boolean;react?:boolean;via?:string;attachment?:AttachmentAttempt;index?:number;draw?:Draw;total?:number|null};
const action=(step:string,p:Payload):Action=>({id:'space-weapon:'+step+':'+p.card+':'+p.target,label:step,handler:'space-weapon:'+step,source:p.card,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor:Side)=>m.stack.push({kind:'resolution',actor,action:action(step,p),cancelled:false});
const starship=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).type==='Starship';
function validHost(m:Match,weapon:string,host:string):boolean{
 if(!starship(m,host)||m.cards[host].owner!==m.cards[weapon].owner)return false;
 switch(m.cards[weapon].blueprint){
  case '1_158':return ['X_WING','Y_WING','B_WING'].some(model=>isModel(m,host,model));
  case '1_159':return isModel(m,host,'CORELLIAN_CORVETTE')||hasPersona(m,host,'FALCON');
  case '1_323':return ['IMPERIAL_CLASS_STAR_DESTROYER','VICTORY_CLASS_STAR_DESTROYER','SUPER_CLASS_STAR_DESTROYER','VENATOR_CLASS_STAR_DESTROYER'].some(model=>isModel(m,host,model));
  default:return false;
 }
}
// Present together at a location, or together inside the same cargo hold.
// An enclosed carrier separates a cargo starfighter from ships outside it.
function transferPresent(m:Match,from:string,to:string):boolean{
 const a=m.cards[from],b=m.cards[to];return !!a&&!!b&&a.zone==='table'&&b.zone==='table'&&a.location===b.location&&a.attachedTo===b.attachedTo;
}
const validTarget=(m:Match,id:string,side:Side)=>starship(m,id)&&!belowDecks(m,id)&&members(m,other(side)).includes(id);
export function starshipWeaponActions(m:Match,w:Window,side:Side):Action[]{
 const out:Action[]=[],b=battle(m),reactSite=pendingReactSite(m,w,side);
 for(const c of Object.values(m.cards)){
  const rule=starshipWeapons[c.blueprint];if(!rule||c.owner!==side)continue;
  if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy'&&(c.zone==='hand'||c.zone==='table')){
   const transfer=c.zone==='table';
   for(const t of Object.values(m.cards).filter(t=>t.zone==='table'&&t.location&&validHost(m,c.id,t.id))){
    if(transfer&&(!c.attachedTo||c.attachedTo===t.id||!transferPresent(m,c.attachedTo,t.id)))continue;
    const a=action('equip',{card:c.id,target:t.id,site:t.location!,transfer});a.label=(transfer?'Transfer ':'Deploy ')+name(m,c.id)+' on '+name(m,t.id);a.payment={[side]:rule.deploy};out.push(a);
   }
  }
  if(reactSite&&c.zone==='hand'&&canDeployAsReact(m,c.id)){
   const sources=reactionSources(m,reactSite,side),vias=[...(sources.some(id=>m.cards[id].blueprint==='1_6')?[undefined]:[]),...sources.filter(id=>m.cards[id].blueprint==='1_201')];
   for(const via of vias)for(const t of Object.values(m.cards).filter(t=>t.zone==='table'&&t.location===reactSite&&validHost(m,c.id,t.id))){
    const a=action('equip',{card:c.id,target:t.id,site:reactSite,transfer:false,react:true,...(via?{via}:{})});a.id+=':react'+(via?':via:'+via:'');a.label='Deploy '+name(m,c.id)+' as a react on '+name(m,t.id);a.payment={[side]:rule.deploy};out.push(a);
   }
  }
  if(w.timing!=='response'||(w.event as {kind?:string})?.kind!=='battle-weapons'||b?.stage!=='weapons'||!c.attachedTo||!gameTextActive(m,c.id)||!validHost(m,c.id,c.attachedTo)||!members(m,side).includes(c.attachedTo)||!operational(m,c.attachedTo)||belowDecks(m,c.id)||b.fired.includes(c.id)||!canUseWeapon(m,c.id))continue;
  for(const target of members(m,other(side)).filter(id=>validTarget(m,id,side))){const a=action('fire',{card:c.id,target,site:b.site});a.label='Fire '+name(m,c.id)+' at '+name(m,target);a.payment={[side]:rule.fire};out.push(a);}
 }
 return out;
}
export function starshipWeaponInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;
 if(r.action.handler==='space-weapon:equip'){if(p.react)registerReact(m,p.card);if(!p.transfer)moveCard(m,p.card,'playing');p.attachment=attachmentAttempt(m,p.card,p.target);return;}
 const b=battle(m)!,host=m.cards[p.card].attachedTo!;useWeapon(m,p.card);b.fired.push(p.card);b.users[host]=p.card;
 const shots=b.starshipShots??=[];p.index=shots.length;shots.push({weapon:p.card,host,target:p.target,side:r.actor,weaponRef:referenceCard(m,p.card),targetRef:referenceCard(m,p.target),draws:[],total:null,modifier:0,outcome:'pending'});
}
export function starshipWeaponResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload,h=r.action.handler,side=r.actor;
 if(h==='space-weapon:equip'){
  const c=m.cards[p.card],t=m.cards[p.target];
  if(r.cancelled||!validAttachmentAttempt(m,p.attachment!)||!validHost(m,p.card,p.target)||!t.location||p.react&&t.location!==p.site||p.transfer&&!transferPresent(m,p.attachment!.fromHost!,t.id)){if(c.zone==='playing'&&sameCard(m,p.attachment!.cardRef))moveCard(m,c.id,'lost');return;}
  if(!p.transfer)moveCard(m,c.id,'table');c.attachedTo=t.id;c.location=t.location;
  if(p.transfer)openWindow(m,'response',other(side),{kind:'weapon-transferred',card:c.id});else deployed(m,c.id);return;
 }
 const b=battle(m)!,shot=b.starshipShots![p.index!];
 if(r.cancelled){shot.outcome='canceled';return;}
 if(h==='space-weapon:fire'){
  // Paid initiation survives changes to the firing ship. Original target
  // references prevent a departing/returning ship inheriting the old hit.
  shot.scope=beginDestinySequence(m,side,shot.weapon,'weapon');queue(m,'draw',p,side);
 }else if(h==='space-weapon:draw'){
  if(p.draw){shot.draws.push(p.draw);delete p.draw;}
  if(shot.draws.length<starshipWeapons[m.cards[shot.weapon].blueprint].draws)drawDestiny(m,side,shot.weapon,'weapon',action('draw',p),false,{weapon:shot.weapon},undefined,false,shot.scope);
  else{
   const active=sameCard(m,shot.weaponRef)&&gameTextActive(m,shot.weapon),bp=m.cards[shot.weapon].blueprint;
   shot.modifier=active?(bp==='1_159'&&!capital(m,shot.target)?1:bp==='1_323'?(capital(m,shot.target)?-2:-5):0):0;
   completeDestinyTotal(m,side,shot.weapon,'weapon',shot.draws,action('result',p),shot.modifier);
  }
 }else if(h==='space-weapon:result'){
  shot.total=p.total!;shot.defense=defenseValue(m,shot.target);shot.outcome='miss';queue(m,'finish',p,side);
  if(!sameCard(m,shot.targetRef)||!validTarget(m,shot.target,side)){shot.outcome='invalid';return;}
  if(shot.total!==null&&shot.total>shot.defense){queue(m,'hit',p,side);openWindow(m,'response',other(side),{kind:'about-to-hit',target:shot.target,weapon:shot.weapon});}
 }else if(h==='space-weapon:hit'){
  if(sameCard(m,shot.targetRef)&&validTarget(m,shot.target,side)){shot.outcome='hit';if(!b.hits.includes(shot.target))b.hits.push(shot.target);openWindow(m,'response',other(side),{kind:'hit',target:shot.target,weapon:shot.weapon});}else shot.outcome='invalid';
 }else if(h==='space-weapon:finish')openWindow(m,'response',other(side),{kind:'weapon-fired',weapon:shot.weapon,target:shot.target,hit:shot.outcome==='hit'});
 else throw Error('Unknown starship weapon action.');
}
export function assertStarshipWeapons(m:Match):void{
 const b=battle(m);if(b?.starshipShots!==undefined&&!Array.isArray(b.starshipShots))throw Error('Invalid starship weapon history.');
 for(const s of b?.starshipShots??[]){
  if(!s||!starshipWeapons[m.cards[s.weapon]?.blueprint]||!sides.includes(s.side)||m.cards[s.weapon].owner!==s.side||!starship(m,s.host)||!starship(m,s.target)||m.cards[s.target].owner===s.side||!Array.isArray(s.draws)||s.draws.length>starshipWeapons[m.cards[s.weapon].blueprint].draws||s.draws.some(d=>!validDraw(m,d,s.side))||s.total!==null&&(!Number.isFinite(s.total)||s.total<0)||![0,1,-2,-5].includes(s.modifier)||!['pending','canceled','invalid','miss','hit'].includes(s.outcome)||s.defense!==undefined&&(!Number.isFinite(s.defense)||s.defense<0))throw Error('Invalid starship weapon record.');
  assertCardReference(m,s.weaponRef,s.weapon);assertCardReference(m,s.targetRef,s.target);assertDestinyScope(m,s.scope,s.side,s.weapon,'weapon');
  if(s.weaponRef.zone!=='table'||s.targetRef.zone!=='table'||['miss','hit'].includes(s.outcome)&&s.draws.length!==starshipWeapons[m.cards[s.weapon].blueprint].draws||s.outcome==='hit'&&(s.total===null||s.defense===undefined||s.total<=s.defense))throw Error('Invalid starship weapon result.');
 }
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('space-weapon:')){
  const p=r.action.payload as Payload;
  if(!p||!starshipWeapons[m.cards[p.card]?.blueprint]||m.cards[p.card].owner!==r.actor||r.action.source!==p.card||!['equip','fire','draw','result','hit','finish'].some(h=>r.action.handler==='space-weapon:'+h)||!starship(m,p.target)||!m.locations.includes(p.site))throw Error('Invalid starship weapon continuation.');
  if(r.action.handler==='space-weapon:equip'){assertAttachmentAttempt(m,p.attachment!,p.card,p.target);if(typeof p.transfer!=='boolean'||p.transfer!==p.attachment!.transfer||p.react!==undefined&&(p.react!==true||p.transfer||p.via!==undefined&&m.cards[p.via]?.blueprint!=='1_201'))throw Error('Invalid starship weapon deployment.');}
  else{const s=b?.starshipShots?.[p.index!];if(!Number.isSafeInteger(p.index)||!s||s.weapon!==p.card||s.target!==p.target||s.side!==r.actor||b?.site!==p.site)throw Error('Invalid starship weapon firing.');}
 }
}
