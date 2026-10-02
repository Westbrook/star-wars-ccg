import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import {attached, cardDefinition, name} from './board';
import {battle, members, weaponDrawBonus} from './battle';
import {canDeployAsReact, pendingReactSite, reactionSources, registerReact} from './ground';
import {canUseWeapon, useWeapon} from './weapon-state';
import {completeDestinyTotal, drawDestiny, type Draw} from './destiny';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';
export type GaderffiiShot = {weapon: string; host: string; target: string; side: Side; draws: Draw[]; total: number | null; outcome: 'pending' | 'canceled' | 'invalid' | 'miss' | 'knocked'; weapons: string[]};
type Payload = {attachment?: AttachmentAttempt; card: string; target?: string; site?: string; index?: number; draw?: Draw; draws?: Draw[]; total?: number | null; transfer?: boolean; react?: boolean; via?: string};
const action = (step: string, p: Payload): Action => ({id: 'gaffi:' + step + ':' + p.card + (p.target ? ':' + p.target : ''), label: step === 'equip' ? (p.transfer ? 'Transfer ' : 'Deploy ') + 'Gaderffii Stick' : 'Swing Gaderffii Stick', handler: 'gaffi:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload, side: Side) => m.stack.push({kind: 'resolution', actor: side, action: action(step, p), cancelled: false});
const raider = (m: Match, id: string) => m.cards[id]?.blueprint === '1_196';
const targetWeapons = (m: Match, id: string) => attached(m, id).filter(c => cardDefinition(m, c.id).type === 'Weapon').map(c => c.id);
const validTarget = (m: Match, target: string, side: Side) => members(m, other(side)).includes(target) && targetWeapons(m, target).length > 0;
export function gaderffiiActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [], b = battle(m), parent = m.stack.at(-2), reactSite = pendingReactSite(m, w, side);
  for (const card of Object.values(m.cards).filter(c => c.blueprint === '1_315' && c.owner === side)) {
    if (w.timing === 'phase' && m.turn.side === side && m.turn.phase === 'deploy' && ['hand','table'].includes(card.zone)) {
      const transfer = card.zone === 'table';
      for (const target of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location && raider(m, c.id))) {
        if (transfer && (!card.attachedTo || target.id === card.attachedTo || target.location !== card.location)) continue;
        actions.push({...action('equip', {card: card.id, target: target.id, site: target.location, transfer}), payment: {[side]: 2}});
      }
    }
    if (reactSite && card.zone === 'hand' && canDeployAsReact(m, card.id)) {
      const sources = reactionSources(m, reactSite, side);
      const options = [...(sources.some(id => m.cards[id].blueprint === '1_6') ? [undefined] : []), ...sources.filter(id => m.cards[id].blueprint === '1_201')];
      for (const via of options) for (const target of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location === reactSite && raider(m, c.id))) {
        const a = action('equip', {card: card.id, target: target.id, site: reactSite, transfer: false, react: true, ...(via ? {via} : {})});
        a.id += ':react' + (via ? ':via:' + via : ''); a.label += ' as a react on ' + name(m, target.id); a.payment = {[side]: 2}; actions.push(a);
      }
    }
    if (w.timing !== 'response' || b?.stage !== 'begin' || parent?.kind !== 'resolution' || parent.action.handler !== 'battle:begin' || parent.awaitingResponses || parent.cancelled || card.zone !== 'table' || !card.attachedTo || !raider(m, card.attachedTo) || !members(m, side).includes(card.attachedTo) || b.fired.includes(card.id) || !canUseWeapon(m, card.id) || !m.players[side].reserve.length) continue;
    for (const target of members(m, other(side)).filter(id => validTarget(m, id, side))) {
      const a = action('fire', {card: card.id, target, site: b.site}); a.label += ' at ' + name(m, target); actions.push(a);
    }
  }
  return actions;
}
export function gaderffiiInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'gaffi:equip') {if (p.react) registerReact(m, p.card); if (!p.transfer) moveCard(m, p.card, 'playing'); p.attachment = attachmentAttempt(m, p.card, p.target!); return;}
  const b = battle(m)!, host = m.cards[p.card].attachedTo!;
  useWeapon(m, p.card); b.fired.push(p.card); b.users[host] = p.card;
  const shots = b.gaffiShots ??= [];
  p.index = shots.length; shots.push({weapon: p.card, host, target: p.target!, side: r.actor, draws: [], total: null, outcome: 'pending', weapons: []});
}
export function gaderffiiResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler, side = r.actor;
  if (h === 'gaffi:equip') {
    const card = m.cards[p.card], target = m.cards[p.target!];
    if (r.cancelled || !validAttachmentAttempt(m, p.attachment!) || card.zone !== (p.transfer ? 'table' : 'playing') || target.zone !== 'table' || target.owner !== side || !raider(m, target.id) || !target.location || p.react && target.location !== p.site || p.transfer && (card.zone !== 'table' || card.location !== target.location)) {if (card.zone === 'playing') moveCard(m, card.id, 'lost'); return;}
    if (card.zone === 'playing') moveCard(m, card.id, 'table'); card.attachedTo = target.id; card.location = target.location;
    openWindow(m, 'response', other(side), {kind: p.transfer ? 'weapon-transferred' : 'deployed', card: card.id}); return;
  }
  const b = battle(m)!, shot = b.gaffiShots![p.index!];
  if (r.cancelled) {shot.outcome = 'canceled'; return;}
  if (h === 'gaffi:fire') {
    if (!members(m, side).includes(shot.host) || m.cards[p.card].zone !== 'table' || m.cards[p.card].attachedTo !== shot.host || !validTarget(m, shot.target, side)) {shot.outcome = 'invalid'; return;}
    queue(m, 'draw', p, side);
  } else if (h === 'gaffi:draw') {
    if (p.draw) {shot.draws.push(p.draw); delete p.draw;}
    if (shot.draws.length < 2) drawDestiny(m, side, shot.weapon, 'weapon', action('draw', p), false, weaponDrawBonus(m, shot.weapon));
    else completeDestinyTotal(m, side, shot.weapon, 'weapon', shot.draws, action('result', p));
  } else if (h === 'gaffi:result') {
    shot.total = p.total!; shot.outcome = 'miss';
    queue(m, 'finish', p, side);
    if (shot.total !== null && shot.total > 5 && validTarget(m, shot.target, side)) {
      shot.weapons = targetWeapons(m, shot.target); shot.outcome = 'knocked';
      b.knockedWeapons = [...new Set([...(b.knockedWeapons ?? []), ...shot.weapons])];
      openWindow(m, 'response', other(side), {kind: 'weapons-knocked-away', source: shot.weapon, target: shot.target, weapons: shot.weapons});
    }
  } else if (h === 'gaffi:finish') openWindow(m, 'response', other(side), {kind: 'weapon-fired', weapon: shot.weapon, target: shot.target, knocked: shot.weapons});
  else throw Error('Unknown Gaderffii Stick action.');
}
export function assertGaderffii(m: Match): void {
  const b = battle(m);
  for (const shot of b?.gaffiShots ?? []) {
    if (m.cards[shot.weapon]?.blueprint !== '1_315' || m.cards[shot.weapon].owner !== shot.side || !sides.includes(shot.side) || !m.cards[shot.host] || !m.cards[shot.target] || !Array.isArray(shot.draws) || shot.draws.length > 2 || shot.draws.some(d => !d || d.card !== null && m.cards[d.card]?.owner !== shot.side || d.value !== null && (!Number.isFinite(d.value) || d.value < 0) || d.card === null && d.value !== null) || shot.total !== null && (!Number.isFinite(shot.total) || shot.total < 0) || !['pending','canceled','invalid','miss','knocked'].includes(shot.outcome) || !Array.isArray(shot.weapons) || new Set(shot.weapons).size !== shot.weapons.length || shot.weapons.some(id => !m.cards[id] || cardDefinition(m, id).type !== 'Weapon')) throw Error('Invalid Gaderffii Stick record.');
    if (['miss','knocked'].includes(shot.outcome) && shot.draws.length !== 2 || shot.outcome === 'knocked' && (shot.total === null || shot.total <= 5 || !shot.weapons.length)) throw Error('Invalid Gaderffii Stick result.');
  }
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('gaffi:')) {
    const p = r.action.payload as Payload, h = r.action.handler;
    if (!p || m.cards[p.card]?.blueprint !== '1_315' || m.cards[p.card].owner !== r.actor || r.action.source !== p.card || !['gaffi:equip','gaffi:fire','gaffi:draw','gaffi:result','gaffi:finish'].includes(h)) throw Error('Invalid Gaderffii Stick continuation.');
    if (h === 'gaffi:equip') {assertAttachmentAttempt(m, p.attachment!, p.card, p.target!); if (!m.cards[p.target!] || typeof p.transfer !== 'boolean' || p.react !== undefined && (p.react !== true || p.transfer || !p.site || !m.locations.includes(p.site) || p.via !== undefined && m.cards[p.via]?.blueprint !== '1_201')) throw Error('Invalid Gaderffii Stick deployment.');}
    else {const shot = b?.gaffiShots?.[p.index!]; if (!Number.isSafeInteger(p.index) || !shot || shot.weapon !== p.card || shot.target !== p.target || b?.site !== p.site) throw Error('Invalid Gaderffii Stick firing.');}
  }
}
