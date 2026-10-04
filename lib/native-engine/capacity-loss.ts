import {isModel} from './characteristics';
import {cardDefinition} from './definitions';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {navigationLosses} from './navigation';
import {capacityFits,occupants,type AboardRole} from './occupancy';
import {placeInUsedFromTable} from './table';
import type {Decision,Json,Match} from './types';

type Choice={ship:CardReference;candidates:CardReference[]};
const crew=(m:Match,host:string)=>occupants(m,host).map(c=>({id:c.id,role:c.aboardRole as AboardRole}));
const overflow=(m:Match,host:string)=>!capacityFits(m,host,crew(m,host));
function candidates(m:Match,host:string):CardReference[]{
 // Astromechs already count as passengers. Reallocation into a general slot
 // is automatic in capacityFits; only displaced astromechs can leave here.
 return occupants(m,host).filter(c=>c.aboardRole==='passenger'&&isModel(m,c.id,'ASTROMECH')).map(c=>referenceCard(m,c.id));
}
function affected(m:Match,host:string):boolean{return navigationLosses(m).some(p=>p.ship.id===host&&sameCard(m,p.ship)&&p.success&&!p.astromech);}
export function capacityPending(m:Match,host:string):boolean{
 return m.stack.some(f=>f.kind==='decision'&&f.handler==='capacity:used'&&(f.payload as unknown as Choice).ship.id===host);
}
function place(m:Match,id:string,host:string):void{
 const entry={card:referenceCard(m,id),ship:referenceCard(m,host),name:cardDefinition(m,id).name,turn:m.turn.number};
 m.data.capacityReturns=[...((m.data.capacityReturns??[]) as Json[]),entry as unknown as Json];
 // This is a placement, not a loss or a forfeiture. Attached cards are lost.
 placeInUsedFromTable(m,id);
}
/** State-based correction happens before the interrupted response resumes. */
export function scheduleCapacityLoss(m:Match):boolean{
 // Complete an existing choice/Lost ordering before scheduling another one.
 if(m.stack.some(f=>f.kind==='decision'&&(f.handler==='capacity:used'||f.handler==='table:lost-order')))return false;
 const ship=Object.values(m.cards).find(c=>c.zone==='table'&&affected(m,c.id)&&overflow(m,c.id));if(!ship)return false;
 const available=candidates(m,ship.id);if(!available.length)throw Error('Unsupported lost capacity.');
 if(available.length===1)place(m,available[0].id,ship.id);
 else m.stack.push({kind:'decision',side:ship.owner,handler:'capacity:used',payload:{ship:referenceCard(m,ship.id),candidates:available} as unknown as Json});
 return true;
}
export function capacityChoices(m:Match,d:Decision){return (d.payload as unknown as Choice).candidates.map(c=>({id:'capacity:used:'+c.id,label:'Place '+cardDefinition(m,c.id).name+' on top of Used · astromech capacity removed'}));}
export function capacityChoose(m:Match,d:Decision,id:string):void{
 if(!capacityChoices(m,d).some(c=>c.id===id))throw Error('Invalid displaced astromech.');place(m,id.slice('capacity:used:'.length),(d.payload as unknown as Choice).ship.id);
}
export function assertCapacityLoss(m:Match):void{
 if(m.data.capacityReturns!==undefined&&!Array.isArray(m.data.capacityReturns))throw Error('Invalid capacity return history.');
 for(const p of (m.data.capacityReturns??[]) as unknown as {card:CardReference;ship:CardReference;name:string;turn:number}[]){
  assertCardReference(m,p.card);assertCardReference(m,p.ship);
  if(p.card.zone!=='table'||p.ship.zone!=='table'||!isModel(m,p.card.id,'ASTROMECH')||cardDefinition(m,p.ship.id).type!=='Starship'||p.name!==cardDefinition(m,p.card.id).name||!Number.isSafeInteger(p.turn)||p.turn<1||p.turn>m.turn.number)throw Error('Invalid capacity placement record.');
 }
 const hosts=new Set<string>();
 for(const f of m.stack)if(f.kind==='decision'&&f.handler==='capacity:used'){
  const p=f.payload as unknown as Choice;
  if(!p||hosts.has(p.ship?.id)||!sameCard(m,p.ship)||f.side!==m.cards[p.ship.id].owner||!affected(m,p.ship.id)||!overflow(m,p.ship.id)||JSON.stringify(p.candidates)!==JSON.stringify(candidates(m,p.ship.id)))throw Error('Invalid capacity loss choice.');hosts.add(p.ship.id);
 }
}
