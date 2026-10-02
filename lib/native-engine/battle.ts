import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import type {GaderffiiShot} from './gaderffii';
import {assertLedger, lossLedger, lossRemaining, type LossLedger} from './loss';
import {atSite, battleDestinyRequirement, cardDefinition, forfeit, isWarrior, name, printed, totalPower} from './board';
import {barred, reactionActions} from './ground';
import {openWindow, type RequiredAction} from './runtime';
import {moveCard, moveTop} from './state';
import {completeDestinyDraw, completeDestinyTotal, type Draw} from './destiny';
import {loseFromTable} from './table';
import {canUseWeapon, useWeapon} from './weapon-state';
import {other, sides, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Pair<T> = Record<Side, T>;
type Shot = {weapon: string; target: string; side: Side; defense: number; bonus: number; card: string | null; destiny: number | null; hit: boolean | null; total?: number | null};
export type Battle = {
  site: string; initiator: Side; stage: 'begin' | 'weapons' | 'power' | 'damage' | 'end' | 'complete';
  participants: Pair<string[]>; hits: string[]; fired: string[]; users: Record<string, string>; shots: Shot[];
  destiny: Pair<number | null>; destinyCards: Pair<string | null>; power: Pair<number>;
  attrition: Pair<number>; damage: Pair<number>; initialAttrition: Pair<number>; initialDamage: Pair<number>;
  reduced: Pair<boolean>; totalsReady: boolean; premature: boolean; runLuke?: boolean;
  departed?: string[];
  worseIncrease?: number; damageLedger?: Pair<LossLedger>;
  damageMultipliers?: {card: string; factor: number; side: Side | 'both'}[];
  knockedWeapons?: string[]; gaffiShots?: GaderffiiShot[];
};
type History = {turn: number; sites: string[]; participants: string[]};
type Payload = {attachment?: AttachmentAttempt; site?: string; card?: string; cards?: string[]; target?: string; side?: Side; step?: string; index?: number; amount?: number; from?: string; value?: number; redraw?: boolean; draw?: Draw; total?: number | null};
const pair = <T>(dark: T, light: T): Pair<T> => ({dark, light});
export const battle = (m: Match) => m.data.battle as Battle | undefined;
export const battleHistory = (m: Match): History => {
  const h = m.data.battles as History | undefined;
  return h?.turn === m.turn.number ? h : {turn: m.turn.number, sites: [], participants: []};
};
const data = (r: Resolution) => r.action.payload as Payload;
const event = (w: Window) => (w.event as {kind?: string} | undefined)?.kind;
const act = (id: string, label: string, handler: string, payload: Payload = {}, payment?: Partial<Pair<number>>, source?: string): Action =>
  ({id, label, handler: 'battle:' + handler, payload: payload as Json, ...(payment ? {payment} : {}), ...(source ? {source} : {})});
function continuation(m: Match, step: string, payload: Payload = {}, actor = battle(m)!.initiator): void {
  m.stack.push({kind: 'resolution', actor, action: act('battle-step:' + step, step, step, payload), cancelled: false});
}
function windowThen(m: Match, step: string, kind: string, priority: Side, payload: Payload = {}): void {
  continuation(m, step, payload); openWindow(m, 'response', priority, {kind});
}
export function members(m: Match, side: Side): string[] {
  const b = battle(m); if (!b) return [];
  return b.participants[side].filter(id => !b.departed?.includes(id) && m.cards[id]?.zone === 'table' && m.cards[id].location === b.site && !barred(m, id));
}
export const participatingAbility = (m: Match, side: Side) => members(m, side).reduce((n, id) => n + printed(m, id, 'ability'), 0);
export function syncBattle(m: Match): void {
  const b = battle(m); if (!b || b.stage === 'complete') return;
  // Leaving ends participation permanently. Returning the same physical card
  // (Old Ben) cannot make it eligible to forfeit twice or restore an old hit.
  const departed = b.departed ??= [];
  for (const id of sides.flatMap(side => b.participants[side]))
    if (!departed.includes(id) && (m.cards[id]?.zone !== 'table' || m.cards[id].location !== b.site || barred(m, id))) departed.push(id);
  b.hits = b.hits.filter(id => !departed.includes(id));
  syncBattleDamage(m);
  if (!['begin', 'weapons'].includes(b.stage)) return;
  const history = battleHistory(m);
  for (const c of atSite(m, b.site)) if (!barred(m, c.id) && !b.participants[c.owner].includes(c.id) && !history.participants.includes(c.id)) {
    b.participants[c.owner].push(c.id); history.participants.push(c.id);
  }
  m.data.battles = history as unknown as Json;
}
const eligibleAt = (m: Match, side: Side, site: string) => atSite(m, site).filter(c => c.owner === side && !barred(m, c.id) && !battleHistory(m).participants.includes(c.id));
export function battleDamage(m: Match, side: Side): number {
  const b = battle(m)!;
  return b.damageLedger && ['power','damage'].includes(b.stage) && !b.premature ? lossRemaining(m, side, b.damageLedger[side]) : b.damage[side];
}
export function syncBattleDamage(m: Match): void {
  const b = battle(m); if (b) for (const side of sides) b.damage[side] = battleDamage(m, side);
}
export function damagePending(m: Match, side: Side): boolean {
  const b = battle(m)!;
  return battleDamage(m, side) > 0 || members(m, side).some(id => b.hits.includes(id) || b.attrition[side] > 0);
}
export function battleCanPass(m: Match, w: Window, side: Side): boolean {
  return event(w) !== 'battle-damage' || !damagePending(m, side);
}

export const weapons: Record<string, {deploy: number; fire: number; bonus: number}> = {
  '1_152': {deploy: 1, fire: 1, bonus: 0}, '1_317': {deploy: 1, fire: 1, bonus: 0},
  '1_153': {deploy: 2, fire: 2, bonus: 1}, '1_312': {deploy: 2, fire: 2, bonus: 1},
};
const warrior = isWarrior;
export function weaponDrawBonus(m: Match, id: string): number {
  const c = m.cards[id];
  return c.owner === 'dark' && c.location && ['1_284', '1_132'].includes(m.cards[c.location].blueprint) ? 1 : 0;
}
export function weaponBonus(m: Match, id: string): number {
  return weapons[m.cards[id].blueprint].bonus + weaponDrawBonus(m, id);
}
export function battleActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [], b = battle(m);
  if (w.timing === 'phase' && side === m.turn.side) {
    if (m.turn.phase === 'deploy') for (const c of Object.values(m.cards)) {
      const rule = weapons[c.blueprint]; if (!rule || c.owner !== side || !['hand', 'table'].includes(c.zone)) continue;
      const transfer = c.zone === 'table';
      for (const host of Object.values(m.cards).filter(h => h.owner === side && h.zone === 'table' && h.location && warrior(m, h.id))) {
        if (transfer && (!c.attachedTo || host.id === c.attachedTo || host.location !== c.location)) continue;
        actions.push(act((transfer ? 'transfer:' : 'equip:') + c.id + ':' + host.id, (transfer ? 'Transfer ' : 'Deploy ') + name(m, c.id) + ' to ' + name(m, host.id), 'equip', {card: c.id, target: host.id}, {[side]: rule.deploy}, c.id));
      }
    }
    if (m.turn.phase === 'battle' && (!b || b.stage === 'complete')) for (const site of m.locations) {
      if (!battleHistory(m).sites.includes(name(m, site)) && sides.every(s => eligibleAt(m, s, site).some(c => printed(m, c.id, 'ability') > 0)))
        actions.push(act('battle:' + site, 'Battle at ' + name(m, site), 'begin', {site}, {[side]: 1}));
    }
  }
  if (w.timing !== 'response' || !b || b.stage === 'complete') return actions;
  const parent = m.stack.at(-2);
  if (parent?.kind === 'resolution' && parent.action.handler === 'battle:begin' && !parent.cancelled && side !== b.initiator)
    actions.push(...reactionActions(m, b.site, side, id => !battleHistory(m).participants.includes(id)));
  if (event(w) === 'battle-weapons') {
    for (const weapon of Object.values(m.cards)) {
      const rule = weapons[weapon.blueprint], host = weapon.attachedTo;
      if (!rule || weapon.owner !== side || weapon.zone !== 'table' || !host || !members(m, side).includes(host) || !warrior(m, host) || b.fired.includes(weapon.id) || !canUseWeapon(m, weapon.id) || !m.players[side].reserve.length) continue;
      for (const target of members(m, other(side))) actions.push(act('fire:' + weapon.id + ':' + target, 'Fire ' + name(m, weapon.id) + ' at ' + name(m, target), 'fire', {card: weapon.id, target}, {[side]: rule.fire}, weapon.id));
    }
  }
  if (event(w) === 'battle-destiny-complete' && b.destiny.dark !== null && b.destiny.light !== null) {
    for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === '1_269')) actions.push(act('takeel:' + card, 'Play Takeel · switch battle destiny', 'takeel', {card}, {[side]: 1}, card));
  }
  if (event(w) === 'battle-damage') {
    for (const id of members(m, side)) {
      if (battleDamage(m, side) > 0 || b.attrition[side] > 0 || b.hits.includes(id)) actions.push(act('forfeit:' + id, 'Forfeit ' + name(m, id) + ' · ' + forfeit(m, id), 'forfeit', {card: id}));
      if (m.cards[id].blueprint === '1_31') for (const target of members(m, side).filter(t => t !== id && b.hits.includes(t))) actions.push(act('rescue:' + id + ':' + target, 'Forfeit Talz · restore ' + name(m, target), 'rescue', {card: id, target}));
    }
    if (battleDamage(m, side) > 0) {
      for (const pile of ['reserve', 'force', 'used'] as const) if (m.players[side][pile].length) actions.push(act('battle-lose:' + pile, 'Lose one Force from ' + pile, 'lose', {from: pile}));
      for (const card of m.players[side].hand) actions.push(act('battle-lose-hand:' + card, 'Lose ' + name(m, card) + ' from hand', 'lose', {card}));
      for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === '1_90')) for (let amount = 1; amount <= m.players[side].force.length; amount++)
        actions.push(act('battle-reduce:' + card + ':' + amount, 'It Could Be Worse · use ' + amount + ' Force', 'reduce', {card, amount}, {[side]: amount}, card));
    }
  }
  return actions;
}

