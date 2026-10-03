import {isSpecies} from './characteristics';
import {canSearch, recordFailedSearch, searchFunctions, type Search} from './search-policy';
import {cardDefinition, name} from './board';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; draw?: Draw; count?: number; cards?: string[]; remaining?: string[]; target?: string};
const action = (step: string, p: Payload): Action => ({id: 'scavenge:' + step + ':' + p.card, label: 'Resolve Tusken Scavengers', handler: 'scavenge:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: 'dark', cancelled: false, action: action(step, p)});
const raiders = (m: Match) => Object.values(m.cards).filter(c => c.zone === 'table' && isSpecies(m, c.id, 'TUSKEN_RAIDER')).length;
const equipment = (m: Match, id: string) => ['Vehicle','Weapon','Device'].includes(cardDefinition(m, id).type);
const eligible = (m: Match, id: string) => m.cards[id]?.owner === 'light' && m.cards[id].zone === 'used' && equipment(m, id);
const search: Search = {blueprint: '1_275', side: 'dark', function: searchFunctions.scavenge, owner: 'light', pile: 'used'};
export function scavengeActions(m: Match, w: Window, side: Side): Action[] {
  const event = w.event as {kind?: string} | undefined;
  if (side !== 'dark' || !raiders(m) || !m.players.light.used.length || w.timing !== 'phase' && !(w.timing === 'response' && event?.kind === 'battle-weapons')) return [];
  return m.players.dark.hand.filter(id => m.cards[id].blueprint === '1_275').map(card => ({...action('play', {card}), label: 'Play Tusken Scavengers', payment: {dark: 1}}));
}
export function scavengeInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
function scheduleLoss(m: Match, p: Payload, target: string): void {
  queue(m, 'next', {...p, remaining: p.remaining!.filter(id => id !== target)});
  queue(m, 'lose', {card: p.card, target});
  openWindow(m, 'response', 'light', {kind: 'about-to-lose-from-pile', card: target, source: p.card, pile: 'used', side: 'light'});
}
export function scavengeResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (r.cancelled) {if (h === 'scavenge:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'scavenge:play') {
    queue(m, 'finish', {card: p.card});
    drawDestiny(m, r.actor, p.card, 'scavenge', action('result', p));
  } else if (h === 'scavenge:result') {
    p.count = raiders(m);
    if (p.draw!.value !== null && p.draw!.value < p.count && m.players.light.used.length && canSearch(m, search))
      m.stack.push({kind: 'decision', side: r.actor, handler: 'scavenge:offer', payload: p as unknown as Json});
  } else if (h === 'scavenge:inspect') {
    if (!m.players.light.used.length || !canSearch(m, search)) return;
    const cards = [...m.players.light.used], remaining = cards.filter(id => eligible(m, id));
    // AR p12: a verified failed search prevents this same search function on
    // another copy this turn. The paid destiny action itself remains possible.
    if (!remaining.length) recordFailedSearch(m, search);
    queue(m, 'next', {card: p.card, cards, remaining});
    openWindow(m, 'response', other(r.actor), {kind: 'pile-revealed', source: p.card, side: 'light', pile: 'used'});
  } else if (h === 'scavenge:next') {
    p.remaining = p.remaining!.filter(id => eligible(m, id));
    if (p.remaining.length === 1) scheduleLoss(m, p, p.remaining[0]);
    else if (p.remaining.length) m.stack.push({kind: 'decision', side: m.turn.side, handler: 'scavenge:order', payload: p as unknown as Json});
  } else if (h === 'scavenge:lose') {
    if (eligible(m, p.target!)) {
      moveCard(m, p.target!, 'lost');
      openWindow(m, 'response', 'light', {kind: 'card-placed-lost', card: p.target!, source: p.card, from: 'used'});
    }
  } else if (h === 'scavenge:finish') moveCard(m, p.card, 'lost');
  else throw Error('Unknown Tusken Scavengers continuation.');
}
export function scavengeChoices(m: Match, d: Decision) {
  if (d.handler === 'scavenge:offer') return [{id: 'scavenge:decline', label: 'Do not search'}, {id: 'scavenge:search', label: 'Search opponent’s Used Pile'}];
  return (d.payload as Payload).remaining!.filter(id => eligible(m, id)).map(id => ({id: 'scavenge:lose:' + id, label: 'Place ' + name(m, id) + ' on top of Lost'}));
}
export function scavengeChoose(m: Match, d: Decision, choice: string): void {
  const p = d.payload as Payload;
  if (d.handler === 'scavenge:offer') {
    if (choice === 'scavenge:search') {
      queue(m, 'inspect', {card: p.card});
      openWindow(m, 'response', other(d.side), {kind: 'before-looking-at-pile', source: p.card, side: 'light', pile: 'used'});
    }
  } else scheduleLoss(m, p, choice.slice('scavenge:lose:'.length));
}
export function scavengeView(m: Match): Json {
  if (m.status !== 'playing') return {scavenge: null};
  const f = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'scavenge:next' || f.kind === 'decision' && f.handler === 'scavenge:order');
  if (!f || f.kind === 'window') return {scavenge: null};
  const p = (f.kind === 'resolution' ? f.action.payload : f.payload) as Payload;
  return {scavenge: {source: p.card, side: 'light', pile: 'used', cards: p.cards!.filter(id => m.cards[id].zone === 'used').map(id => ({...m.cards[id]}))}};
}
export function assertScavenge(m: Match): void {
  const failed = m.data.scavengeFailedTurn;
  if (failed !== undefined && (typeof failed !== 'number' || !Number.isSafeInteger(failed) || failed < 1 || failed > m.turn.number)) throw Error('Invalid failed scavenging search.');
  for (const f of m.stack) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('scavenge:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as Payload;
    if (!p || m.cards[p.card]?.blueprint !== '1_275' || m.cards[p.card].owner !== 'dark' || m.cards[p.card].zone !== 'playing' ||
      (f.kind === 'resolution' ? f.actor : (f as Decision).side) !== (h === 'scavenge:order' ? m.turn.side : 'dark') ||
      !(f.kind === 'resolution' ? ['scavenge:play','scavenge:result','scavenge:inspect','scavenge:next','scavenge:lose','scavenge:finish'] : ['scavenge:offer','scavenge:order']).includes(h)) throw Error('Invalid Tusken Scavengers continuation.');
    if (['scavenge:result','scavenge:offer'].includes(h) && (!p.draw || !validDraw(m, p.draw, 'dark'))) throw Error('Invalid scavenging destiny.');
    if (h === 'scavenge:offer' && (!Number.isSafeInteger(p.count) || p.count! < 1 || p.draw!.value === null || p.draw!.value >= p.count!)) throw Error('Invalid scavenging offer.');
    if (['scavenge:next','scavenge:order'].includes(h) && (!Array.isArray(p.cards) || new Set(p.cards).size !== p.cards.length || p.cards.some(id => m.cards[id]?.owner !== 'light') || !Array.isArray(p.remaining) || new Set(p.remaining).size !== p.remaining.length || p.remaining.some(id => !p.cards!.includes(id) || !equipment(m, id)))) throw Error('Invalid scavenging targets.');
    if (h === 'scavenge:order' && !p.remaining!.some(id => eligible(m, id))) throw Error('Empty scavenging order.');
    if (h === 'scavenge:lose' && (m.cards[p.target!]?.owner !== 'light' || !equipment(m, p.target!))) throw Error('Invalid scavenging loss.');
  }
}
