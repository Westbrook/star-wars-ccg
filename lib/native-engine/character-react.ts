import {laserGateAllowsPassage} from './laser-gate';
import {adjacent,cardDefinition,moveWithAttachments,name} from './board';
import {gameTextActive} from './game-text';
import {barred,canLandspeed,usage,record,registerReact,pendingReactSite,cancelDrainAfterReact} from './ground';
import {belowDecks,crewActive,roleAvailable,vesselRule,type AboardRole} from './occupancy';
import {battleHistory} from './battle';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {openWindow} from './runtime';
import {other,type Match,type Side,type Action,type Window,type Resolution,type Decision,type Json} from './types';

type Payload={characterReact:true;card:string;cardRef:CardReference;from:string;site:string;fromRef:CardReference;siteRef:CardReference;origin?:CardReference;previous?:AboardRole;target?:CardReference;role?:AboardRole;react?:true};
const data=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const roles:AboardRole[]=['pilot','driver','passenger'];
const key=(p:Payload)=>'react-move:'+p.card+':'+p.site;
const action=(step:string,p:Payload):Action=>({id:key(p),label:'React with '+p.card,handler:step==='move'?'ground:move':'character-react:'+step,source:p.card,payload:p as unknown as Json});
const live=(m:Match,p:Payload,site:string)=>sameCard(m,p.cardRef)&&sameCard(m,p.fromRef)&&sameCard(m,p.siteRef)&&m.cards[p.card].location===site&&!barred(m,p.card)&&crewActive(m,p.card);
const hosts=(m:Match,side:Side,site:string)=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.location===site&&!c.attachedTo&&vesselRule(m,c.id));
const boarding=(m:Match,p:Payload,side:Side)=>live(m,p,p.site)&&!m.cards[p.card].attachedTo?hosts(m,side,p.site).flatMap(c=>roles.filter(role=>roleAvailable(m,c.id,p.card,role)).map(role=>({id:'board:'+c.id+':'+role,label:'Embark '+name(m,p.card)+' on '+name(m,c.id)+' as '+role,host:c.id,role}))):[];
function push(m:Match,side:Side,p:Payload,step:string,respondable=false){m.stack.push({kind:'resolution',actor:side,cancelled:false,...(respondable?{awaitingResponses:true}:{}),action:action(step,p)});}
function depart(m:Match,side:Side,p:Payload){
 if(!live(m,p,p.from)||m.cards[p.card].attachedTo||!canLandspeed(m,p.card)||!adjacent(m,p.from,p.site)||!laserGateAllowsPassage(m,p.card,p.from,p.site))return;
 push(m,side,{...p,react:true},'move',true);
}
export function characterReactActions(m:Match,w:Window,side:Side):Action[]{
 const site=pendingReactSite(m,w,side);if(!site||!m.players[side].force.length)return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&c.blueprint==='1_30'&&gameTextActive(m,c.id)&&crewActive(m,c.id)&&!belowDecks(m,c.id)&&(!c.attachedTo||!!c.aboardRole)&&c.location&&adjacent(m,c.location,site)&&laserGateAllowsPassage(m,c.id,c.location,site)&&canLandspeed(m,c.id)&&!usage(m).reacted.includes(c.id)&&!battleHistory(m).participants.includes(c.id)).map(c=>{
  const p:Payload={characterReact:true,card:c.id,cardRef:referenceCard(m,c.id),from:c.location!,site,fromRef:referenceCard(m,c.location!),siteRef:referenceCard(m,site),...(c.attachedTo?{origin:referenceCard(m,c.attachedTo),previous:c.aboardRole}:{})};
  return {...action('begin',p),label:'React with '+name(m,c.id),payment:{[side]:1},unrespondable:true};
 });
}
export function characterReactInitiate(m:Match,r:Resolution){registerReact(m,data(r).card);}
export function characterReactResolve(m:Match,r:Resolution){
 const p=data(r),h=r.action.handler;if(r.cancelled)return;
 if(h==='character-react:begin'){
  if(!live(m,p,p.from))return;
  if(p.origin){if(sameCard(m,p.origin)&&m.cards[p.card].attachedTo===p.origin.id&&m.cards[p.card].aboardRole===p.previous)m.stack.push({kind:'decision',side:r.actor,handler:'character-react:exit',payload:p as unknown as Json});}
  else depart(m,r.actor,p);return;
 }
 if(h==='character-react:exit'){
  if(!live(m,p,p.from)||!p.origin||!sameCard(m,p.origin)||m.cards[p.card].attachedTo!==p.origin.id||m.cards[p.card].aboardRole!==p.previous)return;
  delete m.cards[p.card].attachedTo;delete m.cards[p.card].aboardRole;push(m,r.actor,p,'depart');
  openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card,from:p.from,site:p.from,capacity:true});return;
 }
 if(h==='character-react:depart'){depart(m,r.actor,p);return;}
 if(h==='ground:move'){
  if(!live(m,p,p.from)||m.cards[p.card].attachedTo||!canLandspeed(m,p.card)||!adjacent(m,p.from,p.site)||!laserGateAllowsPassage(m,p.card,p.from,p.site))return;
  moveWithAttachments(m,p.card,p.site);record(m).moved.push(p.card);push(m,r.actor,p,'arrival');cancelDrainAfterReact(m,r.actor,{react:true,card:p.card,site:p.site});
  openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card,from:p.from,site:p.site});return;
 }
 if(h==='character-react:arrival'){
  if(boarding(m,p,r.actor).length)m.stack.push({kind:'decision',side:r.actor,handler:'character-react:board',payload:p as unknown as Json});return;
 }
 if(h==='character-react:board'){
  if(!p.target||!sameCard(m,p.target)||!boarding(m,p,r.actor).some(c=>c.host===p.target!.id&&c.role===p.role))return;
  m.cards[p.card].attachedTo=p.target.id;m.cards[p.card].aboardRole=p.role;
  openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card,from:p.site,site:p.site,capacity:true});return;
 }
 throw Error('Unknown character react continuation.');
}
export function characterReactChoices(m:Match,d:Decision){const p=data(d);return d.handler==='character-react:exit'?[
 {id:'disembark',label:'Disembark '+name(m,p.card)+' before reacting'},
]:[...boarding(m,p,d.side).map(({id,label})=>({id,label})),{id:'finish-react',label:'Finish reaction on the ground'}];}
export function characterReactChoose(m:Match,d:Decision,id:string){
 const p=data(d);if(id==='finish-react')return;
 if(d.handler==='character-react:exit'){
  push(m,d.side,p,'exit');openWindow(m,'response',other(d.side),{kind:'disembarking',card:p.card,host:p.origin!.id,site:p.from});return;
 }
 const c=boarding(m,p,d.side).find(c=>c.id===id);if(!c)throw Error('Invalid character react boarding.');
 push(m,d.side,{...p,target:referenceCard(m,c.host),role:c.role},'board');openWindow(m,'response',other(d.side),{kind:'embarking',card:p.card,host:c.host,site:p.site});
}
export function characterReactView(m:Match){
 const f=[...m.stack].reverse().find(f=>f.kind!=='window'&&(f.kind==='decision'?f.payload:f.action.payload) && (data(f) as Payload).characterReact);
 if(!f||f.kind==='window')return {characterReact:null};const p=data(f),h=f.kind==='decision'?f.handler:f.action.handler;
 return {characterReact:{name:name(m,p.card),from:name(m,p.from),to:name(m,p.site),stage:h.endsWith(':exit')?'disembarking':['character-react:arrival','character-react:board'].includes(h)?'arrival':'moving'}};
}
export function assertCharacterReact(m:Match){
 for(const f of m.stack){if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler,p=data(f);
  if(!h.startsWith('character-react:')&&!(h==='ground:move'&&p?.characterReact))continue;
  if(!p||p.characterReact!==true||m.cards[p.card]?.blueprint!=='1_30'||m.cards[p.card]?.owner!==(f.kind==='decision'?f.side:f.actor)||!['character-react:begin','character-react:exit','character-react:depart','character-react:arrival','character-react:board','ground:move'].includes(h)||f.kind==='decision'&&!['character-react:exit','character-react:board'].includes(h))throw Error('Invalid character react continuation.');
  for(const [ref,id] of [[p.cardRef,p.card],[p.fromRef,p.from],[p.siteRef,p.site]] as const){assertCardReference(m,ref,id);if(ref.zone!=='table')throw Error('Invalid character react reference.');}
  if(p.from===p.site||[p.from,p.site].some(id=>cardDefinition(m,id).subType!=='Site')||!usage(m).reacted.includes(p.card))throw Error('Invalid character react route.');
  for(const ref of [p.origin,p.target])if(ref){assertCardReference(m,ref);if(ref.zone!=='table'||!vesselRule(m,ref.id)||m.cards[ref.id].owner!==m.cards[p.card].owner)throw Error('Invalid character react host.');}
  if(!!p.origin!==!!p.previous||p.previous&&!roles.includes(p.previous)||!!p.target!==!!p.role||p.role&&!roles.includes(p.role)||p.target&&h!=='character-react:board'||h==='character-react:exit'&&!p.origin||['ground:move','character-react:arrival','character-react:board'].includes(h)&&p.react!==true)throw Error('Invalid character react stage.');
  if(f.kind==='resolution'&&(f.action.id!==key(p)||f.action.source!==p.card))throw Error('Invalid character react action.');
 }
}
