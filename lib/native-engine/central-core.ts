import {controls,name} from './board';
import {gameTextActive} from './game-text';
import {referenceCard,sameCard,assertCardReference,type CardReference} from './identity';
import {loseFromTable} from './table';
import {moveCard} from './state';
import {openWindow,retireAction,type RequiredAction} from './runtime';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Payload={source:CardReference;target:CardReference;window:number;index?:number;actionId?:string;stage?:'cancel'};
export const controlledCentralCore=(m:Match,side:Side)=>m.locations.find(id=>m.cards[id].blueprint==='1_283'&&gameTextActive(m,id)&&controls(m,side,id));
const action=(p:Payload):Action=>({id:'central-core:cancel:'+p.source.id+':'+p.target.id+':'+p.target.version+':'+p.window,handler:'central-core:cancel',source:p.source.id,label:'Central Core · cancel Death Star Tractor Beam',payload:p as unknown as Json});
function deploying(m:Match,p:Payload):Resolution|undefined {
 const f=p.index===undefined?undefined:m.stack[p.index],w=p.index===undefined?undefined:m.stack[p.index+1];
 return f?.kind==='resolution'&&!f.cancelled&&!f.awaitingResponses&&f.action.handler==='tractor:deploy'&&f.action.source===p.target.id&&f.action.id===p.actionId&&w?.kind==='window'&&w.timing==='response'&&w.event===undefined&&w.serial===p.window?f:undefined;
}
export function centralCoreAutomatic(m:Match,w:Window):RequiredAction[]{
 const source=controlledCentralCore(m,'light');if(!source)return [];
 const pending=m.stack.filter(f=>f.kind==='resolution'&&f.action.handler==='central-core:cancel').map(f=>(f as Resolution).action.payload as unknown as Payload);
 // The on-table trigger is singleton: choose one beam, finish canceling it,
 // then reconsider remaining beams when that cancellation changes the table.
 if(pending.some(p=>p.source.id===source))return [];
 const parent=m.stack.at(-2),playing=w.timing==='response'&&w.event===undefined&&parent?.kind==='resolution'&&!parent.cancelled&&!parent.awaitingResponses&&parent.action.handler==='tractor:deploy'?parent:undefined;
 const targets=Object.values(m.cards).filter(c=>c.blueprint==='2_111'&&(c.zone==='table'||c.zone==='playing'&&playing?.action.source===c.id));
 return targets.map((c,i)=>{
  const p:Payload={source:referenceCard(m,source),target:referenceCard(m,c.id),window:w.serial,...(c.zone==='playing'?{index:m.stack.length-2,actionId:playing!.action.id}:{})};
  return {...action(p),label:'Central Core · cancel '+name(m,c.id)+(c.location?' at '+name(m,c.location):'')+(targets.length>1?' · beam '+(i+1)+' of '+targets.length:''),actor:'light'};
 });
}
export function centralCoreResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload;
 if(r.cancelled||!sameCard(m,p.target))return;
 if(p.target.zone==='table'&&!p.stage){
  p.stage='cancel';m.stack.push(r);
  openWindow(m,'response','dark',{kind:'about-to-be-canceled-on-table',card:p.target.id,source:p.source.id});return;
 }
 // Once initiated, a required cancellation survives loss of control or text.
 if(p.target.zone==='playing'){
  if(!deploying(m,p))return;retireAction(m,p.index!,p.actionId!,p.window);moveCard(m,p.target.id,'lost');
 }else loseFromTable(m,[p.target.id]);
 openWindow(m,'response','dark',{kind:'card-canceled',card:p.target.id,source:p.source.id});
}
export function assertCentralCore(m:Match):void {
 for(const [index,f]of m.stack.entries())if(f.kind==='resolution'&&f.action.handler.startsWith('central-core:')){
  const p=f.action.payload as unknown as Payload;
  if(!p||f.action.handler!=='central-core:cancel'||f.actor!=='light'||f.action.source!==p.source?.id||f.action.id!==action(p).id||f.action.payment||f.action.unrespondable)throw Error('Invalid Central Core cancellation.');
  assertCardReference(m,p.source);assertCardReference(m,p.target);
  const bound=m.stack.findIndex(x=>x.kind==='window'&&x.serial===p.window);
  if(m.cards[p.source.id].blueprint!=='1_283'||p.source.zone!=='table'||m.cards[p.target.id].blueprint!=='2_111'||!['table','playing'].includes(p.target.zone)||bound<0||bound>=index)throw Error('Invalid Central Core trigger binding.');
  if(p.stage!==undefined){
   const w=m.stack[index+1],e=w?.kind==='window'?w.event as {kind?:string;card?:string;source?:string}|undefined:undefined;
   if(p.stage!=='cancel'||p.target.zone!=='table'||w?.kind!=='window'||w.timing!=='response'||e?.kind!=='about-to-be-canceled-on-table'||e.card!==p.target.id||e.source!==p.source.id)throw Error('Invalid Central Core cancellation continuation.');
  }
  if(p.target.zone==='playing'){
   if(!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=bound||typeof p.actionId!=='string')throw Error('Invalid Core deployment target.');
   const parent=m.stack[p.index!];if(parent?.kind!=='resolution'||parent.action.id!==p.actionId||!['tractor:deploy','core:canceled'].includes(parent.action.handler)||m.stack[p.index!+1]!==m.stack[bound])throw Error('Missing Core deployment action.');
  }else if(p.index!==undefined||p.actionId!==undefined)throw Error('Unexpected Core deployment binding.');
 }
}
