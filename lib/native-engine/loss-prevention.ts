import {assertCardReference, type CardReference} from './identity';
import type {Match, Resolution, Window} from './types';

/** A replacement belongs to one suspended effect, not to the card forever.
 * Keep its originating window and physical instance in the saved continuation. */
export type PreventedLoss = {window: number; target: CardReference};
const equal = (a: CardReference,b: CardReference) => a.id===b.id && a.zone===b.zone && a.version===b.version;
export function lossTargets(w: Window): CardReference[] {
  const e=w.event as {kind?:string;cardRefs?:CardReference[]} | undefined;
  return ['about-to-lose','about-to-forfeit'].includes(e?.kind??'') ? e?.cardRefs??[] : [];
}
export function lossParent(m: Match, serial: number): Resolution | undefined {
  const i=m.stack.findIndex(f=>f.kind==='window'&&f.serial===serial),w=m.stack[i],r=m.stack[i-1];
  return w?.kind==='window' && lossTargets(w).length && r?.kind==='resolution' && !r.cancelled ? r : undefined;
}
export function preventLoss(m: Match, serial: number, target: CardReference): void {
  const w=m.stack.find(f=>f.kind==='window'&&f.serial===serial),r=lossParent(m,serial);
  if(w?.kind!=='window'||!r||!lossTargets(w).some(ref=>equal(ref,target)))throw Error('Loss replacement has no matching effect.');
  if(!r.preventedLosses?.some(p=>equal(p.target,target)))(r.preventedLosses??=[]).push({window:serial,target:{...target}});
}
/** The persisted record lives on Resolution. This synchronous scope only lets
 * shared table primitives see the popped resolution currently executing. It
 * cannot survive a command or protect a later, unrelated loss of the same card. */
const resolving = new WeakMap<Match, readonly PreventedLoss[]>();
export function resolveWithLossPrevention(m: Match,r: Resolution,resolve:()=>void): void {
  const previous=resolving.get(m);resolving.set(m,r.preventedLosses??[]);
  try{resolve();}finally{if(previous)resolving.set(m,previous);else resolving.delete(m);}
}
export function lossPrevented(m:Match,id:string):boolean {
  const excluded=resolving.get(m)??[],seen=new Set<string>();
  for(let card=m.cards[id];card&&!seen.has(card.id);card=m.cards[card.attachedTo!]){
    if(excluded.some(p=>p.target.id===card.id))return true;seen.add(card.id);
  }
  return false;
}
export function assertLossPreventions(m: Match): void {
  for(const [i,f] of m.stack.entries())if(f.kind==='resolution'&&f.preventedLosses!==undefined){
    if(!Array.isArray(f.preventedLosses)||!f.preventedLosses.length||f.cancelled)throw Error('Invalid loss replacements.');
    const seen=new Set<string>();
    for(const p of f.preventedLosses){
      if(!p||!Number.isSafeInteger(p.window)||p.window<1)throw Error('Invalid loss replacement window.');
      assertCardReference(m,p.target);const key=p.target.id+':'+p.target.version,w=m.stack[i+1];
      if(p.target.zone!=='table'||seen.has(key)||w?.kind!=='window'||w.serial!==p.window||!lossTargets(w).some(ref=>equal(ref,p.target)))throw Error('Loss replacement is not bound to its original effect.');
      seen.add(key);
    }
  }
}
