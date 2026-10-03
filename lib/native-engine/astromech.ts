import type {Battle} from './battle';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {groundPresent} from './participation';
import {moveTop} from './state';
import {type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {source: CardReference; window: number; branch: 'activate' | 'draw'};
const key = (id: string) => 'r2-response:' + id;
/** Query the live draw, not the original event's value. A response can modify
 * or cancel it before R2's owner next receives priority. */
function pending(m: Match, w: Window): {side: Side; value: number | null} | undefined {
  if (w.timing !== 'response') return;
  const r = m.stack[m.stack.indexOf(w)-1];
  if (r?.kind !== 'resolution' || r.cancelled) return;
  const e = w.event as {kind?: string} | undefined;
  if (e?.kind === 'destiny-drawn' && r.action.handler === 'destiny:finish') {
    const p = r.action.payload as {side: Side; draw: {value: number | null; substitution?: {value: number}}};
    return {side:p.side,value:p.draw.substitution?.value ?? p.draw.value};
  }
  const b = m.data.battle as Battle | undefined;
  if (!b) return;
  if (e?.kind === 'battle-destiny-drawn' && r.action.handler === 'battle:destiny-finish') {
    const {side} = r.action.payload as {side:Side};
    return {side,value:b.destinyDraws?.[side]?.substitution?.value ?? b.destiny[side]};
  }
  if (e?.kind === 'weapon-destiny-drawn' && r.action.handler === 'battle:shot-finish') {
    const shot = b.shots[(r.action.payload as {index:number}).index];
    if (shot) return {side:r.actor,value:shot.substitution?.value ?? shot.destiny};
  }
}
function eligible(m: Match, w: Window, side: Side): Payload['branch'] | undefined {
  const d = pending(m,w);
  if (!d || d.side === side || d.value === null || !m.players[side].reserve.length) return;
  if (d.value >= 1 && d.value <= 3) return 'activate';
  if (d.value >= 4 && d.value <= 6) return 'draw';
}
export function astromechActions(m: Match, w: Window, side: Side): Action[] {
  const branch = eligible(m,w,side); if (!branch) return [];
  return Object.values(m.cards).filter(c=>c.owner===side && c.blueprint==='2_14' && groundPresent(m,c.id) &&
    (cardDefinition(m,c.location!).icons as string[]|undefined)?.includes('Scomp Link') && !w.completed.includes(key(c.id))).map(c=>({
      id:'r2:'+c.id+':'+branch,label:'R2-D2 · '+(branch==='activate'?'activate 1 Force':'draw top card of Reserve Deck'),
      source:c.id,handler:'astromech:respond',payload:{source:referenceCard(m,c.id),window:w.serial,branch} as unknown as Json,
    }));
}
export function astromechInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  const w = m.stack[m.stack.indexOf(r)-1];
  if (w?.kind!=='window' || w.serial!==p.window || w.completed.includes(key(p.source.id)) || eligible(m,w,r.actor)!==p.branch) throw Error('Invalid R2-D2 opportunity.');
  // Once per physical card and triggering draw, even if its action is canceled.
  w.completed.push(key(p.source.id));
}
export function astromechResolve(m: Match, r: Resolution): void {
  if (r.cancelled || !m.players[r.actor].reserve.length) return;
  const p = r.action.payload as unknown as Payload;
  // The initiated effect survives source departure and uses the current top
  // card. Text activation does not consume the turn's generation allowance.
  moveTop(m,r.actor,'reserve',p.branch==='activate'?'force':'hand');
}
export function assertAstromech(m: Match): void {
  for (const f of m.stack) if (f.kind==='resolution' && f.action.handler.startsWith('astromech:')) {
    const p=f.action.payload as unknown as Payload;
    if (!p || f.action.handler!=='astromech:respond' || !['activate','draw'].includes(p.branch)) throw Error('Invalid astromech continuation.');
    assertCardReference(m,p.source);
    const w=m.stack.find(q=>q.kind==='window' && q.serial===p.window) as Window|undefined;
    const parent=w ? m.stack[m.stack.indexOf(w)-1] : undefined;
    const handler={'destiny-drawn':'destiny:finish','battle-destiny-drawn':'battle:destiny-finish','weapon-destiny-drawn':'battle:shot-finish'}[(w?.event as {kind:string})?.kind];
    if (parent?.kind!=='resolution' || parent.action.handler!==handler || parent.actor===f.actor || !w || m.stack.indexOf(w)>=m.stack.indexOf(f) || !w.completed.includes(key(p.source.id)) ||
      !['destiny-drawn','battle-destiny-drawn','weapon-destiny-drawn'].includes((w.event as {kind:string})?.kind) ||
      p.source.zone!=='table' || m.cards[p.source.id].blueprint!=='2_14' || m.cards[p.source.id].owner!==f.actor || f.action.source!==p.source.id)
      throw Error('Invalid astromech source or trigger.');
  }
}
