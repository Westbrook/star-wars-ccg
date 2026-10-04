import {attachmentAttempt,assertAttachmentAttempt,validAttachmentAttempt,type AttachmentAttempt} from './attachment';
import {ability} from './ability';
import {cardDefinition} from './definitions';
import {adjacent,controls,name} from './board';
import {blowAwaySite,blownAway} from './blown-away';
import {isModel} from './characteristics';
import {deployed} from './deployment';
import {drawDestiny,validDraw,type Draw} from './destiny';
import {gameTextActive} from './game-text';
import {hothSite} from './hoth';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {operational,occupants,permanentAbility,permanentPilot} from './occupancy';
import {moveCard} from './state';
import {canUseWeapon,useWeapon} from './weapon-state';
import {openWindow} from './runtime';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';
type Shot={card:CardReference;weapon:CardReference;host:CardReference;pilot:CardReference;site:CardReference;stage:'pending'|'drawing'|'result'|'destruction'|'complete'|'cancelled';draw:Draw|null;x:number|null;y:number|null;total:number|null;success:boolean|null};
type Payload={card:string;host?:string;weapon?:string;pilot?:string;site?:string;transfer?:boolean;attachment?:AttachmentAttempt;index?:number;draw?:Draw;total?:number|null};
const shots=(m:Match)=>(m.data.generatorShots??=[]) as unknown as Shot[];
const action=(step:string,p:Payload):Action=>({id:'generator:'+step+':'+p.card+':'+(p.weapon??p.host??'')+':'+(p.pilot??''),handler:'generator:'+step,source:p.card,label:'Target the main generator',payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor:Side)=>m.stack.push({kind:'resolution',actor,action:action(step,p),cancelled:false});
const walker=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&isModel(m,id,'AT_AT');
export function generatorActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark'||m.turn.side!==side||w.timing!=='phase')return [];const out:Action[]=[];
 if(m.turn.phase==='deploy')for(const c of Object.values(m.cards).filter(c=>c.owner===side&&c.blueprint==='3_158'&&['hand','table'].includes(c.zone)))for(const h of Object.values(m.cards).filter(h=>h.owner===side&&walker(m,h.id))){
  const transfer=c.zone==='table';if(transfer&&(c.attachedTo===h.id||!c.attachedTo||m.cards[c.attachedTo].location!==h.location||m.cards[c.attachedTo].attachedTo!==h.attachedTo))continue;
  out.push({...action('equip',{card:c.id,host:h.id,transfer}),label:(transfer?'Transfer ':'Deploy ')+'AT-AT Cannon on '+name(m,h.id),payment:{dark:2}});
 }
 if(m.turn.phase!=='control'||!m.players.dark.reserve.length)return out;
 const site=m.locations.find(id=>m.cards[id].blueprint==='3_61'&&!blownAway(m,id));if(!site)return out;
 for(const card of m.players.dark.hand.filter(id=>m.cards[id].blueprint==='3_115'))for(const w of Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&c.blueprint==='3_158'&&c.attachedTo&&walker(m,c.attachedTo)&&operational(m,c.attachedTo)&&!m.cards[c.attachedTo].attachedTo&&canUseWeapon(m,c.id)&&(c.location===site||gameTextActive(m,c.id)&&!!c.location&&adjacent(m,c.location,site)))){
  const host=w.attachedTo!,pilots=[...(permanentPilot(m,host)?[host]:[]),...occupants(m,host).filter(c=>c.aboardRole==='pilot').map(c=>c.id)];
  for(const pilot of pilots)out.push({...action('fire',{card,weapon:w.id,host,pilot,site}),label:'Target the main generator with '+name(m,host)+' · '+(pilot===host?'permanent pilot':name(m,pilot))});
 }return out;
}
export function generatorInitiate(m:Match,r:Resolution){
 const p=r.action.payload as Payload;
 if(r.action.handler==='generator:equip'){if(!p.transfer)moveCard(m,p.card,'playing');p.attachment=attachmentAttempt(m,p.card,p.host!);return;}
 if(r.action.handler!=='generator:fire')throw Error('Invalid generator initiation.');
 useWeapon(m,p.weapon!);moveCard(m,p.card,'playing');p.index=shots(m).length;shots(m).push({card:referenceCard(m,p.card),weapon:referenceCard(m,p.weapon!),host:referenceCard(m,p.host!),pilot:referenceCard(m,p.pilot!),site:referenceCard(m,p.site!),stage:'pending',draw:null,x:null,y:null,total:null,success:null});
}
export function generatorResolve(m:Match,r:Resolution){
 const p=r.action.payload as Payload,h=r.action.handler;
 if(h==='generator:equip'){
  const c=m.cards[p.card];if(r.cancelled||!validAttachmentAttempt(m,p.attachment!)||!walker(m,p.host!)){if(c.zone==='playing')moveCard(m,c.id,'lost');return;}
  if(!p.transfer)moveCard(m,c.id,'table');c.attachedTo=p.host;c.location=m.cards[p.host!].location;if(p.transfer)openWindow(m,'response','light',{kind:'weapon-transferred',card:c.id});else deployed(m,c.id);return;
 }
 const s=shots(m)[p.index!];if(r.cancelled){if(sameCard(m,s.card))moveCard(m,s.card.id,'lost');s.stage='cancelled';s.success=false;return;}
 if(h==='generator:fire'){
  s.stage='drawing';drawDestiny(m,'dark',p.card,'epic-weapon',action('result',p),true,{weapon:s.weapon.id});
 }else if(h==='generator:result'){
  s.draw=p.draw!;s.x=s.pilot.id===s.host.id?permanentAbility(m,s.host.id):ability(m,s.pilot.id);s.y=m.locations.filter(id=>hothSite(m,id)&&!blownAway(m,id)&&controls(m,'dark',id)).length;s.total=(p.total??0)+(s.x??0)+(s.y??0);s.success=s.total>8&&sameCard(m,s.site)&&!blownAway(m,s.site.id);s.stage='result';queue(m,'apply',p,r.actor);openWindow(m,'response','light',{kind:'generator-shot-result',source:p.card,weapon:s.weapon.id,site:s.site.id,total:s.total,success:s.success});
 }else if(h==='generator:apply'){
  queue(m,'finish',p,r.actor);if(s.success&&sameCard(m,s.site)&&!blownAway(m,s.site.id)){s.stage='destruction';blowAwaySite(m,s.site.id,p.card,r.actor);}
 }else if(h==='generator:finish'){
  s.stage='complete';if(sameCard(m,s.card))moveCard(m,s.card.id,s.success?'lost':'used');openWindow(m,'response',other(r.actor),{kind:'weapon-fired',weapon:s.weapon.id,target:s.site.id,hit:false,blownAway:blownAway(m,s.site.id)});
 }else throw Error('Unknown generator shot.');
}
export function assertGeneratorShots(m:Match){
 const all=m.data.generatorShots;if(all!==undefined&&!Array.isArray(all))throw Error('Invalid generator shots.');
 for(const s of (all??[]) as unknown as Shot[]){for(const ref of [s.card,s.weapon,s.host,s.pilot,s.site])assertCardReference(m,ref);if(m.cards[s.card.id].blueprint!=='3_115'||s.card.zone!=='playing'||m.cards[s.weapon.id].blueprint!=='3_158'||!isModel(m,s.host.id,'AT_AT')||m.cards[s.site.id].blueprint!=='3_61'||[s.weapon,s.host,s.pilot,s.site].some(ref=>ref.zone!=='table')||!['pending','drawing','result','destruction','complete','cancelled'].includes(s.stage)||s.draw!==null&&!validDraw(m,s.draw,'dark')||[s.x,s.y,s.total].some(n=>n!==null&&(!Number.isFinite(n)||n<0))||![true,false,null].includes(s.success))throw Error('Invalid generator shot record.');
  if([s.card,s.weapon,s.host,s.pilot].some(ref=>m.cards[ref.id].owner!=='dark')||s.site.id===s.host.id||s.pilot.id!==s.host.id&&!(cardDefinition(m,s.pilot.id).icons as string[]).includes('Pilot'))throw Error('Invalid generator shot identities.');
  const evaluated=['result','destruction','complete'].includes(s.stage);
  if(evaluated&&(s.draw===null||s.x===null||s.y===null||s.total===null||s.success===null)||!evaluated&&s.stage!=='cancelled'&&[s.draw,s.x,s.y,s.total,s.success].some(v=>v!==null)||s.stage==='destruction'&&!s.success||s.success===true&&(s.total===null||s.total<=8)||s.y!==null&&!Number.isSafeInteger(s.y))throw Error('Invalid generator shot stage.');
 }

 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('generator:')){
  const p=r.action.payload as Payload;if(r.actor!=='dark'||!m.cards[p?.card]||m.cards[p.card].owner!=='dark'||r.action.source!==p.card)throw Error('Invalid generator continuation.');
  if(r.action.handler==='generator:equip'){if(m.cards[p.card].blueprint!=='3_158'||!isModel(m,p.host!,'AT_AT'))throw Error('Invalid cannon mount.');if(typeof p.transfer!=='boolean'||p.transfer!==p.attachment?.transfer||m.cards[p.host!].owner!=='dark')throw Error('Invalid cannon transfer.');assertAttachmentAttempt(m,p.attachment!,p.card,p.host!);}
  else{const s=(all as unknown as Shot[])?.[p.index!];if(!Number.isSafeInteger(p.index)||!s||s.card.id!==p.card||s.weapon.id!==p.weapon||s.host.id!==p.host||s.pilot.id!==p.pilot||s.site.id!==p.site||!['fire','result','apply','finish'].some(k=>r.action.handler==='generator:'+k))throw Error('Invalid generator shot binding.');
   const allowed:Record<string,string[]>={'generator:fire':['pending'],'generator:result':['drawing'],'generator:apply':['result'],'generator:finish':['result','destruction']};
   if(!allowed[r.action.handler].includes(s.stage))throw Error('Invalid generator continuation stage.');
  }
 }
}
export function generatorView(m:Match){const s=(m.data.generatorShots as unknown as Shot[]|undefined)?.at(-1);return {generatorShot:s?{stage:s.stage,weapon:name(m,s.weapon.id),host:name(m,s.host.id),pilot:s.pilot.id===s.host.id?'Permanent pilot':name(m,s.pilot.id),destiny:s.draw?.value??null,x:s.x,y:s.y,total:s.total,success:s.success}:null};}
