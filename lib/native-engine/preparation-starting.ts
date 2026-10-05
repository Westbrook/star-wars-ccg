import {name} from './board';
import {effectSearchBlueprints} from './effect-search';
import {referenceCard,assertCardReference,type CardReference} from './identity';
import {canPlayCard} from './persona';
import {preparationBlueprint} from './preparation-destiny';
import {openWindow} from './runtime';
import type {StartingInterruptRules} from './starting-interrupts';
import {moveCard} from './state';
import {startingEffectBlueprints,initiateStartingEffect} from './starting-effects';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side} from './types';

const startingBlueprints=(side:Side)=>[preparationBlueprint(side),side==='dark'?'6_160':'6_77'];
const effectLimit=(m:Match,card:string)=>effectSearchBlueprints.includes(m.cards[card].blueprint)?1:3;
type Payload={card:string;count:number;chosen:CardReference[]};
const payload=(f:Decision|Resolution)=>('action' in f?f.action.payload:f.payload) as unknown as Payload;
const finished=(m:Match)=>(m.data.preparationStarts??[]) as string[];
const source=(m:Match)=>{const i=m.setup?.interrupts;return i&&m.setup?.stage==='starting-resolve'?i.selected[i.order[i.resolved]]:null;};
// Explicit implemented deployment adapters. Additional printed Effects require
// their real behavior; eligible wording alone is not native card admission.
export const startingEffects=(m:Match,side:Side)=>m.players[side].reserve.filter(id=>startingEffectBlueprints.includes(m.cards[id].blueprint)&&canPlayCard(m,id));
const action=(step:string,p:Payload):Action=>({id:'prep-start:'+step+':'+p.card+':'+p.count,handler:'prep-start:'+step,source:p.card,label:'Resolve '+nameFor(step),payload:p as unknown as Json});
const nameFor=(step:string)=>step==='finish'?'Starting Interrupt':'starting Effect search';
const queue=(m:Match,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,action:action(step,p),cancelled:false});
const choose=(m:Match,p:Payload)=>m.stack.push({kind:'decision',side:m.cards[p.card].owner,handler:'prep-start:choose',payload:p as unknown as Json});
export const preparationStarting:StartingInterruptRules={
 candidates:(m,side)=>m.players[side].reserve.filter(id=>startingBlueprints(side).includes(m.cards[id].blueprint)),
 choices:(m,card)=>[{id:'prep-start:begin:'+card,label:'Resolve '+name(m,card)}],
 apply:(m,card,id)=>{
  if(id!=='prep-start:begin:'+card||m.cards[card].zone!=='reserve'||finished(m).includes(card))throw Error('Invalid Starting Interrupt initiation.');
  moveCard(m,card,'playing');const p:Payload={card,count:0,chosen:[]};queue(m,'finish',p);queue(m,'search',p);openWindow(m,'response',other(m.cards[card].owner));return false;
 },
 running:(m,card)=>['playing','lost'].includes(m.cards[card]?.zone)&&m.stack.some(f=>f.kind==='resolution'&&f.action.handler==='prep-start:finish'&&payload(f).card===card),
 complete:(m,card)=>finished(m).includes(card),
 validate:assertPreparationStarting,
};
export function preparationStartingResolve(m:Match,r:Resolution){
 const p=payload(r),side=m.cards[p.card].owner,h=r.action.handler;
 if(h==='prep-start:finish'){
  if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');
  m.data.preparationStarts=[...finished(m),p.card];
 }else if(!r.cancelled&&m.cards[p.card].zone==='playing'){
  if(h==='prep-start:search'){queue(m,'inspect',p);openWindow(m,'response',other(side),{kind:'before-looking-at-pile',side,pile:'reserve',source:p.card});}
  else if(h==='prep-start:inspect')choose(m,p);
  else if(h==='prep-start:after'){
   if(p.count<effectLimit(m,p.card)&&startingEffects(m,side).length)choose(m,p);
  }else throw Error('Unknown starting preparation continuation.');
 }
}
export function preparationStartingChoices(m:Match,d:Decision){
 const p=payload(d),side=m.cards[p.card].owner;
 if(d.handler==='prep-start:verify')return [{id:'prep-start:verified',label:'Finish verification · no eligible Effect'}];
 const eligible=startingEffects(m,side);
 return [...eligible.map(id=>({id:'prep-start:deploy:'+id,label:'Deploy '+name(m,id)})),...(p.count?[{id:'prep-start:done',label:'Finish with '+p.count+' Effect'+(p.count===1?'':'s')}]:eligible.length?[]:[{id:'prep-start:not-found',label:'No eligible Effect · allow opponent to verify'}])];
}
export function preparationStartingChoose(m:Match,d:Decision,id:string){
 const p=payload(d),side=m.cards[p.card].owner;
 if(!preparationStartingChoices(m,d).some(c=>c.id===id))throw Error('Invalid starting Effect choice.');
 if(id==='prep-start:not-found'){m.stack.push({kind:'decision',side:other(side),handler:'prep-start:verify',payload:p as unknown as Json});return;}
 if(id==='prep-start:verified'){
  // Before turn one this does not restrict any first-turn search function.
  // Completion is recorded with the Starting Interrupt, not in turn history.
  return;
 }
 if(id==='prep-start:done')return;
 const card=id.slice('prep-start:deploy:'.length),next:Payload={card:p.card,count:p.count+1,chosen:[...p.chosen,referenceCard(m,card)]};
 queue(m,'after',next);
 initiateStartingEffect(m,card);openWindow(m,'response',other(side));
}
export function preparationStartingView(m:Match,seat:Side){
 const d=m.stack.at(-1);if(m.status!=='setup'||d?.kind!=='decision'||!d.handler.startsWith('prep-start:'))return {startingSearch:null};
 const p=payload(d),side=m.cards[p.card].owner,verify=d.handler==='prep-start:verify';
 // Only the searching player, or the opponent during explicit verification,
 // receives hidden cards. Sorting removes irrelevant original pile order.
 const visible=seat===d.side;
 return {startingSearch:{source:name(m,p.card),side,stage:verify?'verify':'search',count:p.count,cards:visible?[...m.players[side].reserve].sort().map(id=>({...m.cards[id]})):[]}};
}
export function assertPreparationStarting(m:Match){
 const done=finished(m);if(!Array.isArray(done)||new Set(done).size!==done.length||done.some(id=>!m.cards[id]||!startingBlueprints(m.cards[id].owner).includes(m.cards[id].blueprint)))throw Error('Invalid completed starting preparations.');
 if(m.setup?.interrupts)for(const side of ['dark','light'] as const){const id=m.setup.interrupts.selected[side];if(id!==null&&!startingBlueprints(side).includes(m.cards[id]?.blueprint))throw Error('Invalid starting preparation selection.');}
 for(const f of m.stack){
  if(f.kind==='window'){if(m.status==='setup'&&f.timing!=='response')throw Error('Setup cannot enter a turn window.');continue;}
  const h=f.kind==='decision'?f.handler:f.action.handler;if(!h.startsWith('prep-start:'))continue;
  const p=payload(f),side=m.cards[p?.card]?.owner;
  if(!p||!['setup','finished'].includes(m.status)||source(m)!==p.card||!startingBlueprints(side).includes(m.cards[p.card]?.blueprint)||(m.cards[p.card].zone!=='playing'&&!(h==='prep-start:finish'&&m.cards[p.card].zone==='lost'))||finished(m).includes(p.card)||!Number.isSafeInteger(p.count)||p.count<0||p.count>effectLimit(m,p.card)||!Array.isArray(p.chosen)||p.chosen.length!==p.count||new Set(p.chosen.map(r=>r.id)).size!==p.count)throw Error('Invalid starting preparation continuation.');
  if(f.kind==='decision'){
   if(!['prep-start:choose','prep-start:verify'].includes(h)||f.side!==(h==='prep-start:verify'?other(side):side)||h==='prep-start:verify'&&(p.count!==0||startingEffects(m,side).length))throw Error('Invalid starting search decision.');
  }else if(!['prep-start:search','prep-start:inspect','prep-start:finish','prep-start:after'].includes(h)||f.actor!==side||f.action.id!==action(h.slice(11),p).id||f.action.source!==p.card||f.action.payment||f.action.unrespondable)throw Error('Invalid starting preparation action.');
  for(const ref of p.chosen){assertCardReference(m,ref);if(ref.zone!=='reserve'||m.cards[ref.id].owner!==side||!startingEffectBlueprints.includes(m.cards[ref.id].blueprint))throw Error('Invalid starting Effect history.');}
 }
}
