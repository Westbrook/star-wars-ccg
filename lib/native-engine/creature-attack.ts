import {shieldMovement} from './hoth';
import {creatureProfile,supportedCreature,ferocityPlan,ferocityValue} from './creature-profile';
import {gameTextActive} from './game-text';
import {defenseValue} from './defense';
import {moveCard} from './state';
import {ability} from './ability';
import {cardDefinition} from './definitions';
import {moveWithAttachments,power,name,isGuard} from './board';
import {drawDestiny,completeDestinyTotal,validDraw,type Draw} from './destiny';
import {sectorFamily} from './sectors';
import {assertDestinyScope} from './destiny-limits';
import {beginDestinySequence} from './destiny-limits';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {occupants,permanentAbility,vesselPower,belowDecks,characterPresent,isVessel} from './occupancy';
import {barred} from './participation';
import {shuffled} from './random';
import {openWindow,type Context,type RequiredAction} from './runtime';
import {bellySlug,isSpaceSlug} from './space-slug';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

export type CreatureAttack={serial:number;turn:number;site:CardReference;slug:CardReference;ships:CardReference[];initiator:Side;shipSide:Side;mode:'hunt'|'assault';stage:'begin'|'weapons'|'power'|'damage'|'complete';ferocityDraws:Draw[];ferocityCount?:number;ferocityDestiny?:number|null;ferocity?:number|null;powerDraw?:Draw;powerDestiny?:number|null;totals?:{creature:number;ships:number};defeated?:boolean;outcome?:'survived'|'eaten'|'relocated'|'slug-lost'|'creature-lost'|'ended';scope?:string;interrupted?:true;hit?:true;hitLost?:true;relocation?:CardReference};
type Payload={slug:CardReference;site:CardReference;mode:'hunt'|'assault';side:Side;serial?:number;draw?:Draw;total?:number|null};
type Use={source:CardReference;turn:number;side:Side;mode:'hunt'|'assault'};
export const creatureAttack=(m:Match)=>m.data.creatureAttack as CreatureAttack|undefined;
const uses=(m:Match)=>(m.data.creatureAttackUses??[]) as unknown as Use[];
const active=(m:Match)=>{const a=creatureAttack(m);return a&&a.stage!=='complete'?a:undefined;};
// Retain the historical slug/ships field names so existing saved attacks load.
// These now represent the creature and its non-creature participants.
const shipsAt=(m:Match,at:string,side:Side,hunt=false,creature?:string)=>Object.values(m.cards).filter(c=>{
 if(c.zone!=='table'||c.owner!==side||c.location!==at||belowDecks(m,c.id))return false;
 const d=cardDefinition(m,c.id);
 if(hunt){
  if(isSpaceSlug(m,creature??''))return !c.attachedTo&&d.type==='Starship'&&d.subType.startsWith('Starfighter:');
  if(creature&&creatureProfile(m,creature)?.avoidsOwnCharacters&&gameTextActive(m,creature)&&m.cards[creature].owner===side&&d.type==='Character')return false;
  return !c.attachedTo&&(d.type==='Character'&&d.subType!=='Droid'||d.type==='Vehicle'&&d.subType.startsWith('Creature'));
 }
 return !c.coveredBy&&(d.type==='Character'&&characterPresent(m,c.id)||isVessel(m,c.id)&&!c.attachedTo);
});
const action=(step:string,p:Payload):Action=>({id:'creature:'+step+':'+p.slug.id+':'+p.site.id+':'+p.mode+':'+p.side+(p.serial?':'+p.serial:''),handler:'creature:'+step,source:p.slug.id,label:step,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor:Side)=>m.stack.push({kind:'resolution',actor,cancelled:false,action:action(step,p)});
const liveShips=(m:Match,a:CreatureAttack)=>a.ships.filter(ref=>sameCard(m,ref)&&m.cards[ref.id].location===a.site.id&&(!m.cards[ref.id].attachedTo||characterPresent(m,ref.id)));
const live=(m:Match,a:CreatureAttack)=>sameCard(m,a.site)&&sameCard(m,a.slug)&&m.cards[a.slug.id].location===a.site.id&&liveShips(m,a).length>0;
function hunts(m:Match,side:Side):Action[]{
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&supportedCreature(m,c.id)&&c.location&&!uses(m).some(u=>u.mode==='hunt'&&u.turn===m.turn.number&&u.source.id===c.id&&sameCard(m,u.source))).flatMap(c=>sides.filter(s=>shipsAt(m,c.location!,s,true,c.id).length).map(s=>({...action('begin',{slug:referenceCard(m,c.id),site:referenceCard(m,c.location!),mode:'hunt',side:s}),label:name(m,c.id)+' attacks '+(s===side?'your':'opposing')+' '+(isSpaceSlug(m,c.id)?'starfighters':'cards')})));
}
export function creatureActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.phase!=='battle'||m.turn.side!==side||active(m))return [];
 const out=hunts(m,side);
 for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&supportedCreature(m,c.id)&&c.location)){
  const ships=shipsAt(m,c.location!,side).filter(c=>!barred(m,c.id));
  if(ships.length&&!uses(m).some(u=>u.mode==='assault'&&u.turn===m.turn.number&&u.side===side&&u.source.id===c.location&&sameCard(m,u.source)))out.push({...action('begin',{slug:referenceCard(m,c.id),site:referenceCard(m,c.location!),mode:'assault',side}),label:'Attack '+name(m,c.id)+' with your '+(isSpaceSlug(m,c.id)?'ships':'cards')});
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
 const p=r.action.payload as unknown as Payload,ships=shipsAt(m,p.site.id,p.side,p.mode==='hunt',p.slug.id).filter(c=>p.mode==='hunt'||!barred(m,c.id));
 const selected=p.mode==='hunt'?shuffled(ships,context.entropy).slice(0,1):ships;
 if(!selected.length||active(m))throw Error('Invalid creature attack initiation.');
 p.serial=++m.serial;r.action.id=action('begin',p).id;
 m.data.creatureAttack={serial:p.serial,turn:m.turn.number,site:p.site,slug:p.slug,ships:selected.map(c=>referenceCard(m,c.id)),initiator:r.actor,shipSide:p.side,mode:p.mode,stage:'begin',ferocityDraws:[]} as unknown as Json;
 m.data.creatureAttackUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.mode==='hunt'?p.slug:p.site,turn:m.turn.number,side:r.actor,mode:p.mode}] as unknown as Json;
 // Target selection is part of initiation, before the attack-initiated response.
 // This explicit flow replaces the kernel's anonymous action response.
 delete r.awaitingResponses;
 if(p.mode==='hunt'){
  queue(m,'initiated',p,r.actor);
  openWindow(m,'response',m.turn.side,{kind:'attack-target-selected',serial:p.serial,card:selected[0].id,site:p.site.id});
 }else openWindow(m,'response',other(r.actor),{kind:'attack-initiated',serial:p.serial,site:p.site.id});
}
function shipAbility(m:Match,a:CreatureAttack):number {const refs=liveShips(m,a);return refs.reduce((sum,s)=>sum+(isVessel(m,s.id)?permanentAbility(m,s.id)+occupants(m,s.id).filter(c=>['pilot','driver'].includes(c.aboardRole??'')&&!refs.some(r=>r.id===c.id)).reduce((n,c)=>n+ability(m,c.id),0):ability(m,s.id)),0);}
function drawFerocity(m:Match,a:CreatureAttack,p:Payload){
 const profile=ferocityPlan(m,a.slug.id);
 a.ferocityCount??=profile.draws;
 if(!a.ferocityCount){a.ferocity=profile.base;if(a.mode==='hunt')powerChoice(m,a,p);else queue(m,'compare',p,a.initiator);return;}
 if(a.ferocityDraws.length<a.ferocityCount){a.scope??=beginDestinySequence(m,m.cards[a.slug.id].owner,a.slug.id,'ferocity');drawDestiny(m,m.cards[a.slug.id].owner,a.slug.id,'ferocity',action('ferocity-drawn',p),false,0,undefined,false,a.scope);}
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
 if(h==='initiated'){if(live(m,a))openWindow(m,'response',other(a.initiator),{kind:'attack-initiated',site:a.site.id,serial:a.serial});return;}
 if(h==='finish'){a.stage='complete';openWindow(m,'response',other(a.initiator),{kind:'attack-ended',site:a.site.id,serial:a.serial});return;}
 if(h==='begin'){queue(m,'finish',p,a.initiator);queue(m,'hit-cleanup',p,a.initiator);if(!live(m,a)){a.outcome='ended';return;}a.stage='weapons';queue(m,'power',p,a.initiator);openWindow(m,'response',a.initiator,{kind:'attack-weapons',site:a.site.id,serial:a.serial});return;}
 if(h==='hit-cleanup'){if(a.hit&&sameCard(m,a.slug)){queue(m,'hit-loss',p,a.initiator);openWindow(m,'response',other(a.initiator),{kind:'about-to-lose',card:a.slug.id,cards:tableLossCards(m,[a.slug.id]),cause:'creature-hit'});}return;}
 if(h==='hit-lost'){openWindow(m,'response',other(a.initiator),{kind:'creature-lost',card:a.slug.id,site:a.site.id,cause:'creature-hit'});return;}
 if(h==='hit-loss'){if(sameCard(m,a.slug)){a.hitLost=true;queue(m,'hit-lost',p,a.initiator);loseFromTable(m,[a.slug.id]);}return;}
 if(!live(m,a)&&!['lose','lost'].includes(h)){a.outcome='ended';return;}
 if(h==='power'){a.stage='power';if(a.mode==='hunt')drawFerocity(m,a,p);else powerChoice(m,a,p);return;}
 if(h==='ferocity-start'){drawFerocity(m,a,p);return;}
 if(h==='ferocity-drawn'){a.ferocityDraws.push(p.draw!);drawFerocity(m,a,p);return;}
 if(h==='ferocity-total'){a.ferocityDestiny=p.total??null;a.ferocity=ferocityValue(m,a.slug.id,p.total??null);if(a.mode==='hunt')powerChoice(m,a,p);else queue(m,'compare',p,a.initiator);return;}
 if(h==='power-total'){a.powerDraw=p.draw;a.powerDestiny=p.total??null;queue(m,a.mode==='assault'?'ferocity-start':'compare',p,a.initiator);return;}
 if(h==='compare'){
  if(a.ferocityCount!==undefined)a.ferocity=ferocityValue(m,a.slug.id,a.ferocityDestiny??null);
  a.totals={creature:(a.ferocity??0)+(a.mode==='assault'?defenseValue(m,a.slug.id):0),ships:liveShips(m,a).reduce((sum,s)=>sum+(isVessel(m,s.id)?vesselPower(m,s.id):power(m,s.id,a.mode==='hunt',id=>liveShips(m,a).some(r=>r.id===id))),0)+(a.powerDestiny??0)};
  a.defeated=a.mode==='hunt'?a.totals.creature>a.totals.ships:a.totals.ships>a.totals.creature;a.stage='damage';a.outcome='survived';
  if(a.defeated){queue(m,'defeated',p,a.initiator);openWindow(m,'response',other(a.initiator),{kind:'attack-defeated',card:a.mode==='hunt'?a.ships[0].id:a.slug.id,site:a.site.id,serial:a.serial});}return;
 }
 if(h==='defeated'){
  if(a.mode==='assault'){lose(m,a,p,[a.slug.id]);return;}
  const cave=relocationSite(m,a),ship=liveShips(m,a)[0];
  if(cave&&ship)m.stack.push({kind:'decision',side:other(a.shipSide),handler:'creature:outcome',payload:p as unknown as Json});
  else lose(m,a,p,[a.ships[0].id]);return;
 }
 if(h==='lose'){
  const ids=a.mode==='assault'?(sameCard(m,a.slug)?[a.slug.id]:[]):liveShips(m,a).map(r=>r.id);
  if(ids.length){a.outcome=a.mode==='hunt'?'eaten':isSpaceSlug(m,a.slug.id)?'slug-lost':'creature-lost';queue(m,'lost',p,a.initiator);loseFromTable(m,ids);}return;
 }
 if(h==='lost'){openWindow(m,'response',other(a.initiator),{kind:a.mode==='hunt'?'card-eaten':'creature-lost',card:a.mode==='hunt'?a.ships[0].id:a.slug.id,site:a.site.id,cause:'creature-attack'});return;}
 throw Error('Unknown creature attack continuation.');
}
/** End at the next attack-owned boundary. Nested card actions retain their
 * costs, choices and result responses. Only this attack's suspended frames and
 * physical destiny cards are retired; outer phase/required-action state stays. */
