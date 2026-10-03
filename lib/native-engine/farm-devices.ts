import {activatedThisPhase, type ActivationEvent} from './activation';
import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import {cardDefinition, name, system} from './board';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {moveCard, moveTop} from './state';
import type {Action, Json, Match, Resolution, Side, Window} from './types';

type Deploy = {card: string; site: string; attachment?: AttachmentAttempt};
type Draw = {source: CardReference; window: number};
const device = (bp: string) => ['1_37','1_41'].includes(bp);
const key = (id: string) => 'hydroponics:' + id;
function validSite(m: Match, bp: string, site: string): boolean {
  return m.locations.includes(site) && m.cards[site].zone === 'table' && system(m,site) === 'Tatooine' &&
    (bp === '1_41' || (cardDefinition(m,site).icons as string[]).includes('Exterior'));
}
function eligible(m: Match, w: Window, side: Side): boolean {
  const e = w.event as unknown as ActivationEvent | undefined;
  if (w.timing !== 'response' || e?.kind !== 'force-activated' || e.side !== side || m.turn.side !== side || m.turn.phase !== 'activate' ||
    !sameCard(m,e.card) || m.players[side].force[0] !== e.card.id) return false;
  const n = activatedThisPhase(m,side);
  return n === 1 || n === 2 && Object.values(m.cards).some(c=>c.zone==='table' && !c.coveredBy && c.blueprint==='1_41');
}
export function farmDeviceActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [];
  if (w.timing === 'phase' && m.turn.side === side && m.turn.phase === 'deploy')
    for (const card of m.players[side].hand.filter(id=>device(m.cards[id].blueprint)))
      for (const site of m.locations.filter(id=>validSite(m,m.cards[card].blueprint,id)))
        actions.push({id:'farm-deploy:'+card+':'+site,label:'Deploy '+name(m,card)+' on '+name(m,site),source:card,
          handler:'farm:deploy',payment:{[side]:1},payload:{card,site}});
  if (eligible(m,w,side)) for (const c of Object.values(m.cards))
    if (c.owner===side && c.blueprint==='1_37' && gameTextActive(m,c.id) && c.attachedTo && m.locations.includes(c.attachedTo) && !w.completed.includes(key(c.id)))
      actions.push({id:'hydroponics:'+c.id,label:'Hydroponics Station · draw activated Force into hand',source:c.id,
        handler:'farm:draw',payload:{source:referenceCard(m,c.id),window:w.serial} as unknown as Json});
  return actions;
}
export function farmDeviceInitiate(m: Match,r: Resolution): void {
  if (r.action.handler==='farm:deploy') {
    const p=r.action.payload as Deploy; moveCard(m,p.card,'playing'); p.attachment=attachmentAttempt(m,p.card,p.site);
  } else {
    const p=r.action.payload as unknown as Draw,w=m.stack[m.stack.indexOf(r)-1];
    if (w?.kind!=='window' || w.serial!==p.window || !eligible(m,w,r.actor) || w.completed.includes(key(p.source.id))) throw Error('Invalid Hydroponics opportunity.');
    // Location devices use themselves; a site's devices do not share the
    // character rule limiting use to one different device per turn.
    w.completed.push(key(p.source.id));
  }
}
export function farmDeviceResolve(m: Match,r: Resolution): void {
  if (r.action.handler==='farm:deploy') {
    const p=r.action.payload as Deploy;
    if (r.cancelled || !validAttachmentAttempt(m,p.attachment!) || !validSite(m,m.cards[p.card].blueprint,p.site)) {
      if (sameCard(m,p.attachment!.cardRef)) moveCard(m,p.card,'lost'); return;
    }
    moveCard(m,p.card,'table');m.cards[p.card].attachedTo=p.site;deployed(m,p.card);
  } else if (!r.cancelled && m.players[r.actor].force.length) {
    // GEMP's initiated effect draws the current Force top even when a response
    // changes it. Source departure does not cancel an initiated effect.
    moveTop(m,r.actor,'force','hand');
  }
}
export function assertFarmDevices(m: Match): void {
  for (const f of m.stack) if (f.kind==='resolution' && f.action.handler.startsWith('farm:')) {
    if (f.action.handler==='farm:deploy') {
      const p=f.action.payload as Deploy;
      if (!p || !device(m.cards[p.card]?.blueprint) || m.cards[p.card].owner!==f.actor || f.action.source!==p.card || !m.locations.includes(p.site)) throw Error('Invalid farm deployment.');
      assertAttachmentAttempt(m,p.attachment!,p.card,p.site);
    } else if (f.action.handler==='farm:draw') {
      const p=f.action.payload as unknown as Draw;
      if (!p) throw Error('Invalid farm response.');
      assertCardReference(m,p.source);
      const w=m.stack.find(q=>q.kind==='window' && q.serial===p.window) as Window|undefined;
      if (p.source.zone!=='table' || m.cards[p.source.id].blueprint!=='1_37' || m.cards[p.source.id].owner!==f.actor || f.action.source!==p.source.id ||
        !w || m.stack.indexOf(w)>=m.stack.indexOf(f) || (w.event as unknown as ActivationEvent)?.kind!=='force-activated' ||
        (w.event as unknown as ActivationEvent).side!==f.actor || !w.completed.includes(key(p.source.id))) throw Error('Invalid farm response source.');
    } else throw Error('Unknown farm continuation.');
  }
}
