import {ability} from './ability';
import {cardDefinition} from './definitions';
import {moveWithAttachments} from './board';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {sectorFamily} from './sectors';
import {assertDestinyScope} from './destiny-limits';
import {beginDestinySequence} from './destiny-limits';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {occupants,permanentAbility,vesselPower,belowDecks} from './occupancy';
import {barred} from './participation';
import {shuffled} from './random';
import {openWindow,type Context,type RequiredAction} from './runtime';
import {bellySlug,isSpaceSlug} from './space-slug';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

export type CreatureAttack={serial:number;turn:number;site:CardReference;slug:CardReference;ships:CardReference[];initiator:Side;shipSide:Side;mode:'hunt'|'assault';stage:'begin'|'weapons'|'power'|'damage'|'complete';ferocityDraws:Draw[];ferocity?:number|null;powerDraw?:Draw;powerDestiny?:number|null;totals?:{creature:number;ships:number};defeated?:boolean;outcome?:'survived'|'eaten'|'relocated'|'slug-lost'|'ended';scope?:string};
type Payload={slug:CardReference;site:CardReference;mode:'hunt'|'assault';side:Side;serial?:number;draw?:Draw;total?:number|null};
type Use={source:CardReference;turn:number;side:Side;mode:'hunt'|'assault'};
export const creatureAttack=(m:Match)=>m.data.creatureAttack as CreatureAttack|undefined;
const uses=(m:Match)=>(m.data.creatureAttackUses??[]) as unknown as Use[];
const active=(m:Match)=>{const a=creatureAttack(m);return a&&a.stage!=='complete'?a:undefined;};
const shipsAt=(m:Match,at:string,side:Side,fighters=false)=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.location===at&&!c.attachedTo&&!belowDecks(m,c.id)&&cardDefinition(m,c.id).type==='Starship'&&(!fighters||cardDefinition(m,c.id).subType.startsWith('Starfighter:')));
const action=(step:string,p:Payload):Action=>({id:'creature:'+step+':'+p.slug.id+':'+p.site.id+':'+p.mode+':'+p.side+(p.serial?':'+p.serial:''),handler:'creature:'+step,source:p.slug.id,label:step,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor:Side)=>m.stack.push({kind:'resolution',actor,cancelled:false,action:action(step,p)});
const liveShips=(m:Match,a:CreatureAttack)=>a.ships.filter(ref=>sameCard(m,ref)&&m.cards[ref.id].location===a.site.id&&!m.cards[ref.id].attachedTo);
const live=(m:Match,a:CreatureAttack)=>sameCard(m,a.site)&&sameCard(m,a.slug)&&m.cards[a.slug.id].location===a.site.id&&liveShips(m,a).length>0;
function hunts(m:Match,side:Side):Action[]{
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&isSpaceSlug(m,c.id)&&c.location&&!uses(m).some(u=>u.mode==='hunt'&&u.turn===m.turn.number&&u.source.id===c.id&&sameCard(m,u.source))).flatMap(c=>sides.filter(s=>shipsAt(m,c.location!,s,true).length).map(s=>({...action('begin',{slug:referenceCard(m,c.id),site:referenceCard(m,c.location!),mode:'hunt',side:s}),label:'Space Slug attacks '+(s===side?'your':'opposing')+' starfighters'})));
}
export function creatureActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='battle'||m.turn.side!==side||active(m))return [];
 const out=hunts(m,side);
 for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&isSpaceSlug(m,c.id)&&c.location)){
  const ships=shipsAt(m,c.location!,side).filter(c=>!barred(m,c.id));
  if(ships.length&&!uses(m).some(u=>u.mode==='assault'&&u.turn===m.turn.number&&u.side===side&&u.source.id===c.location&&sameCard(m,u.source)))out.push({...action('begin',{slug:referenceCard(m,c.id),site:referenceCard(m,c.location!),mode:'assault',side}),label:'Attack Space Slug with your ships'});
 }
 return out;
}
export function creatureAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;phase?:string}|undefined;
 if(w.timing==='response'&&e?.kind==='phase-end'&&e.phase==='battle'&&!active(m))return hunts(m,m.turn.side).map(a=>({...a,actor:m.turn.side}));
 return [];
}
export function creatureInitiate(m:Match,r:Resolution,context:Context):void{
 if(r.action.handler!=='creature:begin')return;
 const p=r.action.payload as unknown as Payload,ships=shipsAt(m,p.site.id,p.side,p.mode==='hunt').filter(c=>p.mode==='hunt'||!barred(m,c.id));
 const selected=p.mode==='hunt'?shuffled(ships,context.entropy).slice(0,1):ships;
 if(!selected.length||active(m))throw Error('Invalid creature attack initiation.');
 p.serial=++m.serial;r.action.id=action('begin',p).id;
 m.data.creatureAttack={serial:p.serial,turn:m.turn.number,site:p.site,slug:p.slug,ships:selected.map(c=>referenceCard(m,c.id)),initiator:r.actor,shipSide:p.side,mode:p.mode,stage:'begin',ferocityDraws:[]} as unknown as Json;
 m.data.creatureAttackUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.mode==='hunt'?p.slug:p.site,turn:m.turn.number,side:r.actor,mode:p.mode}] as unknown as Json;
}
function shipAbility(m:Match,a:CreatureAttack):number{return liveShips(m,a).reduce((sum,s)=>sum+permanentAbility(m,s.id)+occupants(m,s.id).filter(c=>c.aboardRole==='pilot').reduce((n,c)=>n+ability(m,c.id),0),0);}
function drawFerocity(m:Match,a:CreatureAttack,p:Payload){
 if(a.ferocityDraws.length<2){a.scope??=beginDestinySequence(m,m.cards[a.slug.id].owner,a.slug.id,'ferocity');drawDestiny(m,m.cards[a.slug.id].owner,a.slug.id,'ferocity',action('ferocity-drawn',p),false,0,undefined,false,a.scope);}
 else completeDestinyTotal(m,m.cards[a.slug.id].owner,a.slug.id,'ferocity',a.ferocityDraws,action('ferocity-total',p));
}
function powerChoice(m:Match,a:CreatureAttack,p:Payload){
 if(shipAbility(m,a)>=4&&m.players[a.shipSide].reserve.length)m.stack.push({kind:'decision',side:a.shipSide,handler:'creature:destiny',payload:p as unknown as Json});
 else {a.powerDestiny=0;queue(m,a.mode==='assault'?'ferocity-start':'compare',p,a.initiator);}
}
function lose(m:Match,a:CreatureAttack,p:Payload,ids:string[]){queue(m,'lose',p,a.initiator);const cards=tableLossCards(m,ids);openWindow(m,'response',other(a.initiator),{kind:'about-to-lose',card:ids[0],cards,cardRefs:cards.map(id=>referenceCard(m,id)),cause:'creature-attack'} as unknown as Json);}
export function creatureResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,a=creatureAttack(m);if(!a||a.serial!==p.serial)throw Error('Missing creature attack.');
 const h=r.action.handler.slice(9);
 if(r.cancelled){if(h==='begin'){a.stage='complete';a.outcome='ended';}return;}
 if(h==='finish'){a.stage='complete';openWindow(m,'response',other(a.initiator),{kind:'attack-ended',site:a.site.id,serial:a.serial});return;}
 if(h==='begin'){queue(m,'finish',p,a.initiator);if(!live(m,a)){a.outcome='ended';return;}a.stage='weapons';queue(m,'power',p,a.initiator);openWindow(m,'response',a.initiator,{kind:'attack-weapons',site:a.site.id,serial:a.serial});return;}
 if(!live(m,a)&&!['lose','lost'].includes(h)){a.outcome='ended';return;}
 if(h==='power'){a.stage='power';if(a.mode==='hunt')drawFerocity(m,a,p);else powerChoice(m,a,p);return;}
 if(h==='ferocity-start'){drawFerocity(m,a,p);return;}
 if(h==='ferocity-drawn'){a.ferocityDraws.push(p.draw!);drawFerocity(m,a,p);return;}
 if(h==='ferocity-total'){a.ferocity=p.total??null;if(a.mode==='hunt')powerChoice(m,a,p);else queue(m,'compare',p,a.initiator);return;}
 if(h==='power-total'){a.powerDraw=p.draw;a.powerDestiny=p.total??null;queue(m,a.mode==='assault'?'ferocity-start':'compare',p,a.initiator);return;}
 if(h==='compare'){
  a.totals={creature:(a.ferocity??0)+(a.mode==='assault'?3:0),ships:liveShips(m,a).reduce((sum,s)=>sum+vesselPower(m,s.id),0)+(a.powerDestiny??0)};
  a.defeated=a.mode==='hunt'?a.totals.creature>a.totals.ships:a.totals.ships>a.totals.creature;a.stage='damage';a.outcome='survived';
  if(a.defeated){queue(m,'defeated',p,a.initiator);openWindow(m,'response',other(a.initiator),{kind:'attack-defeated',card:a.mode==='hunt'?a.ships[0].id:a.slug.id,site:a.site.id,serial:a.serial});}return;
 }
 if(h==='defeated'){
  if(a.mode==='assault'){lose(m,a,p,[a.slug.id]);return;}
  const cave=m.locations.find(id=>bellySlug(m,id)===a.slug.id),ship=liveShips(m,a)[0];
  if(cave&&ship&&!barred(m,ship.id)&&!['1_305','1_300','1_299'].includes(m.cards[ship.id].blueprint))m.stack.push({kind:'decision',side:other(a.shipSide),handler:'creature:outcome',payload:p as unknown as Json});
  else lose(m,a,p,[a.ships[0].id]);return;
 }
 if(h==='lose'){
  const ids=a.mode==='assault'?(sameCard(m,a.slug)?[a.slug.id]:[]):liveShips(m,a).map(r=>r.id);
  if(ids.length){a.outcome=a.mode==='hunt'?'eaten':'slug-lost';queue(m,'lost',p,a.initiator);loseFromTable(m,ids);}return;
 }
 if(h==='lost'){openWindow(m,'response',other(a.initiator),{kind:a.mode==='hunt'?'card-eaten':'creature-lost',card:a.mode==='hunt'?a.ships[0].id:a.slug.id,site:a.site.id,cause:'creature-attack'});return;}
 throw Error('Unknown creature attack continuation.');
}
export function creatureChoices(m:Match,d:Decision){
 if(d.handler==='creature:destiny')return [{id:'attack-draw',label:'Draw attack destiny'},{id:'attack-skip',label:'Skip attack destiny'}];
 if(d.handler==='creature:outcome')return [{id:'eat',label:'Space Slug eats the defeated ship'},{id:'belly',label:'Relocate the defeated ship into the belly'}];
 throw Error('Unknown creature attack decision.');
}
export function creatureChoose(m:Match,d:Decision,id:string):void{
 const p=d.payload as unknown as Payload,a=creatureAttack(m)!;if(!creatureChoices(m,d).some(c=>c.id===id))throw Error('Invalid attack choice.');
 if(d.handler==='creature:destiny'){
  if(id==='attack-draw')drawDestiny(m,a.shipSide,a.ships[0].id,'attack',action('power-total',p));else {a.powerDestiny=0;queue(m,a.mode==='assault'?'ferocity-start':'compare',p,a.initiator);}return;
 }
 const cave=m.locations.find(id=>bellySlug(m,id)===a.slug.id),ship=liveShips(m,a)[0];
 if(id==='belly'&&cave&&ship&&!barred(m,ship.id)){moveWithAttachments(m,ship.id,cave);a.outcome='relocated';openWindow(m,'response',a.shipSide,{kind:'moved',card:ship.id,from:a.site.id,site:cave,method:'creature-relocation'});}
 else if(ship)lose(m,a,p,[ship.id]);
}
export function attackView(m:Match){const a=creatureAttack(m);return {creatureAttack:a?{stage:a.stage,mode:a.mode,ships:a.ships.map(s=>cardDefinition(m,s.id).name),ferocity:a.ferocity??null,attackDestiny:a.powerDestiny??null,totals:a.totals??null,outcome:a.outcome??null}:null};}
export function assertCreatureAttack(m:Match):void{
 const us=uses(m);if(!Array.isArray(us))throw Error('Invalid attack usage.');
 for(const u of us){assertCardReference(m,u.source);if(u.source.zone!=='table'||!sides.includes(u.side)||!['hunt','assault'].includes(u.mode)||!Number.isSafeInteger(u.turn)||u.turn<1||u.turn>m.turn.number||u.mode==='hunt'&&(!isSpaceSlug(m,u.source.id)||m.cards[u.source.id].owner!==u.side)||u.mode==='assault'&&sectorFamily(m,u.source.id)!=='big-one')throw Error('Invalid attack usage.');}
 if(new Set(us.map(u=>[u.mode,u.source.id,u.source.version,u.turn,u.side].join(':'))).size!==us.length)throw Error('Duplicate attack usage.');
 const a=creatureAttack(m);
 if(a){
  assertCardReference(m,a.slug);assertCardReference(m,a.site);
  if(!Array.isArray(a.ships))throw Error('Invalid attack ships.');a.ships.forEach(ref=>assertCardReference(m,ref));
  if(!isSpaceSlug(m,a.slug.id)||a.slug.zone!=='table'||a.site.zone!=='table'||sectorFamily(m,a.site.id)!=='big-one'||!Number.isSafeInteger(a.serial)||a.serial<1||a.serial>m.serial||!Number.isSafeInteger(a.turn)||a.turn<1||a.turn>m.turn.number||!sides.includes(a.initiator)||!sides.includes(a.shipSide)||!['hunt','assault'].includes(a.mode)||!['begin','weapons','power','damage','complete'].includes(a.stage)||!a.ships.length||new Set(a.ships.map(s=>s.id)).size!==a.ships.length||a.ships.some(s=>s.zone!=='table'||cardDefinition(m,s.id).type!=='Starship'||m.cards[s.id].owner!==a.shipSide)||a.mode==='hunt'&&(a.ships.length!==1||a.initiator!==m.cards[a.slug.id].owner)||a.mode==='assault'&&a.initiator!==a.shipSide||!Array.isArray(a.ferocityDraws)||a.ferocityDraws.length>2||a.ferocityDraws.some(d=>!validDraw(m,d,m.cards[a.slug.id].owner))||a.powerDraw!==undefined&&!validDraw(m,a.powerDraw,a.shipSide)||a.defeated!==undefined&&typeof a.defeated!=='boolean'||a.outcome!==undefined&&!['survived','eaten','relocated','slug-lost','ended'].includes(a.outcome))throw Error('Invalid creature attack.');
  if(a.totals!==undefined&&(!a.totals||!Number.isFinite(a.totals.creature)||!Number.isFinite(a.totals.ships)))throw Error('Invalid attack totals.');
  for(const n of [a.ferocity,a.powerDestiny,a.totals?.creature,a.totals?.ships])if(n!==undefined&&n!==null&&(!Number.isFinite(n)||n<0))throw Error('Invalid attack total.');
  if(a.scope!==undefined)assertDestinyScope(m,a.scope,m.cards[a.slug.id].owner,a.slug.id,'ferocity');
 }
 const steps=['begin','finish','power','ferocity-start','ferocity-drawn','ferocity-total','power-total','compare','defeated','lose','lost'];
 function binding(p:Payload){
  if(!a||a.stage==='complete'||!p||p.serial!==a.serial||p.slug?.id!==a.slug.id||p.slug.version!==a.slug.version||p.slug.zone!=='table'||p.site?.id!==a.site.id||p.site.version!==a.site.version||p.site.zone!=='table'||p.mode!==a.mode||p.side!==a.shipSide||a.turn!==m.turn.number||m.turn.phase!=='battle')throw Error('Invalid attack continuation binding.');
 }
 for(const f of m.stack){
  if(f.kind==='window')continue;
  const handler=f.kind==='resolution'?f.action.handler:f.handler;
  if(f.kind==='decision'&&handler.startsWith('creature:')){
   binding(f.payload as unknown as Payload);
   if(!['creature:destiny','creature:outcome'].includes(handler)||f.side!==(handler==='creature:destiny'?a!.shipSide:other(a!.shipSide))||a!.stage!==(handler==='creature:destiny'?'power':'damage'))throw Error('Invalid attack decision.');
   continue;
  }
  // Shared destiny frames retain the exact attack callback across persistence.
  const payload=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {next?:Action;start?:{next?:Action};side?:Side;source?:string;category?:string};
  const flow=handler==='destiny:value'?payload.start as typeof payload:payload;
  const forwarded=handler.startsWith('destiny:')&&flow?.next?.handler.startsWith('creature:');
  if(!handler.startsWith('creature:')&&!forwarded)continue;
  const act=forwarded?flow.next!:f.kind==='resolution'?f.action:undefined;
  if(!act)throw Error('Invalid attack frame.');
  const p=act.payload as unknown as Payload;binding(p);
  const step=act.handler.slice(9),expectedSide=step.startsWith('ferocity-')&&step!=='ferocity-start'?m.cards[a!.slug.id].owner:step==='power-total'?a!.shipSide:a!.initiator;
  if(!steps.includes(step)||act.id!==action(step,p).id||act.source!==a!.slug.id||(f.kind==='resolution'?f.actor:f.side)!==expectedSide)throw Error('Invalid attack action binding.');
  if(forwarded){
   const ferocity=step==='ferocity-drawn'||step==='ferocity-total';
   if(!ferocity&&step!=='power-total'||flow.side!==expectedSide||flow.category!==(ferocity?'ferocity':'attack')||flow.source!==(ferocity?a!.slug.id:a!.ships[0].id))throw Error('Invalid attack destiny binding.');
  }else if(step==='ferocity-drawn'&&!validDraw(m,p.draw!,expectedSide)||step==='power-total'&&!validDraw(m,p.draw!,expectedSide))throw Error('Invalid attack draw callback.');
 }
}
