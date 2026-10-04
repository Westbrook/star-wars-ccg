import {optionalActionWindow} from './action-timing';
import {ability} from './ability';
import {cardDefinition} from './definitions';
import {isModel} from './characteristics';
import {drawDestiny,validDraw,type Draw} from './destiny';
import {beginDestinySequence,assertDestinyScope} from './destiny-limits';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {belowDecks,landed,operational,occupants,permanentAbility,permanentPilot,vesselPower} from './occupancy';
import {actingPilot,vesselManeuver} from './piloting';
import {openWindow} from './runtime';
import {addStatModifier} from './stat-modifiers';
import {moveCard} from './state';
import {loseFromTable,tableLossCards} from './table';
import {other,sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;dark?:string;light?:string;site?:string;refs?:Record<Side,CardReference>;slip?:boolean;serial?:number;draw?:Draw;total?:number|null;target?:string;targetRef?:CardReference;index?:number;actionId?:string;windowSerial?:number};
export type TallonRoll={serial:number;source:string;site:string;ships:Record<Side,string>;names:Record<Side,string>;refs:Record<Side,CardReference>;stage:'dark-destiny'|'light-destiny'|'result'|'loss'|'complete';slip:boolean;draws:Partial<Record<Side,Draw>>;scopes:Partial<Record<Side,string>>;destiny:Partial<Record<Side,number|null>>;values?:Record<Side,{power:number;maneuver:number;ability:number}>;totals?:Record<Side,number>;loser:Side|null;targetDeparted:boolean;lost?:Side;lossPrevented?:boolean};
export const tallonRoll=(m:Match)=>m.data.tallonRoll as TallonRoll|undefined;
const starfighter=(m:Match,id:string)=>cardDefinition(m,id).type==='Starship'&&cardDefinition(m,id).subType.startsWith('Starfighter:');
const rebel=(m:Match,id:string)=>m.cards[id].owner==='light'&&starfighter(m,id)&&!(cardDefinition(m,id).icons as string[]).some(i=>['Independent','Republic','Trade Federation','Separatist','Clone Army','First Order','Resistance'].includes(i));
const topLevel=(w:Window)=>optionalActionWindow(w);
const action=(step:string,p:Payload):Action=>({id:'tallon:'+step+':'+p.card+(p.dark?':'+p.dark+':'+p.light:p.target?':'+p.target:''),label:step,handler:'tallon:'+step,source:p.card,payload:p as unknown as Json});
const queue=(m:Match,step:string,p:Payload,actor:Side='dark')=>m.stack.push({kind:'resolution',actor,cancelled:false,action:action(step,p)});
const losingSide=(d:TallonRoll):Side|null=>d.destiny.dark===null?(d.destiny.light===null?null:'dark'):d.destiny.light===null?'light':d.totals!.dark===d.totals!.light?null:d.totals!.dark<d.totals!.light?'dark':'light';
const live=(m:Match,d:TallonRoll)=>sides.every(s=>sameCard(m,d.refs[s]));
function pendingRoll(m:Match,p:Payload):Resolution|undefined{
 const r=m.stack[p.index!],w=m.stack[p.index!+1];
 return r?.kind==='resolution'&&r.action.handler==='tallon:play'&&!r.cancelled&&!r.awaitingResponses&&r.action.id===p.actionId&&w?.kind==='window'&&w.serial===p.windowSerial&&r.action.source===p.target&&sameCard(m,p.targetRef!)?r:undefined;
}
export function tallonActions(m:Match,w:Window,side:Side):Action[]{
 const out:Action[]=[];
 for(const card of m.players[side].hand){
  const bp=m.cards[card].blueprint;
  if(bp==='1_270'&&topLevel(w))for(const tie of Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&starfighter(m,c.id)&&isModel(m,c.id,'TIE_LN')&&operational(m,c.id)&&!belowDecks(m,c.id)&&c.location&&['System','Sector'].includes(cardDefinition(m,c.location).subType)))
   for(const target of Object.values(m.cards).filter(c=>c.zone==='table'&&rebel(m,c.id)&&c.location===tie.location&&!landed(m,c.id)&&!belowDecks(m,c.id))){const a=action('play',{card,dark:tie.id,light:target.id,site:tie.location});a.label='Tallon Roll · '+cardDefinition(m,tie.id).name+' vs '+cardDefinition(m,target.id).name;out.push(a);}
  if(bp!=='2_47')continue;
  if(topLevel(w))for(const c of Object.values(m.cards).filter(c=>c.owner!==side&&c.zone==='table'&&starfighter(m,c.id)&&(cardDefinition(m,c.id).stats as Record<string,string>).maneuver!==undefined)){
   const a=action('reduce',{card,target:c.id});a.label='Corellian Slip · reduce '+cardDefinition(m,c.id).name+' maneuver';out.push(a);
  }
  const r=m.stack[m.stack.indexOf(w)-1];
  if(w.timing==='response'&&!w.event&&r?.kind==='resolution'&&r.action.handler==='tallon:play'&&!r.cancelled&&!r.awaitingResponses&&r.actor!==side){
   const a=action('slip',{card,target:r.action.source,index:m.stack.indexOf(r),actionId:r.action.id,windowSerial:w.serial});a.label='Corellian Slip · add maneuver and pilot ability';out.push(a);
  }
 }
 return out;
}
export function tallonInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload;
 if(r.action.handler==='tallon:play')p.refs={dark:referenceCard(m,p.dark!),light:referenceCard(m,p.light!)};
 else p.targetRef=referenceCard(m,p.target!);
 moveCard(m,p.card,'playing');
}
export function tallonResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as Payload,h=r.action.handler;
 if(h==='tallon:reduce'||h==='tallon:slip'){
  if(!r.cancelled){if(h==='tallon:reduce'&&sameCard(m,p.targetRef!))addStatModifier(m,p.card,p.target!,'maneuver','add',-1,{function:'corellian-slip'});else if(h==='tallon:slip'){const roll=pendingRoll(m,p);if(roll)(roll.action.payload as Payload).slip=true;}}
  if(m.cards[p.card].zone==='playing')moveCard(m,p.card,r.cancelled?'lost':'used');return;
 }
 if(h==='tallon:play'){
  if(r.cancelled){if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'lost');return;}
  const d:TallonRoll={serial:++m.serial,source:p.card,site:p.site!,ships:{dark:p.dark!,light:p.light!},names:{dark:cardDefinition(m,p.dark!).name,light:cardDefinition(m,p.light!).name},refs:structuredClone(p.refs!),stage:'dark-destiny',slip:!!p.slip,draws:{},scopes:{},destiny:{},loser:null,targetDeparted:false};m.data.tallonRoll=d as unknown as Json;p.serial=d.serial;queue(m,'finish',p);
  d.scopes.dark=beginDestinySequence(m,'dark',p.card,'tallon-roll');drawDestiny(m,'dark',p.card,'tallon-roll',action('dark',p),true,0,undefined,false,d.scopes.dark);return;
 }
 const d=tallonRoll(m);if(!d||d.serial!==p.serial||d.source!==p.card)throw Error('Missing Tallon Roll.');
 if(h==='tallon:finish'){d.stage='complete';if(m.cards[p.card].zone==='playing')moveCard(m,p.card,'used');return;}
 if(r.cancelled){if(h==='tallon:lose')d.lossPrevented=true;return;}
 if(h==='tallon:dark'||h==='tallon:light'){
  const side=h==='tallon:dark'?'dark':'light';d.draws[side]=p.draw!;d.destiny[side]=p.total!;
  if(side==='dark'){d.stage='light-destiny';d.scopes.light=beginDestinySequence(m,'light',p.card,'tallon-roll');drawDestiny(m,'light',p.card,'tallon-roll',action('light',{card:p.card,serial:p.serial}),true,0,undefined,false,d.scopes.light);return;}
  d.targetDeparted=!live(m,d);
  const pilotAbility=operational(m,d.ships.light)?Math.max(permanentAbility(m,d.ships.light),...occupants(m,d.ships.light).filter(c=>actingPilot(m,c.id)).map(c=>ability(m,c.id))):0;
  // A remaining effect still resolves after departure. The old ship retains
  // printed statistics and printed pilot icons, but cannot acquire crew or
  // modifiers from a new visit to the table.
  const value=(side:Side,stat:'power'|'maneuver')=>sameCard(m,d.refs[side])?(stat==='power'?vesselPower(m,d.ships[side]):vesselManeuver(m,d.ships[side])??0):permanentPilot(m,d.ships[side])?Number((cardDefinition(m,d.ships[side]).stats as Record<string,string>)[stat]??0):0;
  d.values={dark:{power:value('dark','power'),maneuver:value('dark','maneuver'),ability:0},light:{power:value('light','power'),maneuver:d.slip?value('light','maneuver'):0,ability:d.slip&&sameCard(m,d.refs.light)?pilotAbility:0}};
  d.totals={dark:0,light:0};for(const s of sides){const v=d.values[s];d.totals[s]=(d.destiny[s]??0)+v.power+v.maneuver+v.ability;}
  d.loser=losingSide(d);
  d.stage='result';queue(m,'loss',p);openWindow(m,'response','light',{kind:'tallon-result',source:p.card});
 }else if(h==='tallon:loss'){
  d.stage='loss';if(!d.loser||!sameCard(m,d.refs[d.loser]))return;
  queue(m,'lose',p);const cards=tableLossCards(m,[d.ships[d.loser]]);openWindow(m,'response',other(d.loser),{kind:'about-to-lose',card:d.ships[d.loser],cards,cardRefs:cards.map(id=>referenceCard(m,id)),source:p.card,site:d.site,cause:'tallon-roll'});
 }else if(h==='tallon:lose'){
  if(d.loser&&sameCard(m,d.refs[d.loser])){d.lost=d.loser;queue(m,'lost',p);loseFromTable(m,[d.ships[d.loser]]);}
 }else if(h==='tallon:lost')openWindow(m,'response',other(d.loser!),{kind:'starship-lost',card:d.ships[d.loser!],source:p.card,site:d.site,cause:'tallon-roll'});
 else throw Error('Unknown Tallon Roll continuation.');
}
export function tallonView(m:Match){const d=tallonRoll(m);if(!d)return {tallon:null};const {refs:_refs,scopes:_scopes,...view}=d;return {tallon:structuredClone(view)};}
export function assertTallon(m:Match):void{
 const d=tallonRoll(m);
 if(d){
  if(!Number.isSafeInteger(d.serial)||d.serial<1||d.serial>m.serial||m.cards[d.source]?.blueprint!=='1_270'||!m.locations.includes(d.site)||!['dark-destiny','light-destiny','result','loss','complete'].includes(d.stage)||typeof d.slip!=='boolean'||typeof d.targetDeparted!=='boolean'||d.loser!==null&&!sides.includes(d.loser)||!d.draws||!d.destiny||!d.scopes)throw Error('Invalid Tallon Roll record.');
  for(const s of sides){assertCardReference(m,d.refs?.[s],d.ships?.[s]);if(d.refs[s].zone!=='table'||m.cards[d.ships[s]].owner!==s||!starfighter(m,d.ships[s])||typeof d.names?.[s]!=='string')throw Error('Invalid Tallon Roll participant.');assertDestinyScope(m,d.scopes[s],s,d.source,'tallon-roll');const draw=d.draws[s],v=d.destiny[s];if(draw&&(!validDraw(m,draw,s)||v===undefined||v!==null&&(!Number.isFinite(v)||v<0))||!draw&&v!==undefined)throw Error('Invalid Tallon Roll destiny.');}
  if(d.values||d.totals){for(const s of sides){const v=d.values?.[s];if(!v||!d.totals||d.destiny[s]===undefined||[v.power,v.maneuver,v.ability].some(x=>!Number.isFinite(x)||x<0)||d.totals[s]!==v.power+v.maneuver+v.ability+(d.destiny[s]??0))throw Error('Invalid Tallon Roll total.');}}
  if(d.totals&&d.loser!==losingSide(d))throw Error('Invalid Tallon Roll comparison outcome.');
  if(d.lost!==undefined&&(d.lost!==d.loser||!sides.includes(d.lost))||d.lossPrevented!==undefined&&typeof d.lossPrevented!=='boolean')throw Error('Invalid Tallon Roll loss result.');
  if(['result','loss','complete'].includes(d.stage)&&(!d.values||!d.totals))throw Error('Missing Tallon Roll result.');
 }
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('tallon:')){
  const p=r.action.payload as Payload,h=r.action.handler;
  if(!p||r.action.source!==p.card||m.cards[p.card]?.zone!=='playing'||!['play','reduce','slip','dark','light','loss','lose','lost','finish'].some(x=>h==='tallon:'+x))throw Error('Invalid Tallon Roll continuation.');
  if(h==='tallon:reduce'||h==='tallon:slip'){if(m.cards[p.card].blueprint!=='2_47'||r.actor!=='light')throw Error('Invalid Corellian Slip.');assertCardReference(m,p.targetRef!,p.target);if(h==='tallon:reduce'&&(p.targetRef!.zone!=='table'||!starfighter(m,p.target!))||h==='tallon:slip'&&(p.targetRef!.zone!=='playing'||!Number.isSafeInteger(p.index)||p.index!<0||p.index!>=m.stack.indexOf(r)||typeof p.actionId!=='string'||!Number.isSafeInteger(p.windowSerial)))throw Error('Invalid Corellian Slip target.');}
  else if(m.cards[p.card].blueprint!=='1_270'||r.actor!==(h==='tallon:light'?'light':'dark'))throw Error('Invalid Tallon Roll actor.');
  else if(h==='tallon:play'){for(const s of sides){assertCardReference(m,p.refs?.[s]!,p[s]);if(p.refs![s].zone!=='table'||m.cards[p[s]!].owner!==s||!starfighter(m,p[s]!))throw Error('Invalid pending Tallon Roll target.');}if(!m.locations.includes(p.site!)||p.slip!==undefined&&p.slip!==true)throw Error('Invalid pending Tallon Roll state.');}
  else if(!d||p.serial!==d.serial||p.card!==d.source)throw Error('Stale Tallon Roll continuation.');
 }
}
