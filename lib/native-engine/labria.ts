import {cardDefinition,name} from './board';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {assertPileReveal,revealPileCard,stillRevealed,type PileReveal} from './pile-reveal';
import {assertReserveTopAccessible} from './reserve-inserts';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other,type Action,type Decision,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Payload={card:string;ref?:CardReference;reveal?:PileReveal};
type Usage={turn:number;cards:CardReference[]};
const history=(m:Match)=>m.data.labriaUses as unknown as Usage|undefined;
const uses=(m:Match)=>history(m)?.turn===m.turn.number?history(m)!.cards:[];
const action=(step:string,p:Payload):Action=>({id:'labria:'+step+':'+p.card,handler:'labria:'+step,source:p.card,label:'Labria · reveal the top Reserve card',payload:p as unknown as Json});
const vehicle=(m:Match,id:string)=>['Vehicle','Starship'].includes(cardDefinition(m,id).type);
export function labriaActions(m:Match,w:Window,side:Side):Action[]{
  if(side!=='dark'||w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='control'||!m.players[side].reserve.length)return [];
  return Object.values(m.cards).filter(c=>c.owner===side&&c.blueprint==='1_184'&&gameTextActive(m,c.id)&&!uses(m).some(ref=>ref.id===c.id&&sameCard(m,ref))).map(c=>action('reveal',{card:c.id}));
}
export function labriaInitiate(m:Match,r:Resolution):void {
  const p=r.action.payload as Payload;p.ref=referenceCard(m,p.card);
  m.data.labriaUses={turn:m.turn.number,cards:[...uses(m),p.ref]} as unknown as Json;
}
export function labriaResolve(m:Match,r:Resolution):void {
  const p=r.action.payload as Payload;if(r.cancelled)return;
  if(r.action.handler==='labria:reveal'){
    assertReserveTopAccessible(m,r.actor);const id=m.players[r.actor].reserve[0];if(!id)return;
    p.reveal=revealPileCard(m,id);
    m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action('finish',p)});
    m.stack.push({kind:'decision',side:other(r.actor),handler:'labria:acknowledge',payload:p as unknown as Json});
  }else if(r.action.handler==='labria:lose'){
    // No substitute loss if the revealed card was taken, replaced or shuffled.
    const id=p.reveal!.card.id;
    if(stillRevealed(m,p.reveal!)&&m.players[r.actor].reserve[0]===id){moveCard(m,id,'lost');openWindow(m,'response',other(r.actor),{kind:'cards-lost',cards:[id],source:p.card,cause:'labria'});}
  }else if(r.action.handler==='labria:finish'){
    openWindow(m,'response',other(r.actor),{kind:'reserve-revealed',side:r.actor,source:p.card});
  }else throw Error('Unknown Labria continuation.');
}
export function labriaChoices(m:Match,d:Decision){
  const p=d.payload as unknown as Payload;
  if(d.handler==='labria:acknowledge')return [{id:'labria:acknowledge',label:'Continue · I have seen the revealed card'}];
  if(!stillRevealed(m,p.reveal!))return [{id:'labria:finish',label:'Finish · the revealed card has moved'}];
  return (['reserve','force','used'] as const).map(pile=>({id:'labria:return:'+pile,label:'Return '+name(m,p.reveal!.card.id)+' to top of '+({reserve:'Reserve Deck',force:'Force Pile',used:'Used Pile'}[pile])}));
}
export function labriaChoose(m:Match,d:Decision,id:string):void {
  if(!labriaChoices(m,d).some(c=>c.id===id))throw Error('Invalid Labria return.');if(id==='labria:finish')return;
  const p=d.payload as unknown as Payload;
  if(id==='labria:acknowledge'){
    if(!stillRevealed(m,p.reveal!))return;const card=p.reveal!.card.id;
    if(vehicle(m,card)){
      m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:action('lose',p)});
      openWindow(m,'response','light',{kind:'about-to-lose',card,cards:[card],cardRefs:[p.reveal!.card],source:p.card,cause:'labria'});
    }else m.stack.push({kind:'decision',side:'dark',handler:'labria:return',payload:p as unknown as Json});
    return;
  }
  const pile=id.slice('labria:return:'.length) as 'reserve'|'force'|'used';
  moveCard(m,p.reveal!.card.id,pile);
  // Placement on Force is not activation and consumes no normal allowance.
  openWindow(m,'response',other(d.side),{kind:'card-placed-in-pile',card:p.reveal!.card.id,side:d.side,pile,source:p.card});
}
export function labriaView(m:Match):Json {
  const cards=m.stack.flatMap(f=>{
    const step=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';
    if(!['labria:lose','labria:return','labria:acknowledge'].includes(step))return [];
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    return p.reveal&&stillRevealed(m,p.reveal)?[{...m.cards[p.reveal.card.id]}]:[];
  });return cards.length?{revealedReserve:cards}:{};
}
export function assertLabria(m:Match):void {
  const h=history(m);
  if(m.data.labriaUses!==undefined){if(!h||!Number.isSafeInteger(h.turn)||h.turn<1||h.turn>m.turn.number||!Array.isArray(h.cards)||new Set(h.cards.map(ref=>ref.id+':'+ref.version)).size!==h.cards.length)throw Error('Invalid Labria usage.');for(const ref of h.cards){assertCardReference(m,ref);if(ref.zone!=='table'||m.cards[ref.id].blueprint!=='1_184'||m.cards[ref.id].owner!=='dark')throw Error('Invalid Labria source.');}}
  for(const f of m.stack){
    const step=f.kind==='resolution'?f.action.handler:f.kind==='decision'?f.handler:'';if(!step.startsWith('labria:'))continue;
    const p=(f.kind==='resolution'?f.action.payload:(f as Decision).payload) as unknown as Payload;
    if(!p||m.cards[p.card]?.blueprint!=='1_184'||m.cards[p.card].owner!=='dark'||(f.kind==='resolution'?f.actor:(f as Decision).side)!==(step==='labria:acknowledge'?'light':'dark'))throw Error('Invalid Labria continuation.');
    assertCardReference(m,p.ref!,p.card);if(p.ref!.zone!=='table'||!uses(m).some(ref=>ref.id===p.ref!.id&&ref.version===p.ref!.version))throw Error('Missing Labria usage.');
    if(f.kind==='resolution'){if(!['labria:reveal','labria:lose','labria:finish'].includes(step)||f.action.source!==p.card||f.action.id!==action(step.slice(7),p).id)throw Error('Invalid Labria action.');}
    else if(f.kind!=='decision'||!['labria:return','labria:acknowledge'].includes(step))throw Error('Invalid Labria decision.');
    if(step==='labria:reveal'){if(p.reveal!==undefined)throw Error('Premature Labria reveal.');}
    else{assertPileReveal(m,p.reveal!);if(p.reveal!.card.zone!=='reserve'||m.cards[p.reveal!.card.id].owner!=='dark'||['labria:lose','labria:return'].includes(step)&&vehicle(m,p.reveal!.card.id)!==(step==='labria:lose'))throw Error('Invalid Labria revealed card.');}
  }
}
