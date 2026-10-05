import {undercoverReference,sameUndercoverCard} from './undercover-state';
import {supportedCreature} from './creature-profile';
import {cardDefinition} from './definitions';
import {creatureAttack} from './creature-attack';
import {weapons} from './battle';
import {isWarrior,name} from './board';
import {defenseValue} from './defense';
import {drawDestiny,validDraw,type Draw} from './destiny';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {characterPresent} from './occupancy';
import {openWindow} from './runtime';
import {canUseWeapon,useWeapon} from './weapon-state';
import {other,sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';
type Shot={attack:number;weapon:CardReference;host:CardReference;target:CardReference;side:Side;draw?:Draw;total?:number|null;defense?:number;hit?:boolean};
type Payload={index:number;serial:number;weapon:CardReference;host:CardReference;target:CardReference;draw?:Draw;total?:number|null};
const shots=(m:Match)=>(m.data.creatureShots??[]) as unknown as Shot[];
const action=(step:string,p:Payload):Action=>({id:'creature-weapon:'+step+':'+p.serial+':'+p.weapon.id+':'+p.index,handler:'creature-weapon:'+step,source:p.weapon.id,label:step,payload:p as unknown as Json});
export function creatureWeaponActions(m:Match,w:Window,side:Side):Action[]{
 const a=creatureAttack(m),e=w.event as {kind?:string;serial?:number}|undefined;
 if(!a||a.stage!=='weapons'||w.timing!=='response'||e?.kind!=='attack-weapons'||e.serial!==a.serial||a.shipSide!==side||!sameCard(m,a.slug)||a.hit)return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&weapons[c.blueprint]&&c.attachedTo&&gameTextActive(m,c.id)&&isWarrior(m,c.attachedTo)&&characterPresent(m,c.attachedTo)&&canUseWeapon(m,c.id)&&a.ships.some(r=>r.id===c.attachedTo&&sameUndercoverCard(m,r)&&m.cards[r.id].location===a.site.id)&&!shots(m).some(s=>s.attack===a.serial&&s.weapon.id===c.id&&sameCard(m,s.weapon))).map(c=>{
  const p={serial:a.serial,index:shots(m).length,weapon:referenceCard(m,c.id),host:referenceCard(m,c.attachedTo!),target:a.slug};return {...action('fire',p),label:'Fire '+name(m,c.id)+' at '+name(m,a.slug.id),payment:{[side]:weapons[c.blueprint].fire}};
 });
}
export function creatureWeaponInitiate(m:Match,r:Resolution):void{
 if(r.action.handler!=='creature-weapon:fire')return;const p=r.action.payload as unknown as Payload;
 if(p.index!==shots(m).length)throw Error('Invalid creature shot index.');useWeapon(m,p.weapon.id);
 m.data.creatureShots=[...shots(m),{attack:p.serial,weapon:p.weapon,host:p.host,target:p.target,side:r.actor}] as unknown as Json;
}
export function creatureWeaponResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,s=shots(m)[p.index],a=creatureAttack(m);
 if(r.cancelled)return;
 if(r.action.handler==='creature-weapon:fire'){
  // Once fired, finish the draw even if a nested action removed its participants.
  drawDestiny(m,r.actor,p.weapon.id,'weapon',action('result',p),true,{weapon:p.weapon.id});return;
 }
 if(!s||!a||a.serial!==p.serial)throw Error('Invalid creature weapon continuation.');
 const queue=(step:string)=>m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action(step,p)});
 if(r.action.handler==='creature-weapon:hit'){if(sameCard(m,p.target)&&m.cards[p.target.id].location===a.site.id){s.hit=true;a.hit=true;openWindow(m,'response',other(r.actor),{kind:'hit',target:p.target.id,weapon:p.weapon.id});}return;}
 if(r.action.handler==='creature-weapon:finish'){openWindow(m,'response',other(r.actor),{kind:'weapon-fired',serial:a.serial,weapon:p.weapon.id,target:p.target.id,hit:!!s.hit,total:s.total??null,defense:s.defense??null});return;}
 if(r.action.handler!=='creature-weapon:result')throw Error('Unknown creature weapon action.');
 s.draw=p.draw;s.total=p.total===null||p.total===undefined?null:p.total+weapons[m.cards[p.weapon.id].blueprint].bonus;s.defense=defenseValue(m,p.target.id);
 s.hit=false;queue('finish');
 if(s.total!==null&&s.total>s.defense&&sameCard(m,p.target)&&m.cards[p.target.id].location===a.site.id){queue('hit');openWindow(m,'response',other(r.actor),{kind:'about-to-hit',target:p.target.id,weapon:p.weapon.id});}
}
export function assertCreatureWeapons(m:Match):void{
 const ss=shots(m);if(!Array.isArray(ss))throw Error('Invalid creature shots.');
 if(new Set(ss.map(s=>[s.attack,s.weapon?.id,s.weapon?.version].join(':'))).size!==ss.length)throw Error('Duplicate creature firing record.');
 for(const s of ss){
  for(const r of [s.weapon,s.host,s.target]){assertCardReference(m,r);if(r.zone!=='table'&&!(r===s.host&&undercoverReference(m,r)))throw Error('Invalid shot reference zone.');}
  if(!supportedCreature(m,s.target.id)||cardDefinition(m,s.host.id).type!=='Character'||!weapons[m.cards[s.weapon.id].blueprint]||!sides.includes(s.side)||m.cards[s.weapon.id].owner!==s.side||m.cards[s.host.id].owner!==s.side||!Number.isSafeInteger(s.attack)||s.attack<1||s.attack>m.serial||s.draw!==undefined&&!validDraw(m,s.draw,s.side)||s.total!==undefined&&s.total!==null&&(!Number.isFinite(s.total)||s.total<0)||s.defense!==undefined&&(!Number.isFinite(s.defense)||s.defense<0)||s.hit!==undefined&&typeof s.hit!=='boolean')throw Error('Invalid creature shot record.');
 }
 for(const f of m.stack){
  if(f.kind==='window')continue;const h=f.kind==='resolution'?f.action.handler:f.handler,p=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {start?:unknown;next?:Action;side?:Side;source?:string;category?:string};const flow=(h==='destiny:value'?p.start:p) as typeof p;
  const forwarded=h.startsWith('destiny:')&&flow?.next?.handler.startsWith('creature-weapon:');if(!h.startsWith('creature-weapon:')&&!forwarded)continue;
  const act=forwarded?flow.next!:f.kind==='resolution'?f.action:undefined;if(!act)throw Error('Invalid creature weapon frame.');const data=act.payload as unknown as Payload,s=ss[data?.index],a=creatureAttack(m);
  if(!s||!a||a.serial!==data.serial||a.stage!=='weapons'||s.target.id!==a.slug.id||s.target.version!==a.slug.version||s.side!==a.shipSide||s.attack!==a.serial||act.id!==action(act.handler.slice(16),data).id||!['creature-weapon:fire','creature-weapon:result','creature-weapon:hit','creature-weapon:finish'].includes(act.handler)||act.source!==s.weapon.id||(f.kind==='resolution'?f.actor:f.side)!==s.side)throw Error('Invalid creature weapon binding.');
  for(const key of ['weapon','host','target'] as const){assertCardReference(m,data[key]);if(data[key].id!==s[key].id||data[key].version!==s[key].version||data[key].zone!==s[key].zone)throw Error('Invalid creature weapon target.');}
  if(forwarded&&(flow.category!=='weapon'||flow.side!==s.side||flow.source!==s.weapon.id||act.handler!=='creature-weapon:result'))throw Error('Invalid creature weapon destiny.');
  if(!forwarded&&act.handler==='creature-weapon:result'&&!validDraw(m,data.draw!,s.side))throw Error('Invalid creature weapon result.');
 }
}
