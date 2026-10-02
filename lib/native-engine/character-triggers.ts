import {atSite, cardDefinition, name} from './board';
import {battle, members} from './battle';
import {drawDestiny, type Draw} from './destiny';
import {barred} from './ground';
import {openWindow, type RequiredAction} from './runtime';
import {loseFromTable} from './table';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Window} from './types';

type Choke = {source: string; site: string; draw?: Draw; target?: string};
const action = (step: string, p: Choke): Action => ({id: 'choke:' + step + ':' + p.source, label: 'Vader · ' + step, handler: 'character:' + step, source: p.source, payload: p as unknown as Json});
const targets = (m: Match, p: Choke) => m.cards[p.source]?.zone === 'table' && m.cards[p.source].location === p.site
  ? atSite(m, p.site).filter(c => cardDefinition(m, c.id).subType === 'Imperial' && !barred(m, c.id)).map(c => c.id) : [];

export function characterAutomatic(m: Match, w: Window): RequiredAction[] {
  const b = battle(m);
  if (w.timing !== 'response' || (w.event as {kind?: string} | undefined)?.kind !== 'battle-result' || !b?.totalsReady) return [];
  return (['dark', 'light'] as const).flatMap(side => b.power[side] < b.power[other(side)]
    ? members(m, side).filter(id => m.cards[id].blueprint === '101_5').map(source => ({...action('draw-choke', {source, site: b.site}), actor: side})) : []);
}

export function characterResolve(m: Match, r: Resolution): void {
  if (r.cancelled) return;
  const p = r.action.payload as unknown as Choke;
  if (r.action.handler === 'character:draw-choke') {
    drawDestiny(m, r.actor, p.source, 'choke', action('resolve-choke', p));
  } else if (r.action.handler === 'character:resolve-choke') {
    // A failed draw resolves against Vader's owner. Zero is a successful
    // draw and does not cause a choke. Vader himself is an Imperial present.
    if ((p.draw!.value === null || p.draw!.value > 4) && targets(m, p).length)
      m.stack.push({kind: 'decision', side: r.actor, handler: 'character:choke-target', payload: p as unknown as Json});
  } else if (r.action.handler === 'character:apply-choke') {
    if (targets(m, p).includes(p.target!)) {
      m.stack.push({kind: 'resolution', actor: r.actor, cancelled: false, action: action('choke-lost', p)});
      loseFromTable(m, [p.target!]);
    }
  } else if (r.action.handler === 'character:choke-lost') {
    openWindow(m, 'response', other(r.actor), {kind: 'character-lost', card: p.target!, source: p.source, site: p.site, cause: 'choke'});
  } else throw Error('Unknown character trigger.');
}

export function characterChoices(m: Match, d: Decision) {
  return targets(m, d.payload as unknown as Choke).map(id => ({id: 'choke:' + id, label: 'Lose ' + name(m, id) + ' to Vader’s choke'}));
}
export function characterChoose(m: Match, d: Decision, choice: string): void {
  const p = {...d.payload as unknown as Choke, target: choice.slice('choke:'.length)};
  // Loss, not forfeiture: it pays neither battle damage nor attrition. All
  // attachments leave together, and their owner orders the resulting Lost pile.
  m.stack.push({kind: 'resolution', actor: d.side, cancelled: false, action: action('apply-choke', p)});
  openWindow(m, 'response', other(d.side), {kind: 'about-to-lose', card: p.target, source: p.source, site: p.site, cause: 'choke'});
}

export function assertCharacterTriggers(m: Match): void {
  for (const f of m.stack) {
    const handler = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!handler.startsWith('character:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as unknown as Choke;
    const actor = f.kind === 'resolution' ? f.actor : (f as Decision).side;
    if (!p || m.cards[p.source]?.blueprint !== '101_5' || m.cards[p.source].owner !== actor || !m.locations.includes(p.site) ||
      !['character:draw-choke', 'character:resolve-choke', 'character:choke-target', 'character:apply-choke', 'character:choke-lost'].includes(handler)) throw Error('Invalid character trigger.');
    if (handler === 'character:resolve-choke' || handler === 'character:choke-target') {
      if (!p.draw || p.draw.card !== null && m.cards[p.draw.card]?.owner !== actor || p.draw.value !== null && (!Number.isFinite(p.draw.value) || p.draw.value < 0) || p.draw.card === null && p.draw.value !== null) throw Error('Invalid choke destiny.');
    }
    if (handler === 'character:choke-target' && (!targets(m, p).length || p.draw!.value !== null && p.draw!.value <= 4)) throw Error('Invalid choke choice.');
    if (handler === 'character:apply-choke' && (!p.target || !m.cards[p.target] || cardDefinition(m, p.target).subType !== 'Imperial')) throw Error('Invalid choke target.');
    if (handler === 'character:choke-lost' && (!p.target || !['leaving', 'lost'].includes(m.cards[p.target]?.zone))) throw Error('Invalid choke loss.');
  }
}
