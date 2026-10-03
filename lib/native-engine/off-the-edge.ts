import {cardDefinition, name, printed} from './board';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {alternateDestinies} from './destiny-values';
import {topLevel} from './equipment';
import {queueForceLoss} from './ground';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {groundPresent} from './participation';
import {retrieve} from './retrieval';
import {openWindow} from './runtime';
import {characterDestinyValue} from './stat-modifiers';
import {moveCard} from './state';
import {loseFromTable, tableLossCards} from './table';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; target: CardReference; draw?: Draw; printedValue?: number; cards?: string[]; site?: string};
const action = (step: string,p: Payload): Action => ({id:'off-edge:'+step+':'+p.card+':'+p.target.id,label:'Resolve Off The Edge',handler:'off-edge:'+step,source:p.card,payload:p as unknown as Json});
const queue = (m: Match,step: string,p: Payload) => m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
function targetable(m: Match,id: string,side: Side): boolean {
  const c=m.cards[id];if(c.owner!==side||!groundPresent(m,id))return false;
  const site=cardDefinition(m,c.location!);return site.type==='Location'&&site.subType==='Site'&&site.name.startsWith('Cloud City: ');
}
export function offEdgeActions(m: Match,w: Window,side: Side): Action[] {
  if(!topLevel(w))return [];
  const targets=Object.keys(m.cards).filter(id=>targetable(m,id,side));
  return m.players[side].hand.filter(id=>m.cards[id].blueprint==='5_59').flatMap(card=>targets.map(id=>({...action('play',{card,target:referenceCard(m,id)}),label:'Off The Edge · target '+name(m,id)+(alternateDestinies(m,id).length?' · destiny 2 or 5':' · destiny '+characterDestinyValue(m,id,printed(m,id,'destiny')))})));
}
export function offEdgeInitiate(m: Match,r: Resolution): void {moveCard(m,(r.action.payload as unknown as Payload).card,'playing');}
export function offEdgeResolve(m: Match,r: Resolution): void {
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if(r.cancelled){if(h==='off-edge:play')moveCard(m,p.card,'lost');return;}
  if(h==='off-edge:play'){
    queue(m,'finish',p);drawDestiny(m,r.actor,p.card,'off-the-edge',action('result',p));
  } else if(h==='off-edge:result'){
    // Refresh the target's printed value after destiny finishes, including when
    // that draw failed. This selection belongs to this comparison, not a draw.
    if(alternateDestinies(m,p.target.id).length)m.stack.push({kind:'decision',side:m.cards[p.target.id].owner,handler:'off-edge:value',payload:p as unknown as Json});
    else queue(m,'compare',{...p,printedValue:printed(m,p.target.id,'destiny')});
  } else if(h==='off-edge:compare'){
    const drawn=p.draw!.value,value=characterDestinyValue(m,p.target.id,p.printedValue!);
    if(drawn!==null&&drawn!==value){
      const difference=Math.abs(drawn-value);
      if(!Number.isSafeInteger(difference))throw Error('Fractional Off The Edge results require fractional Force handling.');
      if(drawn>value)retrieve(m,r.actor,p.card,difference,null,'used',undefined,{contributors:[p.target.id]});
      else queueForceLoss(m,{side:r.actor,remaining:difference,source:p.card,site:m.cards[p.target.id].location??null,reductionUsed:false});
    } else if(m.cards[p.target.id].zone==='table'){
      p.site=m.cards[p.target.id].location;queue(m,'lose',p);
      openWindow(m,'response',other(r.actor),{kind:'about-to-lose',card:p.target.id,source:p.card,...(p.site?{site:p.site}:{}),cause:'off-the-edge'});
    }
  } else if(h==='off-edge:lose'){
    if(m.cards[p.target.id].zone==='table'){p.cards=tableLossCards(m,[p.target.id]);queue(m,'lost',p);loseFromTable(m,[p.target.id]);}
  } else if(h==='off-edge:lost')openWindow(m,'response',other(r.actor),{kind:'character-lost',card:p.target.id,cards:p.cards!,source:p.card,...(p.site?{site:p.site}:{}),cause:'off-the-edge'});
  else if(h==='off-edge:finish')moveCard(m,p.card,'lost');
  else throw Error('Unknown Off The Edge continuation.');
}
export function offEdgeChoices(m: Match,d: Decision){
  const p=d.payload as unknown as Payload;if(d.handler!=='off-edge:value')throw Error('Unknown Off The Edge decision.');
  return alternateDestinies(m,p.target.id).map(n=>({id:'off-edge:value:'+n,label:name(m,p.target.id)+' · use '+n+' (current destiny '+characterDestinyValue(m,p.target.id,n)+')'}));
}
export function offEdgeChoose(m: Match,d: Decision,choice: string): void {
  if(!offEdgeChoices(m,d).some(c=>c.id===choice))throw Error('Invalid Off The Edge value.');
  queue(m,'compare',{...d.payload as unknown as Payload,printedValue:Number(choice.slice('off-edge:value:'.length))});
}
export function assertOffEdge(m: Match): void {
  for(const [index,f] of m.stack.entries()){
    const h=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!h.startsWith('off-edge:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='5_59'||m.cards[p.card].zone!=='playing'||(f.kind==='resolution'?f.actor:(f as Decision).side)!==m.cards[p.card].owner)throw Error('Invalid Off The Edge source.');
    assertCardReference(m,p.target);
    if(p.target.zone!=='table'||m.cards[p.target.id].owner!==m.cards[p.card].owner||cardDefinition(m,p.target.id).type!=='Character')throw Error('Invalid Off The Edge target.');
    if(f.kind==='resolution'){
      if(!['off-edge:play','off-edge:result','off-edge:compare','off-edge:lose','off-edge:lost','off-edge:finish'].includes(h)||f.action.source!==p.card||f.action.id!==action(h.slice(9),p).id||f.action.payment!==undefined)throw Error('Invalid Off The Edge resolution.');
    } else if(h!=='off-edge:value'||!alternateDestinies(m,p.target.id).length||p.printedValue!==undefined)throw Error('Invalid Off The Edge value choice.');
    if(!['off-edge:play','off-edge:finish'].includes(h)&&(!p.draw||!validDraw(m,p.draw,m.cards[p.card].owner)))throw Error('Invalid Off The Edge destiny.');
    if(['off-edge:compare','off-edge:lose','off-edge:lost'].includes(h)&&(!Number.isFinite(p.printedValue)||p.printedValue!<0||alternateDestinies(m,p.target.id).length>0&&!alternateDestinies(m,p.target.id).includes(p.printedValue!)))throw Error('Invalid Off The Edge printed value.');
    if(p.printedValue!==undefined&&!alternateDestinies(m,p.target.id).length&&p.printedValue!==printed(m,p.target.id,'destiny'))throw Error('Invalid fixed character destiny.');
    if(h==='off-edge:lost'&&(!Array.isArray(p.cards)||!p.cards.includes(p.target.id)||new Set(p.cards).size!==p.cards.length||p.cards.some(id=>!m.cards[id])))throw Error('Invalid Off The Edge losses.');
    if(p.site!==undefined&&!m.locations.includes(p.site))throw Error('Invalid Off The Edge site.');
    if(!['off-edge:play','off-edge:finish'].includes(h)&&!m.stack.slice(0,index).some(q=>q.kind==='resolution'&&q.action.handler==='off-edge:finish'&&q.action.source===p.card))throw Error('Missing Off The Edge cleanup.');
  }
}
