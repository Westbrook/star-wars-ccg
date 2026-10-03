import {insertsIn} from './reserve-inserts';
import {name} from './board';
import {activateForce} from './runtime';
import {mayActivate} from './activation';
import {moveCard} from './state';
import {other, sides, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; order?: Side[]; group?: number; remaining?: number; maximum?: number};
const action = (step: string, p: Payload): Action => ({id:'stew:'+step+':'+p.card,label:'Resolve Beru Stew',handler:'stew:'+step,source:p.card,payload:p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind:'resolution',actor:m.cards[p.card].owner,cancelled:false,action:action(step,p)});
const bonus = (m: Match) => Object.values(m.cards).filter(c => c.zone === 'table' && !c.coveredBy && ['1_2','1_22','1_37'].includes(c.blueprint)).length;
export function stewActions(m: Match,w: Window,side: Side): Action[] {
  if (w.timing !== 'phase' && !(w.timing === 'response' && (w.event as {kind?:string})?.kind === 'battle-weapons')) return [];
  // AR p138 explicitly makes activation a result, not an initiation condition.
  // Empty Reserve decks do not prohibit playing this Interrupt.
  return m.players[side].hand.filter(id => m.cards[id].blueprint === '1_72').map(card => ({...action('play',{card}),label:'Play '+name(m,card)+' · each player activates 2 Force'}));
}
export function stewInitiate(m: Match,r: Resolution): void {moveCard(m,(r.action.payload as Payload).card,'playing');}
function startGroups(m: Match,p: Payload,first: Side): void {
  queue(m,'activate',{card:p.card,order:[first,other(first)],group:0,remaining:2});
}
export function stewResolve(m: Match,r: Resolution): void {
  const p=r.action.payload as unknown as Payload,h=r.action.handler;
  if (r.cancelled) {if(h==='stew:play')moveCard(m,p.card,'lost');return;}
  if(h==='stew:play') {
    queue(m,'finish',{card:p.card});
    // The turn player orders the two automatic results, even on Dark's turn.
    // If either group is empty there is no meaningful ordering choice.
    if(sides.every(side=>m.players[side].reserve.length>0 && mayActivate(m,side)))m.stack.push({kind:'decision',side:m.turn.side,handler:'stew:order',payload:{card:p.card}});
    else startGroups(m,p,r.actor);
  } else if(h==='stew:activate') {
    const side=p.order![p.group!];
    if(p.remaining!>0 && m.players[side].reserve.length && mayActivate(m,side)) {
      queue(m,'activate',{...p,remaining:0});activateForce(m,side,p.card,p.remaining!);
    } else if(p.group===0) queue(m,'activate',{...p,group:1,remaining:2});
    else {
      // "Also" follows both mandatory groups. Count the current table now,
      // after every response to the individual activations has finished.
      const maximum=mayActivate(m,r.actor) ? (insertsIn(m,r.actor).length ? bonus(m) : Math.min(bonus(m),m.players[r.actor].reserve.length)) : 0;
      if(maximum>0)m.stack.push({kind:'decision',side:r.actor,handler:'stew:amount',payload:{card:p.card,maximum}});
    }
  } else if(h==='stew:bonus') {
    if(p.remaining!>0) activateForce(m,r.actor,p.card,p.remaining!,p.maximum!);
  } else if(h==='stew:finish') moveCard(m,p.card,'lost');
  else throw Error('Unknown Beru Stew continuation.');
}
export function stewChoices(m: Match,d: Decision) {
  const p=d.payload as Payload;
  if(d.handler==='stew:order')return sides.map(side=>({id:'stew:first:'+side,label:(side==='light'?'Light':'Dark')+' activates first'}));
  if(d.handler==='stew:amount')return Array.from({length:p.maximum!+1},(_,n)=>({id:'stew:amount:'+n,label:n?'Activate '+n+' additional Force':'Decline additional activation'}));
  throw Error('Unknown Beru Stew decision.');
}
export function stewChoose(m: Match,d: Decision,choice: string): void {
  if(!stewChoices(m,d).some(c=>c.id===choice))throw Error('Invalid Beru Stew choice.');
  const p=d.payload as Payload;
  if(d.handler==='stew:order')startGroups(m,p,choice.split(':')[2] as Side);
  else queue(m,'bonus',{...p,remaining:Number(choice.split(':')[2])});
}
export function assertStew(m: Match): void {
  for(const [index,f] of m.stack.entries()) {
    const h=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';
    if(!h.startsWith('stew:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as Payload;
    if(!p || m.cards[p.card]?.blueprint!=='1_72' || m.cards[p.card].zone!=='playing')throw Error('Invalid Beru Stew source.');
    const owner=m.cards[p.card].owner;
    if(f.kind==='resolution') {
      if(!['stew:play','stew:activate','stew:bonus','stew:finish'].includes(h) || f.actor!==owner || f.action.source!==p.card || f.action.id!==action(h.slice(5),p).id)throw Error('Invalid Beru Stew resolution.');
    } else if(f.kind==='decision' && (!['stew:order','stew:amount'].includes(h) || f.side!==(h==='stew:order'?m.turn.side:owner)))throw Error('Invalid Beru Stew decision owner.');
    if(!['stew:play','stew:finish'].includes(h) && !m.stack.slice(0,index).some(q=>q.kind==='resolution'&&q.action.handler==='stew:finish'&&(q.action.payload as Payload).card===p.card))throw Error('Missing Beru Stew result.');
    if(h==='stew:activate' && (!Array.isArray(p.order)||p.order.length!==2||!sides.every(s=>p.order!.includes(s))||![0,1].includes(p.group!)||!Number.isSafeInteger(p.remaining)||p.remaining!<0||p.remaining!>2))throw Error('Invalid ordered activation.');
    if(['stew:amount','stew:bonus'].includes(h) && (!Number.isSafeInteger(p.maximum)||p.maximum!<1||p.maximum!>Object.keys(m.cards).length))throw Error('Invalid extra activation bound.');
    if(h==='stew:amount' && (!mayActivate(m,owner) || p.maximum!==(insertsIn(m,owner).length ? bonus(m) : Math.min(bonus(m),m.players[owner].reserve.length))))throw Error('Stale extra activation choice.');
    if(h==='stew:bonus' && (!Number.isSafeInteger(p.remaining)||p.remaining!<0||p.remaining!>p.maximum!))throw Error('Invalid extra activation count.');
    if(h!=='stew:activate' && (p.order!==undefined||p.group!==undefined) || !['stew:activate','stew:bonus'].includes(h) && p.remaining!==undefined || !['stew:amount','stew:bonus'].includes(h) && p.maximum!==undefined)throw Error('Unexpected activation state.');
  }
}
