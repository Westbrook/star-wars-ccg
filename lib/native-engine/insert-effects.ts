import {registerAnger} from './anger';
import {name} from './board';
import {preventActivation} from './activation';
import {deployed} from './deployment';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {insertsIn, reserveInserts, topInsert, revealInsert} from './reserve-inserts';
import {insertCard, moveCard} from './state';
import {openWindow, type Context} from './runtime';
import {other, sides, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';
const onceOnly=['1_42','1_208'];
const blueprints=[...onceOnly,'4_16'];
type Payload={card:string;side:Side;ref?:CardReference};
type Reveal={ref:CardReference;side:Side};
const used=(m:Match):string[] => (m.data.insertPlays??[]) as string[];
const action=(step:string,p:Payload):Action=>({id:'insert:'+step+':'+p.card,handler:'insert:'+step,source:p.card,label:'Resolve '+nameFromPayload(step),payload:p as unknown as Json});
const nameFromPayload=(step:string)=>step==='deploy'?'insert deployment':'revealed insert';
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
export function insertActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='deploy'||m.turn.side!==side||m.players[other(side)].reserve.length<2)return [];
 return m.players[side].hand.filter(id=>blueprints.includes(m.cards[id].blueprint)&&!used(m).includes(m.cards[id].blueprint)).map(card=>({...action('deploy',{card,side:other(side)}),label:'Insert '+name(m,card)+' into opponent’s Reserve'}));
}
export function insertInitiate(m:Match,r:Resolution):void{
 if(r.action.handler!=='insert:deploy')return;
 const p=r.action.payload as Payload,bp=m.cards[p.card].blueprint;
 if(onceOnly.includes(bp)){if(used(m).includes(bp))throw Error('Insert already deployed this game.');m.data.insertPlays=[...used(m),bp];}
 moveCard(m,p.card,'playing');
}
function beginReveal(m:Match,x:Reveal):void{
 queue(m,'result',{card:x.ref.id,side:x.side,ref:x.ref});
 openWindow(m,'response',other(m.cards[x.ref.id].owner),{kind:'insert-revealed',card:x.ref.id,side:x.side,cardRef:x.ref} as unknown as Json);
}
/** Interpose before suspended gameplay resumes. Newly exposed inserts during a
 * response may nest; adjacent inserts wait for the physical top one to leave. */
