import {moveCard} from './state';
import {cardDefinition} from './definitions';
import {creatureProfile,supportedCreature,ferocityPlan,ferocityValue} from './creature-profile';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {beginDestinySequence,assertDestinyScope} from './destiny-limits';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {shuffled} from './random';
import {openWindow,type Context,type RequiredAction} from './runtime';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Encounter={serial:number;site:CardReference;creatures:CardReference[];actor:Side;stage:'begin'|'ferocity'|'loss'|'complete';index:number;draws:Draw[][];totals:(number|null)[];destinyTotals:(number|null)[];scopes:(string|null)[];counts:(number|null)[];defeated:CardReference[];lost:CardReference[];ended?:true};
type Payload={site:CardReference;serial?:number;draw?:Draw;total?:number|null;index?:number};
const history=(m:Match)=>(m.data.creatureEncounters??[]) as unknown as Encounter[];
export const currentEncounter=(m:Match)=>history(m).at(-1);
const active=(m:Match)=>{const e=currentEncounter(m);return e&&e.stage!=='complete'?e:undefined;};
/** One-Arm supplies the icon immediately and keeps it for the rest of the game.
 * Remember the source instance even after it leaves; no extra response is created. */
export function rememberSelectiveWampas(m:Match):boolean {
 if(m.data.selectiveWampas)return false;
 const source=Object.values(m.cards).find(c=>c.blueprint==='7_212'&&gameTextActive(m,c.id));if(!source)return false;
 m.data.selectiveWampas=referenceCard(m,source.id) as unknown as Json;return true;
}
export function selectiveCreature(m:Match,id:string):boolean {
 return (cardDefinition(m,id).icons as string[]).includes('Selective Creature')||creatureProfile(m,id)?.species==='wampa'&&(!!m.data.selectiveWampas||Object.values(m.cards).some(c=>c.blueprint==='7_212'&&gameTextActive(m,c.id)));
}
const together=(m:Match,a:string,b:string)=>!(selectiveCreature(m,a)&&selectiveCreature(m,b)&&creatureProfile(m,a).species===creatureProfile(m,b).species);
function pairs(m:Match,site:string):string[][]{
 const cs=Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===site&&!c.attachedTo&&!c.coveredBy&&supportedCreature(m,c.id));
 return cs.flatMap((a,i)=>cs.slice(i+1).filter(b=>together(m,a.id,b.id)).map(b=>[a.id,b.id]));
}
const action=(step:string,p:Payload):Action=>({id:'encounter:'+step+':'+p.site.id+(p.serial?':'+p.serial:'')+(p.index!==undefined?':'+p.index:''),handler:'encounter:'+step,source:p.site.id,label:step,payload:p as unknown as Json});
const queue=(m:Match,e:Encounter,step:string,index?:number)=>m.stack.push({kind:'resolution',actor:e.actor,cancelled:false,action:action(step,{site:e.site,serial:e.serial,...(index!==undefined?{index}:{})})});
const live=(m:Match,e:Encounter)=>sameCard(m,e.site)&&e.creatures.every(c=>sameCard(m,c)&&m.cards[c.id].location===e.site.id&&!m.cards[c.id].attachedTo);
export function encounterAutomatic(m:Match,w:Window):RequiredAction[]{
 const attack=m.data.creatureAttack as {stage:string}|undefined,battle=m.data.battle as {stage:string}|undefined;
 if(active(m)||attack&&attack.stage!=='complete'||battle&&battle.stage!=='complete')return [];
 // Required actions are selected before optional responses, and re-evaluated
 // after each completed pair. No phase or once-per-turn restriction applies.
 return m.locations.filter(id=>pairs(m,id).length).map(site=>({...action('begin',{site:referenceCard(m,site)}),id:'encounter:begin:'+site+':'+history(m).length,label:'Resolve creatures at '+cardDefinition(m,site).name,actor:m.turn.side}));
}
export function encounterInitiate(m:Match,r:Resolution,context:Context):void{
 if(r.action.handler!=='encounter:begin')return;const p=r.action.payload as unknown as Payload;
 const pair=shuffled(pairs(m,p.site.id),context.entropy)[0];if(!pair||active(m))throw Error('No eligible creature encounter.');p.serial=++m.serial;r.action.id=action('begin',p).id;
 const e:Encounter={serial:p.serial,site:p.site,creatures:pair.map(id=>referenceCard(m,id)),actor:r.actor,stage:'begin',index:0,draws:[[],[]],totals:[null,null],destinyTotals:[null,null],scopes:[null,null],counts:[null,null],defeated:[],lost:[]};
 m.data.creatureEncounters=[...history(m),e] as unknown as Json;delete r.awaitingResponses;openWindow(m,'response',other(r.actor),{kind:'attack-initiated',serial:e.serial,site:e.site.id,creatures:pair});
}
function finishEarly(m:Match,e:Encounter){e.ended=true;e.stage='complete';openWindow(m,'response',other(e.actor),{kind:'attack-ended',serial:e.serial,site:e.site.id,premature:true});}
function nextFerocity(m:Match,e:Encounter):void{
 if(e.index===2){queue(m,e,'compare');return;}
 const index=e.index,id=e.creatures[index].id,plan=ferocityPlan(m,id),side=m.cards[id].owner;
 e.counts[index]??=plan.draws;
 if(!e.counts[index]){e.totals[index]=plan.base;e.index++;nextFerocity(m,e);return;}
 const p={site:e.site,serial:e.serial,index};
 if(e.draws[index].length<e.counts[index]!){e.scopes[index]??=beginDestinySequence(m,side,id,'ferocity');drawDestiny(m,side,id,'ferocity',action('drawn',p),false,0,undefined,false,e.scopes[index]!);}
 else completeDestinyTotal(m,side,id,'ferocity',e.draws[index],action('total',p));
}
export function encounterResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,e=currentEncounter(m);if(!e||p.serial!==e.serial)throw Error('Missing creature encounter.');const h=r.action.handler.slice(10);
 if(r.cancelled){finishEarly(m,e);return;}
 if(h==='finish'){e.stage='complete';openWindow(m,'response',other(e.actor),{kind:'attack-ended',serial:e.serial,site:e.site.id});return;}
 if(h==='lost'){openWindow(m,'response',other(e.actor),{kind:'creatures-eaten',serial:e.serial,cards:e.lost.map(c=>c.id)});return;}
 if(!live(m,e)&&!['lose'].includes(h)){finishEarly(m,e);return;}
 if(h==='begin'){e.stage='ferocity';nextFerocity(m,e);return;}
 if(h==='drawn'){e.draws[p.index!].push(p.draw!);nextFerocity(m,e);return;}
 if(h==='total'){e.destinyTotals[p.index!]=p.total??null;e.totals[p.index!]=ferocityValue(m,e.creatures[p.index!].id,p.total??null);e.index++;nextFerocity(m,e);return;}
 if(h==='compare'){
  e.totals=e.creatures.map((c,i)=>ferocityValue(m,c.id,e.destinyTotals[i]));
  const [a,b]=e.totals as number[];e.defeated=a===b?[...e.creatures]:[e.creatures[a<b?0:1]];e.stage='loss';queue(m,e,'loss');openWindow(m,'response',other(e.actor),{kind:'attack-defeated',serial:e.serial,cards:e.defeated.map(c=>c.id),site:e.site.id});return;
 }
 if(h==='loss'){const ids=e.defeated.filter(c=>sameCard(m,c)&&m.cards[c.id].location===e.site.id).map(c=>c.id);queue(m,e,'lose');if(ids.length)openWindow(m,'response',other(e.actor),{kind:'about-to-lose',cards:tableLossCards(m,ids),cause:'creature-encounter',serial:e.serial});return;}
 if(h==='lose'){
  e.lost=e.defeated.filter(c=>sameCard(m,c)&&m.cards[c.id].location===e.site.id);queue(m,e,'finish');if(e.lost.length){queue(m,e,'lost');loseFromTable(m,e.lost.map(c=>c.id));}return;
 }
 throw Error('Unknown creature encounter continuation.');
}
/** Preserve nested actions, but stop at the next encounter-owned boundary. */
export function scheduleEncounterEnd(m:Match):boolean {
 const e=active(m);if(!e||e.stage==='loss'||!e.ended&&live(m,e))return false;e.ended=true;
 const owns=(a:Action|undefined)=>a?.handler.startsWith('encounter:')&&(a.payload as unknown as Payload)?.serial===e.serial;
 const flowOf=(f:typeof m.stack[number])=>{if(f.kind==='window')return;const h=f.kind==='resolution'?f.action.handler:f.handler,p=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {start?:unknown;next?:Action;draw?:Draw;card?:CardReference};const flow=(h==='destiny:value'?p.start:p) as typeof p;return h.startsWith('destiny:')&&owns(flow?.next)?{card:h==='destiny:value'?p.card?.id:flow.draw?.card}:undefined;};
 const base=m.stack.findIndex(f=>f.kind==='resolution'&&(owns(f.action)||flowOf(f)));if(base<0)return false;const frames=m.stack.slice(base);
 if(frames.some(f=>f.kind==='resolution'?!owns(f.action)&&!flowOf(f):f.kind==='decision'?!flowOf(f):false))return false;
 const top=frames.at(-1)!;if(top.kind==='window'){const ev=top.event as {kind?:string;serial?:number;category?:string}|undefined,parent=frames.at(-2);if(!(ev?.kind==='attack-initiated'&&ev.serial===e.serial)&&!(ev?.category==='ferocity'&&parent&&flowOf(parent))&&!(!ev&&parent?.kind==='resolution'&&owns(parent.action)))return false;}
 for(const f of frames){const p=flowOf(f);if(p?.card&&m.cards[p.card]?.zone==='destiny')moveCard(m,p.card,'used');}m.stack.splice(base);finishEarly(m,e);return true;
}
export function encounterView(m:Match){const e=currentEncounter(m);return {creatureEncounter:e?{serial:e.serial,stage:e.stage,creatures:e.creatures.map((c,i)=>({name:cardDefinition(m,c.id).name,total:e.totals[i],lost:e.lost.some(r=>r.id===c.id)})),ended:!!e.ended}:null};}
export function assertCreatureEncounters(m:Match):void{
 if(m.data.selectiveWampas){const ref=m.data.selectiveWampas as unknown as CardReference;assertCardReference(m,ref);if(ref.zone!=='table'||m.cards[ref.id].blueprint!=='7_212')throw Error('Invalid permanent wampa selectivity.');}
 const hs=history(m);if(!Array.isArray(hs))throw Error('Invalid creature encounters.');let prior=0;
 for(const [n,e] of hs.entries()){
  assertCardReference(m,e.site);if(e.site.zone!=='table'||cardDefinition(m,e.site.id).type!=='Location'||!Number.isSafeInteger(e.serial)||e.serial<=prior||e.serial>m.serial||!sides.includes(e.actor)||!['begin','ferocity','loss','complete'].includes(e.stage)||n<hs.length-1&&e.stage!=='complete'||!Number.isSafeInteger(e.index)||e.index<0||e.index>2||e.ended!==undefined&&e.ended!==true)throw Error('Invalid encounter state.');prior=e.serial;
  if(!Array.isArray(e.creatures)||e.creatures.length!==2||e.creatures[0].id===e.creatures[1].id||!Array.isArray(e.draws)||e.draws.length!==2||!Array.isArray(e.totals)||e.totals.length!==2||!Array.isArray(e.destinyTotals)||e.destinyTotals.length!==2||e.destinyTotals.some(t=>t!==null&&(!Number.isFinite(t)||t<0))||!Array.isArray(e.scopes)||e.scopes.length!==2||!Array.isArray(e.counts)||e.counts.length!==2)throw Error('Invalid encounter participants.');
  e.creatures.forEach((c,i)=>{assertCardReference(m,c);if(c.zone!=='table'||!supportedCreature(m,c.id)||!Array.isArray(e.draws[i])||e.draws[i].length>creatureProfile(m,c.id).draws||e.counts[i]!==null&&(!Number.isSafeInteger(e.counts[i])||e.counts[i]!<0||e.counts[i]!>creatureProfile(m,c.id).draws)||e.draws[i].some(d=>!validDraw(m,d,m.cards[c.id].owner))||e.totals[i]!==null&&(!Number.isFinite(e.totals[i])||e.totals[i]!<0))throw Error('Invalid encounter ferocity.');if(e.scopes[i]!==null)assertDestinyScope(m,e.scopes[i]!,m.cards[c.id].owner,c.id,'ferocity');});
  for(const refs of [e.defeated,e.lost]){if(!Array.isArray(refs)||new Set(refs.map(r=>r.id)).size!==refs.length)throw Error('Invalid encounter losses.');for(const r of refs){assertCardReference(m,r);if(!e.creatures.some(c=>c.id===r.id&&c.version===r.version&&c.zone===r.zone))throw Error('Invalid encounter lost card.');}}
  if(e.lost.some(r=>!e.defeated.some(c=>c.id===r.id)))throw Error('Invalid encounter outcome.');
  if(e.draws.some((ds,i)=>ds.length>(e.counts[i]??0))||e.counts.some((count,i)=>i<e.index&&(count===null||e.totals[i]===null))||e.stage==='begin'&&(e.index!==0||e.counts.some(c=>c!==null))||e.stage==='ferocity'&&(e.defeated.length||e.lost.length))throw Error('Invalid encounter progress.');
  if(!e.ended&&['loss','complete'].includes(e.stage)){
   if(e.index!==2||e.totals.some(t=>t===null))throw Error('Incomplete encounter comparison.');
   const [a,b]=e.totals as number[],expected=a===b?e.creatures:[e.creatures[a<b?0:1]];
   if(e.defeated.length!==expected.length||expected.some(c=>!e.defeated.some(r=>r.id===c.id)))throw Error('Invalid defeated creature.');
  }
 }
 const e=currentEncounter(m);
 for(const f of m.stack){
  if(f.kind==='window')continue;const h=f.kind==='resolution'?f.action.handler:f.handler,p=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {next?:Action;start?:unknown;side?:Side;source?:string;category?:string};const flow=(h==='destiny:value'?p.start:p) as typeof p;
  const forwarded=h.startsWith('destiny:')&&flow?.next?.handler.startsWith('encounter:');if(!h.startsWith('encounter:')&&!forwarded)continue;
  const a=forwarded?flow.next!:f.kind==='resolution'?f.action:undefined;if(!a||!e||e.stage==='complete')throw Error('Invalid encounter continuation.');const data=a.payload as unknown as Payload,step=a.handler.slice(10);
  const draw=['drawn','total'].includes(step),side=draw&&data.index!==undefined&&e.creatures[data.index]?m.cards[e.creatures[data.index].id].owner:e.actor;
  if(!['begin','drawn','total','compare','loss','lose','lost','finish'].includes(step)||data.serial!==e.serial||data.site?.id!==e.site.id||data.site.version!==e.site.version||data.site.zone!==e.site.zone||a.id!==action(step,data).id||a.source!==e.site.id||(f.kind==='resolution'?f.actor:f.side)!==side||draw&&(data.index!==e.index||e.stage!=='ferocity'))throw Error('Invalid encounter action binding.');
  if(!draw&&(data.index!==undefined||step==='begin'&&e.stage!=='begin'||step==='compare'&&(e.stage!=='ferocity'||e.index!==2)||['loss','lose','lost','finish'].includes(step)&&e.stage!=='loss'))throw Error('Invalid encounter continuation stage.');
  if(forwarded&&(!draw||flow.side!==side||flow.source!==e.creatures[data.index!].id||flow.category!=='ferocity'))throw Error('Invalid encounter destiny binding.');
  if(!forwarded&&step==='drawn'&&!validDraw(m,data.draw!,side))throw Error('Invalid encounter draw.');
 }
}
