import lore from '../../data/native-engine/objective-lore.json';
import {cardDefinition} from './definitions';
import {controls,isSite,system} from './board';
import {shipSite,shipSiteGroup} from './ship-sites';
import {isCave,caveSector} from './sectors';
import {forceIcons} from './location-icons';
import {hasCharacteristic} from './characteristics';
import {activeUndercoverSpy} from './undercover-state';
import {gameTextActive} from './game-text';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {retrieve} from './retrieval';
import {openWindow,type RequiredAction} from './runtime';
import {other,sides,type Match,type Json,type Side,type Window,type Action,type Resolution} from './types';

export type ObjectiveRecord={source:CardReference;side:Side;complete:boolean;failed?:true;flips:number;retrieved?:number};
export const objectiveRecords=(m:Match)=>(m.data.objectives??[]) as unknown as ObjectiveRecord[];
export const objectiveRecord=(m:Match,id:string)=>objectiveRecords(m).find(p=>p.source.id===id);
/** The persistent record separates successfully established remainder-of-game
 * text from the currently visible face and its while-this-side-up text. */
export function registerObjective(m:Match,id:string):void {
 if(m.cards[id]?.blueprint!=='7_299'||m.cards[id].zone!=='table'||objectiveRecord(m,id))throw Error('Invalid Objective registration.');
 m.data.objectives=[...objectiveRecords(m),{source:referenceCard(m,id),side:m.cards[id].owner,complete:false,flips:0}] as unknown as Json;
}
export function completeObjective(m:Match,id:string,failed=false):void {const p=objectiveRecord(m,id);if(!p||p.complete||p.failed)throw Error('Objective deployment already completed.');if(failed)p.failed=true;else p.complete=true;}
const loreByBlueprint:Record<string,string>=lore;
/** This card explicitly checks lore words. It does not infer a general printed
 * characteristic from prose; the immutable strings come from pinned classes. */
export const isbLore=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).type==='Character'&&/\b(?:ISB|Rebels?|Rebellion)\b/i.test(loreByBlueprint[m.cards[id].blueprint]??'');
export function objectiveTrait(m:Match,id:string,trait:string):boolean {
 return (trait==='ISB_AGENT'||trait==='SPY')&&isbLore(m,id)&&objectiveRecords(m).some(p=>p.complete&&!p.failed&&p.side===m.cards[id].owner&&m.cards[p.source.id].blueprint==='7_299');
}
export const objectiveIgnoresLocationDeploymentRestrictions=(m:Match,id:string)=>objectiveTrait(m,id,'ISB_AGENT');
const active=(m:Match,p:ObjectiveRecord)=>p.complete&&!p.failed&&sameCard(m,p.source)&&gameTextActive(m,p.source.id);
const agent=(m:Match,id:string)=>m.cards[id]?.zone==='table'&&!m.cards[id].coveredBy&&!activeUndercoverSpy(m,id)&&hasCharacteristic(m,id,'ISB_AGENT');
const agents=(m:Match)=>Object.values(m.cards).filter(c=>agent(m,c.id));
const battlegroundSite=(m:Match,id:string)=>isSite(m,id)&&forceIcons(m,id,'dark')>0&&forceIcons(m,id,'light')>0;
/** Related is not transitive: a planetary site is not related to orbiting
 * asteroids merely because both relate to that system. */
