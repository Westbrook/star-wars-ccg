import {cardDefinition, name} from './board';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; cards?: string[]; target?: string};
const action = (step: string, p: Payload): Action => ({id: 'scan:' + step + ':' + p.card, label: 'Resolve Scanning Crew', handler: 'scan:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
const rebel = (m: Match, id: string) => m.cards[id]?.owner === 'light' && m.cards[id].zone === 'hand' && cardDefinition(m, id).type === 'Character' && cardDefinition(m, id).subType === 'Rebel';
const candidates = (m: Match, p: Payload) => p.cards!.filter(id => rebel(m, id));

export function scanActions(m: Match, w: Window, side: Side): Action[] {
  const event = w.event as {kind?: string} | undefined;
  if (side !== 'dark' || !m.players.light.hand.length || w.timing !== 'phase' && !(w.timing === 'response' && event?.kind === 'battle-weapons')) return [];
  return m.players.dark.hand.filter(id => m.cards[id].blueprint === '1_266').map(card => ({...action('play', {card}), label: 'Scanning Crew · inspect opponent’s hand', payment: {dark: 1}}));
}
export function scanInitiate(m: Match, r: Resolution): void {moveCard(m, (r.action.payload as Payload).card, 'playing');}
// AR p10, Peeking At Cards: printed time limits are obsolete. Inspection
// ends when acknowledged; legacy saved expiresAt fields have no rules effect.
export function scanResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (r.cancelled) {if (h === 'scan:play') moveCard(m, p.card, 'lost'); return;}
  if (h === 'scan:play') {
    queue(m, 'finish', {card: p.card}); queue(m, 'inspect', {card: p.card});
    openWindow(m, 'response', other(r.actor), {kind: 'before-looking-at-hand', source: p.card, side: 'light'});
  } else if (h === 'scan:inspect') {
    if (m.players.light.hand.length) m.stack.push({kind: 'decision', side: r.actor, handler: 'scan:peek',
      payload: {card: p.card, cards: [...m.players.light.hand]} as Json});
  } else if (h === 'scan:put') {
    if (rebel(m, p.target!)) {
      moveCard(m, p.target!, 'used');
      openWindow(m, 'response', other(r.actor), {kind: 'card-placed-used', card: p.target!, source: p.card, from: 'hand'});
    }
  } else if (h === 'scan:finish') moveCard(m, p.card, 'used');
  else throw Error('Unknown Scanning Crew continuation.');
}
export function scanChoices(m: Match, d: Decision) {
  if (d.handler === 'scan:peek') return [{id: 'scan:continue', label: 'Finish viewing'}];
  const p = d.payload as Payload;
  return [{id: 'scan:decline', label: 'Leave the hand unchanged'}, ...candidates(m, p).map(id => ({id: 'scan:select:' + id, label: 'Put ' + name(m, id) + ' on top of Used'}))];
}
export function scanChoose(m: Match, d: Decision, choice: string): void {
  const p = d.payload as Payload;
  if (d.handler === 'scan:peek') {
    if (candidates(m, p).length) m.stack.push({kind: 'decision', side: d.side, handler: 'scan:select', payload: {card: p.card, cards: candidates(m, p)} as Json});
  } else if (choice !== 'scan:decline') {
    const target = choice.slice('scan:select:'.length);
    queue(m, 'put', {card: p.card, target});
    openWindow(m, 'response', other(d.side), {kind: 'about-to-place-hand-card-used', card: target, source: p.card});
  }
}
export function scanView(m: Match, seat: Side): Json {
  if (m.status !== 'playing') return {scan: null};
  const d = m.stack.at(-1);
  if (d?.kind === 'decision' && d.handler === 'scan:peek' && d.side === seat) {
    const p = d.payload as Payload;
    return {scan: {source: p.card, stage: 'peek',
      cards: p.cards!.filter(id => m.cards[id].zone === 'hand').map(id => ({...m.cards[id]}))}};
  }
  if (d?.kind === 'decision' && d.handler === 'scan:select' && d.side === seat) {
    const p = d.payload as Payload;
    return {scan: {source: p.card, stage: 'select', cards: candidates(m, p).map(id => ({...m.cards[id]}))}};
  }
  // The chosen Rebel is revealed for removal responses; the rest of the hand
  // and the entire saved inspection payload stay private.
  const pending = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'scan:put');
  const e = d?.kind === 'window' ? d.event as {kind?: string; source?: string; card?: string} | undefined : undefined;
  const p = pending?.kind === 'resolution' ? pending.action.payload as Payload :
    e?.kind === 'card-placed-used' && m.cards[e.source!]?.blueprint === '1_266' ? {card: e.source!, target: e.card!} : null;
  return {scan: p ? {source: p.card, stage: 'selected', cards: [{...m.cards[p.target!]}]} : null};
}
export function assertScan(m: Match): void {
  for (const f of m.stack) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('scan:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as Payload;
    if (!p || m.cards[p.card]?.blueprint !== '1_266' || m.cards[p.card].owner !== 'dark' || m.cards[p.card].zone !== 'playing' ||
      (f.kind === 'resolution' ? f.actor : (f as Decision).side) !== 'dark' ||
      !(f.kind === 'resolution' ? ['scan:play','scan:inspect','scan:put','scan:finish'] : ['scan:peek','scan:select']).includes(h)) throw Error('Invalid pending Scanning Crew.');
    if (f.kind === 'decision' && (!Array.isArray(p.cards) || !p.cards.length || new Set(p.cards).size !== p.cards.length || p.cards.some(id => m.cards[id]?.owner !== 'light'))) throw Error('Invalid Scanning Crew inspection.');
    if (h === 'scan:select' && p.cards!.some(id => cardDefinition(m, id).type !== 'Character' || cardDefinition(m, id).subType !== 'Rebel')) throw Error('Invalid Scanning Crew selection.');
    if (h === 'scan:put' && (m.cards[p.target!]?.owner !== 'light' || cardDefinition(m, p.target!).type !== 'Character' || cardDefinition(m, p.target!).subType !== 'Rebel')) throw Error('Invalid Scanning Crew target.');
  }
}
