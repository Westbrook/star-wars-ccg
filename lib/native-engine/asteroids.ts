import {name} from './board';
import {cardDefinition} from './definitions';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {destinyInWindow} from './destiny-response';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {vesselArmor,vesselManeuver} from './piloting';
import {openWindow,type RequiredAction} from './runtime';
import {sectorKind,sectorSystem,sectorsAt} from './sectors';
import {loseFromTable,tableLossCards} from './table';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

export type AsteroidDraw={serial:number;turn:number;target:CardReference;site:CardReference;side:Side;window:number;stage:'destiny'|'total'|'loss'|'complete';draw?:Draw;total?:number|null;defense?:number;immediate?:boolean;lost?:boolean;departed?:boolean};
type Payload={target:CardReference;site:CardReference;window:number;serial?:number;immediateWindow?:number;draw?:Draw;total?:number|null;draws?:Draw[]};
export const asteroidDraws=(m:Match)=>(m.data.asteroidDraws??[]) as unknown as AsteroidDraw[];
const active=(m:Match)=>asteroidDraws(m).findLast(d=>d.stage!=='complete');
const atOriginal=(m:Match,d:AsteroidDraw)=>sameCard(m,d.target)&&sameCard(m,d.site)&&m.cards[d.target.id].location===d.site.id&&!m.cards[d.target.id].attachedTo;
const action=(step:string,p:Payload):Action=>({id:'asteroid:'+step+':'+p.target.id+':'+p.target.version+':'+p.site.id+':'+p.window,handler:'asteroid:'+step,source:p.site.id,label:'Draw asteroid destiny against '+p.target.id,payload:p as unknown as Json});
function targets(m:Match){return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===m.turn.side&&!c.attachedTo&&c.location&&sectorKind(m,c.location)==='asteroid'&&cardDefinition(m,c.id).type==='Starship'&&!asteroidDraws(m).some(d=>d.turn===m.turn.number&&d.target.id===c.id&&sameCard(m,d.target)&&d.site.id===c.location&&sameCard(m,d.site)));}
export function asteroidActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='control'||side!==other(m.turn.side)||active(m))return [];
 return targets(m).map(c=>({...action('begin',{target:referenceCard(m,c.id),site:referenceCard(m,c.location!),window:w.serial}),label:'Asteroid destiny · '+name(m,c.id)+' '+c.id}));
}
export function asteroidAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;phase?:string;side?:Side}|undefined;
 if(w.timing==='response'&&e?.kind==='phase-end'&&e.phase==='control'&&!active(m))return targets(m).map(c=>({...action('begin',{target:referenceCard(m,c.id),site:referenceCard(m,c.location!),window:w.serial}),actor:other(m.turn.side),label:'Asteroid destiny · '+name(m,c.id)+' '+c.id}));
 const d=active(m),draw=destinyInWindow(m,w),p=draw?.resolution.action.payload as {category?:string;draw?:Draw;next?:{payload?:Payload}}|undefined;
 if(d?.stage==='destiny'&&draw&&p?.category==='asteroid'&&p.next?.payload?.serial===d.serial&&p.draw?.card&&sectorKind(m,p.draw.card)==='asteroid'&&atOriginal(m,d))return [{...action('immediate',{target:d.target,site:d.site,window:d.window,serial:d.serial,immediateWindow:w.serial}),actor:d.side}];
 return [];
}
export function asteroidInitiate(m:Match,r:Resolution):void{
 if(r.action.handler!=='asteroid:begin')return;
 const p=r.action.payload as unknown as Payload;p.serial=++m.serial;
 m.data.asteroidDraws=[...asteroidDraws(m),{serial:p.serial,turn:m.turn.number,target:p.target,site:p.site,side:r.actor,window:p.window,stage:'destiny'}] as unknown as Json;
}
const queue=(m:Match,side:Side,step:string,p:Payload)=>m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action(step,p)});
function loss(m:Match,d:AsteroidDraw,p:Payload){
 if(!atOriginal(m,d))return;queue(m,d.side,'lose',p);const cards=tableLossCards(m,[d.target.id]);openWindow(m,'response',other(d.side),{kind:'about-to-lose',card:d.target.id,cards,cardRefs:cards.map(id=>referenceCard(m,id)),site:d.site.id,cause:'asteroid'});
}
export function asteroidResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,d=asteroidDraws(m).find(d=>d.serial===p.serial);if(!d)throw Error('Missing asteroid destiny.');
 const step=r.action.handler.slice(9);
 if(step==='begin'){
  queue(m,r.actor,'finish',p);if(r.cancelled||!atOriginal(m,d)){d.departed=!atOriginal(m,d);return;}drawDestiny(m,r.actor,d.site.id,'asteroid',action('drawn',p),false);return;
 }
 if(step==='finish'){d.stage='complete';return;}
 if(r.cancelled)return;
 if(step==='immediate'){d.immediate=true;loss(m,d,p);return;}
 if(step==='drawn'){
  d.draw=p.draw!;d.stage='total';
  const extra=Math.max(0,sectorsAt(m,sectorSystem(m,d.site.id)!,'asteroid').length-1);
  completeDestinyTotal(m,r.actor,d.site.id,'asteroid',[d.draw],action('result',p),extra);return;
 }
 if(step==='result'){
  d.total=p.total!;d.defense=Math.max(vesselArmor(m,d.target.id)??0,vesselManeuver(m,d.target.id)??0);d.departed=!atOriginal(m,d);d.stage='loss';
  if(!d.departed&&d.total!==null&&d.total>d.defense)loss(m,d,p);return;
 }
 if(step==='lose'){if(atOriginal(m,d)){d.lost=true;queue(m,r.actor,'lost',p);loseFromTable(m,[d.target.id]);}return;}
 if(step==='lost'){openWindow(m,'response',r.actor,{kind:'starship-lost',card:d.target.id,site:d.site.id,cause:'asteroid'});return;}
 throw Error('Unknown asteroid continuation.');
}
export function asteroidView(m:Match){const d=asteroidDraws(m).at(-1);return {asteroid:d?{name:name(m,d.target.id),site:name(m,d.site.id),stage:d.stage,draw:d.draw?.value??null,total:d.total??null,defense:d.defense??null,immediate:!!d.immediate,lost:!!d.lost}:null};}
export function assertAsteroids(m:Match):void{
 const draws=asteroidDraws(m);if(!Array.isArray(draws)||draws.filter(d=>d.stage!=='complete').length>1||new Set(draws.map(d=>d.serial)).size!==draws.length)throw Error('Invalid asteroid history.');
 for(const d of draws){
  assertCardReference(m,d.target);assertCardReference(m,d.site);
  if(!Number.isSafeInteger(d.serial)||d.serial<1||d.serial>m.serial||!Number.isSafeInteger(d.turn)||d.turn<1||d.turn>m.turn.number||d.target.zone!=='table'||d.site.zone!=='table'||cardDefinition(m,d.target.id).type!=='Starship'||sectorKind(m,d.site.id)!=='asteroid'||d.side!==other(m.cards[d.target.id].owner)||!Number.isSafeInteger(d.window)||d.window<1||d.window>m.serial||!['destiny','total','loss','complete'].includes(d.stage)||d.draw!==undefined&&!validDraw(m,d.draw,d.side)||d.total!==undefined&&d.total!==null&&(!Number.isFinite(d.total)||d.total<0)||d.defense!==undefined&&(!Number.isFinite(d.defense)||d.defense<0)||['immediate','lost','departed'].some(k=>d[k as 'lost']!==undefined&&typeof d[k as 'lost']!=='boolean'))throw Error('Invalid asteroid result.');
 }
 for(const r of m.stack)if(r.kind==='resolution'){
  const flow=r.action.payload as {category?:string;source?:string;side?:Side;next?:Action},direct=r.action.handler.startsWith('asteroid:'),destiny=r.action.handler.startsWith('destiny:')&&flow.category==='asteroid';
  if(!direct&&!destiny)continue;
  const a=direct?r.action:flow.next!,p=a?.payload as unknown as Payload,d=draws.find(d=>d.serial===p?.serial);
  if(!d||d.stage==='complete'||r.actor!==d.side||!p||p.target?.id!==d.target.id||p.target.version!==d.target.version||p.target.zone!=='table'||p.site?.id!==d.site.id||p.site.version!==d.site.version||p.site.zone!=='table'||p.window!==d.window||a.id!==action(a.handler.slice(9),p).id||a.source!==d.site.id||!['begin','drawn','result','immediate','lose','lost','finish'].includes(a.handler.slice(9))||destiny&&(flow.side!==d.side||flow.source!==d.site.id))throw Error('Invalid asteroid continuation binding.');
  if(a.handler==='asteroid:immediate'){
   const window=m.stack.find(f=>f.kind==='window'&&f.serial===p.immediateWindow),draw=window?.kind==='window'?destinyInWindow(m,window):undefined;
   const flow=draw?.resolution.action.payload as {category?:string;draw?:Draw;next?:{payload?:Payload}}|undefined;
   if(!window||window.kind!=='window'||!window.completed.includes(a.id)||flow?.category!=='asteroid'||flow.next?.payload?.serial!==d.serial||!flow.draw?.card||sectorKind(m,flow.draw.card)!=='asteroid')throw Error('Invalid immediate asteroid trigger.');
  }
  const parent=m.stack.find(f=>f.kind==='window'&&f.serial===d.window);if(!parent||parent.kind!=='window'||m.turn.phase!=='control'||m.turn.number!==d.turn||!(parent.timing==='phase'||(parent.event as {kind?:string;phase?:string})?.kind==='phase-end'))throw Error('Invalid asteroid phase binding.');
 }
}
