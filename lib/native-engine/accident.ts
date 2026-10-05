import {lossPrevented} from './loss-prevention';
import {cardDefinition, name} from './board';
import {battle, members} from './battle';
import {drawDestiny, type Draw} from './destiny';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; site: string; characters: string[]; weapons: string[]; draw?: Draw; target?: string};
const action = (step: string, p: Payload): Action => ({id: 'accident:' + step + ':' + p.card, label: 'Resolve battle accident', handler: 'accident:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
const characters = (m: Match, side: Side) => members(m, side).filter(id => cardDefinition(m, id).type === 'Character');
const weapons = (m: Match, side: Side) => Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location === battle(m)?.site && cardDefinition(m, c.id).type === 'Weapon' && c.attachedTo && members(m, side).includes(c.attachedTo)).map(c => c.id);
const remaining = (m: Match, p: Payload) => p.characters.filter(id => characters(m, other(m.cards[p.card].owner)).includes(id));
export function accidentActions(m: Match, w: Window, side: Side): Action[] {
  const b = battle(m), parent = m.stack.at(-2);
  if (w.timing !== 'response' || !b || b.stage !== 'begin' || parent?.kind !== 'resolution' || parent.awaitingResponses || parent.cancelled || parent.action.handler !== 'battle:begin') return [];
  const enemy = other(side), targets = characters(m, enemy), guns = weapons(m, enemy);
  if (targets.length < 2 || !guns.length) return [];
  return m.players[side].hand.filter(id => m.cards[id].blueprint === (side === 'light' ? '1_80' : '1_237')).map(card => {
    const a = action('play', {card, site: b.site, characters: targets, weapons: guns}); a.label = name(m, card) + ' · cause an accident'; return a;
  });
}
export function accidentInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as unknown as Payload).card, 'playing');}
export function accidentResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload, h = r.action.handler;
  if (r.cancelled) {if (h === 'accident:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'accident:play') {
    queue(m, 'finish', p);
    // Battle-specific targets must participate. Revalidate the original group
    // before drawing; later arrivals are not new targets of this Interrupt.
    p.characters = remaining(m, p);
    if (p.characters.length >= 2 && p.weapons.some(id => weapons(m, other(r.actor)).includes(id)))
      drawDestiny(m, r.actor, p.card, 'accident', action('result', p));
  } else if (h === 'accident:result') {
    if (p.draw!.value !== null && p.draw!.value < p.characters.length && remaining(m, p).length)
      m.stack.push({kind: 'decision', side: other(r.actor), handler: 'accident:select', payload: p as unknown as Json});
  } else if (h === 'accident:lose') {
    if (remaining(m, p).includes(p.target!) && !lossPrevented(m,p.target!)) {queue(m, 'lost', p); loseFromTable(m, [p.target!]);}
  } else if (h === 'accident:lost') {
    openWindow(m, 'response', other(r.actor), {kind: 'character-lost', card: p.target!, source: p.card, site: p.site, cause: 'accident'});
  } else if (h === 'accident:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown accident continuation.');
}
export function accidentChoices(m: Match, d: Decision) {
  return remaining(m, d.payload as unknown as Payload).map(id => ({id: 'accident-lose:' + id, label: 'Lose ' + name(m, id)}));
}
export function accidentChoose(m: Match, d: Decision, choice: string): void {
  const p = {...d.payload as unknown as Payload, target: choice.slice('accident-lose:'.length)};
  queue(m, 'lose', p);
  openWindow(m, 'response', other(d.side), {kind: 'about-to-lose', card: p.target!, source: p.card, site: p.site, cause: 'accident'});
}
export function assertAccident(m: Match): void {
  for (const f of m.stack) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('accident:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as unknown as Payload;
    const owner = m.cards[p?.card]?.owner;
    if (!p || !owner || m.cards[p.card].blueprint !== (owner === 'light' ? '1_80' : '1_237') || m.cards[p.card].zone !== 'playing' || !m.locations.includes(p.site) ||
      !['accident:play','accident:result','accident:select','accident:lose','accident:lost','accident:finish'].includes(h) ||
      (f.kind === 'resolution' ? f.actor !== owner : (f as Decision).side !== other(owner)) ||
      !Array.isArray(p.characters) || new Set(p.characters).size !== p.characters.length || p.characters.some(id => m.cards[id]?.owner !== other(owner) || cardDefinition(m, id).type !== 'Character') ||
      !Array.isArray(p.weapons) || !p.weapons.length || p.weapons.some(id => m.cards[id]?.owner !== other(owner) || cardDefinition(m, id).type !== 'Weapon')) throw Error('Invalid pending accident.');
    if (h === 'accident:select' && (!p.draw || p.draw.value === null || !Number.isFinite(p.draw.value) || p.draw.value < 0 || p.draw.value >= p.characters.length || !remaining(m, p).length)) throw Error('Invalid accident choice.');
    if (['accident:lose','accident:lost'].includes(h) && !p.characters.includes(p.target!)) throw Error('Invalid accident target.');
  }
}
