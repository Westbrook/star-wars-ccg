import {sectorPaths,landingEndpoint,sectorKind,locationGroup,isCave,caveSector} from './sectors';
import {hasNavigation,vesselHyperspeed} from './piloting';
import {systemPosition,orbitTransfer} from './mobile-systems';
import {cardDefinition} from './definitions';
import {movesFree} from './movement-costs';
import {adjacent,moveWithAttachments,name,system} from './board';
import {barred,canMove,record} from './ground';
import {vesselRule,occupants,operational,pilotAboard,capital} from './occupancy';
import {premiereSystems} from './premiere-setup';
import {bayCosts} from './travel';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {other,type Match,type Side,type Window,type Action,type Resolution,type Json} from './types';

type Method='sector'|'landspeed'|'hyperspace'|'orbit'|'land'|'takeoff';
type Route={method:Method;path:string[];cost:number};
type Payload={card:CardReference;path:CardReference[];method:Method;index:number;cost:number};
const exterior=(m:Match,id:string)=>cardDefinition(m,id).subType==='Site'&&(cardDefinition(m,id).icons as string[]).includes('Exterior');
const stat=(m:Match,id:string,key:string)=>Number((cardDefinition(m,id).stats as Record<string,string>)[key]??0);
export function vehicleDestination(m:Match,id:string,to:string):boolean{
 if(!exterior(m,to))return false;
 // Both printed Sandcrawlers prohibit nonplanet/mobile destinations.
 return !['1_150','1_309'].includes(m.cards[id].blueprint)||(cardDefinition(m,to).icons as string[]).includes('Planet');
}
export function vesselRoutes(m:Match,id:string):Route[]{
 const c=m.cards[id];if(!c||c.zone!=='table'||!c.location||c.attachedTo||!vesselRule(m,id)||barred(m,id))return [];
 const from=c.location,d=cardDefinition(m,id),out:Route[]=[];
 if(d.type==='Vehicle'){
  if(!operational(m,id))return [];
  for(const direction of [-1,1]){const path=[from];let previous=from;
   for(let n=1;n<=stat(m,id,'landspeed');n++){const to=m.locations[m.locations.indexOf(from)+direction*n];if(!to||!adjacent(m,previous,to)||!vehicleDestination(m,id,to))break;path.push(to);out.push({method:'landspeed',path:[...path],cost:movesFree(m,id)?0:1});previous=to;}
  }return out;
 }
 if(operational(m,id))for(const path of sectorPaths(m,id,from))out.push({method:'sector',path,cost:1});
 const origin=premiereSystems[m.cards[from].blueprint];
 if(origin&&operational(m,id)){
  if(hasNavigation(m,id)&&(vesselHyperspeed(m,id)??0)>0)for(const to of m.locations){const target=systemPosition(m,to);if(to!==from&&target&&Math.abs(systemPosition(m,from)!.parsec-target.parsec)<=(vesselHyperspeed(m,id)??0))out.push({method:'hyperspace',path:[from,to],cost:1});}
  for(const to of m.locations)if(to!==from&&orbitTransfer(m,from,to))out.push({method:'orbit',path:[from,to],cost:1});
 }
 if(operational(m,id)&&!capital(m,id)&&!['1_305','1_300','1_299'].includes(c.blueprint))for(const to of m.locations.filter(to=>isCave(m,to)&&caveSector(m,to)===from))out.push({method:'land',path:[from,to],cost:1});
 if(isCave(m,from)&&pilotAboard(m,id)&&caveSector(m,from))out.push({method:'takeoff',path:[from,caveSector(m,from)!],cost:1});
 if(operational(m,id)&&(origin||sectorKind(m,from))&&landingEndpoint(m,locationGroup(m,from)!)===from){
  if(!capital(m,id))for(const to of m.locations.filter(to=>exterior(m,to)&&system(m,to)===locationGroup(m,from))){
   const bay=bayCosts[m.cards[to].blueprint]!==undefined;
   if(['1_305','1_300','1_299'].includes(m.cards[id].blueprint)&&!bay)continue;
   out.push({method:'land',path:[from,to],cost:bay?0:1});
  }
 }else if(!isCave(m,from)&&exterior(m,from)&&pilotAboard(m,id)){
  for(const to of m.locations.filter(to=>landingEndpoint(m,system(m,from)!)===to))out.push({method:'takeoff',path:[from,to],cost:bayCosts[m.cards[from].blueprint]!==undefined?0:1});
 }
 return out;
}
const routeId=(p:Payload)=>'voyage:'+p.method+':'+p.card.id+':'+p.path.at(-1)!.id;
const make=(p:Payload):Action=>({id:routeId(p),handler:'voyage:begin',source:p.card.id,payload:p as unknown as Json,label:'Move vessel'});
/** Shared regular movement action, including moves granted outside Move phase. */
export function vesselMovementAction(m:Match,id:string,r:Route):Action {
 const p:Payload={card:referenceCard(m,id),path:r.path.map(id=>referenceCard(m,id)),method:r.method,index:0,cost:r.cost};
 return {...make(p),payment:{[m.cards[id].owner]:r.cost}};
}
export function vesselTravelActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='move')return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&canMove(m,c.id)).flatMap(c=>vesselRoutes(m,c.id).filter(r=>r.cost<=m.players[side].force.length).map(r=>{
  const p:Payload={card:referenceCard(m,c.id),path:r.path.map(id=>referenceCard(m,id)),method:r.method,index:0,cost:r.cost};
  const verb={sector:'Move',landspeed:'Move',hyperspace:'Hyperspace',orbit:'Transfer',land:'Land',takeoff:'Take off with'}[r.method];
  return {...make(p),label:verb+' '+name(m,c.id)+' to '+name(m,r.path.at(-1)!)+(r.path.length>2?' via '+r.path.slice(1,-1).map(id=>name(m,id)).join(', '):'')+' · '+(r.cost?r.cost+' Force':'free'),payment:{[side]:r.cost}};
 }));
}
const stillRoute=(m:Match,p:Payload)=>sameCard(m,p.card)&&p.path.every(r=>sameCard(m,r))&&m.cards[p.card.id].location===p.path[p.index].id&&!barred(m,p.card.id);
function continueMove(m:Match,r:Resolution,p:Payload){m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:{...make(p),handler:'voyage:step'}});}
export function vesselTravelResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;if(r.cancelled||!stillRoute(m,p))return;
 if(r.action.handler==='voyage:begin'){
  if(!canMove(m,p.card.id)||!vesselRoutes(m,p.card.id).some(x=>x.method===p.method&&x.path.join('|')===p.path.map(x=>x.id).join('|')))return;
  record(m).moved.push(p.card.id);continueMove(m,r,p);
  openWindow(m,'response',other(r.actor),{kind:'vessel-moving',card:p.card.id,from:p.path[0].id,site:p.path.at(-1)!.id,method:p.method});return;
 }
 if(r.action.handler!=='voyage:step')throw Error('Unknown vessel travel continuation.');
 const next=p.path[p.index+1].id;
 // Hyperspace range is checked when the move begins. Its moving response
 // cannot retroactively revoke an initiated route by reducing hyperspeed.
 if(p.method!=='hyperspace'&&!vesselRoutes(m,p.card.id).some(x=>x.method===p.method&&x.path.includes(next)))return;
 const from=p.path[p.index].id;moveWithAttachments(m,p.card.id,next);p.index++;
 const complete=p.index===p.path.length-1;if(!complete)continueMove(m,r,p);
 openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card.id,from,site:next,method:p.method,initial:p.index===1,complete});
}
export function assertVesselTravel(m:Match):void{
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('voyage:')){
  const p=f.action.payload as unknown as Payload;
  if(!p||!['voyage:begin','voyage:step'].includes(f.action.handler)||!['sector','landspeed','hyperspace','orbit','land','takeoff'].includes(p.method)||!Array.isArray(p.path)||p.path.length<2||!Number.isSafeInteger(p.index)||p.index<0||p.index>=p.path.length-1||!Number.isSafeInteger(p.cost)||p.cost<0||p.cost>1)throw Error('Invalid vessel travel continuation.');
  assertCardReference(m,p.card);if(p.card.zone!=='table'||m.cards[p.card.id].owner!==f.actor||!vesselRule(m,p.card.id)||f.action.source!==p.card.id||f.action.id!==routeId(p))throw Error('Invalid vessel travel source.');
  for(const ref of p.path){assertCardReference(m,ref);if(ref.zone!=='table'||cardDefinition(m,ref.id).type!=='Location')throw Error('Invalid vessel route location.');}
  if(new Set(p.path.map(x=>x.id)).size!==p.path.length||!['landspeed','sector'].includes(p.method)&&p.path.length!==2||f.action.handler==='voyage:begin'&&p.index!==0)throw Error('Invalid vessel route.');
 }
}
/** Journey endpoints and current position are already public table information. */
export function vesselTravelView(m:Match){
 const r=[...m.stack].reverse().find(f=>f.kind==='resolution'&&f.action.handler.startsWith('voyage:'));
 if(!r||r.kind!=='resolution')return {journey:null};
 const p=r.action.payload as unknown as Payload;
 if(!sameCard(m,p.card))return {journey:null};
 return {journey:{card:p.card.id,name:name(m,p.card.id),method:p.method,from:name(m,p.path[0].id),to:name(m,p.path.at(-1)!.id),at:name(m,m.cards[p.card.id].location!),completed:p.index,total:p.path.length-1}};
}
