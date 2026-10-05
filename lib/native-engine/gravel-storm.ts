import {undercoverTargetable,undercoverReference} from './undercover-state';
import {lossPrevented} from './loss-prevention';
import {optionalActionWindow} from './action-timing';
import {ability} from './ability';
import {cardDefinition, name} from './board';
import {immuneToCardTitle} from './card-immunity';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {groundPresent} from './participation';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {loseFromTable, tableLossCards} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target: CardReference; draw?: Draw; cards?: string[]; site?: string};
const sites = new Set(['Dune Sea','Jundland Wastes',"Beggar's Canyon","Lars' Moisture Farm",'Jawa Camp','Mos Eisley'].map(s=>'Tatooine: '+s));
const action = (step:string,p:Payload): Action => ({id:'gravel:'+step+':'+p.card+':'+p.target.id,label:'Resolve Gravel Storm',handler:'gravel:'+step,source:p.card,payload:p as unknown as Json});
const queue = (m:Match,step:string,p:Payload) => m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
function targetable(m:Match,id:string,side:Side):boolean {
  const c=m.cards[id];
  return c.owner!==side && (m.cards[id].zone==='table'&&groundPresent(m,id)||undercoverTargetable(m,id)) && sites.has(cardDefinition(m,c.location!).name) && !immuneToCardTitle(m,id,'Gravel Storm');
}
export function gravelActions(m:Match,w:Window,side:Side):Action[] {
  if (!optionalActionWindow(w)) return [];
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='1_247').flatMap(card=>Object.keys(m.cards).filter(id=>targetable(m,id,side)).map(id=>({
    ...action('play',{card,target:referenceCard(m,id)}),label:'Gravel Storm · target '+name(m,id)})));
}
export function gravelInitiate(m:Match,r:Resolution):void {moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
export function gravelResolve(m:Match,r:Resolution):void {
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if (r.cancelled) {if(h==='gravel:play')moveCard(m,p.card,'lost');return;}
  if(h==='gravel:play') {
    queue(m,'finish',p);drawDestiny(m,r.actor,p.card,'gravel-storm',action('result',p));
  } else if(h==='gravel:result') {
    // Executed GEMP keeps this physical target after initiation: movement,
    // later protection and even departure/re-entry do not retarget the action.
    // The initial reference remains a durable record of the actual selection.
    if(p.draw!.value!==null && p.draw!.value>ability(m,p.target.id) && (m.cards[p.target.id].zone==='table'||undercoverTargetable(m,p.target.id))) {
      p.site=m.cards[p.target.id].location;
      queue(m,'lose',p);openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.target.id,source:p.card,...(p.site?{site:p.site}:{}),cause:'gravel-storm'});
    }
  } else if(h==='gravel:lose') {
    if((m.cards[p.target.id].zone==='table'||undercoverTargetable(m,p.target.id))&&!lossPrevented(m,p.target.id)) {
      p.cards=tableLossCards(m,[p.target.id]);queue(m,'lost',p);loseFromTable(m,[p.target.id]);
    }
  } else if(h==='gravel:lost') {
    openWindow(m,'response',other(r.actor),{kind:'character-lost',card:p.target.id,cards:p.cards!,source:p.card,...(p.site?{site:p.site}:{}),cause:'gravel-storm'});
  } else if(h==='gravel:finish') moveCard(m,p.card,'lost');
  else throw Error('Unknown Gravel Storm continuation.');
}
export function assertGravel(m:Match):void {
  for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('gravel:')) {
    const p=f.action.payload as unknown as Payload,h=f.action.handler;
    if(!p||m.cards[p.card]?.blueprint!=='1_247'||m.cards[p.card].owner!==f.actor||m.cards[p.card].zone!=='playing'||f.action.source!==p.card||
      !['gravel:play','gravel:result','gravel:lose','gravel:lost','gravel:finish'].includes(h))throw Error('Invalid Gravel Storm continuation.');
    assertCardReference(m,p.target);
    if(p.target.zone!=='table'&&!undercoverReference(m,p.target)||m.cards[p.target.id].owner===f.actor||cardDefinition(m,p.target.id).type!=='Character')throw Error('Invalid Gravel Storm target.');
    if(['gravel:result','gravel:lose','gravel:lost'].includes(h)&&(!p.draw||!validDraw(m,p.draw,f.actor)))throw Error('Invalid Gravel Storm destiny.');
    if(h==='gravel:lost'&&(!Array.isArray(p.cards)||!p.cards.includes(p.target.id)||new Set(p.cards).size!==p.cards.length||p.cards.some(id=>!m.cards[id])))throw Error('Invalid Gravel Storm losses.');
    if(p.site!==undefined&&!m.cards[p.site])throw Error('Invalid Gravel Storm location.');
  }
}
