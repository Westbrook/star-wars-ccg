import {name} from './board';
import {deployed} from './deployment';
import {topLevel} from './equipment';
import {gameTextActive} from './game-text';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {assertReservePeek, peekReserve, reservePeekView, returnReservePeek, type ReservePeek} from './reserve-peek';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload={card:string;ref?:CardReference;inspection?:ReservePeek;selected?:string[]};
type Usage={turn:number;cards:CardReference[]};
const history=(m:Match)=>m.data.darkPathUses as unknown as Usage|undefined;
const uses=(m:Match)=>history(m)?.turn===m.turn.number?history(m)!.cards:[];
const action=(step:string,p:Payload):Action=>({id:'dark-path:'+step+':'+p.card,handler:'dark-path:'+step,source:p.card,label:step==='deploy'?'Deploy The Dark Path':'The Dark Path · peek at three, lose two',payload:p as unknown as Json});
export function darkPathActions(m:Match,w:Window,side:Side):Action[]{
  const result:Action[]=[];
  if(side!=='dark')return result;
  if(w.timing==='phase'&&m.turn.side===side&&m.turn.phase==='deploy')for(const card of m.players[side].hand)
    if(m.cards[card].blueprint==='4_133')result.push(action('deploy',{card}));
  if(topLevel(w)&&m.players[side].reserve.length)for(const c of Object.values(m.cards))
    if(c.owner===side&&c.blueprint==='4_133'&&gameTextActive(m,c.id)&&!uses(m).some(ref=>ref.id===c.id&&sameCard(m,ref)))result.push(action('peek',{card:c.id}));
  return result;
}
export function darkPathInitiate(m:Match,r:Resolution):void{
  const p=r.action.payload as Payload;
  if(r.action.handler==='dark-path:deploy')moveCard(m,p.card,'playing');
  else{
    p.ref=referenceCard(m,p.card);
    m.data.darkPathUses={turn:m.turn.number,cards:[...uses(m),p.ref]} as unknown as Json;
  }
}
export function darkPathResolve(m:Match,r:Resolution):void{
  const p=r.action.payload as Payload;
  if(r.action.handler==='dark-path:deploy'){
    if(r.cancelled||!canEnterTable(m,p.card))moveCard(m,p.card,'lost');else{moveCard(m,p.card,'table');deployed(m,p.card);}return;
  }
  if(r.cancelled)return;
  const inspection=peekReserve(m,r.actor,3);
  if(inspection.cards.length)m.stack.push({kind:'decision',side:r.actor,handler:'dark-path:select',payload:{...p,inspection,selected:[]} as unknown as Json});
}
export function darkPathChoices(m:Match,d:Decision){
  const p=d.payload as unknown as Payload;
  // "Any two of those three" requires all three; a short deck may still be
  // inspected. GEMP's actual granting card confirms no loss on a short peek.
  if(p.inspection!.cards.length<3)return [{id:'dark-path:finish',label:'Finish viewing · fewer than three cards; none are lost'}];
  return p.inspection!.cards.filter(ref=>!p.selected!.includes(ref.id)).map(ref=>({id:'dark-path:lose:'+ref.id,label:'Lose '+name(m,ref.id)+(p.selected!.length?' · placed on top of the first lost card':' · first card to Lost Pile')}));
}
export function darkPathChoose(m:Match,d:Decision,id:string):void{
  if(!darkPathChoices(m,d).some(x=>x.id===id))throw Error('Invalid Dark Path selection.');
  const p=d.payload as unknown as Payload;
  if(id==='dark-path:finish'){returnReservePeek(m,p.inspection!);openWindow(m,'response',other(d.side),{kind:'reserve-peeked',side:d.side,source:p.card});return;}
  p.selected!.push(id.slice('dark-path:lose:'.length));
  if(p.selected!.length<2){m.stack.push(d);return;}
  // Restore the kept card above every encountered insert before the loss
  // result. No insert fires halfway through this private peek/replace effect.
  returnReservePeek(m,p.inspection!);
  for(const card of p.selected!)moveCard(m,card,'lost');
  openWindow(m,'response',other(d.side),{kind:'cards-lost',cards:p.selected!,source:p.card});
}
export function darkPathView(m:Match,seat:Side):Json{
  const d=m.stack.at(-1);
  if(d?.kind!=='decision'||d.handler!=='dark-path:select'||d.side!==seat)return {};
  const p=d.payload as unknown as Payload;return {...reservePeekView(m,p.inspection!),peekSelected:p.selected!.map(id=>({...m.cards[id]}))};
}
export function assertDarkPath(m:Match):void{
  const h=history(m);
  if(m.data.darkPathUses!==undefined){if(!h||!Number.isSafeInteger(h.turn)||h.turn<1||h.turn>m.turn.number||!Array.isArray(h.cards)||new Set(h.cards.map(ref=>ref.id+':'+ref.version)).size!==h.cards.length)throw Error('Invalid Dark Path usage.');for(const ref of h.cards){assertCardReference(m,ref);if(ref.zone!=='table'||m.cards[ref.id].blueprint!=='4_133')throw Error('Invalid Dark Path source.');}}
  for(const f of m.stack){
    const step=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!step.startsWith('dark-path:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='4_133'||m.cards[p.card].owner!=='dark'||(f.kind==='resolution'?f.actor:(f as Decision).side)!=='dark')throw Error('Invalid Dark Path continuation.');
    if(f.kind==='resolution'){
      if(!['dark-path:deploy','dark-path:peek'].includes(step)||f.action.source!==p.card||f.action.id!==action(step.slice(10),p).id)throw Error('Invalid Dark Path action.');
      if(step==='dark-path:deploy'){if(m.cards[p.card].zone!=='playing')throw Error('Invalid Dark Path deployment.');continue;}
    }else if(f.kind!=='decision'||step!=='dark-path:select')throw Error('Invalid Dark Path decision.');
    assertCardReference(m,p.ref!,p.card);
    if(p.ref!.zone!=='table'||!uses(m).some(ref=>ref.id===p.ref!.id&&ref.version===p.ref!.version))throw Error('Missing Dark Path usage.');
    if(f.kind==='decision'){
      assertReservePeek(m,p.inspection!);
      if(p.inspection!.side!=='dark'||p.inspection!.cards.length>3||!Array.isArray(p.selected)||p.selected.length>1||p.selected.some(id=>!p.inspection!.cards.some(ref=>ref.id===id))||p.inspection!.cards.length<3&&p.selected.length)throw Error('Invalid Dark Path selection.');
    }
  }
}
