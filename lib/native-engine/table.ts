import {shipSite,shipSiteDependents,relatedShip} from './ship-sites';
import {lossPrevented} from './loss-prevention';
import {carrierCaptives,releaseForDepartures} from './captives';
import {bellyLossCards} from './space-slug';
import {isVessel} from './occupancy';
import {referenceCard} from './identity';
import {recordTableLossOrigins} from './loss-origin';
import {moveCard} from './state';
import {name} from './board';
import {sides, type Decision, type Json, type Match} from './types';

type Ordering = {remaining: string[]; used?: string[]};
/** All dependents leave simultaneously. Ordering their Lost Piles must not keep
 * their presence/modifiers on table, or add their forfeit to the host's value. */
function tableGroup(m: Match, hosts: string[], loss = false): Set<string> {
  const excluded=new Set(loss ? Object.keys(m.cards).filter(id=>lossPrevented(m,id)) : []);
  for(let changed=true;changed;){changed=false;for(const c of Object.values(m.cards))if(c.attachedTo&&excluded.has(c.attachedTo)&&!excluded.has(c.id)){excluded.add(c.id);changed=true;}}
  const ids = new Set(hosts.filter(id=>!excluded.has(id))),siteDependents=new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for(const id of shipSiteDependents(m,ids)){siteDependents.add(id);if(!ids.has(id)&&!excluded.has(id)){ids.add(id);changed=true;}}
    for(const id of carrierCaptives(m,ids))if(!ids.has(id)&&!excluded.has(id)){ids.add(id);changed=true;}
    for (const c of Object.values(m.cards)) if ((c.attachedTo || c.stackedOn) && ids.has((c.attachedTo || c.stackedOn)!) && !ids.has(c.id) && !excluded.has(c.id)) {ids.add(c.id); changed = true;}
  }
  if ([...ids].some(id => !['table','stacked','captive','inactive','buried'].includes(m.cards[id]?.zone) || m.cards[id].zone==='buried'&&!siteDependents.has(id) || m.locations.includes(id)&&!shipSite(m,id))) throw Error('Invalid table loss.');
  return ids;
}
function removeGroup(m: Match, ids: Set<string>, zone: 'leaving' | 'hand'): void {
  // Remove descendants before their host to satisfy the primitive invariant.
  releaseForDepartures(m,ids);
  const waiting = new Set(ids);
  m.locations=m.locations.filter(id=>!ids.has(id));
  while (waiting.size) {
    const id = [...waiting].find(id => ![...waiting].some(child => m.cards[child].attachedTo === id || m.cards[child].stackedOn === id || m.cards[child].location === id || relatedShip(m,child)===id));
    if (!id) throw Error('Cyclic table loss.');
    moveCard(m, id, zone); waiting.delete(id);
  }
}
/** Snapshot the complete affected group for response targeting before removal. */
export const tableLossCards = (m: Match, hosts: string[]): string[] => [...tableGroup(m,[...hosts,...bellyLossCards(m,hosts)],true)];
export function loseFromTable(m: Match, hosts: string[]): string[] {
  const ids = tableGroup(m, [...hosts,...bellyLossCards(m,hosts)],true), references = [...ids].filter(id=>m.cards[id].zone!=='buried').map(id=>referenceCard(m,id));
  removeGroup(m, ids, 'leaving');
  recordTableLossOrigins(m,references);
  orderNext(m, [...ids]);
  return [...ids];
}
/** Revealed minefield duds are discarded from their buried state. They never
 * deploy or become active characters/locations while their Lost order is chosen. */
export function loseBuriedCards(m: Match, cards: string[]): void {
  if (new Set(cards).size !== cards.length || cards.some(id => m.cards[id]?.zone !== 'buried')) throw Error('Invalid buried-card loss.');
  for (const id of cards) moveCard(m,id,'leaving');
  orderNext(m,cards);
}
/** Failed simultaneous deployment never entered table, but Lost ordering is still chosen. */
export function losePlayingCards(m:Match,cards:string[]):void {
 if(new Set(cards).size!==cards.length||cards.some(id=>m.cards[id]?.zone!=='playing'))throw Error('Invalid failed deployment.');
 for(const id of cards)moveCard(m,id,'leaving');orderNext(m,cards);
}
/** Placement in Used changes only the host's destination. Descendants
 * still leave simultaneously and are ordered in Lost before the host enters Used. */
export function placeInUsedFromTable(m: Match, host: string): void {
  const ids = tableGroup(m,[host]), references = [...ids].filter(id=>id!==host&&m.cards[id].zone!=='buried').map(id=>referenceCard(m,id));
  removeGroup(m,ids,'leaving');
  if (references.length) recordTableLossOrigins(m,references);
  orderNext(m,[...ids].filter(id => id !== host),[host]);
}
/** Releasing a captured ship by Escape places the complete aboard group in
 * Used. Remove it simultaneously, then let each owner order their own pile. */
export function escapeShipToUsed(m:Match,host:string):void {
 const ids=tableGroup(m,[host]);removeGroup(m,ids,'leaving');orderUsed(m,[...ids]);
}
function orderUsed(m:Match,remaining:string[]):void {
 if(!remaining.length)return;
 const side=remaining.some(id=>m.cards[id].owner===m.turn.side)?m.turn.side:m.cards[remaining[0]].owner;
 const own=remaining.filter(id=>m.cards[id].owner===side);
 if(own.length===1){moveCard(m,own[0],'used');orderUsed(m,remaining.filter(id=>id!==own[0]));return;}
 m.stack.push({kind:'decision',side,handler:'table:used-order',payload:{remaining}});
}
export const forfeitToUsed = placeInUsedFromTable;
/** Out-of-play costs remove the host permanently. Its dependents are lost,
 * not sacrificed; their ordering must finish before the parent can respond. */