export function battleInitiate(m: Match, r: Resolution): void {
  const p = data(r), kind = r.action.handler;
  if (kind === 'battle:begin') {
    const b: Battle = {site: p.site!, initiator: r.actor, stage: 'begin', participants: pair([], []), hits: [], fired: [], users: {}, shots: [], destiny: pair(null, null), destinyCards: pair(null, null), power: pair(0, 0), attrition: pair(0, 0), damage: pair(0, 0), initialAttrition: pair(0, 0), initialDamage: pair(0, 0), reduced: pair(false, false), totalsReady: false, premature: false};
    m.data.battle = b as unknown as Json;
    const history = battleHistory(m); history.sites.push(name(m, p.site!)); m.data.battles = history as unknown as Json; syncBattle(m);
  } else if (kind === 'battle:equip' && m.cards[p.card!].zone === 'hand' || ['battle:takeel', 'battle:reduce'].includes(kind)) moveCard(m, p.card!, 'playing');
  else if (kind === 'battle:fire') {
    const b = battle(m)!, id = p.card!, host = m.cards[id].attachedTo!;
    useWeapon(m, id);
    b.fired.push(id); b.users[host] = id;
    b.shots.push({weapon: id, target: p.target!, side: r.actor, defense: printed(m, p.target!, 'ability'), bonus: weaponBonus(m, id), card: null, destiny: null, hit: null});
    p.index = b.shots.length - 1;
  } else if (kind === 'battle:rescue') {
    // Talz's forfeiture is the cost; the restoration follows its loss responses.
    forfeitCard(m, p.card!, r.actor);
  }
  if (kind === 'battle:equip') p.attachment = attachmentAttempt(m, p.card!, p.target!);
}

