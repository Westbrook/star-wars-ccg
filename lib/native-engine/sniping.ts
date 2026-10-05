import {ability} from './ability';
import {cardDefinition,isWarrior,name} from './board';
import {weapons} from './battle';
import {completeDestinyTotal,drawDestiny,validDraw,type Draw} from './destiny';
import {beginDestinySequence,assertDestinyScope} from './destiny-limits';
import {destinyInWindow,pendingDestiny} from './destiny-response';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {laserGateTargetsAt,laserGateAtSite} from './laser-gate';
import {lossPrevented} from './loss-prevention';
import {characterPresent} from './occupancy';
import {hasPersona} from './persona';
import {openWindow} from './runtime';
import {moveCard,useForce} from './state';
import {loseFromTable} from './table';
import {canUseWeapon,useWeapon} from './weapon-state';
import {other,sides,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

/** Verified control-phase firing against Laser Gate. Other Sniper/Sorry targets
 * and weapon profiles remain pending; these Interrupts are not fully admitted. */
type Shot={source:CardReference;weapon:CardReference;host:CardReference;target:CardReference;site:CardReference;side:Side;scope?:string;draws:Draw[];total:number|null;bonusWindows:number[];outcome:'pending'|'canceled'|'invalid'|'miss'|'hit';stage:'drawing'|'result'|'complete'};
type Payload={card:string;weapon:string;weaponRef?:CardReference;hostRef?:CardReference;sourceRef?:CardReference;index?:number;target?:string;draw?:Draw;total?:number|null;pendingIndex?:number;pendingId?:string;window?:number};
const shots=(m:Match)=>(m.data.snipingShots??[]) as unknown as Shot[];
const blueprint=(side:Side)=>side==='light'?'2_57':'2_139';
const supportedWeapon=(m:Match,id:string)=>!!weapons[m.cards[id]?.blueprint]||['1_155','1_157','1_324'].includes(m.cards[id]?.blueprint);
const sameReference=(a:CardReference,b:CardReference)=>a.id===b.id&&a.zone===b.zone&&a.version===b.version;
const action=(step:string,p:Payload):Action=>({id:'sniping:'+step+':'+p.card+':'+p.weapon+(p.target?':'+p.target:'')+(p.window?':'+p.window:''),handler:'sniping:'+step,source:step==='play'?p.card:step==='bonus'?p.card:p.weapon,label:step,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,side:Side)=>m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action(step,p)});
function profile(m:Match,weapon:string,host:string){
 const bp=m.cards[weapon]?.blueprint;
 if(weapons[bp])return isWarrior(m,host)?{count:1,cost:weapons[bp].fire,bonus:weapons[bp].bonus}:undefined;
 if(bp==='1_155'&&isWarrior(m,host))return {count:2,cost:Math.max(0,Math.floor(7-ability(m,host))),bonus:0};
 if(bp==='1_157'&&hasPersona(m,host,'OBIWAN')||bp==='1_324'&&hasPersona(m,host,'VADER'))return {count:2,cost:0,bonus:0};
}
function available(m:Match,weapon:string,side:Side):string[]{
 const c=m.cards[weapon],host=c?.attachedTo;if(!c||c.owner!==side||c.zone!=='table'||!host||m.cards[host].owner!==side||!characterPresent(m,host)||!gameTextActive(m,weapon)||!canUseWeapon(m,weapon))return [];
 const rule=profile(m,weapon,host),site=m.cards[host].location;
 return rule&&site&&rule.cost<=m.players[side].force.length?laserGateTargetsAt(m,site,side):[];
}
function pending(m:Match,p:Payload){
 const r=m.stack[p.pendingIndex!],w=m.stack[p.pendingIndex!+1];
 if(r?.kind!=='resolution'||r.action.id!==p.pendingId||r.action.handler!=='destiny:finish'||w?.kind!=='window'||w.serial!==p.window)return;
 const flow=r.action.payload as {next?:Action;source?:string;side?:Side;category?:string},next=flow.next?.payload as Payload|undefined,s=shots(m)[p.index!];
 return s&&flow.category==='weapon'&&flow.source===s.weapon.id&&flow.side===s.side&&flow.next?.handler==='sniping:draw'&&next&&next.index===p.index&&next.card===p.card&&next.weapon===p.weapon&&next.target===p.target?r:undefined;
}
function bonus(m:Match,s:Shot){return s.side==='light'?(hasPersona(m,s.host.id,'HAN')?1:0):(m.cards[s.host.id].blueprint==='2_108'?2:0);}
export function snipingActions(m:Match,w:Window,side:Side):Action[]{
 const out:Action[]=[];
 if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='control')for(const card of m.players[side].hand.filter(id=>m.cards[id].blueprint===blueprint(side)))for(const weapon of Object.keys(m.cards))if(available(m,weapon,side).length)out.push({...action('play',{card,weapon}),label:name(m,card)+' · fire '+name(m,weapon)+' at Laser Gate'});
 const d=destinyInWindow(m,w),flow=d?.resolution.action.payload as {next?:Action;source?:string;category?:string}|undefined;
 if(d&&d.side===side&&d.value!==null&&!d.substituted&&flow?.category==='weapon'&&flow.next?.handler==='sniping:draw'){
  const p=flow.next.payload as Payload,s=shots(m)[p.index!];
  if(s&&s.side===side&&s.weapon.id===flow.source&&sameCard(m,s.source)&&bonus(m,s)&&!s.bonusWindows.includes(w.serial))out.push({...action('bonus',{...p,pendingIndex:m.stack.indexOf(d.resolution),pendingId:d.resolution.action.id,window:w.serial}),label:name(m,p.card)+' · add '+bonus(m,s)+' to weapon destiny'});
 }
 return out;
}
export function snipingInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;
 if(r.action.handler==='sniping:bonus'){shots(m)[p.index!].bonusWindows.push(p.window!);return;}
 if(r.action.handler!=='sniping:play')throw Error('Invalid sniping initiation.');
 p.weaponRef=referenceCard(m,p.weapon);p.hostRef=referenceCard(m,m.cards[p.weapon].attachedTo!);moveCard(m,p.card,'playing');p.sourceRef=referenceCard(m,p.card);
}
export function snipingChoices(m:Match,d:Decision){
 const p=d.payload as unknown as Payload;if(d.handler!=='sniping:target')throw Error('Invalid sniping choice.');
 const targets=sameCard(m,p.weaponRef!)&&sameCard(m,p.hostRef!)&&m.cards[p.weapon].attachedTo===p.hostRef!.id?available(m,p.weapon,d.side):[];
 return targets.length?targets.map(id=>({id:'sniping:target:'+id,label:'Fire at '+name(m,id)})):[{id:'sniping:no-target',label:'No legal target remains'}];
}
export function snipingChoose(m:Match,d:Decision,choice:string):void{
 const p=d.payload as unknown as Payload;if(!snipingChoices(m,d).some(c=>c.id===choice))throw Error('Invalid sniping target.');
 if(choice==='sniping:no-target')return;
 const target=choice.slice('sniping:target:'.length),host=p.hostRef!.id;
 useForce(m,{[d.side]:profile(m,p.weapon,host)!.cost});useWeapon(m,p.weapon);
 const index=shots(m).length,s:Shot={source:p.sourceRef!,weapon:p.weaponRef!,host:p.hostRef!,target:referenceCard(m,target),site:referenceCard(m,m.cards[host].location!),side:d.side,draws:[],total:null,bonusWindows:[],outcome:'pending',stage:'drawing'};
 m.data.snipingShots=[...shots(m),s] as unknown as Json;
 queue(m,'fire',{...p,index,target},d.side);openWindow(m,'response',other(d.side),{kind:'weapon-targeted',weapon:p.weapon,target,source:p.card});
}
export function snipingResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload,h=r.action.handler;
 if(h==='sniping:bonus'){
  const target=pending(m,p),d=target&&pendingDestiny(m,target);if(!r.cancelled&&d&&d.value!==null&&!d.substituted)(target!.action.payload as {draw:Draw}).draw.value=d.value+bonus(m,shots(m)[p.index!]);return;
 }
 if(h==='sniping:play'){
  if(!sameCard(m,p.sourceRef!))return;
  if(r.cancelled){moveCard(m,p.card,'lost');return;}
  queue(m,'cleanup',p,r.actor);m.stack.push({kind:'decision',side:r.actor,handler:'sniping:target',payload:p as unknown as Json});return;
 }
 if(h==='sniping:cleanup'){if(sameCard(m,p.sourceRef!))moveCard(m,p.card,'lost');return;}
 const s=shots(m)[p.index!];
 if(r.cancelled){s.outcome='canceled';s.stage='complete';return;}
 const valid=()=>sameCard(m,s.target)&&sameCard(m,s.site)&&laserGateAtSite(m,s.target.id,s.site.id);
 if(h==='sniping:fire'){s.scope=beginDestinySequence(m,r.actor,p.weapon,'weapon');queue(m,'draw',p,r.actor);}
 else if(h==='sniping:draw'){
  if(p.draw){s.draws.push(p.draw);delete p.draw;}
  if(s.draws.length<(weapons[m.cards[p.weapon].blueprint]?1:2))drawDestiny(m,r.actor,p.weapon,'weapon',action('draw',p),false,{weapon:p.weapon},undefined,false,s.scope);
  else completeDestinyTotal(m,r.actor,p.weapon,'weapon',s.draws,action('result',p),weapons[m.cards[p.weapon].blueprint]?.bonus??0);
 }else if(h==='sniping:result'){
  s.total=p.total!;s.stage='result';s.outcome=valid()?'miss':'invalid';queue(m,'finish',p,r.actor);
  if(valid()&&s.total!==null&&s.total>3){queue(m,'hit',p,r.actor);openWindow(m,'response',other(r.actor),{kind:'about-to-hit',target:s.target.id,weapon:p.weapon});}
 }else if(h==='sniping:hit'){
  if(!valid()){s.outcome='invalid';return;}s.outcome='hit';queue(m,'loss-before',p,r.actor);openWindow(m,'response',other(r.actor),{kind:'hit',target:s.target.id,weapon:p.weapon});
 }else if(h==='sniping:loss-before'){
  if(valid()&&!lossPrevented(m,s.target.id)){queue(m,'lose',p,r.actor);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:s.target.id,source:p.weapon,cause:'weapon',site:s.site.id});}
 }else if(h==='sniping:lose'){
  if(valid()&&!lossPrevented(m,s.target.id)){queue(m,'lost',p,r.actor);loseFromTable(m,[s.target.id]);}
 }else if(h==='sniping:lost')openWindow(m,'response',other(r.actor),{kind:'card-lost',card:s.target.id,source:p.weapon,cause:'weapon',site:s.site.id});
 else if(h==='sniping:finish'){s.stage='complete';openWindow(m,'response',other(r.actor),{kind:'weapon-fired',weapon:p.weapon,target:s.target.id,hit:s.outcome==='hit'});}
 else throw Error('Unknown sniping continuation.');
}
export function assertSniping(m:Match):void{
 if(m.data.snipingShots!==undefined&&!Array.isArray(m.data.snipingShots))throw Error('Invalid sniping history.');
 for(const s of shots(m)){
  for(const ref of [s.source,s.weapon,s.host,s.target,s.site])assertCardReference(m,ref);
  if(s.source.zone!=='playing'||[s.weapon,s.host,s.target,s.site].some(ref=>ref.zone!=='table')||!sides.includes(s.side)||m.cards[s.source.id].blueprint!==blueprint(s.side)||m.cards[s.source.id].owner!==s.side||m.cards[s.weapon.id].owner!==s.side||m.cards[s.target.id].blueprint!=='2_113'||m.cards[s.target.id].owner===s.side||!Array.isArray(s.draws)||s.draws.length>(weapons[m.cards[s.weapon.id].blueprint]?1:2)||s.draws.some(d=>!validDraw(m,d,s.side))||s.total!==null&&(!Number.isFinite(s.total)||s.total<0)||!['pending','canceled','invalid','miss','hit'].includes(s.outcome)||!['drawing','result','complete'].includes(s.stage)||!Array.isArray(s.bonusWindows)||new Set(s.bonusWindows).size!==s.bonusWindows.length||s.bonusWindows.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid sniping shot.');
  assertDestinyScope(m,s.scope,s.side,s.weapon.id,'weapon');
  if(!supportedWeapon(m,s.weapon.id)||m.cards[s.host.id].owner!==s.side||cardDefinition(m,s.site.id).subType!=='Site'||s.outcome==='hit'&&(s.total===null||s.total<=3)||['miss','hit'].includes(s.outcome)&&s.draws.length!==(weapons[m.cards[s.weapon.id].blueprint]?1:2)||s.stage==='drawing'&&(s.outcome!=='pending'||s.total!==null)||s.stage==='complete'&&s.outcome==='pending')throw Error('Invalid sniping hit.');
 }
 for(const f of m.stack){
  const handler=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';
  const raw=(f.kind==='resolution'?f.action.payload:f.kind==='decision'?f.payload:undefined) as unknown as {start?:unknown;next?:Action;side?:Side;source?:string;category?:string};
  const flow=(handler==='destiny:value'?raw?.start:raw) as typeof raw;
  const forwarded=handler.startsWith('destiny:')&&flow?.next?.handler.startsWith('sniping:');
  const act=forwarded?flow.next:f.kind==='resolution'?f.action:undefined,h=forwarded?act!.handler:handler;if(!h.startsWith('sniping:'))continue;
  const p=(act?act.payload:(f as Decision).payload) as unknown as Payload,side=f.kind==='resolution'?f.actor:(f as Decision).side;
  if(!p||m.cards[p.card]?.blueprint!==blueprint(side)||m.cards[p.card].owner!==side||!['play','target','cleanup','bonus','fire','draw','result','hit','loss-before','lose','lost','finish'].some(n=>h==='sniping:'+n))throw Error('Invalid sniping continuation.');
  for(const [ref,id] of [[p.sourceRef,p.card],[p.weaponRef,p.weapon],[p.hostRef,undefined]] as const)assertCardReference(m,ref!,id);
  if(p.sourceRef!.zone!=='playing'||p.weaponRef!.zone!=='table'||p.hostRef!.zone!=='table'||!supportedWeapon(m,p.weapon)||m.cards[p.weapon].owner!==side||m.cards[p.hostRef!.id].owner!==side)throw Error('Invalid sniping references.');
  if(act&&(act.id!==action(h.slice(8),p).id||act.source!==action(h.slice(8),p).source||act.payment!==undefined||act.unrespondable!==undefined))throw Error('Invalid sniping action.');
  if(!act&&h!=='sniping:target')throw Error('Invalid sniping decision.');
  if(!['sniping:play','sniping:target','sniping:cleanup'].includes(h)){
   const s=shots(m)[p.index!];if(!Number.isSafeInteger(p.index)||!s||s.source.id!==p.card||s.weapon.id!==p.weapon||s.target.id!==p.target||s.side!==side)throw Error('Invalid sniping binding.');
   if(!sameReference(s.source,p.sourceRef!)||!sameReference(s.weapon,p.weaponRef!)||!sameReference(s.host,p.hostRef!))throw Error('Invalid sniping instance binding.');
   if(forwarded&&(flow.category!=='weapon'||flow.side!==s.side||flow.source!==s.weapon.id||!['sniping:draw','sniping:result'].includes(h)))throw Error('Invalid sniping destiny binding.');
   if(['sniping:fire','sniping:draw','sniping:result'].includes(h)&&s.stage!=='drawing'||h==='sniping:result'&&s.draws.length!==(weapons[m.cards[s.weapon.id].blueprint]?1:2))throw Error('Invalid sniping stage.');
   if(p.draw!==undefined&&!validDraw(m,p.draw,side)||!forwarded&&h==='sniping:result'&&p.total!==null&&(!Number.isFinite(p.total)||p.total!<0))throw Error('Invalid sniping destiny result.');
   if(h==='sniping:bonus'&&(!pending(m,p)||!bonus(m,s)||!s.bonusWindows.includes(p.window!)))throw Error('Invalid sniping bonus.');
  }
 }
}
