import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import {cardDefinition} from './definitions';
import {isJedi} from './location-ability';
import {canEnterTable} from './persona';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; host: string; attachment?: AttachmentAttempt};
const validHost = (m: Match, id: string, side: Side) => m.cards[id]?.owner === side && isJedi(m, id, 'light');
export function abilityEffectActions(m: Match, w: Window, side: Side): Action[] {
  if (w.timing !== 'phase' || m.turn.phase !== 'deploy' || m.turn.side !== side) return [];
  return m.players[side].hand.filter(id => m.cards[id].blueprint === '1_43').flatMap(card =>
    Object.keys(m.cards).filter(id => validHost(m, id, side)).map(host => ({id: 'ability-effect:deploy:' + card + ':' + host,
      label: 'Deploy Affect Mind on ' + cardDefinition(m, host).name, handler: 'ability-effect:deploy', source: card,
      payment: {[side]: 1}, payload: {card, host} as Json})));
}
export function abilityEffectInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  moveCard(m, p.card, 'playing'); p.attachment = attachmentAttempt(m, p.card, p.host);
}
export function abilityEffectResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.cancelled || !validAttachmentAttempt(m, p.attachment!) || !canEnterTable(m, p.card)) {
    moveCard(m, p.card, 'lost'); return;
  }
  // Deployment chose a Jedi at initiation; losing ability during responses is
  // not a new deployment target selection. Original instance must still exist.
  const host = m.cards[p.host];
  moveCard(m, p.card, 'table'); m.cards[p.card].attachedTo = p.host; m.cards[p.card].location = host.location;
  openWindow(m, 'response', other(r.actor), {kind: 'deployed', card: p.card});
}
export function assertAbilityEffects(m: Match): void {
  for (const c of Object.values(m.cards)) if (c.zone === 'table' && c.blueprint === '1_43' &&
    (!c.attachedTo || cardDefinition(m, c.attachedTo).type !== 'Character' || c.location !== m.cards[c.attachedTo].location)) throw Error('Invalid Affect Mind attachment.');
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('ability-effect:')) {
    const p = r.action.payload as Payload;
    if (r.action.handler !== 'ability-effect:deploy' || !p || m.cards[p.card]?.blueprint !== '1_43' || m.cards[p.card].owner !== r.actor ||
      r.action.source !== p.card || m.cards[p.card].zone !== 'playing' || !m.cards[p.host] || cardDefinition(m, p.host).type !== 'Character' ||
      r.action.payment?.[r.actor] !== 1 || (r.action.payment?.[other(r.actor)] ?? 0) !== 0) throw Error('Invalid Affect Mind deployment.');
    assertAttachmentAttempt(m, p.attachment!, p.card, p.host);
    if (p.attachment!.transfer) throw Error('Affect Mind has no transfer action.');
  }
}
