import {mayActivate} from './activation';
import {insertsIn} from './reserve-inserts';
import {activateOneForce, openWindow} from './runtime';
import {other, sides, type Decision, type Json, type Match, type Resolution, type Side} from './types';
export type Declaration={turn:number;side:Side;before:number;count:number;remaining:number;done:boolean;extend:boolean};
export const opposingInserts=(m:Match,side:Side)=>insertsIn(m,side).some(x=>m.cards[x.card.id].owner!==side);
export const declaration=(m:Match):Declaration|undefined=>{const p=m.data.normalActivation as unknown as Declaration|undefined;return p?.turn===m.turn.number?p:undefined;};
export function mayActivateNormally(m:Match):boolean{const p=declaration(m);return !p||p.done&&p.extend;}
export function needsDeclaration(m:Match):boolean{return opposingInserts(m,m.turn.side)&&!declaration(m);}
export function askActivationAmount(m:Match):void{m.stack.push({kind:'decision',side:m.turn.side,handler:'core:activation-amount',payload:{turn:m.turn.number,maximum:Math.floor(m.turn.generation)-m.turn.activated}});}
export function activationAmountChoices(m:Match,d:Decision){const p=d.payload as {maximum:number};return Array.from({length:p.maximum+1},(_,n)=>({id:'core:activation-amount:'+n,label:n?'Declare '+n+' Force to activate':'Declare no activation'}));}
function queue(m:Match):void{m.stack.push({kind:'resolution',actor:m.turn.side,cancelled:false,action:{id:'core:declared-activation',handler:'core:declared-activation',label:'Continue declared activation',payload:{turn:m.turn.number}}});}
export function chooseActivationAmount(m:Match,d:Decision,id:string):void{
 if(!activationAmountChoices(m,d).some(c=>c.id===id))throw Error('Invalid activation declaration.');
 const count=Number(id.split(':')[2]);m.data.normalActivation={turn:m.turn.number,side:m.turn.side,before:m.turn.activated,count,remaining:count,done:false,extend:false};queue(m);
}
export function resolveDeclaredActivation(m:Match,r:Resolution):void{
 const p=declaration(m)!;
 if(r.cancelled||!p.remaining||!mayActivate(m,p.side)||!m.players[p.side].reserve.length){p.done=true;p.extend=!opposingInserts(m,p.side);return;}
 p.remaining--;queue(m);
 // Between ordinary activations players may still take phase actions. The
 // opponent gets the next top-level opportunity after this unit of Force.
 // The temporary window returns to the same declaration after both pass.
 openWindow(m,'phase',other(p.side),{kind:'activation-between',turn:p.turn});
 if(activateOneForce(m,p.side))m.turn.activated++;
}
export function assertDeclaredActivation(m:Match):void{
 const p=m.data.normalActivation as unknown as Declaration|undefined;
 if(p&&(!Number.isSafeInteger(p.turn)||p.turn<1||p.turn>m.turn.number||!sides.includes(p.side)||!Number.isSafeInteger(p.before)||p.before<0||!Number.isSafeInteger(p.count)||p.count<0||!Number.isSafeInteger(p.remaining)||p.remaining<0||p.remaining>p.count||typeof p.done!=='boolean'||typeof p.extend!=='boolean'))throw Error('Invalid normal activation declaration.');
 if(p?.turn===m.turn.number&&(p.side!==m.turn.side||p.before+p.count>Math.floor(m.turn.generation)||m.turn.activated<p.before+p.count-p.remaining))throw Error('Stale activation declaration.');
 let batches=0;
 for(const [i,f] of m.stack.entries()){
  if(f.kind==='decision'&&f.handler==='core:activation-amount'){
   const q=f.payload as {turn:number;maximum:number};if(f.side!==m.turn.side||q?.turn!==m.turn.number||!Number.isSafeInteger(q.maximum)||q.maximum<0||q.maximum!==Math.floor(m.turn.generation)-m.turn.activated||declaration(m))throw Error('Invalid activation amount decision.');
  }
  if(f.kind==='resolution'&&f.action.handler==='core:declared-activation'){
   if(++batches>1||!p||p.turn!==m.turn.number||p.done||f.actor!==p.side||f.action.id!=='core:declared-activation'||(f.action.payload as {turn:number})?.turn!==p.turn||f.awaitingResponses||f.action.payment)throw Error('Invalid declared activation continuation.');
  }
  if(f.kind==='window'&&(f.event as {kind?:string})?.kind==='activation-between'){
   const parent=m.stack[i-1];if(f.timing!=='phase'||(f.event as {turn:number}).turn!==m.turn.number||parent?.kind!=='resolution'||parent.action.handler!=='core:declared-activation')throw Error('Invalid activation interval.');
  }
 }
 if(p?.turn===m.turn.number&&!p.done&&batches!==1)throw Error('Missing declared activation continuation.');
}