function forfeitCard(m: Match, id: string, side: Side): void {
  const b = battle(m)!, value = forfeit(m, id);
  if (b.damageLedger) b.damageLedger[side].paid += value; else b.damage[side] = Math.max(0, b.damage[side] - value); syncBattleDamage(m); b.attrition[side] = Math.max(0, b.attrition[side] - value);
  continuation(m, 'forfeit-result', {card: id}, side); loseFromTable(m, [id]);
}

function beginEnd(m: Match, premature = false): void {
  const b = battle(m)!; b.stage = 'end'; b.premature = premature;
  // Winner/loser responses still occur in power. If presence disappears then,
  // calculated balances never become damage-segment obligations. Retain the
  // initial totals as history while clearing what remains payable.
  if (premature) {b.damage = pair(0, 0); b.attrition = pair(0, 0);}
  windowThen(m, 'ended', 'battle-ending', other(b.initiator));
  const hit = sides.flatMap(s => members(m, s)).filter(id => b.hits.includes(id));
  if (premature && hit.length) {
    continuation(m, 'premature-loss-result', {cards: hit});
    loseFromTable(m, hit);
  }
}
export function battleAutomatic(m: Match, w: Window): RequiredAction[] {
  const b = battle(m);
  // Only after the current action resolves: never abandon its costs, destiny or
  // pending choices. Presence loss during damage does not terminate the battle.
  if (!b || !['begin', 'weapons', 'power'].includes(b.stage) || m.stack.some(f => f.kind === 'resolution' && !['battle:begin', 'battle:power', 'battle:totals', 'battle:destiny-next', 'battle:destiny-select', 'battle:damage'].includes(f.action.handler))) return [];
  if (sides.every(s => participatingAbility(m, s) > 0)) return [];
  return [{...act('battle-premature-end', 'End battle: presence removed', 'premature'), actor: b.initiator}];
}
export function battleResolve(m: Match, r: Resolution): void {
  const p = data(r), side = r.actor, b = battle(m), kind = r.action.handler;
  if (kind === 'battle:destiny-finish') {
    if (p.redraw) {
      if (p.card && m.cards[p.card].zone === 'destiny') moveCard(m, p.card, 'used');
      if (m.players[p.side!].reserve.length) {battleChoose(m, {kind: 'decision', side: p.side!, handler: 'battle:destiny', payload: null}, 'draw-destiny'); return;}
      b!.destiny[p.side!] = null; b!.destinyCards[p.side!] = null;
      windowThen(m, 'destiny-next', 'battle-destiny-player-complete', other(p.side!), {side: p.side});
    } else {
      const value = b!.destiny[p.side!];
      b!.destiny[p.side!] = r.cancelled || value === null ? null : Math.max(0, value);
      completeDestinyDraw(m, p.side!, b!.site, 'battle', {card: p.card!, value: b!.destiny[p.side!]},
        act('battle-destiny-result', 'Complete battle destiny', 'destiny-result', {side: p.side}));
    }
    return;
  }
  if (kind === 'battle:shot-finish') {
    const shot = b!.shots[p.index!];
    completeDestinyDraw(m, side, shot.weapon, 'weapon', {card: shot.card, value: r.cancelled ? null : shot.destiny},
      act('shot-total', 'Total weapon destiny', 'shot-total', {index: p.index}), false);
    return;
  }
  if (r.cancelled) {
    if (['battle:takeel', 'battle:reduce'].includes(kind) && m.cards[p.card!].zone === 'playing') moveCard(m, p.card!, 'lost');
    if (kind === 'battle:begin') beginEnd(m, true);
    return;
  }
  if (kind === 'battle:equip') {
    const c = m.cards[p.card!], host = m.cards[p.target!];
    if (!validAttachmentAttempt(m, p.attachment!) || host.zone !== 'table' || host.owner !== side || !warrior(m, host.id)) {if (c.zone === 'playing') moveCard(m, c.id, 'lost'); return;}
    if (c.zone === 'playing') moveCard(m, c.id, 'table'); c.attachedTo = host.id; c.location = host.location;
    openWindow(m, 'response', other(side), {kind: 'deployed', card: c.id}); return;
  }
  if (!b) throw Error('Missing battle.');
  if (kind === 'battle:premature') {
    // Remove only this battle's continuation/windows, leaving its phase below.
    const base = m.stack.findIndex(f => f.kind === 'resolution' && f.action.handler.startsWith('battle:'));
    if (base < 0) throw Error('Missing battle continuation.'); m.stack.splice(base); beginEnd(m, true); return;
  }
  if (kind === 'battle:begin') {b.stage = 'weapons'; windowThen(m, 'power', 'battle-weapons', b.initiator);}
  else if (kind === 'battle:power') {b.stage = 'power'; windowThen(m, 'destiny-select', 'battle-destiny-before', b.initiator, {side: b.initiator});}
  else if (kind === 'battle:destiny-select') {
    if (participatingAbility(m, p.side!) >= battleDestinyRequirement(m, p.side!, b.site) && m.players[p.side!].reserve.length)
      m.stack.push({kind: 'decision', side: p.side!, handler: 'battle:destiny', payload: null});
    else continuation(m, 'destiny-next', {side: p.side});
  } else if (kind === 'battle:destiny-result') {
    b.destiny[p.side!] = p.draw!.value;
    windowThen(m, 'destiny-next', 'battle-destiny-player-complete', other(p.side!), {side: p.side});
  } else if (kind === 'battle:destiny-next') {
    if (p.side === b.initiator) windowThen(m, 'destiny-select', 'battle-destiny-before', other(p.side), {side: other(p.side)});
    else windowThen(m, 'power-actions', 'battle-destiny-complete', other(b.initiator));
  } else if (kind === 'battle:power-actions') windowThen(m, 'totals', 'battle-power', b.initiator);
  else if (kind === 'battle:totals') {
    for (const s of sides) {const ids = members(m, s); b.power[s] = totalPower(m, s, b.site, s !== b.initiator, id => ids.includes(id)) + (b.destiny[s] ?? 0); b.attrition[s] = b.destiny[other(s)] ?? 0;}
    for (const s of sides) b.damage[s] = Math.max(0, b.power[other(s)] - b.power[s]);
    b.damageLedger = pair(lossLedger(b.damage.dark, 'battle'), lossLedger(b.damage.light, 'battle'));
    for (const s of sides) b.damageLedger[s].multiplier = (b.damageMultipliers ?? []).filter(v => v.side === 'both' || v.side === s).reduce((n, v) => n * v.factor, 1);
    syncBattleDamage(m);
    b.initialAttrition = {...b.attrition}; b.initialDamage = {...b.damage}; b.totalsReady = true;
    windowThen(m, 'damage', 'battle-result', other(b.initiator));
  } else if (kind === 'battle:damage') {b.stage = 'damage'; windowThen(m, 'end', 'battle-damage', b.initiator);}
  else if (kind === 'battle:end') beginEnd(m);
  else if (kind === 'battle:ended') {b.stage = 'complete'; openWindow(m, 'response', other(b.initiator), {kind: 'battle-ended'});}
  else if (kind === 'battle:takeel') {[b.destiny.dark, b.destiny.light] = [b.destiny.light, b.destiny.dark]; moveCard(m, p.card!, 'lost');}
  else if (kind === 'battle:reduce') {if (!b.reduced[side]) {if (b.damageLedger) b.damageLedger[side].reduction = p.amount!; else b.damage[side] = Math.max(0, b.damage[side] - p.amount!); b.reduced[side] = true; syncBattleDamage(m);} moveCard(m, p.card!, 'used');}
  else if (kind === 'battle:fire') {
    const shot = b.shots[p.index!];
    shot.card = m.players[side].reserve.length ? moveTop(m, side, 'reserve', 'destiny') : null;
    shot.destiny = shot.card ? printed(m, shot.card, 'destiny') + weaponDrawBonus(m, shot.weapon) : null;
    continuation(m, 'shot-finish', {index: p.index}, side);
    openWindow(m, 'response', other(side), {kind: shot.card ? 'weapon-destiny-drawn' : 'weapon-destiny-failed', card: shot.card, value: shot.destiny});
  } else if (kind === 'battle:shot-total') {
    const shot = b.shots[p.index!]; shot.destiny = p.draw!.value;
    completeDestinyTotal(m, side, shot.weapon, 'weapon', [p.draw!], act('shot-result', 'Resolve weapon result', 'shot-result', {index: p.index}));
  } else if (kind === 'battle:shot-result') {
    const shot = b.shots[p.index!]; shot.total = p.total!;
    shot.defense = printed(m, shot.target, 'ability');
    shot.hit = shot.total !== null && shot.total + weapons[m.cards[shot.weapon].blueprint].bonus > shot.defense;
    continuation(m, 'shot-complete', {index: p.index}, side);
    if (shot.hit && members(m, other(shot.side)).includes(shot.target)) {
      continuation(m, 'hit', {index: p.index}, side);
      openWindow(m, 'response', other(side), {kind: 'about-to-hit', target: shot.target, weapon: shot.weapon});
    }
  } else if (kind === 'battle:hit') {
    const shot = b.shots[p.index!];
    if (members(m, other(shot.side)).includes(shot.target)) {
      if (!b.hits.includes(shot.target)) b.hits.push(shot.target);
      openWindow(m, 'response', other(side), {kind: 'hit', target: shot.target, weapon: shot.weapon});
    }
  } else if (kind === 'battle:shot-complete') {
    const shot = b.shots[p.index!];
    openWindow(m, 'response', other(side), {kind: 'weapon-fired', weapon: shot.weapon, target: shot.target, hit: shot.hit});
  } else if (kind === 'battle:forfeit') {
    forfeitCard(m, p.card!, side);
  } else if (kind === 'battle:forfeit-result') {
    openWindow(m, 'response', other(side), {kind: 'forfeited', card: p.card!, site: b.site});
  } else if (kind === 'battle:premature-loss-result') {
    openWindow(m, 'response', other(side), {kind: 'cards-lost', cards: p.cards!});
  } else if (kind === 'battle:rescue') b.hits = b.hits.filter(id => id !== p.target);
  else if (kind === 'battle:lose') {
    const id = p.card ?? m.players[side][p.from as 'reserve' | 'force' | 'used'][0];
    moveCard(m, id, 'lost'); if (b.damageLedger) b.damageLedger[side].paid++; else b.damage[side] = Math.max(0, b.damage[side] - 1); syncBattleDamage(m);
    openWindow(m, 'response', other(side), {kind: 'force-lost', card: id, side, source: 'battle'});
  } else throw Error('Unknown battle effect: ' + kind);
}
export function battleChoices() {return [{id: 'draw-destiny', label: 'Draw battle destiny'}, {id: 'skip-destiny', label: 'Draw no battle destiny'}];}
export function battleChoose(m: Match, decision: Decision, choice: string): void {
  const b = battle(m)!, side = decision.side;
  if (choice === 'skip-destiny') {continuation(m, 'destiny-next', {side}); return;}
  const card = moveTop(m, side, 'reserve', 'destiny'); b.destiny[side] = printed(m, card, 'destiny'); b.destinyCards[side] = card;
  continuation(m, 'destiny-finish', {side, card}); openWindow(m, 'response', other(side), {kind: 'battle-destiny-drawn', card, side});
}
export function battleView(m: Match): Json {
  const b = battle(m);
  // Only public battle information; neither continuations nor hidden pile IDs.
  return {battle: b ? {...structuredClone(b), damage: pair(battleDamage(m, 'dark'), battleDamage(m, 'light'))} as unknown as Json : null};
}
export function assertBattle(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'battle:equip') {const p = data(f); assertAttachmentAttempt(m, p.attachment!, p.card!, p.target!);}
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'battle:destiny-finish') {
    const p = data(f);
    if (!sides.includes(p.side!) || m.cards[p.card!]?.owner !== p.side || p.redraw !== undefined && typeof p.redraw !== 'boolean') throw Error('Invalid battle destiny continuation.');
  }
  const history = m.data.battles as History | undefined;
  if (history && (!Number.isSafeInteger(history.turn) || history.turn < 1 || history.turn > m.turn.number || new Set(history.sites).size !== history.sites.length || new Set(history.participants).size !== history.participants.length || history.participants.some(id => !m.cards[id]))) throw Error('Invalid battle history.');
  const b = battle(m); if (!b) return;
  if (b.knockedWeapons && (new Set(b.knockedWeapons).size !== b.knockedWeapons.length || b.knockedWeapons.some(id => !m.cards[id] || cardDefinition(m, id).type !== 'Weapon'))) throw Error('Invalid knocked-away weapons.');
  if (b.damageLedger) for (const side of sides) {
    assertLedger(b.damageLedger[side]);
    if (b.damageLedger[side].kind !== 'battle' || b.damageLedger[side].increase !== (side === 'light' ? b.worseIncrease ?? 0 : 0) || (b.damageLedger[side].reduction > 0) !== b.reduced[side]) throw Error('Invalid battle loss ledger.');
  }
  if (b.worseIncrease !== undefined && (!Number.isSafeInteger(b.worseIncrease) || b.worseIncrease <= 0)) throw Error('Invalid battle loss increase.');
  if (b.departed && (new Set(b.departed).size !== b.departed.length || b.departed.some(id => !sides.some(side => b.participants[side].includes(id))))) throw Error('Invalid departed battle participant.');
  if (b.runLuke !== undefined && typeof b.runLuke !== 'boolean') throw Error('Invalid Run Luke modifier.');
  if (!m.cards[b.site] || !sides.includes(b.initiator) || !['begin', 'weapons', 'power', 'damage', 'end', 'complete'].includes(b.stage)) throw Error('Invalid battle.');
  for (const side of sides) {
    if (new Set(b.participants[side]).size !== b.participants[side].length || b.participants[side].some(id => m.cards[id]?.owner !== side)) throw Error('Invalid battle participants.');
    for (const values of [b.power, b.attrition, b.damage, b.initialAttrition, b.initialDamage]) if (!Number.isFinite(values[side]) || values[side] < 0) throw Error('Invalid battle totals.');
    const drawing = m.stack.some(f => f.kind === 'resolution' && f.action.handler === 'battle:destiny-finish' && data(f).side === side);
    if (b.destiny[side] !== null && (!Number.isFinite(b.destiny[side]) || b.destiny[side]! < 0 && !drawing)) throw Error('Invalid battle destiny.');
    if (b.destinyCards[side] !== null && m.cards[b.destinyCards[side]!]?.owner !== side) throw Error('Invalid destiny owner.');
  }
  for (const shot of b.shots) if (!weapons[m.cards[shot.weapon]?.blueprint] || !m.cards[shot.target] || !sides.includes(shot.side) ||
    shot.card !== null && m.cards[shot.card]?.owner !== shot.side || shot.destiny !== null && !Number.isFinite(shot.destiny) ||
    shot.total !== undefined && shot.total !== null && (!Number.isFinite(shot.total) || shot.total < 0) ||
    shot.hit !== null && typeof shot.hit !== 'boolean') throw Error('Invalid weapon destiny.');
  for (const ids of [b.hits, b.fired]) if (new Set(ids).size !== ids.length || ids.some(id => !m.cards[id])) throw Error('Invalid weapon usage.');
}
