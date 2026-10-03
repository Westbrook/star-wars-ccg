import {queueForceLoss} from './ground';
import {assertCardReference, type CardReference} from './identity';
import type {RequiredAction} from './runtime';
import {other, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Obligation={source:CardReference;side:Side;created:number;watching?:number};
const obligations=(m:Match)=>(m.data.angerObligations??[]) as unknown as Obligation[];
const key=(p:Obligation)=>p.source.id+':'+p.source.version;
export function registerAnger(m:Match,source:CardReference,side:Side):void{
  m.data.angerObligations=[...obligations(m),{source,side,created:m.serial}] as unknown as Json;
}
const action=(step:string,p:Obligation)=>({id:'anger:'+step+':'+key(p),handler:'anger:'+step,source:p.source.id,label:step==='loss'?'Anger, Fear, Aggression · lose 4 Force':step==='satisfy'?'Battle initiated · obligation satisfied':'Anger, Fear, Aggression · watch this battle phase',payload:p as unknown as Json});
export function angerAutomatic(m:Match,w:Window):RequiredAction[]{
  const e=w.event as {kind?:string;phase?:string;side?:Side}|undefined,parent=m.stack.at(-2);
  return obligations(m).flatMap(p=>{
    if(w.serial<=p.created)return [];
    const step=e?.kind==='phase-start'&&e.phase==='battle'&&e.side===p.side&&p.watching===undefined?'watch':
      e?.kind==='phase-end'&&e.phase==='battle'&&e.side===p.side&&p.watching===m.turn.number?'loss':
      w.timing==='response'&&!e&&parent?.kind==='resolution'&&parent.action.handler==='battle:begin'&&!parent.awaitingResponses&&parent.actor===p.side?'satisfy':null;
    return step?[{...action(step,p),actor:other(p.side),...(step!=='loss'?{unrespondable:true as const}:{})}]:[];
  });
}
export function angerResolve(m:Match,r:Resolution):void{
  const p=r.action.payload as unknown as Obligation,current=obligations(m).find(x=>key(x)===key(p));
  if(!current)return;
  if(r.action.handler==='anger:watch'){if(!r.cancelled)current.watching=m.turn.number;return;}
  m.data.angerObligations=obligations(m).filter(x=>key(x)!==key(p)) as unknown as Json;
  if(r.action.handler==='anger:loss'&&!r.cancelled)queueForceLoss(m,{side:p.side,remaining:4,source:p.source.id,site:null,reductionUsed:false});
}
function assertObligation(m:Match,p:Obligation):void{
  if(!p||p.side!=='dark'||!Number.isSafeInteger(p.created)||p.created<1||p.created>m.serial||p.watching!==undefined&&(!Number.isSafeInteger(p.watching)||p.watching<1||p.watching>m.turn.number))throw Error('Invalid Anger obligation.');
  assertCardReference(m,p.source);if(p.source.zone!=='table'||m.cards[p.source.id].blueprint!=='4_16'||m.cards[p.source.id].owner!=='light')throw Error('Invalid Anger source.');
}
export function assertAnger(m:Match):void{
  if(m.data.angerObligations!==undefined&&!Array.isArray(m.data.angerObligations))throw Error('Invalid Anger history.');
  const all=obligations(m);for(const p of all)assertObligation(m,p);
  if(new Set(all.map(key)).size!==all.length)throw Error('Duplicate Anger obligation.');
  for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('anger:')){
    const p=f.action.payload as unknown as Obligation;assertObligation(m,p);
    if(!['anger:watch','anger:satisfy','anger:loss'].includes(f.action.handler)||f.actor!=='light'||f.action.source!==p.source.id||f.action.id!==action(f.action.handler.slice(6),p).id)throw Error('Invalid Anger continuation.');
  }
}
export function angerView(m:Match):Json{return {anger:obligations(m).map(p=>({card:p.source.id,side:p.side,watching:p.watching===m.turn.number}))};}
