import {controls,name,system} from './board';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {sectorKind,sectorSystem} from './sectors';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={source:CardReference;window:number;index:number;pending:string;mode:'boost'|'cancel';turn:number};
type Use={source:CardReference;turn:number};
const uses=(m:Match)=>(m.data.cloudDrainUses??[]) as unknown as Use[];
function pending(m:Match,p:Payload){const r=m.stack[p.index],w=m.stack[p.index+1];return r?.kind==='resolution'&&r.action.id===p.pending&&r.action.handler==='ground:drain'&&w?.kind==='window'&&w.serial===p.window?r:undefined;}
const key=(p:Payload)=>'sector:'+p.mode+':'+p.source.id+':'+p.window;
export function sectorActions(m:Match,w:Window,side:Side):Action[]{
 const index=m.stack.indexOf(w)-1,r=m.stack[index];if(w.timing!=='response'||r?.kind!=='resolution'||r.action.handler!=='ground:drain'||r.cancelled||r.awaitingResponses)return [];
 const at=(r.action.payload as {site:string}).site;
 return m.locations.filter(id=>m.cards[id].owner===side&&sectorKind(m,id)&&gameTextActive(m,id)&&controls(m,side,id)).flatMap(id=>{
  const boost=sectorKind(m,id)==='cloud'&&r.actor===side&&cardDefinition(m,at).subType==='Site'&&system(m,at)===sectorSystem(m,id)&&!uses(m).some(u=>u.turn===m.turn.number&&u.source.id===id&&u.source.version===referenceCard(m,id).version);
  const cancel=sectorKind(m,id)==='asteroid'&&cardDefinition(m,at).subType==='System'&&system(m,at)===sectorSystem(m,id);
  if(!boost&&!cancel)return [];
  const p:Payload={source:referenceCard(m,id),window:w.serial,index,pending:r.action.id,mode:boost?'boost':'cancel',turn:m.turn.number};
  return [{id:key(p),handler:'sector:'+p.mode,source:id,label:name(m,id)+' · '+(boost?'add 1 to':'cancel')+' Force drain at '+name(m,at),payload:p as unknown as Json}];
 });
}
export function sectorInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;if(p.mode==='boost')m.data.cloudDrainUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.source,turn:m.turn.number}] as unknown as Json;
}
export function sectorResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,target=pending(m,p);if(r.cancelled||!target||target.cancelled)return;
 if(p.mode==='boost'){const t=target.action.payload as {sectorBonus?:number};t.sectorBonus=1;} // Copies of Clouds are not cumulative on the same drain.
 else {target.cancelled=true;openWindow(m,'response',other(r.actor),{kind:'force-drain-cancelled',site:(target.action.payload as {site:string}).site,source:p.source.id,cause:'asteroid-field'});}
}
export function assertSectorEffects(m:Match):void{
 const u=uses(m);if(!Array.isArray(u)||new Set(u.map(x=>x.source?.id+':'+x.source?.version+':'+x.turn)).size!==u.length)throw Error('Invalid cloud drain usage.');
 for(const v of u){assertCardReference(m,v.source);if(v.source.zone!=='table'||sectorKind(m,v.source.id)!=='cloud'||!Number.isSafeInteger(v.turn)||v.turn<1||v.turn>m.turn.number)throw Error('Invalid cloud drain use.');}
 for(const [i,r] of m.stack.entries())if(r.kind==='resolution'&&r.action.handler.startsWith('sector:')){
  const p=r.action.payload as unknown as Payload;assertCardReference(m,p.source);
  if(!['boost','cancel'].includes(p.mode)||r.action.handler!=='sector:'+p.mode||r.action.id!==key(p)||r.action.source!==p.source.id||p.source.zone!=='table'||m.cards[p.source.id].owner!==r.actor||sectorKind(m,p.source.id)!==(p.mode==='boost'?'cloud':'asteroid')||p.turn!==m.turn.number||!Number.isSafeInteger(p.index)||p.index<0||p.index>=i||!pending(m,p)||p.mode==='boost'&&!u.some(v=>v.turn===p.turn&&v.source.id===p.source.id&&v.source.version===p.source.version))throw Error('Invalid sector response binding.');
 }
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler==='ground:drain'){const b=(r.action.payload as {sectorBonus?:number}).sectorBonus;if(b!==undefined&&(!Number.isSafeInteger(b)||b<1||b>1))throw Error('Invalid sector drain modifier.');}
}
