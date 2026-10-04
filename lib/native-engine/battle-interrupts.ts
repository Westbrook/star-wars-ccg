import {ability} from './ability';
import {addBattleDrawModifier} from './battle-destiny';
import {battle,members} from './battle';
import {cardDefinition,isSite,isWarrior,name} from './board';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {crewActive,unitsAt} from './occupancy';
import {hasPersona} from './persona';
import {vesselManeuver} from './piloting';
import {moveCard} from './state';
import {sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

const supported=['1_102','1_110','1_116','1_119'];
type Payload={card:string;amount:1|2;targets:CardReference[];site:CardReference;window:number};
const data=(r:Resolution)=>r.action.payload as unknown as Payload;
const action=(p:Payload):Action=>({id:'battle-add:'+p.card+':'+p.amount+':'+p.targets.map(ref=>ref.id).join(':'),handler:'battle-add:play',source:p.card,label:'Add '+p.amount+' battle destiny',payload:p as unknown as Json});
/** A droid also prevents a character being alone. A vehicle without ability
 * does not, while an active permanent pilot does (AR, Alone/Lone). */
export function aloneInBattle(m:Match,id:string):boolean {
 const c=m.cards[id];return !!c?.location&&cardDefinition(m,id).type==='Character'&&members(m,c.owner).includes(id)&&!unitsAt(m,c.location).some(other=>other.id!==id&&other.owner===c.owner&&crewActive(m,other.id)&&(cardDefinition(m,other.id).type==='Character'||ability(m,other.id)>0));
}
export function battleInterruptActions(m:Match,w:Window,side:Side):Action[]{
 const b=battle(m);if(!b||w.timing!=='response')return [];
 const parent=m.stack.at(-2),initial=b.stage==='begin'&&b.initiator!==side&&parent?.kind==='resolution'&&parent.action.handler==='battle:begin'&&!parent.cancelled&&!parent.awaitingResponses;
 const weapons=b.stage==='weapons'&&(w.event as {kind?:string})?.kind==='battle-weapons',participants=sides.flatMap(s=>members(m,s)),result:Action[]=[];
 for(const card of m.players[side].hand.filter(id=>supported.includes(m.cards[id].blueprint))){
  const bp=m.cards[card].blueprint,offer=(targets:string[],amount:1|2)=>{const p:Payload={card,amount,targets:targets.map(id=>referenceCard(m,id)),site:referenceCard(m,b.site),window:w.serial};result.push({...action(p),...(bp==='1_102'?{payment:{[side]:1}}:{}),label:name(m,card)+' · add '+amount+' battle destiny · '+targets.map(id=>name(m,id)).join(' + ')});};
  if(bp==='1_102'&&initial&&['System','Sector'].includes(cardDefinition(m,b.site).subType))for(const id of members(m,side))if(cardDefinition(m,id).type==='Starship'&&(vesselManeuver(m,id)??0)>3)offer([id],1);
  if(!weapons)continue;
  if(bp==='1_110')for(const luke of participants.filter(id=>hasPersona(m,id,'LUKE')))for(const leia of participants.filter(id=>hasPersona(m,id,'LEIA')))offer([luke,leia],2);
  if(bp==='1_116')for(const luke of participants.filter(id=>hasPersona(m,id,'LUKE')))for(const imperial of participants.filter(id=>cardDefinition(m,id).subType==='Imperial'&&ability(m,id)>2))offer([luke,imperial],hasPersona(m,imperial,'VADER')?2:1);
  if(bp==='1_119'&&isSite(m,b.site))for(const id of participants.filter(id=>m.cards[id].owner!==b.initiator&&aloneInBattle(m,id))){if(m.cards[id].owner===side&&isWarrior(m,id))offer([id],1);if(hasPersona(m,id,'LEIA'))offer([id],2);}
 }
 return result;
}
export function battleInterruptInitiate(m:Match,r:Resolution){moveCard(m,data(r).card,'playing');}
export function battleInterruptResolve(m:Match,r:Resolution){
 const p=data(r),b=battle(m);
 // Optional additions are locked in. Conditions/targets are not continuous
 // modifiers: departure or stat changes after play do not erase the addition.
 if(!r.cancelled&&b&&['begin','weapons'].includes(b.stage)&&b.site===p.site.id)addBattleDrawModifier(m,p.card,r.actor,'add',p.amount,{function:'battle-destiny'});
 moveCard(m,p.card,!r.cancelled&&m.cards[p.card].blueprint==='1_102'?'used':'lost');
}
export function assertBattleInterrupts(m:Match){
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('battle-add:')){
  const p=data(r),bp=m.cards[p?.card]?.blueprint,b=battle(m);
  if(!p||!supported.includes(bp)||r.actor!==m.cards[p.card].owner||r.action.handler!=='battle-add:play'||r.action.source!==p.card||m.cards[p.card].zone!=='playing'||![1,2].includes(p.amount)||!Array.isArray(p.targets)||new Set(p.targets.map(ref=>ref.id)).size!==p.targets.length||r.action.id!==action(p).id||!b||b.site!==p.site?.id)throw Error('Invalid battle addition.');
  assertCardReference(m,p.site);if(p.site.zone!=='table')throw Error('Invalid battle addition site.');
  for(const ref of p.targets){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid battle addition target.');}
  const i=m.stack.findIndex(f=>f.kind==='window'&&f.serial===p.window),w=m.stack[i],parent=m.stack[i-1];
  if(!Number.isSafeInteger(p.window)||i<0||i>=m.stack.indexOf(r)||w?.kind!=='window'||w.timing!=='response')throw Error('Invalid battle addition window.');
  if(bp==='1_102'){
   if(p.targets.length!==1||p.amount!==1||cardDefinition(m,p.targets[0].id).type!=='Starship'||m.cards[p.targets[0].id].owner!==r.actor||parent?.kind!=='resolution'||parent.action.handler!=='battle:begin'||b.initiator===r.actor||!['System','Sector'].includes(cardDefinition(m,p.site.id).subType)||r.action.payment?.[r.actor]!==1)throw Error('Invalid Out Of Nowhere binding.');
  }else{
   if((w.event as {kind?:string})?.kind!=='battle-weapons'||r.action.payment)throw Error('Invalid battle addition timing.');
   if(bp==='1_110'&&(p.targets.length!==2||p.amount!==2||!hasPersona(m,p.targets[0].id,'LUKE')||!hasPersona(m,p.targets[1].id,'LEIA')))throw Error('Invalid Skywalkers targets.');
   if(bp==='1_116'&&(p.targets.length!==2||!hasPersona(m,p.targets[0].id,'LUKE')||cardDefinition(m,p.targets[1].id).subType!=='Imperial'||p.amount!==(hasPersona(m,p.targets[1].id,'VADER')?2:1)))throw Error('Invalid Force Is Strong targets.');
   if(bp==='1_119'&&(p.targets.length!==1||!isSite(m,p.site.id)||cardDefinition(m,p.targets[0].id).type!=='Character'||p.amount===2&&!hasPersona(m,p.targets[0].id,'LEIA')||p.amount===1&&m.cards[p.targets[0].id].owner!==r.actor))throw Error('Invalid Warrior’s Courage target.');
  }
 }
}