export function scheduleAttackEnd(m:Match):boolean{
 const a=active(m);
 if(!a||a.hitLost||['eaten','slug-lost','creature-lost','relocated'].includes(a.outcome??''))return false;
 if(!a.interrupted&&live(m,a))return false;
 // Once a side has departed, returning during the nested action cannot revive the attack.
 a.interrupted=true;
 const owns=(act:Action|undefined)=>act?.handler.startsWith('creature:')&&(act.payload as unknown as Payload)?.serial===a.serial;
 const base=m.stack.findIndex(f=>f.kind==='resolution'&&owns(f.action));if(base<0)return false;
 const frames=m.stack.slice(base);
 const flowOf=(f:typeof m.stack[number])=>{
  if(f.kind==='window')return undefined;
  const h=f.kind==='resolution'?f.action.handler:f.handler,p=(f.kind==='resolution'?f.action.payload:f.payload) as unknown as {start?:unknown;next?:Action;draw?:Draw;card?:CardReference};
  const flow=(h==='destiny:value'?p.start:p) as {next?:Action;draw?:Draw;card?:CardReference};
  return h.startsWith('destiny:')&&owns(flow?.next)?{flow,card:h==='destiny:value'?p.card?.id:flow.draw?.card}:undefined;
 };
 // Neither pending loss order nor a nested Interrupt may be abandoned.
 if(frames.some(f=>f.kind==='resolution'?!owns(f.action)&&!flowOf(f):f.kind==='decision'?!((f.handler.startsWith('creature:')&&(f.payload as unknown as Payload)?.serial===a.serial)||flowOf(f)):false))return false;
 const top=frames.at(-1)!;
 if(top.kind==='window'){
  const e=top.event as {kind?:string;serial?:number;category?:string}|undefined,parent=frames.at(-2);
  const attack=e?.kind?.startsWith('attack-')&&e.serial===a.serial;
  const draw=e&&['ferocity','attack'].includes(e.category??'')&&parent&&flowOf(parent);
  const anonymous=!e&&parent?.kind==='resolution'&&owns(parent.action);
  if(!attack&&!draw&&!anonymous)return false;
 }
 if(frames.some(f=>f.kind==='resolution'&&f.action.handler==='creature:begin'&&f.cancelled))return false;
 for(const f of frames){const pending=flowOf(f);if(pending?.card&&m.cards[pending.card]?.zone==='destiny')moveCard(m,pending.card,'used');}
 m.stack.splice(base);a.stage='complete';a.outcome='ended';
 openWindow(m,'response',other(a.initiator),{kind:'attack-ended',site:a.site.id,serial:a.serial,premature:true});return true;
}
function relocationSite(m:Match,a:CreatureAttack):string|undefined {
 const target=liveShips(m,a)[0];if(!target||barred(m,target.id)||!gameTextActive(m,a.slug.id))return;
 if(isSpaceSlug(m,a.slug.id))return !['1_305','1_300','1_299'].includes(m.cards[target.id].blueprint)?m.locations.find(id=>bellySlug(m,id)===a.slug.id):undefined;
 if(m.cards[a.slug.id].blueprint==='3_93'&&cardDefinition(m,target.id).type==='Character'&&!isGuard(m.cards[target.id].blueprint))return m.locations.find(id=>m.cards[id].blueprint==='3_150'&&id!==a.site.id&&!shieldMovement(m,m.cards[target.id].owner,a.site.id,id));
}
export function creatureChoices(m:Match,d:Decision){
 if(d.handler==='creature:destiny')return [{id:'attack-draw',label:'Draw attack destiny'},{id:'attack-skip',label:'Skip attack destiny'}];
 if(d.handler==='creature:outcome'){const a=creatureAttack(m)!;return isSpaceSlug(m,a.slug.id)?[{id:'eat',label:'Space Slug eats the defeated ship'},{id:'belly',label:'Relocate the defeated ship into the belly'}]:[{id:'eat',label:'Wampa eats the defeated character'},{id:'cave',label:'Relocate the defeated character to Wampa Cave'}];}
 throw Error('Unknown creature attack decision.');
}
export function creatureChoose(m:Match,d:Decision,id:string):void{
 const p=d.payload as unknown as Payload,a=creatureAttack(m)!;if(!creatureChoices(m,d).some(c=>c.id===id))throw Error('Invalid attack choice.');
 if(d.handler==='creature:destiny'){
  if(id==='attack-draw')drawDestiny(m,a.shipSide,a.ships[0].id,'attack',action('power-total',p));else {a.powerDestiny=0;queue(m,a.mode==='assault'?'ferocity-start':'compare',p,a.initiator);}return;
 }
 const cave=relocationSite(m,a),ship=liveShips(m,a)[0];
 if(['belly','cave'].includes(id)&&cave&&ship){moveWithAttachments(m,ship.id,cave);a.outcome='relocated';a.relocation=referenceCard(m,cave);openWindow(m,'response',a.shipSide,{kind:'moved',card:ship.id,from:a.site.id,site:cave,method:'creature-relocation'});}
 else if(ship)lose(m,a,p,[ship.id]);
}
export function attackView(m:Match){const a=creatureAttack(m);return {creatureAttack:a?{stage:a.stage,mode:a.mode,creature:name(m,a.slug.id),ground:!!creatureProfile(m,a.slug.id)?.ground,hit:!!a.hit,hitLost:!!a.hitLost,relocation:a.relocation?name(m,a.relocation.id):null,ships:a.ships.map(s=>cardDefinition(m,s.id).name),ferocity:a.ferocity??null,attackDestiny:a.powerDestiny??null,totals:a.totals??null,outcome:a.outcome??null}:null};}
export function assertCreatureAttack(m:Match):void{
 const us=uses(m);if(!Array.isArray(us))throw Error('Invalid attack usage.');
 for(const u of us){assertCardReference(m,u.source);if(u.source.zone!=='table'||!sides.includes(u.side)||!['hunt','assault'].includes(u.mode)||!Number.isSafeInteger(u.turn)||u.turn<1||u.turn>m.turn.number||u.mode==='hunt'&&(!supportedCreature(m,u.source.id)||m.cards[u.source.id].owner!==u.side)||u.mode==='assault'&&cardDefinition(m,u.source.id).type!=='Location')throw Error('Invalid attack usage.');}
 if(new Set(us.map(u=>[u.mode,u.source.id,u.source.version,u.turn,u.side].join(':'))).size!==us.length)throw Error('Duplicate attack usage.');
 const a=creatureAttack(m);
 if(a){
  assertCardReference(m,a.slug);assertCardReference(m,a.site);
  if(!Array.isArray(a.ships))throw Error('Invalid attack ships.');a.ships.forEach(ref=>assertCardReference(m,ref));
  if(!supportedCreature(m,a.slug.id)||a.slug.zone!=='table'||a.site.zone!=='table'||cardDefinition(m,a.site.id).type!=='Location'||isSpaceSlug(m,a.slug.id)&&sectorFamily(m,a.site.id)!=='big-one'||!Number.isSafeInteger(a.serial)||a.serial<1||a.serial>m.serial||!Number.isSafeInteger(a.turn)||a.turn<1||a.turn>m.turn.number||!sides.includes(a.initiator)||!sides.includes(a.shipSide)||!['hunt','assault'].includes(a.mode)||!['begin','weapons','power','damage','complete'].includes(a.stage)||!a.ships.length||new Set(a.ships.map(s=>s.id)).size!==a.ships.length||a.ships.some(s=>s.zone!=='table'||!['Character','Vehicle','Starship'].includes(cardDefinition(m,s.id).type)||m.cards[s.id].owner!==a.shipSide)||a.mode==='hunt'&&(a.ships.length!==1||a.initiator!==m.cards[a.slug.id].owner)||a.mode==='assault'&&a.initiator!==a.shipSide||!Array.isArray(a.ferocityDraws)||a.ferocityDraws.length>creatureProfile(m,a.slug.id).draws||a.ferocityCount!==undefined&&(!Number.isSafeInteger(a.ferocityCount)||a.ferocityCount<0||a.ferocityCount>creatureProfile(m,a.slug.id).draws)||a.ferocityDraws.some(d=>!validDraw(m,d,m.cards[a.slug.id].owner))||a.powerDraw!==undefined&&!validDraw(m,a.powerDraw,a.shipSide)||a.defeated!==undefined&&typeof a.defeated!=='boolean'||a.hit!==undefined&&a.hit!==true||a.hitLost!==undefined&&(a.hitLost!==true||!a.hit)||a.interrupted!==undefined&&a.interrupted!==true||a.outcome!==undefined&&!['survived','eaten','relocated','slug-lost','creature-lost','ended'].includes(a.outcome))throw Error('Invalid creature attack.');
  if(a.relocation){assertCardReference(m,a.relocation);if(a.relocation.zone!=='table'||cardDefinition(m,a.relocation.id).type!=='Location'||a.outcome!=='relocated')throw Error('Invalid creature relocation.');}
  if(a.totals!==undefined&&(!a.totals||!Number.isFinite(a.totals.creature)||!Number.isFinite(a.totals.ships)))throw Error('Invalid attack totals.');
  for(const n of [a.ferocity,a.ferocityDestiny,a.powerDestiny,a.totals?.creature,a.totals?.ships])if(n!==undefined&&n!==null&&(!Number.isFinite(n)||n<0))throw Error('Invalid attack total.');
  if(a.scope!==undefined)assertDestinyScope(m,a.scope,m.cards[a.slug.id].owner,a.slug.id,'ferocity');
 }
 const steps=['begin','initiated','finish','power','ferocity-start','ferocity-drawn','ferocity-total','power-total','compare','defeated','lose','lost','hit-cleanup','hit-loss','hit-lost'];
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
