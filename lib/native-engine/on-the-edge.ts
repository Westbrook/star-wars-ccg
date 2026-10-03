import {ability} from './ability';
import {cardDefinition, name} from './board';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {topLevel} from './equipment';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {groundPresent} from './participation';
import {retrieve} from './retrieval';
import {openWindow, queueForcePayment} from './runtime';
import {moveCard} from './state';
import {loseFromTable, tableLossCards} from './table';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target: CardReference; chosen?: number; draw?: Draw; cards?: string[]; site?: string};
const action = (step: string,p: Payload): Action => ({id:'edge:'+step+':'+p.card+':'+p.target.id,label:'Resolve On The Edge',handler:'edge:'+step,source:p.card,payload:p as unknown as Json});
const queue = (m: Match,step: string,p: Payload) => m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
export function edgeActions(m: Match,w: Window,side: Side): Action[] {
  if(!topLevel(w)||!m.players[side].force.length)return [];
  const targets=Object.keys(m.cards).filter(id=>groundPresent(m,id)&&cardDefinition(m,id).subType==='Rebel'&&ability(m,id)>2);
  // Printed text targets a Rebel, not necessarily one owned by the player.
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='1_101').flatMap(card=>targets.map(id=>({...action('play',{card,target:referenceCard(m,id)}),label:'On The Edge · risk '+name(m,id)})));
}
export function edgeInitiate(m: Match,r: Resolution): void {
  const p=r.action.payload as unknown as Payload;moveCard(m,p.card,'playing');
  m.stack.push({kind:'decision',side:r.actor,handler:'edge:number',payload:p as unknown as Json});
}
export function edgeResolve(m: Match,r: Resolution): void {
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if(r.cancelled){if(h==='edge:play')moveCard(m,p.card,'lost');return;}
  if(h==='edge:play'){
    queue(m,'finish',p);drawDestiny(m,r.actor,p.card,'on-the-edge',action('result',p));
  } else if(h==='edge:result'){
    // GEMP's chosen Rebel is a physical target retained after initiation. Losing
    // table presence during responses does not cancel the destiny/retrieval.
    if(p.draw!.value!==null&&p.draw!.value>p.chosen!)m.stack.push({kind:'decision',side:r.actor,handler:'edge:retrieve',payload:p as unknown as Json});
    else if(m.cards[p.target.id].zone==='table'){
      p.site=m.cards[p.target.id].location;queue(m,'lose',p);
      openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.target.id,source:p.card,...(p.site?{site:p.site}:{}),cause:'on-the-edge'});
    }
  } else if(h==='edge:lose'){
    if(m.cards[p.target.id].zone==='table'){
      p.cards=tableLossCards(m,[p.target.id]);queue(m,'lost',p);loseFromTable(m,[p.target.id]);
    }
  } else if(h==='edge:lost')openWindow(m,'response',other(r.actor),{kind:'character-lost',card:p.target.id,cards:p.cards!,source:p.card,...(p.site?{site:p.site}:{}),cause:'on-the-edge'});
  else if(h==='edge:finish')moveCard(m,p.card,'lost');
  else throw Error('Unknown On The Edge continuation.');
}
export function edgeChoices(m: Match,d: Decision){
  const p=d.payload as unknown as Payload;
  if(d.handler==='edge:number')return Array.from({length:6},(_,i)=>({id:'edge:number:'+(i+1),label:'Choose '+(i+1)+' · destiny must exceed '+(i+1)}));
  if(d.handler==='edge:retrieve')return [{id:'edge:retrieve',label:'Retrieve '+p.chosen+' Force'},{id:'edge:decline',label:'Decline retrieval'}];
  throw Error('Unknown On The Edge decision.');
}
export function edgeChoose(m: Match,d: Decision,choice: string): void {
  if(!edgeChoices(m,d).some(c=>c.id===choice))throw Error('Invalid On The Edge choice.');
  const p=d.payload as unknown as Payload;
  if(d.handler==='edge:number'){
    const parent=m.stack.at(-1);
    if(parent?.kind!=='resolution'||parent.action.handler!=='edge:play'||parent.action.source!==p.card||!parent.awaitingResponses)throw Error('Missing On The Edge payment.');
    p.chosen=Number(choice.slice('edge:number:'.length));parent.action.payload=p as unknown as Json;parent.action.payment={[d.side]:1};queueForcePayment(m,parent,parent.action.payment);
  } else if(choice==='edge:retrieve')retrieve(m,d.side,p.card,p.chosen!);
}
export function assertEdge(m: Match): void {
  for(const [index,f] of m.stack.entries()){
    const h=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!h.startsWith('edge:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='1_101'||m.cards[p.card].zone!=='playing'||(f.kind==='resolution'?f.actor:(f as Decision).side)!==m.cards[p.card].owner)throw Error('Invalid On The Edge source.');
    assertCardReference(m,p.target);
    if(p.target.zone!=='table'||cardDefinition(m,p.target.id).subType!=='Rebel')throw Error('Invalid On The Edge target.');
    if(f.kind==='resolution'){
      if(!['edge:play','edge:result','edge:lose','edge:lost','edge:finish'].includes(h)||f.action.source!==p.card||f.action.id!==action(h.slice(5),p).id)throw Error('Invalid On The Edge resolution.');
      if(h==='edge:play'&&(p.chosen===undefined?!f.awaitingResponses||f.action.payment!==undefined:f.action.payment?.[f.actor]!==1||(f.action.payment?.[other(f.actor)]??0)!==0))throw Error('Invalid On The Edge cost.');
    } else if(!['edge:number','edge:retrieve'].includes(h))throw Error('Invalid On The Edge decision.');
    if(p.chosen!==undefined&&(!Number.isSafeInteger(p.chosen)||p.chosen<1||p.chosen>6)||p.chosen===undefined&&!['edge:play','edge:number'].includes(h))throw Error('Invalid On The Edge number.');
    if(h==='edge:number'){
      const parent=m.stack[index-1];
      if(p.chosen!==undefined||parent?.kind!=='resolution'||parent.action.handler!=='edge:play'||!parent.awaitingResponses||parent.action.source!==p.card||JSON.stringify(parent.action.payload)!==JSON.stringify(p))throw Error('Invalid On The Edge number parent.');
    }
    if(['edge:result','edge:retrieve','edge:lose','edge:lost'].includes(h)&&(!p.draw||!validDraw(m,p.draw,m.cards[p.card].owner)))throw Error('Invalid On The Edge destiny.');
    if(h==='edge:retrieve'&&(p.draw!.value===null||p.draw!.value<=p.chosen!))throw Error('Invalid On The Edge success.');
    if(['edge:lose','edge:lost'].includes(h)&&p.draw!.value!==null&&p.draw!.value>p.chosen!)throw Error('Invalid On The Edge failure.');
    if(h==='edge:lost'&&(!Array.isArray(p.cards)||!p.cards.includes(p.target.id)||new Set(p.cards).size!==p.cards.length||p.cards.some(id=>!m.cards[id])))throw Error('Invalid On The Edge losses.');
    if(p.site!==undefined&&!m.locations.includes(p.site))throw Error('Invalid On The Edge site.');
    if(!['edge:play','edge:number','edge:finish'].includes(h)&&!m.stack.slice(0,index).some(q=>q.kind==='resolution'&&q.action.handler==='edge:finish'&&q.action.source===p.card))throw Error('Missing On The Edge cleanup.');
  }
}