export function scheduleInserts(m:Match):boolean{
 const exposed=sides.map(side=>({side,insert:topInsert(m,side)})).filter(x=>x.insert&&!x.insert.revealed);
 if(!exposed.length)return false;
 for(const x of exposed)if(!blueprints.includes(m.cards[x.insert!.card.id].blueprint))throw Error('Unimplemented insert reveal effect.');
 const candidates=exposed.map(x=>({side:x.side,ref:revealInsert(m,x.side)!}));
 if(candidates.length===1)beginReveal(m,candidates[0]);
 else m.stack.push({kind:'decision',side:m.turn.side,handler:'insert:order',payload:{candidates} as unknown as Json});
 return true;
}
export function insertResolve(m:Match,r:Resolution,context:Context):void{
 const p=r.action.payload as Payload,h=r.action.handler;
 if(h==='insert:deploy'){
  if(r.cancelled||m.players[p.side].reserve.length<2||!canEnterTable(m,p.card)){moveCard(m,p.card,'lost');return;}
  insertCard(m,p.card,p.side,context.entropy);deployed(m,p.card);return;
 }
 if(r.cancelled){
  if(h==='insert:result'&&sameCard(m,p.ref!)&&insertsIn(m,p.side).some(x=>x.card.id===p.card&&x.revealed)){moveCard(m,p.card,'lost');openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:[p.card]});}
  return;
 }
 if(h==='insert:result'){
  if(!sameCard(m,p.ref!)||!insertsIn(m,p.side).some(x=>x.card.id===p.card&&x.revealed))return;
  // Revealed inserts are lost first. Loss responses finish before the
  // activation restriction or delayed battle obligation takes effect.
  queue(m,'restrict',p);moveCard(m,p.card,'lost');openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:[p.card]});
 }else if(h==='insert:restrict'){if(m.cards[p.card].blueprint==='4_16')registerAnger(m,p.ref!,p.side);else preventActivation(m,p.card,p.side);}
 else throw Error('Unknown insert continuation.');
}
export function insertChoices(m:Match,d:Decision){
 const p=d.payload as unknown as {candidates:Reveal[]};return p.candidates.map(x=>({id:'insert:first:'+x.ref.id,label:'Resolve '+name(m,x.ref.id)+' first'}));
}
export function insertChoose(m:Match,d:Decision,id:string):void{
 if(!insertChoices(m,d).some(c=>c.id===id))throw Error('Invalid insert order.');
 const all=(d.payload as unknown as {candidates:Reveal[]}).candidates,first=all.find(x=>'insert:first:'+x.ref.id===id)!;
 // Selected result is topmost. The other exposed result keeps its response
 // window and only resumes after this complete result (including nested work).
 for(const x of [...all.filter(x=>x!==first),first])beginReveal(m,x);
}
export function assertInsertEffects(m:Match):void{
 if(m.data.insertPlays!==undefined&&(!Array.isArray(m.data.insertPlays)||new Set(used(m)).size!==used(m).length||used(m).some(x=>!onceOnly.includes(x))))throw Error('Invalid insert play history.');
 for(const f of m.stack){
  const h=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!h.startsWith('insert:'))continue;
  if(f.kind==='decision'){
   const p=f.payload as unknown as {candidates:Reveal[]};if(h!=='insert:order'||f.side!==m.turn.side||!Array.isArray(p?.candidates)||p.candidates.length!==2||new Set(p.candidates.map(x=>x.side)).size!==2)throw Error('Invalid insert ordering.');
   for(const x of p.candidates){assertCardReference(m,x.ref);if(!sides.includes(x.side)||!insertsIn(m,x.side).some(y=>y.revealed&&y.card.id===x.ref.id&&sameCard(m,x.ref)))throw Error('Invalid exposed insert.');}continue;
  }
  if(f.kind!=='resolution')throw Error('Invalid insert frame.');
  const p=f.action.payload as unknown as Payload;
  if(!p||!blueprints.includes(m.cards[p.card]?.blueprint)||!sides.includes(p.side)||p.side!==other(m.cards[p.card].owner)||f.actor!==m.cards[p.card].owner||f.action.source!==p.card||f.action.id!==action(h.slice(7),p).id||!['insert:deploy','insert:result','insert:restrict'].includes(h))throw Error('Invalid insert resolution.');
  if(h==='insert:deploy'){if(m.cards[p.card].zone!=='playing'||onceOnly.includes(m.cards[p.card].blueprint)&&!used(m).includes(m.cards[p.card].blueprint))throw Error('Invalid insert deployment.');}
  else{assertCardReference(m,p.ref!,p.card);if(p.ref!.zone!=='table'||f.awaitingResponses||f.action.payment)throw Error('Invalid insert result.');}
 }
 for(const x of reserveInserts(m))if(blueprints.includes(m.cards[x.card.id].blueprint)){
  if(x.side!==other(m.cards[x.card.id].owner))throw Error('Insert in the wrong Reserve.');
  if(x.revealed){
   // A shuffle changes physical depth, never the already-started resolution.
   // A recovered revealed flag must still have exactly one bound continuation.
   const bindings=m.stack.flatMap(f=>f.kind==='resolution'&&f.action.handler==='insert:result'?[f.action.payload as unknown as Payload]:f.kind==='decision'&&f.handler==='insert:order'?(f.payload as unknown as {candidates:Reveal[]}).candidates.map(c=>({card:c.ref.id,ref:c.ref,side:c.side})):[]);
   if(bindings.filter(p=>p.side===x.side&&p.ref?.id===x.card.id&&p.ref.version===x.card.version).length!==1)throw Error('Revealed insert needs its bound continuation.');
  }
 }
}