export function placeOutFromTable(m: Match, host: string): string[] {
  const ids = tableGroup(m, [host],true), lost = [...ids].filter(id => id !== host);
  const references = lost.filter(id=>m.cards[id].zone!=='buried').map(id => referenceCard(m, id));
  removeGroup(m, ids, 'leaving');
  moveCard(m, host, 'out');
  if (references.length) recordTableLossOrigins(m, references);
  orderNext(m, lost);
  return lost;
}
/** Returning a carrier to hand loses its occupants and attachments. Other
 * returning hosts retain their established attachment destinations. */
export function returnToHand(m: Match, hosts: string[]): string[] {
  const ids = tableGroup(m, hosts);
  const lost = new Set(hosts.filter(id=>isVessel(m,id)).flatMap(id=>[...tableGroup(m,[id])].filter(child=>child!==id)));
  if(lost.size){
    const refs=[...lost].filter(id=>m.cards[id].zone!=='buried').map(id=>referenceCard(m,id));
    removeGroup(m,ids,'leaving');for(const id of ids)if(!lost.has(id))moveCard(m,id,'hand');
    recordTableLossOrigins(m,refs);orderNext(m,[...lost]);
  }else removeGroup(m, ids, 'hand');
  return [...ids];
}

function orderNext(m: Match, remaining: string[], used: string[] = []): void {
  if (!remaining.length) {for (const id of used) moveCard(m,id,'used'); return;}
  const side = remaining.some(id => m.cards[id].owner === m.turn.side) ? m.turn.side : m.cards[remaining[0]].owner;
  const own = remaining.filter(id => m.cards[id].owner === side);
  if (own.length === 1) {moveCard(m, own[0], 'lost'); orderNext(m, remaining.filter(id => id !== own[0]),used); return;}
  m.stack.push({kind: 'decision', side, handler: 'table:lost-order', payload: {remaining,...(used.length?{used}:{})} as Json});
}
export function tableChoices(m: Match, decision: Decision) {
  const zone=decision.handler==='table:used-order'?'used':'lost';
  return (decision.payload as Ordering).remaining.filter(id => m.cards[id].owner === decision.side).map(id => ({id: 'place-'+zone+':' + id, label: 'Place ' + name(m, id) + ' on top of '+(zone==='used'?'Used':'Lost')}));
}
export function tableChoose(m: Match, decision: Decision, choice: string): void {
  if(!tableChoices(m,decision).some(c=>c.id===choice))throw Error('Invalid pile ordering choice.');
  if(decision.handler==='table:used-order'){const id=choice.slice('place-used:'.length);moveCard(m,id,'used');orderUsed(m,(decision.payload as Ordering).remaining.filter(x=>x!==id));return;}
  const id = choice.slice('place-lost:'.length), remaining = (decision.payload as Ordering).remaining;
  moveCard(m, id, 'lost'); orderNext(m, remaining.filter(card => card !== id),(decision.payload as Ordering).used);
}
export function assertLeaving(m: Match): void {
  const pending = m.stack.filter(f => f.kind === 'decision' && ['table:lost-order','table:used-order'].includes(f.handler)).flatMap(f => {const p=f.kind === 'decision' ? f.payload as Ordering : {remaining: []};return [...p.remaining,...(p.used??[])];});
  if (new Set(pending).size !== pending.length || pending.some(id => m.cards[id]?.zone !== 'leaving')) throw Error('Invalid pending table loss.');
  if (Object.values(m.cards).some(c => c.zone === 'leaving' && !pending.includes(c.id))) throw Error('Orphaned leaving card.');
  for (const f of m.stack) if (f.kind === 'decision' && ['table:lost-order','table:used-order'].includes(f.handler) && !(f.payload as Ordering).remaining.some(id => m.cards[id]?.owner === f.side && sides.includes(f.side))) throw Error('Invalid loss ordering seat.');
  for (const f of m.stack) if (f.kind === 'decision' && ['table:lost-order','table:used-order'].includes(f.handler)) {
    const p=f.payload as Ordering;
    if (p.used !== undefined && (!Array.isArray(p.used) || (f.handler!=='table:lost-order'||p.used.length !== 1))) throw Error('Invalid pending forfeiture destination.');
  }
}

/** Site destruction loses active cards, attachments, stacked cards and buried
 * cards together. Removing all first preserves simultaneous-loss ordering. */
export function siteLossCards(m:Match,site:string,except:string):string[]{
 const roots=Object.values(m.cards).filter(c=>['table','stacked','captive','inactive'].includes(c.zone)&&c.id!==except&&!m.locations.includes(c.id)&&(c.location===site||c.attachedTo===site||c.stackedOn===site)).map(c=>c.id);
 return [...new Set([...tableLossCards(m,roots),...Object.values(m.cards).filter(c=>c.zone==='buried'&&c.location===site&&c.id!==except).map(c=>c.id)])];
}
export function loseSiteCards(m:Match,ids:string[]):void{
 ids=ids.filter(id=>!lossPrevented(m,id));
 if(new Set(ids).size!==ids.length||ids.some(id=>!['table','stacked','buried','captive','inactive'].includes(m.cards[id]?.zone)||m.locations.includes(id)))throw Error('Invalid site casualties.');
 const refs=ids.filter(id=>m.cards[id].zone!=='buried').map(id=>referenceCard(m,id));removeGroup(m,new Set(ids),'leaving');recordTableLossOrigins(m,refs);orderNext(m,ids);
}
