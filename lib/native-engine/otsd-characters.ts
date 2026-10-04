import {cardDefinition} from './definitions';
import {adjacent,isSite,isWarrior,name,system} from './board';
import {gameTextActive} from './game-text';
import {hasCharacteristic,nonUnique} from './characteristics';
import {crewActive} from './occupancy';
import {groundPresent} from './participation';
import {optionalActionWindow} from './action-timing';
import {addCombatModifier} from './combat-modifiers';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

const faction=(bp:string)=>bp==='106_6'?'Rebel':bp==='106_16'?'Imperial':undefined;
export const otsdAlienLeader=(bp:string)=>['106_1','106_11'].includes(bp);
const characters=(m:Match)=>Object.values(m.cards).filter(c=>c.zone==='table'&&!c.coveredBy&&cardDefinition(m,c.id).type==='Character');
/** "Present" here means present at the source's location (not "present with"
 * the source). An enclosed passenger can target a warrior outside, but cannot
 * make an enclosed warrior present at the location. */
function together(m:Match,a:string,b:string):boolean {
 return !!m.cards[a].location&&m.cards[a].location===m.cards[b].location&&crewActive(m,a)&&groundPresent(m,b);
}
export function otsdAlienDiscount(m:Match,id:string,site:string):number {
 if(cardDefinition(m,id).subType!=='Alien'||!isSite(m,site)||system(m,site)!=='Tatooine')return 0;
 const titles=new Set(characters(m).filter(c=>c.owner===m.cards[id].owner&&otsdAlienLeader(c.blueprint)&&gameTextActive(m,c.id)&&crewActive(m,c.id)&&c.location&&(c.location===site||adjacent(m,c.location,site))).map(c=>c.blueprint));
 return -titles.size;
}
export function otsdRecruitFree(m:Match,id:string,site:string):boolean {
 const f=faction(m.cards[id].blueprint);return !!f&&isSite(m,site)&&characters(m).some(c=>c.location===site&&cardDefinition(m,c.id).subType===f&&hasCharacteristic(m,c.id,'LEADER'));
}
export function otsdClearsAttrition(m:Match,id:string):boolean {
 const c=m.cards[id],f=faction(c.blueprint);if(!f||!gameTextActive(m,id)||!crewActive(m,id)||!c.location||!isSite(m,c.location))return false;
 return characters(m).some(v=>v.id!==id&&v.location===c.location&&crewActive(m,v.id)&&cardDefinition(m,v.id).subType===f&&(hasCharacteristic(m,v.id,'LEADER')||hasCharacteristic(m,v.id,'TROOPER')&&!hasCharacteristic(m,v.id,f==='Rebel'?'RECRUIT':'CADET')));
}
type Use={source:CardReference;turn:number};
type Boost=Use&{target:CardReference};
const uses=(m:Match)=>(m.data.otsdRecruitUses??[]) as unknown as Use[];
const used=(m:Match,id:string)=>uses(m).some(u=>u.turn===m.turn.number&&u.source.id===id&&sameCard(m,u.source));
function targets(m:Match,id:string):string[]{const f=faction(m.cards[id].blueprint);return characters(m).filter(c=>cardDefinition(m,c.id).subType===f&&nonUnique(m,c.id)&&isWarrior(m,c.id)&&together(m,id,c.id)).map(c=>c.id);}
export function otsdRecruitActions(m:Match,w:Window,side:Side):Action[]{
 if(!optionalActionWindow(w))return [];
 return characters(m).filter(c=>c.owner===side&&faction(c.blueprint)&&gameTextActive(m,c.id)&&crewActive(m,c.id)&&!used(m,c.id)).flatMap(c=>targets(m,c.id).map(id=>({id:'recruit:'+c.id+':'+id,handler:'recruit:boost',source:c.id,label:name(m,c.id)+' · '+name(m,id)+' power +1 this turn',payload:{source:referenceCard(m,c.id),target:referenceCard(m,id),turn:m.turn.number} as unknown as Json})));
}
export function otsdRecruitInitiate(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Boost;if(used(m,p.source.id)||!targets(m,p.source.id).includes(p.target.id))throw Error('Recruit boost unavailable.');
 m.data.otsdRecruitUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.source,turn:p.turn}] as unknown as Json;
}
export function otsdRecruitResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Boost;
 // A turn-duration effect survives its source departing. Its original target
 // must still exist; leaving and returning creates a different physical card.
 if(!r.cancelled&&sameCard(m,p.target))addCombatModifier(m,p.source.id,p.target.id,'power-add',1,{function:'recruit:boost'});
}
export function assertOtsdRecruits(m:Match):void {
 if(!Array.isArray(uses(m)))throw Error('Invalid recruit usage.');
 const seen=new Set<string>();for(const u of uses(m)){
  if(!u||!Number.isSafeInteger(u.turn)||u.turn<1||u.turn>m.turn.number)throw Error('Invalid recruit turn.');assertCardReference(m,u.source);
  const key=u.source.id+':'+u.source.version+':'+u.turn;if(u.source.zone!=='table'||!faction(m.cards[u.source.id].blueprint)||seen.has(key))throw Error('Invalid recruit usage binding.');seen.add(key);
 }
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('recruit:')){
  const p=r.action.payload as unknown as Boost;if(!p||r.action.handler!=='recruit:boost')throw Error('Invalid recruit action.');assertCardReference(m,p.source);assertCardReference(m,p.target);
  if(p.source.zone!=='table'||p.target.zone!=='table'||r.actor!==m.cards[p.source.id].owner||r.action.source!==p.source.id||r.action.id!=='recruit:'+p.source.id+':'+p.target.id||!faction(m.cards[p.source.id].blueprint)||cardDefinition(m,p.target.id).subType!==faction(m.cards[p.source.id].blueprint)||!nonUnique(m,p.target.id)||!uses(m).some(u=>u.turn===p.turn&&u.source.id===p.source.id&&u.source.version===p.source.version))throw Error('Invalid recruit target binding.');
 }
}
