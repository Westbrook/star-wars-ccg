import {artillery,artilleryPowerSources} from './artillery';
import {attachmentAttempt,assertAttachmentAttempt,validAttachmentAttempt,type AttachmentAttempt} from './attachment';
import {battle,battleHistory,members} from './battle';
import {adjacent,isWarrior,name,system} from './board';
import {isModel} from './characteristics';
import {creatureAttack} from './creature-attack';
import {supportedCreature} from './creature-profile';
import {cardDefinition} from './definitions';
import {defenseValue} from './defense';
import {deployed} from './deployment';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {belowDecks,characterPresent,operational} from './occupancy';
import {groundPresent} from './participation';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {canUseWeapon,useWeapon} from './weapon-state';
import {other,sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Shot={weapon:CardReference;user:CardReference;target:CardReference;site:CardReference;side:Side;context:'battle'|'attack';turn:number;sequence:number;stage:'pending'|'drawing'|'result'|'complete';draw:Draw|null;modifier:number;total:number|null;defense:number|null;outcome:'pending'|'canceled'|'invalid'|'miss'|'hit'};
type Payload={card:string;user?:string;target:string;index?:number;attachment?:AttachmentAttempt;draw?:Draw;total?:number|null};
const history=(m:Match)=>(m.data.heavyShots??[]) as unknown as Shot[];
const supported=(m:Match,id:string)=>['3_158','3_75'].includes(m.cards[id]?.blueprint);
const fighter=(m:Match,id:string)=>cardDefinition(m,id).type==='Starship'&&cardDefinition(m,id).subType.startsWith('Starfighter:');
const action=(step:string,p:Payload):Action=>({id:'heavy:'+step+':'+p.card+':'+(p.user??'')+':'+p.target,handler:'heavy:'+step,source:p.card,label:step,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,side:Side)=>m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action(step,p)});
function current(m:Match):{context:Shot['context'];sequence:number;site:string}|null{
 const a=creatureAttack(m);if(a?.stage==='weapons')return {context:'attack',sequence:a.serial,site:a.site.id};
 const b=battle(m);return b?.stage==='weapons'?{context:'battle',sequence:battleHistory(m).sites.length,site:b.site}:null;
}
const contextMatches=(m:Match,s:Shot)=>{const c=current(m);return !!c&&s.turn===m.turn.number&&c.context===s.context&&c.sequence===s.sequence&&c.site===s.site.id;};
function targetAvailable(m:Match,id:string,side:Side,context:Shot['context']):boolean{
 const c=m.cards[id];if(!c||c.zone!=='table'||!c.location||belowDecks(m,id))return false;
 if(context==='attack'){const a=creatureAttack(m)!;return a.shipSide===side&&a.slug.id===id&&sameCard(m,a.slug)&&!a.hit&&supportedCreature(m,id);}
 return c.owner!==side&&members(m,c.owner).includes(id)&&(characterPresent(m,id)||['Vehicle','Starship'].includes(cardDefinition(m,id).type)&&!c.attachedTo);
}
function users(m:Match,weapon:string):string[]{
 const w=m.cards[weapon];
 if(w.blueprint==='3_158'){const host=w.attachedTo;return host&&isModel(m,host,'AT_AT')&&operational(m,host)&&!belowDecks(m,host)?[host]:[];}
 if(!artilleryPowerSources(m,weapon).length)return [];
 return Object.values(m.cards).filter(c=>c.owner===w.owner&&c.location===w.location&&groundPresent(m,c.id)&&isWarrior(m,c.id)).map(c=>c.id);
}
export function heavyWeaponActions(m:Match,w:Window,side:Side):Action[]{
 const out:Action[]=[];
 if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy')for(const card of m.players[side].hand.filter(id=>m.cards[id].blueprint==='3_75'))for(const site of m.locations){
  const d=cardDefinition(m,site);if(m.cards[site].blownAway||d.subType!=='Site'||!system(m,site)||system(m,site)==='Death Star'||!(d.icons as string[]).includes('Exterior'))continue;
  out.push({...action('deploy',{card,target:site}),label:'Deploy Golan Laser Battery at '+name(m,site),payment:{[side]:3}});
 }
 const c=current(m),kind=(w.event as {kind?:string})?.kind;if(!c||w.timing!=='response'||kind!==(c.context==='battle'?'battle-weapons':'attack-weapons'))return out;
 for(const weapon of Object.values(m.cards).filter(x=>x.owner===side&&x.zone==='table'&&supported(m,x.id)&&gameTextActive(m,x.id)&&x.location)){
  if(history(m).some(s=>contextMatches(m,s)&&s.weapon.id===weapon.id&&sameCard(m,s.weapon)))continue;
  if(c.context==='battle'&&battle(m)!.fired.includes(weapon.id))continue;
  for(const user of users(m,weapon.id)){
   if(!canUseWeapon(m,weapon.id,user))continue;
   if(c.context==='battle'&&weapon.location===c.site&&!members(m,side).includes(user))continue;
   const a=creatureAttack(m);if(c.context==='attack'&&(a!.shipSide!==side||(weapon.location===c.site||a!.mode!=='assault')&&!a!.ships.some(ref=>ref.id===user&&sameCard(m,ref))))continue;
   if(weapon.location!==c.site&&!adjacent(m,weapon.location!,c.site))continue;
   for(const target of Object.keys(m.cards).filter(id=>targetAvailable(m,id,side,c.context))){
    const d=cardDefinition(m,target);if(d.type==='Starship'&&(weapon.blueprint!=='3_158'||!fighter(m,target)))continue;
    out.push({...action('fire',{card:weapon.id,user,target}),label:'Fire '+name(m,weapon.id)+' at '+name(m,target)+(weapon.blueprint==='3_75'?' · '+name(m,user):'')+(weapon.location!==c.site?' · adjacent site':''),payment:{[side]:2}});
   }
  }
 }
 return out;
}
export function heavyWeaponInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;
 if(r.action.handler==='heavy:deploy'){moveCard(m,p.card,'playing');p.attachment=attachmentAttempt(m,p.card,p.target);return;}
 const c=current(m);if(!c||!p.user)throw Error('No heavy weapon opportunity.');
 useWeapon(m,p.card,p.user);if(c.context==='battle'){battle(m)!.fired.push(p.card);battle(m)!.users[p.user]=p.card;}
 p.index=history(m).length;m.data.heavyShots=[...history(m),{weapon:referenceCard(m,p.card),user:referenceCard(m,p.user),target:referenceCard(m,p.target),site:referenceCard(m,c.site),side:r.actor,context:c.context,sequence:c.sequence,turn:m.turn.number,stage:'pending',draw:null,modifier:0,total:null,defense:null,outcome:'pending'}] as unknown as Json;
}
export function heavyWeaponResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload,h=r.action.handler;
 if(h==='heavy:deploy'){
  const c=m.cards[p.card];if(r.cancelled||!validAttachmentAttempt(m,p.attachment!)){if(c.zone==='playing'&&sameCard(m,p.attachment!.cardRef))moveCard(m,c.id,'lost');return;}
  moveCard(m,c.id,'table');c.attachedTo=p.target;c.location=p.target;deployed(m,c.id);return;
 }
 const s=history(m)[p.index!];if(r.cancelled){s.stage='complete';s.outcome='canceled';return;}
 if(h==='heavy:fire'){s.stage='drawing';drawDestiny(m,r.actor,p.card,'weapon',action('drawn',p),false,{weapon:p.card});return;}
 if(h==='heavy:drawn'){
  s.draw=p.draw!;const type=cardDefinition(m,s.target.id).type;
  // Target-type modifiers belong to the total, and expire with the weapon's text.
  s.modifier=sameCard(m,s.weapon)&&gameTextActive(m,p.card)?m.cards[p.card].blueprint==='3_158'?(type==='Vehicle'?2:['Character','Creature'].includes(type)?1:0):['Character','Creature'].includes(type)?2:0:0;
  completeDestinyTotal(m,r.actor,p.card,'weapon',[s.draw],action('result',p),s.modifier);return;
 }
 const valid=()=>contextMatches(m,s)&&sameCard(m,s.target)&&m.cards[s.target.id].location===s.site.id&&targetAvailable(m,s.target.id,s.side,s.context);
 if(h==='heavy:result'){
  s.stage='result';s.total=p.total!;s.defense=m.cards[p.card].blueprint==='3_158'&&fighter(m,s.target.id)?3:defenseValue(m,s.target.id);s.outcome=valid()?'miss':'invalid';queue(m,'finish',p,r.actor);
  if(valid()&&s.total!==null&&s.total>s.defense){queue(m,'hit',p,r.actor);openWindow(m,'response',other(r.actor),{kind:'about-to-hit',target:s.target.id,weapon:p.card});}
 }else if(h==='heavy:hit'){
  if(valid()){s.outcome='hit';if(s.context==='battle'){const b=battle(m)!;if(!b.hits.includes(s.target.id))b.hits.push(s.target.id);}else creatureAttack(m)!.hit=true;openWindow(m,'response',other(r.actor),{kind:'hit',target:s.target.id,weapon:p.card});}else s.outcome='invalid';
 }else if(h==='heavy:finish'){s.stage='complete';openWindow(m,'response',other(r.actor),{kind:'weapon-fired',weapon:p.card,target:s.target.id,hit:s.outcome==='hit'});}
 else throw Error('Unknown heavy weapon step.');
}
export function assertHeavyWeapons(m:Match):void{
 if(m.data.heavyShots!==undefined&&!Array.isArray(m.data.heavyShots))throw Error('Invalid heavy weapon history.');
 for(const s of history(m)){
  for(const ref of [s.weapon,s.user,s.target,s.site]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid heavy weapon reference.');}
  if(!supported(m,s.weapon.id)||!sides.includes(s.side)||m.cards[s.weapon.id].owner!==s.side||m.cards[s.user.id].owner!==s.side||!['battle','attack'].includes(s.context)||!Number.isSafeInteger(s.sequence)||s.sequence<1||!Number.isSafeInteger(s.turn)||s.turn<1||s.turn>m.turn.number||!['pending','drawing','result','complete'].includes(s.stage)||!['pending','canceled','invalid','miss','hit'].includes(s.outcome)||s.draw!==null&&!validDraw(m,s.draw,s.side)||![0,1,2].includes(s.modifier)||[s.total,s.defense].some(n=>n!==null&&(!Number.isFinite(n)||n<0)))throw Error('Invalid heavy weapon record.');
  if(s.outcome==='hit'&&(s.total===null||s.defense===null||s.total<=s.defense)||s.stage==='pending'&&(s.draw!==null||s.outcome!=='pending')||s.stage==='complete'&&s.outcome==='pending')throw Error('Invalid heavy weapon outcome.');
 }
 const keys=history(m).map(s=>[s.turn,s.context,s.sequence,s.weapon.id,s.weapon.version].join(':'));
 if(new Set(keys).size!==keys.length)throw Error('Duplicate heavy weapon shot.');
 for(const f of m.stack){
  if(f.kind==='window')continue;
  const h=f.kind==='resolution'?f.action.handler:f.handler,raw=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {start?:unknown;next?:Action;side?:Side;source?:string;category?:string};
  const flow=(h==='destiny:value'?raw.start:raw) as typeof raw;
  const forwarded=h.startsWith('destiny:')&&flow?.next?.handler.startsWith('heavy:');
  if(!h.startsWith('heavy:')&&!forwarded)continue;
  const act=forwarded?flow.next!:f.kind==='resolution'?f.action:undefined,actor=f.kind==='resolution'?f.actor:f.side;
  const p=act?.payload as Payload;
  if(!act||!p||act.source!==p.card||m.cards[p.card]?.owner!==actor||act.id!==action(act.handler.slice(6),p).id)throw Error('Invalid heavy weapon continuation.');
  if(act.handler==='heavy:deploy'){
   if(forwarded||m.cards[p.card].blueprint!=='3_75'||cardDefinition(m,p.target).subType!=='Site')throw Error('Invalid artillery deployment.');
   assertAttachmentAttempt(m,p.attachment!,p.card,p.target);continue;
  }
  const s=history(m)[p.index!];
  if(!Number.isSafeInteger(p.index)||!s||s.weapon.id!==p.card||s.user.id!==p.user||s.target.id!==p.target||s.side!==actor||!contextMatches(m,s)||!['fire','drawn','result','hit','finish'].some(h=>act.handler==='heavy:'+h))throw Error('Invalid heavy weapon binding.');
  const expected=act.handler==='heavy:fire'?'pending':['heavy:drawn','heavy:result'].includes(act.handler)?'drawing':'result';
  if(s.stage!==expected)throw Error('Invalid heavy weapon stage.');
  if(forwarded&&(flow.category!=='weapon'||flow.side!==s.side||flow.source!==s.weapon.id||!['heavy:drawn','heavy:result'].includes(act.handler)))throw Error('Invalid heavy weapon destiny.');
  if(act.handler==='heavy:result'&&s.draw===null||!forwarded&&act.handler==='heavy:drawn'&&!validDraw(m,p.draw!,s.side)||!forwarded&&act.handler==='heavy:result'&&p.total!==null&&(!Number.isFinite(p.total)||p.total!<0))throw Error('Invalid heavy weapon result.');
 }

}
export function heavyWeaponView(m:Match){const c=current(m),ss=history(m);const latest=ss.at(-1);return {heavyShots:ss.filter(s=>s.turn===m.turn.number&&(c?s.context===c.context&&s.sequence===c.sequence:latest&&s.context===latest.context&&s.sequence===latest.sequence)).map(s=>({weapon:name(m,s.weapon.id),user:name(m,s.user.id),target:name(m,s.target.id),side:s.side,context:s.context,draw:s.draw?.value??null,modifier:s.modifier,total:s.total,defense:s.defense,outcome:s.outcome}))};}
