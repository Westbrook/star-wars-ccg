import type {AsteroidDraw} from './asteroids';
import type {FighterTrouble} from './fighter-trouble';
import type {TallonRoll} from './tallon-roll';
import {sameCard, type CardReference} from './identity';
import type {Battle} from './battle';
import {redrawDestiny} from './destiny';
import type {Match, Resolution, Side, Window} from './types';
export const destinyResponseHandlers: Record<string,string> = {'destiny-drawn':'destiny:finish','battle-destiny-drawn':'battle:destiny-finish','weapon-destiny-drawn':'battle:shot-finish'};
export function pendingDestiny(m: Match, r: Resolution): {resolution: Resolution; side: Side; value: number | null; substituted: boolean} | undefined {
  if (!m.stack.includes(r) || r.cancelled || (r.action.payload as {redraw?:boolean})?.redraw) return;
  if (r.action.handler==='destiny:finish') {
    const p=r.action.payload as {side:Side;draw:{value:number|null;substitution?:{value:number}}};
    return {resolution:r,side:p.side,value:p.draw.substitution?.value??p.draw.value,substituted:!!p.draw.substitution};
  }
  const b=m.data.battle as Battle|undefined;if(!b)return;
  if(r.action.handler==='battle:destiny-finish'){
    const {side}=r.action.payload as {side:Side};const s=b.destinyDraws?.[side]?.substitution;
    return {resolution:r,side,value:s?.value??b.destiny[side],substituted:!!s};
  }
  if(r.action.handler==='battle:shot-finish'){
    const shot=b.shots[(r.action.payload as {index:number}).index];
    if(shot)return {resolution:r,side:r.actor,value:shot.substitution?.value??shot.destiny,substituted:!!shot.substitution};
  }
}
export function destinyInWindow(m: Match,w: Window){
  const r=m.stack[m.stack.indexOf(w)-1];
  if(w.timing!=='response' || r?.kind!=='resolution' || r.action.handler!==destinyResponseHandlers[(w.event as {kind?:string})?.kind??''])return;
  return pendingDestiny(m,r);
}
/** Bind the exact still-pending draw. A canceled or substituted destiny cannot
 * be canceled again, and cancel-and-redraw releases its original sequence slot. */
export function cancelPendingDestiny(m: Match,r: Resolution,redraw=false): boolean {
  const d=pendingDestiny(m,r);if(!d || d.value===null || d.substituted)return false;
  if(redraw && r.action.handler==='destiny:finish')return redrawDestiny(m,r);
  r.cancelled=true;
  if(redraw)(r.action.payload as {redraw?:boolean}).redraw=true;
  return true;
}

/** Actual targets of the pending draw, bound to its owning shot and original
 * table instances. Other destiny categories and total-result windows do not
 * grant a just-drawn defense response. Extend here as new targeting draws ship. */
export function destinyDefenseTargets(m:Match,w:Window):CardReference[]{
 const d=destinyInWindow(m,w);if(!d||d.value===null)return [];
 if(d.resolution.action.handler!=='destiny:finish')return [];
 const p=d.resolution.action.payload as {source?:string;category?:string;next?:{handler:string;payload:{index?:number;card?:string;target?:string;serial?:number}}};
 if(p.category==='asteroid'&&p.next?.handler==='asteroid:drawn'){
  const draw=(m.data.asteroidDraws as unknown as AsteroidDraw[]|undefined)?.find(d=>d.serial===p.next?.payload.serial&&d.stage==='destiny');
  return draw&&p.source===draw.site.id&&sameCard(m,draw.target)?[draw.target]:[];
 }
 if(p.category==='fighter-trouble'&&p.next?.handler==='fighter-trouble:result'){
  const trouble=m.data.fighterTrouble as FighterTrouble|undefined;
  return trouble?.stage==='destiny'&&trouble.serial===p.next.payload.serial&&trouble.source===p.source&&sameCard(m,trouble.target)?[trouble.target]:[];
 }
 if(p.category==='tallon-roll'&&p.next?.handler==='tallon:dark'){
  const roll=m.data.tallonRoll as TallonRoll|undefined;
  if(!roll||roll.serial!==p.next.payload.serial||roll.source!==p.source||roll.stage!=='dark-destiny')return [];
  return (roll.slip?[roll.refs.dark,roll.refs.light]:[roll.refs.dark]).filter(ref=>sameCard(m,ref));
 }
 if(p.category!=='weapon'||p.next?.handler!=='space-weapon:draw')return [];
 const next=p.next.payload,b=m.data.battle as Battle|undefined,shot=b?.starshipShots?.[next.index!];
 if(!shot||shot.outcome!=='pending'||shot.weapon!==p.source||shot.weapon!==next.card||shot.target!==next.target||!sameCard(m,shot.targetRef))return [];
 return [shot.targetRef];
}
