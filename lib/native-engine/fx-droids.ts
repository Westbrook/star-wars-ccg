import {adjacent, cardDefinition, name} from './board';
import {battle} from './battle';
import {pendingForfeiture, type Forfeiture} from './forfeiture';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';
import {openWindow} from './runtime';

export const isFX = (blueprint: string) => ['3_9','3_86'].includes(blueprint);
type Usage = {source: CardReference; turn: number};
type Payload = {source: CardReference; target: CardReference; forfeiture: string};
const uses = (m: Match) => (m.data.fxUses ?? []) as unknown as Usage[];
const used = (m: Match, id: string) => uses(m).some(p => p.turn===m.turn.number && p.source.id===id && sameCard(m,p.source));
export function fxActions(m: Match, w: Window, side: Side): Action[] {
  const e=w.event as {kind?:string;forfeiture?:string}|undefined;
  if(w.timing!=='response' || e?.kind!=='about-to-forfeit' || !e.forfeiture)return [];
  const p=pendingForfeiture(m,e.forfeiture);if(!p || p.destination!=='lost')return [];
  const c=m.cards[p.target.id],def=cardDefinition(m,c.id);
  if(c.owner!==side || !c.location || def.type!=='Character' || def.subType==='Droid' || !battle(m)?.hits.includes(c.id))return [];
  return Object.values(m.cards).filter(d=>d.zone==='table' && d.owner===side && isFX(d.blueprint) && !d.attachedTo && d.location &&
    !used(m,d.id) && (d.location===c.location || adjacent(m,d.location,c.location!))).map(d=>({
      id:'fx:'+d.id+':'+p.id,label:name(m,d.id)+' · forfeit '+name(m,c.id)+' to Used',handler:'fx:replace',source:d.id,
      payload:{source:referenceCard(m,d.id),target:p.target,forfeiture:p.id} as unknown as Json,
    }));
}
export function fxInitiate(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as Payload;if(used(m,p.source.id))throw Error('FX droid already used this turn.');
  m.data.fxUses=[...uses(m).filter(u=>u.turn===m.turn.number),{source:p.source,turn:m.turn.number}] as unknown as Json;
}
export function fxResolve(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as Payload;if(r.cancelled)return;
  const f=pendingForfeiture(m,p.forfeiture);
  if(!f || f.target.id!==p.target.id || f.target.version!==p.target.version || !sameCard(m,p.target) || f.destination!=='lost')return;
  f.destination='used';
  openWindow(m,'response',other(r.actor),{kind:'forfeiture-destination-changed',card:p.target.id,source:p.source.id,destination:'used'});
}
export function assertFX(m: Match): void {
  if(m.data.fxUses!==undefined && !Array.isArray(m.data.fxUses))throw Error('Invalid FX usage.');
  const seen=new Set<string>();
  for(const u of uses(m)){
    if(!u || !Number.isSafeInteger(u.turn) || u.turn<1 || u.turn>m.turn.number)throw Error('Invalid FX turn.');
    assertCardReference(m,u.source);const key=u.source.id+':'+u.source.version+':'+u.turn;
    if(u.source.zone!=='table' || !isFX(m.cards[u.source.id].blueprint) || seen.has(key))throw Error('Invalid FX source.');
    seen.add(key);
  }
  for(const f of m.stack)if(f.kind==='resolution' && f.action.handler.startsWith('fx:')){
    const p=f.action.payload as unknown as Payload;
    if(!p || f.action.handler!=='fx:replace')throw Error('Invalid FX continuation.');
    assertCardReference(m,p.source);assertCardReference(m,p.target);
    const target=m.stack.find(q=>q.kind==='resolution' && q.action.handler==='forfeiture:leave' && (q.action.payload as {id?:string})?.id===p.forfeiture);
    if(!target || m.stack.indexOf(target)>=m.stack.indexOf(f) || !isFX(m.cards[p.source.id].blueprint) || m.cards[p.source.id].owner!==f.actor ||
      m.cards[p.target.id].owner!==f.actor || p.source.zone!=='table' || p.target.zone!=='table' || f.action.source!==p.source.id ||
      !uses(m).some(u=>u.turn===m.turn.number && u.source.id===p.source.id && u.source.version===p.source.version))throw Error('Invalid FX replacement target.');
    const original=(target as Resolution).action.payload as unknown as Forfeiture;
    if(original.target.id!==p.target.id || original.target.version!==p.target.version)throw Error('FX target does not match forfeiture.');
  }
}
