import {activeUndercoverSpy,undercoverReference} from './undercover-state';
import {crewActive} from './occupancy';
import {destinyInWindow, destinyResponseHandlers} from './destiny-response';
import {gameTextActive} from './game-text';
import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {groundPresent} from './participation';
import {moveTop} from './state';
import {activateOneForce} from './runtime';
import {mayActivate} from './activation';
import {type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {source: CardReference; window: number; branch: 'activate' | 'draw'};
const key = (id: string) => 'r2-response:' + id;
function eligible(m: Match, w: Window, side: Side): Payload['branch'] | undefined {
  const d = destinyInWindow(m,w);
  if (!d || d.side === side || d.value === null || !m.players[side].reserve.length) return;
  if (d.value >= 1 && d.value <= 3 && mayActivate(m,side)) return 'activate';
  if (d.value >= 4 && d.value <= 6) return 'draw';
}
export function astromechActions(m: Match, w: Window, side: Side): Action[] {
  const branch = eligible(m,w,side); if (!branch) return [];
  return Object.values(m.cards).filter(c=>c.owner===side && c.blueprint==='2_14' && (crewActive(m,c.id)||activeUndercoverSpy(m,c.id)) && gameTextActive(m,c.id) &&
    ((groundPresent(m,c.id)||activeUndercoverSpy(m,c.id))&&(cardDefinition(m,c.location!).icons as string[]|undefined)?.includes('Scomp Link')||!!c.aboardRole&&!!c.attachedTo&&(cardDefinition(m,c.attachedTo).icons as string[]).includes('Scomp Link')) && !w.completed.includes(key(c.id))).map(c=>({
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
  if (p.branch==='activate') activateOneForce(m,r.actor);
  else moveTop(m,r.actor,'reserve','hand');
}
export function assertAstromech(m: Match): void {
  for (const f of m.stack) if (f.kind==='resolution' && f.action.handler.startsWith('astromech:')) {
    const p=f.action.payload as unknown as Payload;
    if (!p || f.action.handler!=='astromech:respond' || !['activate','draw'].includes(p.branch)) throw Error('Invalid astromech continuation.');
    assertCardReference(m,p.source);
    const w=m.stack.find(q=>q.kind==='window' && q.serial===p.window) as Window|undefined;
    const parent=w ? m.stack[m.stack.indexOf(w)-1] : undefined;
    const handler=destinyResponseHandlers[(w?.event as {kind:string})?.kind];
    if (parent?.kind!=='resolution' || parent.action.handler!==handler || parent.actor===f.actor || !w || m.stack.indexOf(w)>=m.stack.indexOf(f) || !w.completed.includes(key(p.source.id)) ||
      !['destiny-drawn','battle-destiny-drawn','weapon-destiny-drawn'].includes((w.event as {kind:string})?.kind) ||
      p.source.zone!=='table'&&!(p.source.zone==='inactive'&&undercoverReference(m,p.source)) || m.cards[p.source.id].blueprint!=='2_14' || m.cards[p.source.id].owner!==f.actor || f.action.source!==p.source.id)
      throw Error('Invalid astromech source or trigger.');
  }
}
