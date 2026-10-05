import {cardDefinition,name,moveWithAttachments,system} from './board';
import {gameTextActive} from './game-text';
import {barred,canMove,usage,record,registerReact,pendingReactSite,cancelDrainAfterReact} from './ground';
import {vesselRoutes} from './vessel-travel';
import {occupants,roleAvailable,crewActive,type AboardRole} from './occupancy';
import {battleHistory,members} from './battle';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {openWindow} from './runtime';
import {other,type Match,type Side,type Action,type Window,type Resolution,type Decision,type Json} from './types';

type ReactMove={card:string;cardRef:CardReference;path:CardReference[];index:number;cost:number;participants:string[];react?:boolean;crew?:{ref:CardReference;before:boolean;role?:AboardRole;previous?:AboardRole}};
const payload=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as ReactMove;
const action=(step:string,p:ReactMove):Action=>({id:'vehicle-react:'+p.card+':'+p.path.at(-1)!.id,handler:'vehicle-react:'+step,source:p.card,label:'React with vehicle',payload:p as unknown as Json});
const alive=(m:Match,p:ReactMove)=>sameCard(m,p.cardRef)&&p.path.every(r=>sameCard(m,r))&&!m.cards[p.card].attachedTo&&m.cards[p.card].location===p.path[p.index].id&&!barred(m,p.card);
const routeValid=(m:Match,p:ReactMove)=>alive(m,p)&&vesselRoutes(m,p.card).some(r=>r.method==='landspeed'&&r.path.join('|')===p.path.slice(p.index).map(r=>r.id).join('|'));
// Carried passengers join the current battle on arrival. That participation
// must not erase the react's explicit permission to disembark just afterward.
const eligible=(m:Match,id:string,arrived=false)=>!usage(m).reacted.includes(id)&&(!battleHistory(m).participants.includes(id)||arrived&&members(m,m.cards[id].owner).includes(id))&&!barred(m,id)&&crewActive(m,id);
export function vehicleReactActions(m:Match,w:Window,side:Side):Action[]{
 if(m.turn.side===side)return [];
 const site=pendingReactSite(m,w,side);if(!site)return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&(c.blueprint!=='3_69'||system(m,site)==='Hoth')&&['1_148','1_308','1_149','1_151','1_310','3_69'].includes(c.blueprint)&&gameTextActive(m,c.id)&&canMove(m,c.id)&&eligible(m,c.id)).flatMap(c=>vesselRoutes(m,c.id).filter(r=>r.method==='landspeed'&&r.path.at(-1)===site&&r.cost<=m.players[side].force.length).map(r=>{
  const p:ReactMove={card:c.id,cardRef:referenceCard(m,c.id),path:r.path.map(id=>referenceCard(m,id)),index:0,cost:r.cost,participants:[c.id]};
  return {...action('begin',p),label:'React with '+name(m,c.id)+' to '+name(m,site)+' · '+(r.cost?r.cost+' Force':'free'),payment:{[side]:r.cost},unrespondable:true};
 }));
}
export function vehicleReactInitiate(m:Match,r:Resolution){if(r.action.handler==='vehicle-react:begin')registerReact(m,payload(r).card);}
function resume(m:Match,side:Side,p:ReactMove,step:string){m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action(step,p)});}
type CrewChoice={id:string;label:string;card:string;role?:AboardRole};
function crewChoices(m:Match,p:ReactMove,side:Side,before:boolean):CrewChoice[]{
 if(!alive(m,p))return [];
 const candidates=before?Object.values(m.cards).filter(c=>c.zone==='table'&&!c.attachedTo&&c.location===p.path[0].id):occupants(m,p.card);
 return candidates.filter(c=>c.owner===side&&cardDefinition(m,c.id).type==='Character'&&!barred(m,c.id)&&crewActive(m,c.id)&&(p.participants.includes(c.id)||eligible(m,c.id,!before))).flatMap(c=>before?(['pilot','driver','passenger'] as AboardRole[]).filter(role=>roleAvailable(m,p.card,c.id,role)).map(role=>({id:'board:'+c.id+':'+role,label:'Embark '+name(m,c.id)+' as '+role,card:c.id,role})):[{id:'exit:'+c.id,label:'Disembark '+name(m,c.id)+' at '+name(m,p.path.at(-1)!.id),card:c.id}]);
}
function crewWindow(m:Match,side:Side,p:ReactMove,before:boolean){
 if(!alive(m,p))return;
 if(crewChoices(m,p,side,before).length)m.stack.push({kind:'decision',side,handler:'vehicle-react:'+(before?'board':'exit'),payload:p as unknown as Json});
 else if(before)depart(m,side,p);
}
function depart(m:Match,side:Side,p:ReactMove){
 if(!routeValid(m,p))return;
 // Sense answers the regular movement after paid pre-departure boarding.
 p.react=true;m.stack.push({kind:'resolution',actor:side,cancelled:false,awaitingResponses:true,action:action('move',p)});
}
export function vehicleReactResolve(m:Match,r:Resolution){
 const p=payload(r),h=r.action.handler;if(r.cancelled||!alive(m,p))return;
 if(h==='vehicle-react:begin'||h==='vehicle-react:board'){crewWindow(m,r.actor,p,true);return;}
 if(h==='vehicle-react:exit'){crewWindow(m,r.actor,p,false);return;}
 if(h==='vehicle-react:crew'){
  const crew=p.crew!,c=m.cards[crew.ref.id],choice=crewChoices(m,p,r.actor,crew.before).find(x=>x.card===c.id&&x.role===crew.role);
  const valid=sameCard(m,crew.ref)&&!!choice&&(crew.before||c.aboardRole===crew.previous);delete p.crew;
  resume(m,r.actor,p,crew.before?'board':'exit');
  if(!valid)return;
  if(crew.before){c.attachedTo=p.card;c.aboardRole=crew.role;}else{delete c.attachedTo;delete c.aboardRole;}
  openWindow(m,'response',other(r.actor),{kind:'moved',card:c.id,from:c.location!,site:c.location!,capacity:true});return;
 }
 if(h==='vehicle-react:move'){
  if(!routeValid(m,p))return;record(m).moved.push(p.card);resume(m,r.actor,p,'step');
  openWindow(m,'response',other(r.actor),{kind:'vessel-moving',card:p.card,from:p.path[0].id,site:p.path.at(-1)!.id,method:'landspeed',react:true});return;
 }
 if(h!=='vehicle-react:step')throw Error('Unknown vehicle react continuation.');
 if(!routeValid(m,p))return;
 const from=p.path[p.index].id,to=p.path[++p.index].id;moveWithAttachments(m,p.card,to);const complete=p.index===p.path.length-1;
 resume(m,r.actor,p,complete?'exit':'step');
 if(complete)cancelDrainAfterReact(m,r.actor,{react:true,card:p.card,site:to});
 openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card,from,site:to,method:'landspeed',react:true,initial:p.index===1,complete});
}
export function vehicleReactChoices(m:Match,d:Decision){const p=payload(d),before=d.handler==='vehicle-react:board';return [...crewChoices(m,p,d.side,before).map(({id,label})=>({id,label})),{id:'continue-react',label:before?'Finish boarding and react':'Finish disembarking'}];}
export function vehicleReactChoose(m:Match,d:Decision,id:string){
 const p=payload(d),before=d.handler==='vehicle-react:board';
 if(id==='continue-react'){if(before)depart(m,d.side,p);return;}
 const choice=crewChoices(m,p,d.side,before).find(c=>c.id===id);if(!choice)throw Error('Invalid react crew movement.');
 const c=m.cards[choice.card];
 if(!p.participants.includes(c.id))p.participants.push(c.id);registerReact(m,c.id);
 p.crew={ref:referenceCard(m,c.id),before,...(before?{role:choice.role}:{previous:c.aboardRole})};
 resume(m,d.side,p,'crew');
 openWindow(m,'response',other(d.side),{kind:before?'embarking':'disembarking',card:c.id,host:p.card,site:c.location!});
}
export function vehicleReactView(m:Match){
 const f=[...m.stack].reverse().find(f=>f.kind!=='window'&&(f.kind==='decision'?f.handler:f.action.handler).startsWith('vehicle-react:'));
 if(!f||f.kind==='window')return {vehicleReact:null};const p=payload(f),h=f.kind==='decision'?f.handler:f.action.handler;
 return {vehicleReact:{name:name(m,p.card),from:name(m,p.path[0].id),to:name(m,p.path.at(-1)!.id),cost:p.cost,stage:h.endsWith(':exit')||p.crew&&!p.crew.before?'arrival':h.endsWith(':begin')||h.endsWith(':board')||p.crew?.before?'boarding':'moving'}};
}
export function assertVehicleReact(m:Match){
 let count=0;for(const f of m.stack){if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('vehicle-react:'))continue;
  const p=payload(f),side=f.kind==='decision'?f.side:f.actor;
  if(++count>1||!['begin','board','move','step','exit','crew'].some(s=>h==='vehicle-react:'+s)||f.kind==='decision'&&!['vehicle-react:board','vehicle-react:exit'].includes(h)||!p||m.cards[p.card]?.owner!==side||!['1_148','1_308','1_149','1_151','1_310','3_69'].includes(m.cards[p.card].blueprint))throw Error('Invalid vehicle react continuation.');
  assertCardReference(m,p.cardRef,p.card);if(p.cardRef.zone!=='table'||!Array.isArray(p.path)||p.path.length<2||!Number.isSafeInteger(p.index)||p.index<0||p.index>=p.path.length||![0,1].includes(p.cost)||!Array.isArray(p.participants)||p.participants[0]!==p.card||new Set(p.participants).size!==p.participants.length||p.participants.some(id=>m.cards[id]?.owner!==side||!usage(m).reacted.includes(id)))throw Error('Invalid vehicle react history.');
  for(const ref of p.path){assertCardReference(m,ref);if(ref.zone!=='table'||cardDefinition(m,ref.id).subType!=='Site')throw Error('Invalid vehicle react route.');}
  if(new Set(p.path.map(r=>r.id)).size!==p.path.length||['vehicle-react:begin','vehicle-react:board','vehicle-react:move'].includes(h)&&p.index!==0||h==='vehicle-react:step'&&p.index>=p.path.length-1||h==='vehicle-react:exit'&&p.index!==p.path.length-1||['vehicle-react:move','vehicle-react:step','vehicle-react:exit'].includes(h)&&p.react!==true)throw Error('Invalid vehicle react stage.');
  if(h==='vehicle-react:crew'){const c=p.crew;if(!c||typeof c.before!=='boolean'||!p.participants.includes(c.ref?.id)||c.before&&(!['pilot','driver','passenger'].includes(c.role!)||p.index!==0)||!c.before&&(!['pilot','driver','passenger'].includes(c.previous!)||p.index!==p.path.length-1))throw Error('Invalid react crew continuation.');assertCardReference(m,c.ref);if(c.ref.zone!=='table'||m.cards[c.ref.id].owner!==side||cardDefinition(m,c.ref.id).type!=='Character')throw Error('Invalid react crew source.');}else if(p.crew)throw Error('Unexpected react crew continuation.');
  if(f.kind==='resolution'&&(f.action.source!==p.card||f.action.id!==action('',p).id))throw Error('Invalid vehicle react identity.');
 }
}