export function objectiveLocationsRelated(m:Match,site:string,to:string):boolean {
 if(site===to)return true;
 if(isCave(m,site))return caveSector(m,site)===to;
 if(shipSite(m,site))return shipSite(m,to)&&shipSiteGroup(m,site)!==undefined&&shipSiteGroup(m,site)===shipSiteGroup(m,to);
 return system(m,site)!==undefined&&system(m,site)===system(m,to);
}
export function objectiveDrainModifier(m:Match,side:Side,location:string):number {
 let bonus=0;
 for(const p of objectiveRecords(m))if(active(m,p)&&m.cards[p.source.id].face==='back'){
  const sites=m.locations.filter(site=>battlegroundSite(m,site)&&agents(m).some(c=>c.owner===p.side&&c.location===site));
  if(side===p.side){if(sites.includes(location))bonus++;}
  else if(sites.some(site=>objectiveLocationsRelated(m,site,location)))bonus--;
 }
 return bonus;
}
function shouldFlip(m:Match,p:ObjectiveRecord):boolean {
 const cards=agents(m);
 if(m.cards[p.source.id].face==='back')return cards.length===0;
 return cards.length>=4||m.locations.filter(site=>['Hoth','Yavin 4'].includes(system(m,site)??'')&&controls(m,p.side,site)&&cards.some(c=>c.owner===p.side&&c.location===site)).length>=2;
}
type Payload={source:CardReference;face:'front'|'back';flips:number;window:number;stage?:'flip'};
const face=(m:Match,id:string)=>m.cards[id].face==='back'?'back':'front';
const flipAction=(p:Payload):Action=>({id:'objective:flip:'+p.source.id+':'+p.flips+':'+p.window,handler:'objective:flip',source:p.source.id,label:'Flip '+(p.face==='front'?"ISB Operations to Empire’s Sinister Agents":"Empire’s Sinister Agents to ISB Operations"),payload:p as unknown as Json});
export function objectiveAutomatic(m:Match,w:Window):RequiredAction[]{
 if(m.status!=='playing')return [];
 return objectiveRecords(m).filter(p=>active(m,p)&&shouldFlip(m,p)&&!m.stack.some(f=>f.kind==='resolution'&&f.action.handler==='objective:flip'&&f.action.source===p.source.id)).map(p=>({...flipAction({source:p.source,face:face(m,p.source.id),flips:p.flips,window:w.serial}),actor:p.side}));
}
export function objectiveActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='draw'||m.turn.side!==side)return [];
 return objectiveRecords(m).filter(p=>active(m,p)&&p.side===side&&m.cards[p.source.id].face==='back'&&p.retrieved!==m.turn.number).map(p=>({id:'objective:retrieve:'+p.source.id,handler:'objective:retrieve',source:p.source.id,label:'Retrieve one ISB agent',payload:{source:p.source,turn:m.turn.number} as unknown as Json}));
}
export function objectiveInitiate(m:Match,r:Resolution):void {
 if(r.action.handler==='objective:retrieve'){const p=objectiveRecord(m,r.action.source!);if(!p||p.retrieved===m.turn.number)throw Error('Objective retrieval already used.');p.retrieved=m.turn.number;}
}
export function objectiveResolve(m:Match,r:Resolution):void {
 if(r.action.handler==='objective:retrieve'){
  const p=r.action.payload as unknown as {source:CardReference;turn:number};if(r.cancelled||!sameCard(m,p.source))return;
  const blueprints=[...new Set(m.players[r.actor].lost.filter(id=>hasCharacteristic(m,id,'ISB_AGENT')).map(id=>m.cards[id].blueprint))];
  retrieve(m,r.actor,p.source.id,1,blueprints);return;
 }
 if(r.action.handler!=='objective:flip')throw Error('Unknown Objective action.');
 const p=r.action.payload as unknown as Payload,record=objectiveRecord(m,p.source.id);
 if(r.cancelled||!record||!sameCard(m,p.source)||face(m,p.source.id)!==p.face||record.flips!==p.flips)return;
 if(!p.stage){p.stage='flip';m.stack.push(r);openWindow(m,'response',other(r.actor),{kind:'about-to-flip',card:p.source.id,from:p.face,to:p.face==='front'?'back':'front'});return;}
 if(p.face==='front')m.cards[p.source.id].face='back';else delete m.cards[p.source.id].face;
 record.flips++;openWindow(m,'response',other(r.actor),{kind:'flipped',card:p.source.id,face:face(m,p.source.id)});
}
export function objectiveView(m:Match){return {objectives:objectiveRecords(m).map(p=>{const d=cardDefinition(m,p.source.id);return {card:p.source.id,blueprint:m.cards[p.source.id].blueprint,side:p.side,face:face(m,p.source.id),name:d.name,image:d.image,text:d.text,status:p.failed?'failed':!p.complete?'deploying':sameCard(m,p.source)?'active':'out',flips:p.flips,retrievable:active(m,p)&&m.cards[p.source.id].face==='back'?m.players[p.side].lost.filter(id=>hasCharacteristic(m,id,'ISB_AGENT')):[],agents:agents(m).map(c=>c.id)};})};}
export function assertObjectives(m:Match):void {
 if(m.data.objectives!==undefined&&!Array.isArray(m.data.objectives))throw Error('Invalid Objective registry.');
 if(objectiveRecords(m).some(p=>p.complete)&&Object.values(m.cards).some(c=>cardDefinition(m,c.id).type==='Character'&&!(c.blueprint in loreByBlueprint)))throw Error('ISB Objective requires reviewed lore for every character.');
 const owners=new Set<Side>();
 for(const p of objectiveRecords(m)){
  assertCardReference(m,p.source);
  if(m.cards[p.source.id].blueprint!=='7_299'||p.source.zone!=='table'||!sides.includes(p.side)||m.cards[p.source.id].owner!==p.side||owners.has(p.side)||typeof p.complete!=='boolean'||p.failed!==undefined&&p.failed!==true||p.complete&&p.failed||!Number.isSafeInteger(p.flips)||p.flips<0||p.retrieved!==undefined&&(!Number.isSafeInteger(p.retrieved)||p.retrieved<1||p.retrieved>m.turn.number)||!p.complete&&(p.flips!==0||p.retrieved!==undefined||m.cards[p.source.id].face!==undefined))throw Error('Invalid Objective state.');
  if(p.complete&&(m.cards[p.source.id].face==='back')!==(p.flips%2===1))throw Error('Objective face does not match its completed flips.');
  owners.add(p.side);
 }
 for(const c of Object.values(m.cards))if(c.face!==undefined&&(c.face!=='back'||c.blueprint!=='7_299'||!objectiveRecord(m,c.id)?.complete))throw Error('Invalid flipped Objective face.');
 for(const [index,f] of m.stack.entries())if(f.kind==='resolution'&&f.action.handler.startsWith('objective:')){
  const p=f.action.payload as unknown as Payload&{turn?:number};assertCardReference(m,p.source);const record=objectiveRecord(m,p.source.id);
  if(!record||f.actor!==record.side||f.action.source!==p.source.id||!record.complete||f.action.payment||f.action.unrespondable)throw Error('Invalid Objective action source.');
  if(f.action.handler==='objective:retrieve'){if(f.action.id!=='objective:retrieve:'+p.source.id||p.turn!==m.turn.number||record.retrieved!==p.turn)throw Error('Invalid Objective retrieval.');}
  else if(f.action.handler==='objective:flip'){
   if(!['front','back'].includes(p.face)||!Number.isSafeInteger(p.flips)||p.flips<0||p.flips>record.flips||f.action.id!==flipAction(p).id||!m.stack.some(x=>x.kind==='window'&&x.serial===p.window)||p.stage!==undefined&&p.stage!=='flip')throw Error('Invalid Objective flip.');
   if(p.stage==='flip'){const next=m.stack[index+1],e=next?.kind==='window'?next.event as {kind?:string;card?:string;from?:string}|undefined:undefined;if(next?.kind!=='window'||e?.kind!=='about-to-flip'||e.card!==p.source.id||e.from!==p.face)throw Error('Invalid pending Objective flip response.');}
  }else throw Error('Invalid Objective handler.');
 }
}
