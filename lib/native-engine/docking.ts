import {cardDefinition,name} from './board';
import {capital,operational,occupants,roleAvailable,vesselRule,type AboardRole} from './occupancy';
import {barred} from './ground';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {other,type Match,type Side,type Action,type Window,type Resolution,type Decision,type Json} from './types';

type Dock={a:CardReference;b:CardReference;site:CardReference;transfers:number};
const payload=(f:Resolution|Decision)=>('action' in f?f.action.payload:f.payload) as unknown as Dock;
const shipName=(m:Match,id:string)=>name(m,id)+' '+id;
const ship=(m:Match,id:string,side:Side)=>m.cards[id]?.zone==='table'&&m.cards[id].owner===side&&!m.cards[id].attachedTo&&!!vesselRule(m,id)&&cardDefinition(m,id).type==='Starship';
function together(m:Match,p:Dock,side:Side):boolean {
 return [p.a,p.b,p.site].every(ref=>sameCard(m,ref))&&ship(m,p.a.id,side)&&ship(m,p.b.id,side)&&m.cards[p.a.id].location===p.site.id&&m.cards[p.b.id].location===p.site.id;
}
const ready=(m:Match,p:Dock,side:Side)=>together(m,p,side)&&(capital(m,p.a.id)||capital(m,p.b.id))&&(operational(m,p.a.id)||operational(m,p.b.id))&&!barred(m,p.a.id)&&!barred(m,p.b.id);
const action=(handler:string,p:Dock):Action=>({id:'dock:'+p.a.id+':'+p.b.id,handler:'docking:'+handler,label:'Ship docking',source:p.a.id,payload:p as unknown as Json});
function resume(m:Match,side:Side,p:Dock){m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action('continue',p)});}
function end(m:Match,side:Side,p:Dock){
 // Only the starships move; cargo transfers have their own result, not a moved result.
 openWindow(m,'response',other(side),{kind:'moved',cards:[p.a.id,p.b.id].filter(id=>sameCard(m,id===p.a.id?p.a:p.b)),method:'ship-dock',initial:true,complete:true});
}
export function dockingActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='move'||m.players[side].force.length<1)return [];
 const ships=Object.values(m.cards).filter(c=>ship(m,c.id,side)&&c.location&&cardDefinition(m,c.location).subType==='System');
 return ships.flatMap((a,i)=>ships.slice(i+1).flatMap(b=>{
  const p:Dock={a:referenceCard(m,a.id),b:referenceCard(m,b.id),site:referenceCard(m,a.location!),transfers:0};
  return ready(m,p,side)?[{...action('begin',p),label:'Dock '+shipName(m,a.id)+' ↔ '+shipName(m,b.id)+' · 1 Force',payment:{[side]:1}}]:[];
 }));
}
export function dockingResolve(m:Match,r:Resolution){
 const p=payload(r);if(r.cancelled)return;
 if(r.action.handler==='docking:begin'&&!ready(m,p,r.actor))return;
 if(!together(m,p,r.actor)){if(r.action.handler==='docking:continue')end(m,r.actor,p);return;}
 m.stack.push({kind:'decision',side:r.actor,handler:'docking:transfer',payload:p as unknown as Json});
}
type Option={id:string;label:string;card:string;host:string;role:AboardRole;transfer:boolean};
function options(m:Match,side:Side,p:Dock):Option[]{
 if(!together(m,p,side))return [];
 const result:Option[]=[];
 for(const [from,to] of [[p.a.id,p.b.id],[p.b.id,p.a.id]])for(const c of occupants(m,from).filter(c=>c.owner===side)){
  const character=cardDefinition(m,c.id).type==='Character';
  const roles:AboardRole[]=character?['pilot','passenger']:[cardDefinition(m,c.id).type==='Vehicle'?'vehicle':'starship'];
  for(const role of roles){
   if(roleAvailable(m,to,c.id,role))result.push({id:'transfer:'+c.id+':'+to+':'+role,label:'Transfer '+name(m,c.id)+' to '+shipName(m,to)+' as '+role,card:c.id,host:to,role,transfer:true});
   if(character&&!barred(m,c.id)&&role!==c.aboardRole&&roleAvailable(m,from,c.id,role))result.push({id:'seat:'+c.id+':'+role,label:'Assign '+name(m,c.id)+' as '+role+' aboard '+shipName(m,from),card:c.id,host:from,role,transfer:false});
  }
 }
 return result;
}
export function dockingChoices(m:Match,d:Decision){return [...options(m,d.side,payload(d)).map(({id,label})=>({id,label})),{id:'undock',label:'Finish transfers and undock'}];}
export function dockingChoose(m:Match,d:Decision,choice:string){
 const p=payload(d);if(choice==='undock'){end(m,d.side,p);return;}
 const selected=options(m,d.side,p).find(x=>x.id===choice);if(!selected)throw Error('Invalid docking transfer.');
 const c=m.cards[selected.card],from=c.attachedTo!;c.attachedTo=selected.host;c.aboardRole=selected.role;
 if(selected.transfer)p.transfers++;
 resume(m,d.side,p);
 openWindow(m,'response',other(d.side),selected.transfer?{kind:'ship-transferred',card:c.id,from,to:selected.host,site:p.site.id}:{kind:'moved',card:c.id,from:p.site.id,site:p.site.id,capacity:true});
}
export function dockingView(m:Match){
 const frame=[...m.stack].reverse().find(f=>f.kind==='decision'&&f.handler==='docking:transfer'||f.kind==='resolution'&&f.action.handler==='docking:continue');
 if(!frame||frame.kind==='window')return {docking:null};const p=payload(frame);
 return {docking:{ships:[shipName(m,p.a.id),shipName(m,p.b.id)],transfers:p.transfers}};
}
export function assertDocking(m:Match){
 let sessions=0;
 for(const f of m.stack){
  if(f.kind==='window')continue;const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('docking:'))continue;
  if(++sessions>1||!['docking:begin','docking:continue','docking:transfer'].includes(h)||(f.kind==='decision')!==(h==='docking:transfer'))throw Error('Invalid docking continuation.');
  const p=payload(f),side=f.kind==='decision'?f.side:f.actor;
  if(!p||!Number.isSafeInteger(p.transfers)||p.transfers<0||h==='docking:begin'&&p.transfers!==0)throw Error('Invalid docking history.');
  for(const ref of [p.a,p.b,p.site]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid docking reference.');}
  if(p.a.id===p.b.id||cardDefinition(m,p.site.id).subType!=='System'||[p.a,p.b].some(ref=>m.cards[ref.id].owner!==side||!vesselRule(m,ref.id)||cardDefinition(m,ref.id).type!=='Starship'))throw Error('Invalid docking ships.');
  if(f.kind==='resolution'&&(f.action.source!==p.a.id||f.action.id!=='dock:'+p.a.id+':'+p.b.id))throw Error('Invalid docking identity.');
 }
}
