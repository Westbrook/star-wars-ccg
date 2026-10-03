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
