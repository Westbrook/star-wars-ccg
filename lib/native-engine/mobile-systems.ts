import {premiereSystems} from './premiere-setup';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canMove,barred,record} from './ground';
import {openWindow} from './runtime';
import {other,type Match,type Side,type Window,type Action,type Resolution,type Json} from './types';

type Position={parsec:number;orbit:string|null};
type SavedPosition=Position&{card:CardReference};
type Payload={card:CardReference;from:Position;to:Position;target?:CardReference};
const positions=(m:Match)=>(m.data.mobileSystems??{}) as unknown as Record<string,SavedPosition>;
export const mobileSystem=(m:Match,id:string)=>!!premiereSystems[m.cards[id]?.blueprint]?.mobile;
/** Orbit identities survive conversion of the orbited system card. */
export function systemPosition(m:Match,id:string):Position|null{
 const def=premiereSystems[m.cards[id]?.blueprint];if(!def)return null;
 const p=positions(m)[id];return def.mobile&&p&&sameCard(m,p.card)?{parsec:p.parsec,orbit:p.orbit}:{parsec:def.parsec,orbit:null};
}
export const orbitTransfer=(m:Match,from:string,to:string)=>!!systemPosition(m,from)?.orbit&&systemPosition(m,from)!.orbit===premiereSystems[m.cards[to]?.blueprint]?.system||!!systemPosition(m,to)?.orbit&&systemPosition(m,to)!.orbit===premiereSystems[m.cards[from]?.blueprint]?.system;
function destinations(m:Match,id:string):Position[]{
 const from=systemPosition(m,id)!,speed=premiereSystems[m.cards[id].blueprint].hyperspeed??0,out:Position[]=[];
 if(speed<1)return out;
 for(let parsec=Math.max(0,from.parsec-speed);parsec<=Math.min(99,from.parsec+speed);parsec++){
  if(parsec!==from.parsec||from.orbit!==null)out.push({parsec,orbit:null});
  for(const target of m.locations){const d=premiereSystems[m.cards[target].blueprint];if(target!==id&&d&&systemPosition(m,target)?.parsec===parsec&&!(from.parsec===parsec&&from.orbit===d.system))out.push({parsec,orbit:d.system});}
 }
 return out;
}
const label=(p:Position)=>'parsec '+p.parsec+' · '+(p.orbit?'orbit '+p.orbit:'deep space');
const make=(p:Payload):Action=>({id:'mobile:move:'+p.card.id+':'+p.to.parsec+':'+(p.to.orbit??'deep'),handler:'mobile:begin',source:p.card.id,label:'Move Death Star to '+label(p.to),payload:p as unknown as Json,payment:{dark:1}});
export function mobileActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark'||m.turn.side!==side||m.turn.phase!=='move'||w.timing!=='phase')return [];
 return m.locations.filter(id=>mobileSystem(m,id)&&canMove(m,id)).flatMap(id=>destinations(m,id).map(to=>{
  const target=to.orbit?m.locations.find(at=>premiereSystems[m.cards[at].blueprint]?.system===to.orbit):undefined;
  return make({card:referenceCard(m,id),from:systemPosition(m,id)!,to,...(target?{target:referenceCard(m,target)}:{})});
 }));
}
export function mobileResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;
 if(r.cancelled||!sameCard(m,p.card)||!m.locations.includes(p.card.id)||barred(m,p.card.id))return;
 const current=systemPosition(m,p.card.id);if(!current||current.parsec!==p.from.parsec||current.orbit!==p.from.orbit||p.target&&(!sameCard(m,p.target)||systemPosition(m,p.target.id)?.parsec!==p.to.parsec))return;
 if(r.action.handler==='mobile:begin'){
  if(!canMove(m,p.card.id)||!destinations(m,p.card.id).some(to=>to.parsec===p.to.parsec&&to.orbit===p.to.orbit))return;
  record(m).moved.push(p.card.id);const next=make(p);delete next.payment;next.handler='mobile:arrive';m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:next});
  openWindow(m,'response',other(r.actor),{kind:'mobile-moving',card:p.card.id,from:p.from as unknown as Json,to:p.to as unknown as Json});return;
 }
 if(r.action.handler!=='mobile:arrive')throw Error('Unknown mobile-system movement.');
 const map={...positions(m),[p.card.id]:{card:p.card,...p.to}};
 // Orbiting mobile systems are carried too; their own regular moves are untouched.
 const carried=new Set([premiereSystems[m.cards[p.card.id].blueprint].system]);let added=true;
 while(added){added=false;for(const id of m.locations){const pos=systemPosition(m,id),name=premiereSystems[m.cards[id].blueprint]?.system;if(mobileSystem(m,id)&&pos?.orbit&&carried.has(pos.orbit)&&!carried.has(name)){map[id]={card:referenceCard(m,id),...pos,parsec:p.to.parsec};carried.add(name);added=true;}}}
 m.data.mobileSystems=map as unknown as Json;
 openWindow(m,'response',other(r.actor),{kind:'mobile-moved',card:p.card.id,from:p.from as unknown as Json,to:p.to as unknown as Json});
}
const validPosition=(p:Position)=>!!p&&Number.isSafeInteger(p.parsec)&&p.parsec>=0&&p.parsec<=99&&(p.orbit===null||typeof p.orbit==='string');
export function assertMobileSystems(m:Match):void{
 if(m.data.mobileSystems!==undefined&&(!m.data.mobileSystems||typeof m.data.mobileSystems!=='object'||Array.isArray(m.data.mobileSystems)))throw Error('Invalid mobile-system positions.');
 for(const [id,p] of Object.entries(positions(m))){
  if(!mobileSystem(m,id)||!validPosition(p))throw Error('Invalid mobile-system position.');assertCardReference(m,p.card,id);if(p.card.zone!=='table')throw Error('Invalid mobile-system instance.');
  if(sameCard(m,p.card)&&p.orbit&&!m.locations.some(at=>at!==id&&premiereSystems[m.cards[at].blueprint]?.system===p.orbit&&systemPosition(m,at)?.parsec===p.parsec))throw Error('Invalid mobile-system orbit.');
 }
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('mobile:')){
  const p=f.action.payload as unknown as Payload;
  if(!p||!['mobile:begin','mobile:arrive'].includes(f.action.handler)||f.actor!=='dark'||!validPosition(p.from)||!validPosition(p.to)||!mobileSystem(m,p.card?.id)||f.action.source!==p.card.id||f.action.id!==make(p).id||Math.abs(p.from.parsec-p.to.parsec)>1||p.from.parsec===p.to.parsec&&p.from.orbit===p.to.orbit)throw Error('Invalid mobile-system continuation.');
  assertCardReference(m,p.card);if(p.card.zone!=='table'||!!p.target!==!!p.to.orbit)throw Error('Invalid mobile-system target.');
  if(p.target){assertCardReference(m,p.target);if(p.target.zone!=='table'||p.target.id===p.card.id||premiereSystems[m.cards[p.target.id].blueprint]?.system!==p.to.orbit)throw Error('Invalid mobile-system destination.');}
 }
}
export function mobileView(m:Match){const frame=m.stack.find(f=>f.kind==='resolution'&&f.action.handler.startsWith('mobile:'));const p=frame?.kind==='resolution'?frame.action.payload as unknown as Payload:null;return {mobileMovement:p?{from:label(p.from),to:label(p.to)}:null,systems:Object.fromEntries(m.locations.filter(id=>systemPosition(m,id)).map(id=>[id,{...systemPosition(m,id)!,mobile:mobileSystem(m,id)}]))};}
