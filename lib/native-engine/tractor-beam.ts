import {captureDestinations} from './ship-sites';
import {cardDefinition} from './definitions';
import {name} from './board';
import {isModel} from './characteristics';
import {gameTextActive} from './game-text';
import {belowDecks,landed} from './occupancy';
import {defenseValue} from './defense';
import {attachmentAttempt,validAttachmentAttempt,assertAttachmentAttempt,type AttachmentAttempt} from './attachment';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {beginDestinySequence,assertDestinyScope} from './destiny-limits';
import {completeDestinyTotal,drawDestiny,validDraw,type Draw} from './destiny';
import {captureStarship} from './captured-ships';
import {deployed} from './deployment';
import {battle} from './battle';
import {moveCard} from './state';
import {openWindow,queueForcePayment} from './runtime';
import type {Action,Decision,Json,Match,Resolution,Side,Window} from './types';

type Payload={card:CardReference;host:CardReference;target?:CardReference;window?:number;attachment?:AttachmentAttempt;transfer?:boolean;scope?:string;draws?:Draw[];draw?:Draw;total?:number|null};
type Use={window:number;card:CardReference};
const uses=(m:Match)=>(m.data.tractorBeamUses??[]) as unknown as Use[];
const deathStarBeam=(m:Match,id:string)=>m.cards[id]?.blueprint==='2_111';
const beamCard=(m:Match,id:string)=>['2_111','2_115'].includes(m.cards[id]?.blueprint);
const siteHost=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&!m.cards[id].coveredBy&&['1_124','1_285'].includes(m.cards[id].blueprint);
const hostEligible=(m:Match,id:string,beam:string)=>deathStarBeam(m,beam)?siteHost(m,id):m.cards[id]?.zone==='table'&&m.cards[id].owner==='dark'&&['IMPERIAL_CLASS_STAR_DESTROYER','VICTORY_CLASS_STAR_DESTROYER','SUPER_CLASS_STAR_DESTROYER','VENATOR_CLASS_STAR_DESTROYER'].some(model=>isModel(m,id,model));
const firingLocation=(m:Match,p:Pick<Payload,'card'|'host'>)=>deathStarBeam(m,p.card.id)?m.locations.find(id=>m.cards[id].blueprint==='2_143'):m.cards[p.host.id]?.location;
const targetEligible=(m:Match,id:string,site:string)=>m.cards[id]?.zone==='table'&&m.cards[id].owner==='light'&&cardDefinition(m,id).type==='Starship'&&!cardDefinition(m,id).subType.includes('Mon Calamari')&&m.cards[id].location===site&&!belowDecks(m,id)&&!landed(m,id);
const action=(step:string,p:Payload):Action=>({id:'tractor:'+step+':'+p.card.id+':'+(p.target?.id??p.host.id),handler:'tractor:'+step,source:p.card.id,label:'Tractor Beam',payload:p as unknown as Json});
const queue=(m:Match,p:Payload,step:string)=>m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action(step,p)});
export function tractorBeamActions(m:Match,w:Window,side:Side):Action[]{
 if(side!=='dark')return [];
 const result:Action[]=[];
 for(const c of Object.values(m.cards).filter(c=>c.owner==='dark'&&beamCard(m,c.id))){
  if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy'&&(c.zone==='hand'||c.zone==='table'&&!deathStarBeam(m,c.id))){
   for(const host of Object.values(m.cards).filter(h=>hostEligible(m,h.id,c.id)))if(c.zone==='hand'||c.attachedTo!==host.id&&m.cards[c.attachedTo!]?.zone==='table'&&m.cards[c.attachedTo!]?.location===host.location&&m.cards[c.attachedTo!]?.attachedTo===host.attachedTo){
    const p:Payload={card:referenceCard(m,c.id),host:referenceCard(m,host.id),transfer:c.zone==='table'};
    result.push({...action('deploy',p),payment:{dark:2},label:(p.transfer?'Transfer ':'Deploy ')+name(m,c.id)+' on '+name(m,host.id)+' · use 2 Force'});
   }
  }
  const b=battle(m),host=m.cards[c.attachedTo!];
  if(w.timing!=='response'||(w.event as {kind?:string})?.kind!=='battle-ending'||!b||!host||c.zone!=='table'||!gameTextActive(m,c.id)||host.zone!=='table'||firingLocation(m,{card:referenceCard(m,c.id),host:referenceCard(m,host.id)})!==b.site||!hostEligible(m,host.id,c.id)||!deathStarBeam(m,c.id)&&(belowDecks(m,host.id)||landed(m,host.id))||uses(m).some(u=>u.window===w.serial&&u.card.id===c.id&&sameCard(m,u.card)))continue;
  if(m.players.dark.force.length>=2&&Object.values(m.cards).some(t=>targetEligible(m,t.id,b.site))){const p:Payload={card:referenceCard(m,c.id),host:referenceCard(m,host.id),window:w.serial};result.push({...action('use',p),unrespondable:true,label:'Use '+name(m,c.id)+' on '+name(m,host.id)});}
 }
 return result;
}
export function tractorBeamInitiate(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='tractor:deploy'){
  if(!p.transfer)moveCard(m,p.card.id,'playing');p.card=referenceCard(m,p.card.id);p.attachment=attachmentAttempt(m,p.card.id,p.host.id);
 }else m.data.tractorBeamUses=[...uses(m).filter(u=>u.window===p.window),{window:p.window!,card:p.card}] as unknown as Json;
}
export function tractorBeamResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload,h=r.action.handler;
 if(h==='tractor:deploy'){
  if(r.cancelled||!validAttachmentAttempt(m,p.attachment!)||!hostEligible(m,p.host.id,p.card.id)){
   if(!p.transfer&&sameCard(m,p.card))moveCard(m,p.card.id,'lost');return;
  }
  if(!p.transfer)moveCard(m,p.card.id,'table');const c=m.cards[p.card.id];c.attachedTo=p.host.id;c.location=deathStarBeam(m,c.id)?p.host.id:m.cards[p.host.id].location;
  if(!p.transfer)deployed(m,c.id);else openWindow(m,'response','light',{kind:'device-transferred',card:c.id});return;
 }
 if(r.cancelled)return;
 if(h==='tractor:use'){
  const decision:Decision={kind:'decision',side:'dark',handler:'tractor:target',payload:p as unknown as Json};
  const choices=tractorBeamChoices(m,decision);
  if(choices.length===1)tractorBeamChoose(m,decision,choices[0].id);else if(choices.length>1)m.stack.push(decision);
 }else if(h==='tractor:fire'){
  if(deathStarBeam(m,p.card.id)){p.draws=[];p.scope=beginDestinySequence(m,'dark',p.card.id,'tractor-beam');drawDestiny(m,'dark',p.card.id,'tractor-beam',action('draw',p),false,0,undefined,false,p.scope);}
  else drawDestiny(m,'dark',p.card.id,'tractor-beam',action('result',p),true);
 }else if(h==='tractor:draw'){
  p.draws!.push(p.draw!);delete p.draw;
  if(p.draws!.length<2)drawDestiny(m,'dark',p.card.id,'tractor-beam',action('draw',p),false,0,undefined,false,p.scope);
  else completeDestinyTotal(m,'dark',p.card.id,'tractor-beam',p.draws!,action('result',p));
 }
 else if(h==='tractor:result'){
  if(!sameCard(m,p.target!)||!sameCard(m,p.host)||!sameCard(m,p.card)||!targetEligible(m,p.target!.id,firingLocation(m,p)!))return;
  if(p.total!==null&&p.total!==undefined&&p.total>defenseValue(m,p.target!.id)){
   queue(m,p,'capture');openWindow(m,'response','light',{kind:'about-to-capture',card:p.target!.id,cardRef:p.target!,source:p.card.id} as unknown as Json);
  }
 }else if(h==='tractor:capture'){
  if(sameCard(m,p.target!)&&sameCard(m,p.host)&&sameCard(m,p.card)&&m.cards[p.card.id].attachedTo===p.host.id&&targetEligible(m,p.target!.id,firingLocation(m,p)!)){
   const choices=captureDestinations(m,p.host.id);
   if(choices.length===1)captureStarship(m,p.target!.id,choices[0]);
   else m.stack.push({kind:'decision',side:'dark',handler:'tractor:custody',payload:p as unknown as Json});
  }
 }else throw Error('Unknown Tractor Beam continuation.');
}
export function tractorBeamChoices(m:Match,d:Decision){
 const p=d.payload as unknown as Payload;
 if(d.handler==='tractor:custody')return (p.target&&sameCard(m,p.target)&&sameCard(m,p.host)&&sameCard(m,p.card)&&m.cards[p.card.id].attachedTo===p.host.id&&targetEligible(m,p.target.id,firingLocation(m,p)!)?captureDestinations(m,p.host.id):[]).map((id,i,a)=>({id:'tractor:custody:'+id,label:'Hold '+name(m,p.target!.id)+' at '+name(m,id)+(a.length>1?' · bay '+(i+1)+' of '+a.length:'')}));
 const targets=sameCard(m,p.card)&&sameCard(m,p.host)&&m.cards[p.card.id].attachedTo===p.host.id&&m.players.dark.force.length>=2?Object.values(m.cards).filter(t=>targetEligible(m,t.id,firingLocation(m,p)!)):[];
 return targets.map(t=>({id:'tractor:target:'+t.id,label:'Target '+name(m,t.id)+' · use 2 Force'}));
}
export function tractorBeamChoose(m:Match,d:Decision,choice:string):void {
 if(!tractorBeamChoices(m,d).some(c=>c.id===choice))throw Error('Invalid Tractor Beam target.');
 const p=d.payload as unknown as Payload;
 if(d.handler==='tractor:custody'){captureStarship(m,p.target!.id,choice.slice('tractor:custody:'.length));return;}
 const target=choice.slice('tractor:target:'.length);
 const r:Resolution={kind:'resolution',actor:'dark',cancelled:false,awaitingResponses:true,action:{...action('fire',{...p,target:referenceCard(m,target)}),payment:{dark:2}}};
 m.stack.push(r);queueForcePayment(m,r,{dark:2});
}
export function assertTractorBeams(m:Match):void {
 const records=uses(m);
 if(!Array.isArray(records)||new Set(records.map(u=>u.window+':'+u.card?.id+':'+u.card?.version)).size!==records.length)throw Error('Invalid Tractor Beam trigger use.');
 for(const u of records){assertCardReference(m,u.card);if(!Number.isSafeInteger(u.window)||u.window<1||u.window>m.serial||u.card.zone!=='table'||!beamCard(m,u.card.id))throw Error('Invalid Tractor Beam trigger history.');}
 for(const frame of m.stack)if(frame.kind==='resolution'&&frame.action.handler.startsWith('tractor:')||frame.kind==='decision'&&frame.handler.startsWith('tractor:')){
  if(frame.kind==='decision'&&(!['tractor:target','tractor:custody'].includes(frame.handler)||frame.side!=='dark'||!tractorBeamChoices(m,frame).length))throw Error('Invalid Tractor Beam targeting decision.');
  const f:Resolution=frame.kind==='resolution'?frame:{kind:'resolution',actor:frame.side,cancelled:false,action:action(frame.handler==='tractor:custody'?'capture':'use',frame.payload as unknown as Payload)};
  const p=f.action.payload as unknown as Payload,h=f.action.handler;
  if(!p||!['deploy','use','fire','draw','result','capture'].some(step=>h==='tractor:'+step)||f.actor!=='dark'||!beamCard(m,p.card?.id)||f.action.source!==p.card.id||f.action.id!==action(h.slice(8),p).id)throw Error('Invalid Tractor Beam action.');
  assertCardReference(m,p.card);assertCardReference(m,p.host);
  if(p.host.zone!=='table'||(deathStarBeam(m,p.card.id)?!['1_124','1_285'].includes(m.cards[p.host.id].blueprint):cardDefinition(m,p.host.id).type!=='Starship'))throw Error('Invalid Tractor Beam host.');
  if(h==='tractor:deploy'){
   assertAttachmentAttempt(m,p.attachment!,p.card.id,p.host.id);if(typeof p.transfer!=='boolean'||p.attachment!.transfer!==p.transfer)throw Error('Invalid Tractor Beam deployment.');
  }else{
   if(h!=='tractor:use')assertCardReference(m,p.target!);
   const parent=m.stack.find(x=>x.kind==='window'&&x.serial===p.window);
   if(p.card.zone!=='table'||h!=='tractor:use'&&(p.target!.zone!=='table'||cardDefinition(m,p.target!.id).type!=='Starship')||!parent||parent.kind!=='window'||(parent.event as {kind?:string})?.kind!=='battle-ending'||!records.some(u=>u.window===p.window&&JSON.stringify(u.card)===JSON.stringify(p.card)))throw Error('Invalid Tractor Beam battle binding.');
   if(h==='tractor:fire'&&(f.action.payment?.dark!==2||f.action.payment?.light!==undefined))throw Error('Invalid Tractor Beam cost.');
   if(p.scope)assertDestinyScope(m,p.scope,'dark',p.card.id,'tractor-beam');
   if(h==='tractor:draw'&&(!deathStarBeam(m,p.card.id)||!p.scope||!p.draw||!Array.isArray(p.draws)||p.draws.length>1))throw Error('Invalid Death Star Tractor Beam draw sequence.');
   if(p.draws!==undefined&&(!Array.isArray(p.draws)||p.draws.length>2||p.draws.some(d=>!validDraw(m,d,'dark'))))throw Error('Invalid Tractor Beam draws.');
   if(deathStarBeam(m,p.card.id)&&['tractor:result','tractor:capture'].includes(h)&&(!p.scope||p.draws?.length!==2))throw Error('Incomplete Death Star Tractor Beam total.');
   if(p.draw&&!validDraw(m,p.draw,'dark')||p.total!==undefined&&p.total!==null&&!Number.isFinite(p.total))throw Error('Invalid Tractor Beam destiny.');
  }
 }
}
