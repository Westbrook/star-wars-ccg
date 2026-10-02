import {atSite, cardDefinition, isWarrior, name, system} from './board';
import {weapons} from './battle';
import {canUseDevice, equipmentState, nighttimeSites, recordEquipment, useDevice} from './equipment-state';
import {drawDestiny, type Draw} from './destiny';
import {canDeployAsReact, pendingReactSite, reactionSources, registerReact} from './ground';
import {openWindow, type RequiredAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other, type Action, type Decision, type Json, type Match, type Payment, type Resolution, type Side, type Window} from './types';

type Payload = {card?: string; target?: string; site?: string; mode?: 'warrior' | 'power'; react?: boolean; via?: string; draw?: Draw; cards?: string[]; selected?: string[]; count?: number; trippedBy?: Side};
export const isMine = (blueprint: string) => ['1_162', '1_322'].includes(blueprint);
const mining = (m: Match, side: Side, site: string) => atSite(m, site).filter(c => c.owner === side && ['1_18', '1_186'].includes(c.blueprint));
const isTraining = (bp: string) => ['1_64', '1_221'].includes(bp);
const devices: Record<string, number> = {'1_201': 1, '1_207': 1, '1_40': 1, '1_35': 1};
const act = (id: string, label: string, handler: string, p: Payload = {}, payment?: Payment, source?: string): Action => ({id, label, handler: 'equipment:' + handler, payload: p as Json, ...(payment ? {payment} : {}), ...(source ? {source} : {})});
const data = (r: Resolution | Decision) => ('action' in r ? r.action.payload : r.payload) as Payload;
const event = (w: Window) => w.event as {kind?: string; card?: string; site?: string; cards?: string[]} | undefined;
function then(m: Match, handler: string, side: Side, p: Payload = {}): void {m.stack.push({kind: 'resolution', actor: side, action: act('equipment-step:' + handler, handler, handler, p), cancelled: false});}
export const topLevel = (w: Window) => w.timing === 'phase' || w.timing === 'response' && event(w)?.kind === 'battle-weapons';
const burySite = (m: Match, side: Side, site: string) => system(m, site) === 'Tatooine' && (cardDefinition(m, site).icons as string[]).includes('Exterior') && mining(m, side, site).length > 0;
function validHost(m: Match, blueprint: string, host: string, side: Side): boolean {
  const c = m.cards[host], def = cardDefinition(m, host);
  if (c.zone !== 'table' || c.owner !== side || def.type !== 'Character' || !c.location) return false;
  if (blueprint === '1_201') return true;
  if (blueprint === '1_35' || weapons[blueprint]) return isWarrior(m, host);
  if (blueprint === '1_40') return ['Rebel', 'Alien'].includes(def.subType);
  if (blueprint === '1_207') return ['Imperial', 'Alien'].includes(def.subType);
  return isTraining(blueprint) && (isWarrior(m, host) || def.subType !== 'Droid');
}
function deployActions(m: Match, side: Side, reactSite?: string, via?: string): Action[] {
  const result: Action[] = [], reacting = !!reactSite;
  for (const id of m.players[side].hand) {
    const c = m.cards[id], bp = c.blueprint, def = cardDefinition(m, id);
    if (reacting && (!canDeployAsReact(m, id) || !['Device', 'Weapon'].includes(def.type))) continue;
    const suffix = reacting ? ':react' + (via ? ':via:' + via : '') : '';
    const extra = reacting ? {react: true, ...(via ? {via} : {})} : {};
    if (devices[bp] || isTraining(bp) || reacting && weapons[bp]) {
      for (const host of Object.values(m.cards).filter(h => validHost(m, bp, h.id, side) && (!reactSite || h.location === reactSite))) {
        const mode = isTraining(bp) ? isWarrior(m, host.id) ? 'power' : 'warrior' : undefined;
        const a = act('attach:' + id + ':' + host.id + suffix, 'Deploy ' + name(m, id) + ' on ' + name(m, host.id), 'attach', {card: id, target: host.id, ...(mode ? {mode} : {}), ...extra}, {[side]: devices[bp] ?? weapons[bp]?.deploy ?? 0}, id);
        if (weapons[bp]) {a.handler = 'battle:equip'; a.id = 'equip:' + id + ':' + host.id + suffix;}
        result.push(a);
      }
    } else if (bp === '1_224' && !reacting) result.push(act('macroscan:' + id, 'Deploy Macroscan', 'macroscan', {card: id}, {[side]: 2}, id));
    else if (isMine(bp)) for (const site of m.locations.filter(site => (!reactSite || site === reactSite) && mining(m, side, site).length))
      result.push(act('mine:' + id + ':' + site + suffix, 'Lay Timer Mine at ' + name(m, site), 'mine', {card: id, site, ...extra}, {}, id));
  }
  return result;
}
export function equipmentActions(m: Match, w: Window, side: Side): Action[] {
  const result: Action[] = [];
  if (w.timing === 'phase' && m.turn.side === side && m.turn.phase === 'deploy') {
    result.push(...deployActions(m, side));
    for (const c of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && devices[c.blueprint] && c.attachedTo))
      for (const host of Object.values(m.cards).filter(h => h.id !== c.attachedTo && h.location === c.location && validHost(m, c.blueprint, h.id, side)))
        result.push(act('device-transfer:' + c.id + ':' + host.id, 'Transfer ' + name(m, c.id) + ' to ' + name(m, host.id), 'attach', {card: c.id, target: host.id}, {[side]: devices[c.blueprint]}, c.id));
    for (const site of m.locations.filter(site => burySite(m, side, site))) for (const card of m.players[side].hand)
      result.push(act('bury:' + card + ':' + site, 'Bury ' + name(m, card) + ' at ' + name(m, site), 'bury', {card, site}));
  }
  const reactSite = pendingReactSite(m, w, side);
  if (reactSite) {
    const sources = reactionSources(m, reactSite, side);
    if (sources.some(id => m.cards[id].blueprint === '1_6')) result.push(...deployActions(m, side, reactSite));
    for (const via of sources.filter(id => m.cards[id].blueprint === '1_201')) result.push(...deployActions(m, side, reactSite, via));
  }
  if (topLevel(w)) for (const c of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table')) {
    if (c.blueprint === '1_35' && c.attachedTo && isWarrior(m, c.attachedTo) && canUseDevice(m, c.id))
      result.push(act('peek:' + c.id, 'Use Electrobinoculars · 2 Force', 'peek', {card: c.id}, {[side]: 2}, c.id));
    if (c.blueprint === '1_224' && m.players[other(side)].reserve.length)
      result.push(act('peek:' + c.id, 'Use Macroscan · 1 Force', 'peek', {card: c.id}, {[side]: 1}, c.id));
  }
  if (side === m.turn.side && (topLevel(w) || event(w)?.kind === 'mines-before-explosion')) {
    const limited = event(w)?.kind === 'mines-before-explosion' ? event(w)?.cards : undefined;
    for (const site of m.locations) for (const droid of mining(m, side, site))
      for (const mine of Object.values(m.cards).filter(c => c.zone === 'table' && c.location === site && isMine(c.blueprint) && (!limited || limited.includes(c.id))))
        result.push(act('defuse:' + droid.id + ':' + mine.id, 'Defuse Timer Mine · 1 Force', 'defuse', {card: droid.id, target: mine.id}, {[side]: 1}, droid.id));
  }
  return result;
}
export function equipmentAutomatic(m: Match, w: Window): RequiredAction[] {
  const result: RequiredAction[] = [];
  if (w.timing === 'start') for (const c of Object.values(m.cards)) if (c.zone === 'table' && c.owner === m.turn.side && isMine(c.blueprint) && (equipmentState(m).mines[c.id] ?? m.turn.number) < m.turn.number)
    result.push({...act('explode:' + c.id, 'Explode Timer Mine at ' + name(m, c.location!), 'explode', {card: c.id}, {}, c.id), actor: c.owner});
  const e = event(w);
  if (w.timing === 'response' && ['deployed', 'moved'].includes(e?.kind ?? '')) {
    const arrivals = e?.cards ?? (e?.card ? [e.card] : []), sites = new Set<string>();
    for (const id of arrivals) {
      const c = m.cards[id];
      if (c?.zone === 'table' && c.location && !sites.has(c.location) && ['Character', 'Vehicle', 'Starship'].includes(cardDefinition(m, c.id).type) && Object.values(m.cards).some(b => b.zone === 'buried' && b.location === c.location)) {
        sites.add(c.location);
        result.push({...act('trip-mines:' + c.location, 'Reveal buried cards at ' + name(m, c.location), 'trip', {site: c.location, trippedBy: c.owner}), actor: m.turn.side});
      }
    }
  }
  return result;
}
export function equipmentInitiate(m: Match, r: Resolution): void {
  const p = data(r), kind = r.action.handler;
  if (['equipment:attach', 'equipment:macroscan', 'equipment:mine'].includes(kind) && m.cards[p.card!].zone === 'hand') moveCard(m, p.card!, 'playing');
  if (p.react) registerReact(m, p.card!);
  if (kind === 'equipment:peek' && m.cards[p.card!].blueprint === '1_35') useDevice(m, p.card!);
}
function loss(m: Match, cards: string[], side: Side): void {
  const live = cards.filter(id => m.cards[id]?.zone === 'table');
  if (!live.length) return;
  then(m, 'lost', side, {cards: live}); loseFromTable(m, live);
}
function discardMine(m: Match, id: string, side: Side): void {loss(m, [id], side);}
function resolveMineVictims(m: Match, r: Resolution): void {
  const p = data(r), mine = m.cards[p.card!];
  const victims = atSite(m, p.site ?? mine.location!).filter(c => c.owner !== mine.owner).map(c => c.id);
  const count = Math.min(victims.length, Math.max(0, Math.floor(p.draw?.value ?? 0)));
  then(m, 'discard-mine', mine.owner, {card: mine.id});
  if (!count) return;
  if (count === victims.length) loss(m, victims, other(mine.owner));
  else m.stack.push({kind: 'decision', side: other(mine.owner), handler: 'equipment:mine-victims', payload: {card: mine.id, cards: victims, selected: [], count} as Json});
}
export function equipmentResolve(m: Match, r: Resolution): void {
  const p = data(r), kind = r.action.handler, side = r.actor;
  if (r.cancelled) {if (p.card && m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost'); return;}
  if (kind === 'equipment:attach') {
    const c = m.cards[p.card!], host = m.cards[p.target!], transfer = c.zone === 'table';
    if (!validHost(m, c.blueprint, host.id, side)) {if (!transfer) moveCard(m, c.id, 'lost'); return;}
    if (!transfer) moveCard(m, c.id, 'table'); c.attachedTo = host.id; c.location = host.location;
    if (p.mode) recordEquipment(m).training[c.id] = p.mode;
    openWindow(m, 'response', other(side), {kind: transfer ? 'transferred' : 'deployed', card: c.id});
  } else if (kind === 'equipment:macroscan') {moveCard(m, p.card!, 'table'); openWindow(m, 'response', other(side), {kind: 'deployed', card: p.card!});}
  else if (kind === 'equipment:mine') {moveCard(m, p.card!, 'table'); m.cards[p.card!].location = p.site; recordEquipment(m).mines[p.card!] = m.turn.number; openWindow(m, 'response', other(side), {kind: 'deployed', card: p.card!});}
  else if (kind === 'equipment:bury') {moveCard(m, p.card!, 'buried'); m.cards[p.card!].location = p.site; openWindow(m, 'response', other(side), {kind: 'card-buried', site: p.site!});}
  else if (kind === 'equipment:peek') {
    const binoculars = m.cards[p.card!].blueprint === '1_35', target = binoculars ? side : other(side), count = binoculars || !nighttimeSites(m).length ? 1 : 3;
    const cards = m.players[target].reserve.slice(0, count);
    if (cards.length) m.stack.push({kind: 'decision', side, handler: 'equipment:peek', payload: {card: p.card!, cards} as Json});
  } else if (kind === 'equipment:defuse') discardMine(m, p.target!, side);
  else if (kind === 'equipment:explode') {
    const mine = m.cards[p.card!]; if (mine.zone !== 'table') return;
    drawDestiny(m, mine.owner, mine.id, 'timer-mine', act('mine-victims:' + mine.id, 'Resolve Timer Mine', 'mine-victims', {card: mine.id, site: mine.location!}));
  } else if (kind === 'equipment:mine-victims') resolveMineVictims(m, r);
  else if (kind === 'equipment:discard-mine') discardMine(m, p.card!, side);
  else if (kind === 'equipment:lost') openWindow(m, 'response', other(side), {kind: 'cards-lost', cards: p.cards!});
  else if (kind === 'equipment:trip') {
    const cards = Object.values(m.cards).filter(c => c.zone === 'buried' && c.location === p.site).map(c => c.id), mines: string[] = [], duds: string[] = [];
    for (const id of cards) {moveCard(m, id, 'table'); m.cards[id].location = p.site; if (isMine(m.cards[id].blueprint)) {mines.push(id); recordEquipment(m).mines[id] = m.turn.number;} else duds.push(id);}
    then(m, 'trip-defuse', side, {cards: mines, site: p.site, trippedBy: p.trippedBy}); loss(m, duds, side);
  } else if (kind === 'equipment:trip-defuse') {
    then(m, 'trip-order', side, p);
    if (mining(m, m.turn.side, p.site!).length) openWindow(m, 'response', m.turn.side, {kind: 'mines-before-explosion', cards: p.cards!});
  } else if (kind === 'equipment:trip-order') {
    const cards = p.cards!.filter(id => m.cards[id].zone === 'table');
    if (cards.length) m.stack.push({kind: 'decision', side: m.turn.side, handler: 'equipment:trip-order', payload: {...p, cards} as Json});
  } else throw Error('Unknown equipment effect: ' + kind);
}
export function equipmentChoices(m: Match, d: Decision) {
  const p = data(d);
  if (d.handler === 'equipment:peek') return [{id: 'keep', label: 'Keep the order unchanged'}, ...(m.cards[p.card!].blueprint === '1_35' ? [{id: 'to-force', label: 'Put the viewed card on top of Force'}] : [])];
  if (d.handler === 'equipment:mine-victims') return p.cards!.filter(id => !p.selected!.includes(id)).map(id => ({id: 'select:' + id, label: 'Lose ' + name(m, id)}));
  if (d.handler === 'equipment:trip-order') return p.cards!.map(id => ({id: 'explode:' + id, label: 'Resolve ' + name(m, id) + ' · ' + id}));
  throw Error('Unknown equipment decision.');
}
export function equipmentChoose(m: Match, d: Decision, choice: string): void {
  const p = data(d);
  if (d.handler === 'equipment:peek') {
    if (choice === 'to-force') {
      const id = p.cards![0]; if (m.cards[id].owner !== d.side || m.players[d.side].reserve[0] !== id) throw Error('Peeked card changed.');
      moveCard(m, id, 'force'); openWindow(m, 'response', other(d.side), {kind: 'card-to-force', side: d.side});
    }
  } else if (d.handler === 'equipment:mine-victims') {
    p.selected!.push(choice.slice(7));
    if (p.selected!.length < p.count!) m.stack.push({...d, payload: p as Json}); else loss(m, p.selected!, d.side);
  } else if (d.handler === 'equipment:trip-order') {
    const id = choice.slice(8); then(m, 'trip-order', d.side, {...p, cards: p.cards!.filter(card => card !== id)});
    if (m.cards[id].owner === p.trippedBy) discardMine(m, id, m.cards[id].owner);
    else then(m, 'explode', m.cards[id].owner, {card: id});
  } else throw Error('Unknown equipment decision.');
}
export function equipmentView(m: Match, seat: Side): Json {
  const d = m.stack.at(-1);
  return {peek: d?.kind === 'decision' && d.handler === 'equipment:peek' && d.side === seat ? data(d).cards!.map(id => ({...m.cards[id]})) : []};
}
export function assertEquipment(m: Match): void {
  const s = equipmentState(m), raw = m.data.equipment as {turn: number} | undefined;
  if (raw && (!Number.isSafeInteger(raw.turn) || raw.turn < 1 || raw.turn > m.turn.number)) throw Error('Invalid equipment turn.');
  for (const [host, device] of Object.entries(s.devices)) if (!m.cards[host] || !m.cards[device] || !devices[m.cards[device].blueprint]) throw Error('Invalid device usage.');
  for (const [id, mode] of Object.entries(s.training)) if (!m.cards[id] || !isTraining(m.cards[id].blueprint) || !['warrior', 'power'].includes(mode)) throw Error('Invalid training mode.');
  for (const c of Object.values(m.cards)) {
    if (c.zone === 'buried' && (!c.location || !m.locations.includes(c.location) || c.attachedTo)) throw Error('Invalid buried card.');
    if (c.zone !== 'table') continue;
    if (isMine(c.blueprint) && (!c.location || !Number.isSafeInteger(s.mines[c.id]) || s.mines[c.id] > m.turn.number || s.mines[c.id] < 1)) throw Error('Mine requires its deployment turn and site.');
    if (isTraining(c.blueprint) && (!c.attachedTo || !s.training[c.id])) throw Error('Training requires its selected mode.');
    if (devices[c.blueprint] && !c.attachedTo) throw Error('Device requires its bearer.');
  }
  if (new Set(nighttimeSites(m)).size !== nighttimeSites(m).length || nighttimeSites(m).some(site => !m.locations.includes(site))) throw Error('Invalid nighttime sites.');
  for (const f of m.stack) if (f.kind === 'decision' && f.handler.startsWith('equipment:')) {
    const p = data(f);
    if (!Array.isArray(p.cards) || new Set(p.cards).size !== p.cards.length || p.cards.some(id => !m.cards[id])) throw Error('Invalid equipment choice cards.');
    if (f.handler === 'equipment:mine-victims' && (!Number.isSafeInteger(p.count) || p.count! < 1 || p.count! > p.cards.length || !Array.isArray(p.selected) || new Set(p.selected).size !== p.selected.length || p.selected.some(id => !p.cards!.includes(id)) || p.selected.length >= p.count!)) throw Error('Invalid mine victim selection.');
  }
}
