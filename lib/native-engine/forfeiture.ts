import {lossPrevented} from './loss-prevention';
import {artillery} from './artillery';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {openWindow} from './runtime';
import {forfeitToUsed, loseFromTable} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side} from './types';

export type Forfeiture = {id: string; target: CardReference; site: string; destination: 'lost' | 'used'};
const action = (step: string, p: Forfeiture): Action => ({id:p.id+':'+step,handler:'forfeiture:'+step,label:'Complete forfeiture',payload:p as unknown as Json});
/** The caller has already credited forfeiture. Replacements change placement,
 * never reprice or refund that payment (GEMP ForfeitCardsFromTableSimultaneouslyEffect). */
export function beginForfeiture(m: Match, card: string, side: Side, site: string): void {
  const p: Forfeiture={id:'forfeiture-'+ ++m.serial,target:referenceCard(m,card),site,destination:'lost'};
  m.stack.push({kind:'resolution',actor:side,cancelled:false,action:action('leave',p)});
  openWindow(m,'response',other(side),{kind:'about-to-forfeit',card,site,forfeiture:p.id});
}
export function pendingForfeiture(m: Match, id: string): Forfeiture | undefined {
  const f=m.stack.find(f=>f.kind==='resolution' && f.action.handler==='forfeiture:leave' && !f.cancelled && (f.action.payload as unknown as Forfeiture).id===id);
  if(f?.kind!=='resolution')return;
  const p=f.action.payload as unknown as Forfeiture;return sameCard(m,p.target)?p:undefined;
}
export function forfeitureResolve(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as Forfeiture;if(r.cancelled)return;
  if(r.action.handler==='forfeiture:leave'){
    if(!sameCard(m,p.target)||lossPrevented(m,p.target.id))return;
    m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action('result',p)});
    if(p.destination==='used')forfeitToUsed(m,p.target.id);else loseFromTable(m,[p.target.id]);
  }else if(r.action.handler==='forfeiture:result'){
    if(m.cards[p.target.id].zone!==p.destination)throw Error('Forfeiture destination changed during placement.');
    openWindow(m,'response',other(r.actor),{kind:p.destination==='lost'?'forfeited':'forfeited-to-used',card:p.target.id,cardRef:referenceCard(m,p.target.id),site:p.site});
  }else throw Error('Unknown forfeiture continuation.');
}
export function assertForfeitures(m: Match): void {
  const ids=new Set<string>();
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('forfeiture:')){
    const p=f.action.payload as unknown as Forfeiture;
    if(!p || !/^forfeiture-[1-9]\d*$/.test(p.id) || Number(p.id.slice(11))>m.serial || !['lost','used'].includes(p.destination) || !m.locations.includes(p.site) || ids.has(p.id) ||
       !['forfeiture:leave','forfeiture:result'].includes(f.action.handler))throw Error('Invalid pending forfeiture.');
    assertCardReference(m,p.target);
    if(p.target.zone!=='table' || m.cards[p.target.id].owner!==f.actor || !['Character','Vehicle','Starship'].includes(cardDefinition(m,p.target.id).type)&&!artillery(m,p.target.id))throw Error('Invalid forfeiture target.');
    ids.add(p.id);
  }
}
