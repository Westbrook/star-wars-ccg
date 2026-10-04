import {bayCosts} from './travel';
import {cardDefinition} from './definitions';
import {vesselRule,roleAvailable,occupants,capital,type AboardRole} from './occupancy';
import {deploymentPayment,presence,system} from './board';
import {premiereLocations} from './premiere-setup';
import {deployed} from './deployment';
import {canPlayCard,canEnterTable} from './persona';
import {barred} from './participation';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {moveCard} from './state';
import {openWindow} from './runtime';
import {other,type Match,type Action,type Window,type Side,type Resolution,type Json} from './types';

type Payload={card:string;target:CardReference;role?:AboardRole;source?:CardReference;from?:string;previous?:AboardRole};
const roles:AboardRole[]=['pilot','driver','passenger'];
const label=(m:Match,id:string)=>cardDefinition(m,id).name;
const hasDeployPresence=(m:Match,id:string,side:Side)=>!!premiereLocations[m.cards[id]?.blueprint]?.icons[side]||presence(m,side,id);
export function vesselDeploysAt(m:Match,id:string,location:string,withPilot=false,ignorePresence=false):boolean{
 const r=vesselRule(m,id);if(!r||!m.locations.includes(location)||!ignorePresence&&!hasDeployPresence(m,location,m.cards[id].owner))return false;
 const d=cardDefinition(m,location),exterior=d.subType==='Site'&&(d.icons as string[]).includes('Exterior');
 return cardDefinition(m,id).type==='Starship'?d.subType==='System'&&(r.permanent>0||withPilot)||!capital(m,id)&&exterior&&bayCosts[m.cards[location].blueprint]!==undefined:exterior&&(!r.world||system(m,location)===r.world);
}
const action=(step:string,p:Payload,label:string,payment?:Partial<Record<Side,number>>):Action=>({id:'vessel:'+step+':'+p.card+':'+p.target.id+(p.role?':'+p.role:''),handler:'vessel:'+step,source:p.card,payload:p as unknown as Json,label,...(payment?{payment}:{})});
export function vesselActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||side!==m.turn.side||!['deploy','move'].includes(m.turn.phase))return [];
 const out:Action[]=[],hosts=Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&vesselRule(m,c.id));
 if(m.turn.phase==='deploy')for(const id of m.players[side].hand){
  if(!canPlayCard(m,id))continue;
  if(vesselRule(m,id))for(const site of m.locations.filter(site=>vesselDeploysAt(m,id,site))){const cost=Number((cardDefinition(m,id).stats as Record<string,string>).deploy);if(cost<=m.players[side].force.length)out.push(action('deploy',{card:id,target:referenceCard(m,site)},'Deploy '+label(m,id)+' to '+label(m,site),{[side]:cost}));}
  if(cardDefinition(m,id).type==='Character')for(const host of hosts){const pay=deploymentPayment(m,id,host.location!,true);if(!pay||Object.entries(pay).some(([s,n])=>m.players[s as Side].force.length<n!))continue;for(const role of roles.filter(role=>roleAvailable(m,host.id,id,role)))out.push(action('aboard',{card:id,target:referenceCard(m,host.id),role},'Deploy '+label(m,id)+' aboard '+label(m,host.id)+' as '+role,pay));}
 }
 for(const host of hosts){
  for(const c of occupants(m,host.id).filter(c=>cardDefinition(m,c.id).type==='Character'&&!barred(m,c.id))){
   for(const role of roles.filter(role=>role!==c.aboardRole&&roleAvailable(m,host.id,c.id,role)))out.push(action('role',{card:c.id,source:referenceCard(m,c.id),target:referenceCard(m,host.id),role,previous:c.aboardRole},'Assign '+label(m,c.id)+' as '+role+' aboard '+label(m,host.id)));
   if(m.turn.phase==='move'&&cardDefinition(m,host.location!).subType==='Site')out.push(action('exit',{card:c.id,source:referenceCard(m,c.id),target:referenceCard(m,host.id),from:host.location,previous:c.aboardRole},'Disembark '+label(m,c.id)+' at '+label(m,host.location!)));
  }
  if(m.turn.phase==='move'&&cardDefinition(m,host.location!).subType==='Site')for(const c of Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&!c.attachedTo&&c.location===host.location&&cardDefinition(m,c.id).type==='Character'&&!barred(m,c.id)))for(const role of roles.filter(role=>roleAvailable(m,host.id,c.id,role)))out.push(action('embark',{card:c.id,source:referenceCard(m,c.id),target:referenceCard(m,host.id),from:c.location,role},'Embark '+label(m,c.id)+' aboard '+label(m,host.id)+' as '+role));
 }
 return out;
}
export function vesselInitiate(m:Match,r:Resolution):void {if(['vessel:deploy','vessel:aboard'].includes(r.action.handler))moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
export function vesselResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload,c=m.cards[p.card],h=r.action.handler,deploy=['vessel:deploy','vessel:aboard'].includes(h),host=m.cards[p.target.id];
 if(deploy){
  const valid=!r.cancelled&&sameCard(m,p.target)&&canEnterTable(m,p.card)&&(h==='vessel:deploy'?vesselDeploysAt(m,p.card,p.target.id):host.owner===r.actor&&!!host.location&&roleAvailable(m,host.id,c.id,p.role!));
  if(!valid){moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');c.location=h==='vessel:deploy'?p.target.id:host.location;
  if(h==='vessel:aboard'){c.attachedTo=host.id;c.aboardRole=p.role;}
  deployed(m,p.card);return;
 }
 if(r.cancelled||!sameCard(m,p.source!)||!sameCard(m,p.target)||barred(m,c.id))return;
 if(h==='vessel:role'){if(c.attachedTo!==host.id||c.aboardRole!==p.previous||!roleAvailable(m,host.id,c.id,p.role!))return;c.aboardRole=p.role;}
 else if(h==='vessel:embark'){if(c.attachedTo||c.location!==p.from||host.location!==p.from||!roleAvailable(m,host.id,c.id,p.role!))return;c.attachedTo=host.id;c.aboardRole=p.role;}
 else if(h==='vessel:exit'){if(c.attachedTo!==host.id||host.location!==p.from||c.aboardRole!==p.previous)return;delete c.attachedTo;delete c.aboardRole;}
 else throw Error('Unknown vessel action.');
 openWindow(m,'response',other(r.actor),{kind:'moved',card:c.id,from:c.location!,site:c.location!,capacity:true});
}
export function assertVessels(m:Match):void{
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('vessel:')){
  const p=f.action.payload as unknown as Payload,h=f.action.handler,deploy=['vessel:deploy','vessel:aboard'].includes(h);
  if(!p||!['vessel:deploy','vessel:aboard','vessel:role','vessel:embark','vessel:exit'].includes(h)||m.cards[p.card]?.owner!==f.actor||f.action.source!==p.card||deploy&&m.cards[p.card].zone!=='playing')throw Error('Invalid vessel continuation.');
  assertCardReference(m,p.target);if(p.target.zone!=='table'||(h==='vessel:deploy'?!vesselRule(m,p.card)||cardDefinition(m,p.target.id).type!=='Location':!vesselRule(m,p.target.id)||cardDefinition(m,p.card).type!=='Character'))throw Error('Invalid vessel target.');
  if(!deploy){assertCardReference(m,p.source!,p.card);if(p.source!.zone!=='table')throw Error('Invalid moving crew.');}
  if(['vessel:aboard','vessel:role','vessel:embark'].includes(h)&&!roles.includes(p.role!))throw Error('Invalid capacity choice.');
  if(['vessel:role','vessel:exit'].includes(h)&&!roles.includes(p.previous!))throw Error('Invalid previous capacity.');
  if(['vessel:embark','vessel:exit'].includes(h)&&(!p.from||!m.cards[p.from]||cardDefinition(m,p.from).subType!=='Site'))throw Error('Invalid crew origin.');
  if(f.action.id!=='vessel:'+h.slice(7)+':'+p.card+':'+p.target.id+(p.role?':'+p.role:''))throw Error('Invalid vessel action identity.');
 }
}
