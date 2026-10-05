import {beginBesieged,endBesieged} from './besieged';
import {besiegedParticipant,type BesiegedBattle} from './captured-ship-state';
import {mayBattleForFree} from './battle-plan';
import {battlePowerBonus,assertBattlePower,type BattlePowerModifier} from './battle-power';
import {forceLossCredit} from './droid-service';
import {otsdClearsAttrition} from './otsd-characters';
import type {DroidBoost} from './power-droid';
import {unitsAt,characterPresent,occupants,belowDecks} from './occupancy';
import {sunsdownAt} from './nighttime';
import {battleMembers as members,battleProhibited} from './participation';
export {battleMembers as members,battleProhibited} from './participation';
import {defenseValue} from './defense';
import {restoreWeaponForfeit} from './forfeit';
import {beginForfeiture} from './forfeiture';
import type {StarshipShot} from './starship-weapons';
import type {LightsaberShot} from './lightsabers';
import {immuneToAttrition,battleDestinyBonus,currentBattleDestiny} from './combat-modifiers';
import {deployed} from './deployment';
import {locationAbility} from './location-ability';
import {tradedPower, type AbilityTrade} from './battle-effects';
import {ability} from './ability';
import {battleDrawPolicy, assertBattleDrawModifiers, type BattleDrawModifier} from './battle-destiny';
import {beginDestinySequence, assertDestinyScope, remainingDestinyDraws, replaceDestinyDraw, type DestinySequence} from './destiny-limits';
import {sameCard, referenceCard, assertCardReference, type CardReference} from './identity';
import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import type {GaderffiiShot} from './gaderffii';
import {assertLedger, lossLedger, lossRemaining, type LossLedger} from './loss';
import {atSite, cardDefinition, forfeit, isWarrior, name, printed, totalPower, weaponDrawBonus} from './board';
export {weaponDrawBonus} from './board';
import {reactionActions} from './ground';
import {openWindow, type RequiredAction} from './runtime';
import {moveCard} from './state';
import {drawDestiny, validDraw, assertDrawFlow, type DrawFlow, completeDestinyDraw, completeDestinyTotal, pendingWeaponTotal, type Draw, type Substitution} from './destiny';
import {loseFromTable} from './table';
import {canUseWeapon, useWeapon} from './weapon-state';
import {other, sides, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type DestinyPlan = {remaining: number; draws: Draw[]; selection: {x: number; y: number} | null};
type Pair<T> = Record<Side, T>;
type Shot = {host?: string; weapon: string; target: string; side: Side; defense: number; bonus: number; card: string | null; destiny: number | null; hit: boolean | null; total?: number | null; substitution?: Substitution};
export type Battle = {
  besieged?: BesiegedBattle;
  site: string; initiator: Side; stage: 'begin' | 'weapons' | 'power' | 'damage' | 'end' | 'complete';
  participants: Pair<string[]>; hits: string[]; fired: string[]; users: Record<string, string>; shots: Shot[];
  destiny: Pair<number | null>; destinyCards: Pair<string | null>; power: Pair<number>;
  powerDestinies?: Partial<Pair<{count:number;remaining:number;draws:Draw[];total:number|null;scope:string}>>;
  destinyDraws?: Pair<Draw | null>;
  /** Final selected draws, before total modifiers. Physical attempts, canceled
   * draws and discarded selection candidates must not count for Takeel. */
  destinyResults?: Pair<{draws: Draw[]; total: number | null} | null>;
  destinySwitched?: boolean;
  destinyPlans?: Pair<DestinyPlan | null>;
  destinyScopes?: Partial<Pair<string>>;
  drawModifiers?: BattleDrawModifier[];
  powerModifiers?: BattlePowerModifier[];
  abilityTrades?: AbilityTrade[];
  gamblersLuck?: {card: string; side: Side; amount: 1 | 2};
  attrition: Pair<number>; damage: Pair<number>; initialAttrition: Pair<number>; initialDamage: Pair<number>;
  reduced: Pair<boolean>; totalsReady: boolean; premature: boolean; cancelled?: boolean; runLuke?: boolean;
  departed?: string[];
  attritionProtected?: CardReference[];
  characterDestinyUses?: CardReference[];
  obiWanUses?: CardReference[];
  powerDroidUses?: string[];
  powerDroidBoosts?: DroidBoost[];
  worseIncrease?: number; damageLedger?: Pair<LossLedger>;
  damageMultipliers?: {card: string; factor: number; side: Side | 'both'}[];
  knockedWeapons?: string[]; gaffiShots?: GaderffiiShot[]; saberShots?: LightsaberShot[]; starshipShots?: StarshipShot[];
};
type History = {turn: number; sites: string[]; participants: string[]};
type Payload = {continuousBattleBonus?:number; reference?:CardReference; flow?: DrawFlow; draws?: Draw[]; attachment?: AttachmentAttempt; site?: string; card?: string; cards?: string[]; target?: string; side?: Side; step?: string; index?: number; amount?: number; from?: string; value?: number; redraw?: boolean; draw?: Draw; total?: number | null};
const pair = <T>(dark: T, light: T): Pair<T> => ({dark, light});
function completedBattleDraws(b: Battle, side: Side): Draw[] {
  // Older saved battles predate the finalized record. Their plan contains all
  // selected draws; the single-draw path retains its final total and card.
  return (b.destinyResults?.[side]?.draws ?? b.destinyPlans?.[side]?.draws ??
    (b.destiny[side] === null ? [] : [{card: b.destinyCards[side], value: b.destiny[side]}])).filter(d => d.value !== null);
}
function recordBattleDestiny(b: Battle, side: Side, draws: Draw[], total: number | null): void {
  (b.destinyResults ??= pair(null, null))[side] = {draws: structuredClone(draws), total};
  b.destiny[side] = total;
}
export const battle = (m: Match) => m.data.battle as Battle | undefined;
/** One shared physical-draw allowance per side for this battle. */
export function battleDestinyScope(m: Match, side: Side): string {
  const b = battle(m);
  if (!b || b.stage === 'complete') throw Error('No active battle destiny scope.');
  return (b.destinyScopes ??= {})[side] ??= beginDestinySequence(m, side, b.site, 'battle');
}
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
export const participatingAbility = (m: Match, side: Side) => members(m, side).reduce((n, id) => n + ability(m, id), 0);
export function syncBattle(m: Match): void {
  const b = battle(m); if (!b || b.stage === 'complete') return;
  // Departure ends this participation and clears its hit. A new table instance
  // can join before power, but never afterward (including Old Ben in damage).
  const departed = b.departed ??= [];
  for (const id of sides.flatMap(side => b.participants[side]))
    if (!departed.includes(id) && (b.besieged&&!besiegedParticipant(m,id) || m.cards[id]?.zone !== 'table' || m.cards[id].location !== b.site || battleProhibited(m, id))) departed.push(id);
  b.hits = b.hits.filter(id => !departed.includes(id));
  syncBattleDamage(m);
  if (b.besieged || !['begin', 'weapons'].includes(b.stage)) return;
  const history = battleHistory(m);
  for (const c of unitsAt(m, b.site)) if (!battleProhibited(m, c.id) && !history.participants.includes(c.id)) {
    // leaveTable expires the old instance's turn history. Merely moving away
    // does not, so returning the same instance cannot bypass that restriction.
    if (!b.participants[c.owner].includes(c.id)) b.participants[c.owner].push(c.id);
    b.departed = b.departed?.filter(id => id !== c.id);
    history.participants.push(c.id);
  }
  m.data.battles = history as unknown as Json;
}
const eligibleAt = (m: Match, side: Side, site: string) => unitsAt(m, site).filter(c => c.owner === side && !battleProhibited(m, c.id) && !battleHistory(m).participants.includes(c.id));
export function battleDamage(m: Match, side: Side): number {
  const b = battle(m)!;
  return b.damageLedger && ['power','damage'].includes(b.stage) && !b.premature ? lossRemaining(m, side, b.damageLedger[side]) : b.damage[side];
}
export function syncBattleDamage(m: Match): void {
  const b = battle(m); if (b) for (const side of sides) b.damage[side] = battleDamage(m, side);
}
// AR pp56–57: pending means greater than zero. Battle loss is an action that
// loses exactly one Force, unlike a card effect that instructs 'lose X Force'.
// Keep fractional damage/attrition and fractional forfeiture credits intact.
export function damagePending(m: Match, side: Side): boolean {
  const b = battle(m)!;
  return battleDamage(m, side) > 0 || members(m, side).some(id => b.hits.includes(id) || b.attrition[side] > 0 && !b.attritionProtected?.some(ref=>ref.id===id && sameCard(m,ref)));
}
export function battleCanPass(m: Match, w: Window, side: Side): boolean {
  return event(w) !== 'battle-damage' || !damagePending(m, side);
}

export const weapons: Record<string, {deploy: number; fire: number; bonus: number}> = {
  '1_152': {deploy: 1, fire: 1, bonus: 0}, '1_317': {deploy: 1, fire: 1, bonus: 0},
  '1_153': {deploy: 2, fire: 2, bonus: 1}, '1_312': {deploy: 2, fire: 2, bonus: 1},
};
const warrior = isWarrior;
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
      if (!battleHistory(m).sites.includes(name(m, site)) && sides.every(s => locationAbility(m, s, site, eligibleAt(m, s, site).reduce((n,c) => n + ability(m,c.id),0)) >= 1))
        {const free=mayBattleForFree(m,side,site);actions.push(act('battle:' + site, 'Battle at ' + name(m, site)+(free?' · use 1 Force':''), 'begin', {site}, {[side]: 1}));
         if(free)actions.push(act('battle-free:'+site,'Battle at '+name(m,site)+' · free','begin',{site}));}
    }
  }
  if (w.timing !== 'response' || !b || b.stage === 'complete') return actions;
  const parent = m.stack.at(-2);
  if (parent?.kind === 'resolution' && parent.action.handler === 'battle:begin' && !b.besieged && !parent.cancelled && side !== b.initiator)
    actions.push(...reactionActions(m, b.site, side, id => !battleHistory(m).participants.includes(id)));
  if (event(w) === 'battle-weapons') {
    for (const weapon of Object.values(m.cards)) {
      const rule = weapons[weapon.blueprint], host = weapon.attachedTo;
      if (!rule || weapon.owner !== side || weapon.zone !== 'table' || !host || !members(m, side).includes(host) || !characterPresent(m,host) || !warrior(m, host) || b.fired.includes(weapon.id) || !canUseWeapon(m, weapon.id)) continue;
      for (const target of members(m, other(side)).filter(id=>characterPresent(m,id)||cardDefinition(m,id).type==='Vehicle'&&!belowDecks(m,id))) actions.push(act('fire:' + weapon.id + ':' + target, 'Fire ' + name(m, weapon.id) + ' at ' + name(m, target), 'fire', {card: weapon.id, target}, {[side]: rule.fire}, weapon.id));
    }
  }
  if (event(w) === 'battle-destiny-complete' && sides.every(s => b.destiny[s] !== null && completedBattleDraws(b, s).length === 1)) {
    for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === '1_269')) actions.push(act('takeel:' + card, 'Play Takeel · switch battle destiny', 'takeel', {card}, {[side]: 1}, card));
  }
  if (event(w) === 'battle-damage') {
    for (const id of members(m, side)) {
      if (battleDamage(m, side) > 0 || b.attrition[side] > 0 || b.hits.includes(id)) actions.push(act('forfeit:' + id, 'Forfeit ' + name(m, id) + ' · ' + forfeit(m, id) + (otsdClearsAttrition(m,id)?' · clears remaining attrition':'') + (occupants(m,id).length?' · also loses '+occupants(m,id).length+' aboard':''), 'forfeit', {card: id}));
      if (m.cards[id].blueprint === '1_31') for (const target of members(m, side).filter(t => t !== id && b.hits.includes(t))) actions.push(act('rescue:' + id + ':' + target, 'Forfeit Talz · restore ' + name(m, target), 'rescue', {card: id, target}));
    }
    if (battleDamage(m, side) > 0) {
      for (const pile of ['reserve', 'force', 'used'] as const) if (m.players[side][pile].length) actions.push(act('battle-lose:' + pile, 'Lose one Force from ' + pile, 'lose', {from: pile}));
      for (const card of m.players[side].hand) actions.push(act('battle-lose-hand:' + card, 'Lose ' + name(m, card) + ' from hand' + (forceLossCredit(m,card)!==1?' · satisfies up to '+forceLossCredit(m,card)+' battle damage':''), 'lose', {card}));
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
    if ('besieged' in p) beginBesieged(m,b,(p as unknown as {besieged:Parameters<typeof beginBesieged>[2]}).besieged);
    else {const history = battleHistory(m); history.sites.push(name(m, p.site!)); m.data.battles = history as unknown as Json; syncBattle(m);}
  } else if (kind === 'battle:equip' && m.cards[p.card!].zone === 'hand' || ['battle:takeel', 'battle:reduce'].includes(kind)) moveCard(m, p.card!, 'playing');
  else if (kind === 'battle:fire') {
    const b = battle(m)!, id = p.card!, host = m.cards[id].attachedTo!;
    useWeapon(m, id);
    b.fired.push(id); b.users[host] = id;
    b.shots.push({host: m.cards[id].attachedTo!, weapon: id, target: p.target!, side: r.actor, defense: defenseValue(m, p.target!), bonus: weaponBonus(m, id), card: null, destiny: null, hit: null});
    p.index = b.shots.length - 1;
  } else if (kind === 'battle:rescue') {
    // Talz's forfeiture is the cost; the restoration follows its loss responses.
    forfeitCard(m, p.card!, r.actor);
  }
  if (kind === 'battle:reduce') {
    // It Could Be Worse responds to this player's pending loss; it does not
    // replace their damage-segment action. The UI combines that response and
    // the loss choices in one window, so restore its underlying action turn.
    // Nested payment/play/cancellation responses still alternate normally.
    const window = m.stack.at(-2);
    if (window?.kind !== 'window' || event(window) !== 'battle-damage') throw Error('Battle reduction has no pending loss opportunity.');
    window.priority = r.actor;
  }
  if (kind === 'battle:equip') p.attachment = attachmentAttempt(m, p.card!, p.target!);
}

function forfeitCard(m: Match, id: string, side: Side): void {
  const b = battle(m)!, value = forfeit(m, id);
  if (b.damageLedger) b.damageLedger[side].paid += value; else b.damage[side] = Math.max(0, b.damage[side] - value); syncBattleDamage(m); b.attrition[side] = otsdClearsAttrition(m,id)?0:Math.max(0, b.attrition[side] - value);
  beginForfeiture(m,id,side,b.site);
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
  if (m.stack.some(f => f.kind === 'resolution' && f.action.handler === 'battle:begin' && f.cancelled)) return [];
  // Only after the current action resolves: never abandon its costs, destiny or
  // pending choices. Presence loss during damage does not terminate the battle.
  if (!b || !['begin', 'weapons', 'power'].includes(b.stage) || m.stack.some(f => f.kind === 'resolution' && !['battle:begin', 'battle:power', 'battle:totals', 'battle:destiny-next', 'battle:destiny-select', 'battle:damage', 'battle:power-destiny-next', 'battle:power-destiny-select'].includes(f.action.handler))) return [];
  if (sides.every(s => locationAbility(m, s, b.site, participatingAbility(m, s)) >= 1)) return [];
  return [{...act('battle-premature-end', 'End battle: presence removed', 'premature'), actor: b.initiator}];
}
export function battleResolve(m: Match, r: Resolution): void {
  const p = data(r), side = r.actor, b = battle(m), kind = r.action.handler;
  if (kind === 'battle:destiny-finish') {
    if (p.flow) {
      const f = p.flow, original = b!.destinyDraws![f.side]!;
      if (p.redraw && !original.substitution) {
        if (f.reference && sameCard(m, f.reference)) moveCard(m, f.reference.id, 'used');
        if (original.card) replaceDestinyDraw(m, f.scope);
        drawDestiny(m, f.side, f.source, f.category, f.next, false, f.modifier, f.drawn, f.retain, f.scope);
      } else {
        const value = original.substitution?.value ?? (r.cancelled ? null : currentBattleDestiny(m,f.side,p.continuousBattleBonus));
        b!.destiny[f.side] = value === null ? null : Math.max(0, value);
        completeDestinyDraw(m, f.side, f.source, f.category, {...original, value: b!.destiny[f.side]}, f.next, false, f.retain, f.retain ? f.reference : undefined, f.scope);
      }
      return;
    }
    if (p.redraw) {
      if (p.card) replaceDestinyDraw(m, b!.destinyScopes?.[p.side!]);
      if (p.card && m.cards[p.card].zone === 'destiny') moveCard(m, p.card, 'used');
      if (m.players[p.side!].reserve.length) {battleChoose(m, {kind: 'decision', side: p.side!, handler: 'battle:destiny', payload: null}, 'draw-destiny'); return;}
      b!.destiny[p.side!] = null; b!.destinyCards[p.side!] = null;
      windowThen(m, 'destiny-next', 'battle-destiny-player-complete', other(p.side!), {side: p.side});
    } else {
      const value = currentBattleDestiny(m,p.side!,p.continuousBattleBonus);
      const substitution = b!.destinyDraws?.[p.side!]?.substitution;
      b!.destiny[p.side!] = substitution?.value ?? (r.cancelled || value === null ? null : Math.max(0, value));
      completeDestinyDraw(m, p.side!, b!.site, 'battle', {card: p.card ?? null, value: b!.destiny[p.side!], ...(substitution ? {substitution} : {})},
        act('battle-destiny-result', 'Complete battle destiny', 'destiny-result', {side: p.side}));
    }
    return;
  }
  if (kind === 'battle:shot-finish') {
    const shot = b!.shots[p.index!];
    if (p.redraw && !shot.substitution) {
      const f=p.flow;
      // Before weapon adapters retained DrawFlow, the sequence was still saved.
      // An ordinary weapon fires once in a battle; its newest matching sequence
      // is that shot. Reuse its limit/count rather than inventing a fresh draw.
      const legacyScope = !f ? Object.entries((m.data.destinySequences??{}) as Record<string,DestinySequence>)
        .filter(([,s])=>s.side===side&&s.source===shot.weapon&&s.category==='weapon')
        .sort(([a],[z])=>Number(z.slice('destiny-sequence:'.length))-Number(a.slice('destiny-sequence:'.length)))[0]?.[0] : undefined;
      const scope=f?.scope??legacyScope;
      if (shot.card && (f?.reference ? sameCard(m,f.reference) : m.cards[shot.card].zone==='destiny')) moveCard(m,shot.card,'used');
      if (shot.card) replaceDestinyDraw(m,scope);
      const drawn=act('weapon-drawn','Reveal weapon destiny','weapon-drawn',{index:p.index});
      drawDestiny(m,side,shot.weapon,'weapon',drawn,false,f?.modifier??{weapon:shot.weapon},drawn,false,scope);
      return;
    }
    completeDestinyDraw(m, side, shot.weapon, 'weapon', {card: shot.card, value: shot.substitution?.value ?? (r.cancelled ? null : shot.destiny), ...(shot.substitution ? {substitution: shot.substitution} : {})},
      act('shot-total', 'Total weapon destiny', 'shot-total', {index: p.index}), false);
    return;
  }
  if (r.cancelled) {
    if (['battle:takeel', 'battle:reduce'].includes(kind) && m.cards[p.card!].zone === 'playing') moveCard(m, p.card!, 'lost');
    if (kind === 'battle:begin') {
      // Cancellation preserves participation/cost history but does not emit
      // normal end-of-battle response windows (GEMP BattleEffect steps 8–9).
      endBesieged(m,b!); b!.cancelled = true; b!.premature = true; b!.stage = 'complete';
      b!.damage = pair(0, 0); b!.attrition = pair(0, 0);
    }
    return;
  }
  if (kind === 'battle:equip') {
    const c = m.cards[p.card!], host = m.cards[p.target!];
    if (!validAttachmentAttempt(m, p.attachment!) || host.zone !== 'table' || host.owner !== side || !warrior(m, host.id)) {if (c.zone === 'playing') moveCard(m, c.id, 'lost'); return;}
    if (c.zone === 'playing') moveCard(m, c.id, 'table'); c.attachedTo = host.id; c.location = host.location;
    if (p.attachment!.transfer) openWindow(m, 'response', other(side), {kind: 'weapon-transferred', card: c.id});
    else deployed(m, c.id); return;
  }
  if (!b) throw Error('Missing battle.');
  if (kind === 'battle:premature') {
    // Remove only this battle's continuation/windows, leaving its phase below.
    const base = m.stack.findIndex(f => f.kind === 'resolution' && f.action.handler.startsWith('battle:'));
    if (base < 0) throw Error('Missing battle continuation.'); m.stack.splice(base); beginEnd(m, true); return;
  }
  if (kind === 'battle:begin') {b.stage = 'weapons'; windowThen(m, 'power', 'battle-weapons', b.initiator);}
  else if (kind === 'battle:power') {b.stage = 'power'; continuation(m,'power-destiny-select',{side:b.initiator});}
  else if(kind==='battle:power-destiny-select'){
    const side=p.side!,count=sunsdownAt(m,b.site)?1:0;
    if(!count){continuation(m,'power-destiny-next',{side});return;}
    const scope=beginDestinySequence(m,side,b.site,'power');
    (b.powerDestinies??={})[side]={count,remaining:count-1,draws:[],total:null,scope};
    drawDestiny(m,side,b.site,'power',act('power-destiny-drawn','Resolve power destiny','power-destiny-drawn',{side}),false,0,undefined,false,scope);
  }else if(kind==='battle:power-destiny-drawn'){
    const plan=b.powerDestinies![p.side!]!;plan.draws.push(p.draw!);
    completeDestinyTotal(m,p.side!,b.site,'power',plan.draws,act('power-destiny-result','Complete power destiny','power-destiny-result',{side:p.side}));
  }else if(kind==='battle:power-destiny-result'){
    b.powerDestinies![p.side!]!.total=p.total!;
    windowThen(m,'power-destiny-next','power-destiny-player-complete',other(p.side!),{side:p.side});
  }else if(kind==='battle:power-destiny-next'){
    if(p.side===b.initiator)continuation(m,'power-destiny-select',{side:other(p.side)});
    else windowThen(m,'destiny-select','battle-destiny-before',b.initiator,{side:b.initiator});
  }
  else if (kind === 'battle:destiny-select') {
    const policy = battleDrawPolicy(m, p.side!);
    const extra = b.gamblersLuck && b.gamblersLuck.side === p.side ? b.gamblersLuck.amount : 0;
    const scope = battleDestinyScope(m, p.side!);
    const count = policy.count;
    if ((extra || count > 1 || policy.minimum) && count && m.players[p.side!].reserve.length) (b.destinyPlans ??= pair(null, null))[p.side!] = {remaining: count, draws: [], selection: extra ? {x: extra + 1, y: extra} : null};
    if (count && m.players[p.side!].reserve.length && remainingDestinyDraws(m, scope) > 0)
      m.stack.push({kind: 'decision', side: p.side!, handler: 'battle:destiny', payload: null});
    else continuation(m, 'destiny-next', {side: p.side});
  } else if (kind === 'battle:plan-draw' || kind === 'battle:plan-batch') {
    b.destinyPlans![side]!.draws.push(...(p.draws ?? [p.draw!]));
    continueDestinyPlan(m, side);
  } else if (kind === 'battle:plan-result') {
    recordBattleDestiny(b, side, p.draws!, p.total!);
    windowThen(m, 'destiny-next', 'battle-destiny-player-complete', other(side), {side});
  } else if (kind === 'battle:destiny-result') {
    recordBattleDestiny(b, p.side!, p.draws ?? [p.draw!], p.draw!.value);
    windowThen(m, 'destiny-next', 'battle-destiny-player-complete', other(p.side!), {side: p.side});
  } else if (kind === 'battle:destiny-next') {
    if (p.side === b.initiator) windowThen(m, 'destiny-select', 'battle-destiny-before', other(p.side), {side: other(p.side)});
    else windowThen(m, 'power-actions', 'battle-destiny-complete', other(b.initiator));
  } else if (kind === 'battle:power-actions') windowThen(m, 'totals', 'battle-power', b.initiator);
  else if (kind === 'battle:totals') {
    for (const s of sides) {const ids = members(m, s); b.power[s] = totalPower(m, s, b.site, s !== b.initiator, id => ids.includes(id)) + (b.destiny[s] ?? 0) + (b.powerDestinies?.[s]?.total ?? 0) + tradedPower(m,s) + battlePowerBonus(m,s); b.attrition[s] = b.destiny[other(s)] ?? 0;}
    for (const s of sides) b.damage[s] = Math.max(0, b.power[other(s)] - b.power[s]);
    b.damageLedger = pair(lossLedger(b.damage.dark, 'battle'), lossLedger(b.damage.light, 'battle'));
    for (const s of sides) b.damageLedger[s].multiplier = (b.damageMultipliers ?? []).filter(v => v.side === 'both' || v.side === s).reduce((n, v) => n * v.factor, 1);
    syncBattleDamage(m);
    b.initialAttrition = {...b.attrition}; b.initialDamage = {...b.damage}; b.totalsReady = true;
    windowThen(m, 'damage', 'battle-result', other(b.initiator));
  } else if (kind === 'battle:damage') {
    b.stage = 'damage';
    b.attritionProtected = sides.flatMap(side=>members(m,side).filter(id=>immuneToAttrition(m,id,b.attrition[side])).map(id=>referenceCard(m,id)));
    windowThen(m, 'end', 'battle-damage', b.initiator);
  }
  else if (kind === 'battle:end') beginEnd(m);
  else if (kind === 'battle:ended') {endBesieged(m,b); b.stage = 'complete'; openWindow(m, 'response', other(b.initiator), {kind: 'battle-ended'});}
  else if (kind === 'battle:takeel') {
    // Individual modifiers travel with the number; resolved total modifiers
    // stay with their original player (AR, Takeel). Keep physical ownership.
    const adjustment = (s: Side) => {
      const result = b.destinyResults?.[s];
      return result && result.total !== null ? result.total - result.draws.reduce((n,d) => n + (d.value ?? 0), 0) : 0;
    };
    if (!b.destinySwitched) {
      const dark = adjustment('dark'), light = adjustment('light');
      [b.destiny.dark, b.destiny.light] = [Math.max(0, b.destiny.light! - light + dark), Math.max(0, b.destiny.dark! - dark + light)];
      // GEMP retains this battle-long switch; another Takeel does not undo it.
      b.destinySwitched = true;
    }
    moveCard(m, p.card!, 'lost');
  }
  else if (kind === 'battle:reduce') {if (!b.reduced[side]) {if (b.damageLedger) b.damageLedger[side].reduction = p.amount!; else b.damage[side] = Math.max(0, b.damage[side] - p.amount!); b.reduced[side] = true; syncBattleDamage(m);} moveCard(m, p.card!, 'used');}
  else if (kind === 'battle:fire') {
    const shot = b.shots[p.index!];
    const drawn = act('weapon-drawn', 'Reveal weapon destiny', 'weapon-drawn', {index: p.index});
    drawDestiny(m, side, shot.weapon, 'weapon', drawn, false, {weapon: shot.weapon}, drawn);
  } else if (kind === 'battle:weapon-drawn') {
    const shot = b.shots[p.index!];
    shot.card = p.draw!.card; shot.destiny = p.draw!.value;
    if (p.draw!.substitution) shot.substitution = p.draw!.substitution;
    continuation(m, 'shot-finish', {index: p.index, ...(p.flow ? {flow:p.flow} : {})}, side);
    if (!p.draw!.skipped) openWindow(m, 'response', other(side), {kind: shot.destiny !== null ? 'weapon-destiny-drawn' : 'weapon-destiny-failed', card: shot.card, value: shot.destiny, ...(shot.substitution ? {substituted: true} : {})});
  } else if (kind === 'battle:drawn' || kind === 'battle:planned-drawn') {
    const bonus=p.draw!.value!==null&&!p.draw!.substitution?battleDestinyBonus(m,side):undefined;
    b.destiny[side] = p.draw!.value===null?null:p.draw!.value+(bonus??0); b.destinyCards[side] = p.draw!.card;
    (b.destinyDraws ??= pair(null, null))[side] = structuredClone(p.draw!);
    continuation(m, 'destiny-finish', {side, ...(bonus===undefined?{}:{continuousBattleBonus:bonus}), ...(p.flow ? {flow: p.flow} : {}), ...(p.draw!.card ? {card: p.draw!.card,reference:referenceCard(m,p.draw!.card)} : {})}, side);
    if (!p.draw!.skipped) openWindow(m, 'response', other(side), {kind: p.draw!.value !== null ? 'battle-destiny-drawn' : 'battle-destiny-failed', card: p.draw!.card, side, ...(p.draw!.substitution ? {substituted: true, value: p.draw!.value} : {})});
  } else if (kind === 'battle:shot-total') {
    const shot = b.shots[p.index!]; shot.destiny = p.draw!.value;
    completeDestinyTotal(m, side, shot.weapon, 'weapon', [p.draw!], act('shot-result', 'Resolve weapon result', 'shot-result', {index: p.index}));
  } else if (kind === 'battle:shot-result') {
    const shot = b.shots[p.index!]; shot.total = p.total!;
    shot.defense = defenseValue(m, shot.target);
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
    openWindow(m, 'response', other(side), {kind: 'forfeited', card: p.card!, cardRef: referenceCard(m,p.card!), site: b.site});
  } else if (kind === 'battle:premature-loss-result') {
    openWindow(m, 'response', other(side), {kind: 'cards-lost', cards: p.cards!});
  } else if (kind === 'battle:rescue') {b.hits = b.hits.filter(id => id !== p.target); restoreWeaponForfeit(m,p.target!);}
  else if (kind === 'battle:lose') {
    const id = p.card ?? m.players[side][p.from as 'reserve' | 'force' | 'used'][0];
    const credit = forceLossCredit(m,id);
    moveCard(m, id, 'lost'); if (b.damageLedger) b.damageLedger[side].paid += credit; else b.damage[side] = Math.max(0, b.damage[side] - credit); syncBattleDamage(m);
    openWindow(m, 'response', other(side), {kind: 'force-lost', card: id, side, source: 'battle'});
  } else throw Error('Unknown battle effect: ' + kind);
}
export function battleChoices(m?: Match, decision?: Decision) {const count = m && decision ? battle(m)?.destinyPlans?.[decision.side]?.remaining ?? 1 : 1; return [{id: 'draw-destiny', label: count > 1 ? 'Draw all ' + count + ' battle destinies' : 'Draw battle destiny'}, {id: 'skip-destiny', label: 'Draw no battle destiny'}];}
export function battleChoose(m: Match, decision: Decision, choice: string): void {
  const b = battle(m)!, side = decision.side;
  if (choice === 'skip-destiny') {if (b.destinyPlans?.[side]) {b.destinyPlans[side]!.remaining = 0; b.destinyPlans[side]!.selection = null;} continuation(m, 'destiny-next', {side}); return;}
  if (b.destinyPlans?.[side]) {continueDestinyPlan(m, side); return;}
  const drawn = act('battle-drawn', 'Reveal battle destiny', 'drawn', {side});
  drawDestiny(m, side, b.site, 'battle', drawn, true, 0, drawn, false, battleDestinyScope(m, side));
}
function continueDestinyPlan(m: Match, side: Side): void {
  const b = battle(m)!, plan = b.destinyPlans![side]!;
  if (!plan.remaining || !m.players[side].reserve.length || remainingDestinyDraws(m, battleDestinyScope(m, side)) === 0) {
    plan.remaining = 0; plan.selection = null;
    completeDestinyTotal(m, side, b.site, 'battle', plan.draws, act('battle-plan-result', 'Total battle destiny', 'plan-result', {side})); return;
  }
  const drawn = act('battle-planned-drawn', 'Reveal battle destiny', 'planned-drawn', {side});
  plan.remaining--;
  drawDestiny(m, side, b.site, 'battle', act('battle-plan-draw', 'Resolve battle destiny', 'plan-draw', {side}), false, 0, drawn, false, battleDestinyScope(m, side));
}
export function battleView(m: Match): Json {
  const b = battle(m);
  // Only public battle information; neither continuations nor hidden pile IDs.
  const projected=b?structuredClone(b):null;
  if(projected)for(const side of sides)projected.destiny[side]=currentBattleDestiny(m,side);
  if(projected?.starshipShots)projected.starshipShots=projected.starshipShots.map(shot=>({...shot,...(shot.outcome==='pending'?pendingWeaponTotal(m,{weapon:shot.weaponRef,target:shot.targetRef}):{})}));
  return {battleDrawPolicy: b && b.stage !== 'complete' ? {dark:battleDrawPolicy(m,'dark'),light:battleDrawPolicy(m,'light')} : null, battle: b ? {...projected, damage: pair(battleDamage(m, 'dark'), battleDamage(m, 'light'))} as unknown as Json : null};
}
export function assertBattle(m: Match): void {
  assertBattleDrawModifiers(m);
  assertBattlePower(m);
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'battle:equip') {const p = data(f); assertAttachmentAttempt(m, p.attachment!, p.card!, p.target!);}
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'battle:destiny-finish') {
    const p = data(f);
    if(p.continuousBattleBonus!==undefined&&(![0,1].includes(p.continuousBattleBonus)||!battle(m)?.destinyDraws?.[p.side!]||battle(m)!.destinyDraws![p.side!]!.value===null||battle(m)!.destinyDraws![p.side!]!.substitution))throw Error('Invalid continuous battle destiny bonus.');
    if(p.reference){assertCardReference(m,p.reference,p.card);if(p.reference.zone!=='destiny')throw Error('Invalid battle draw reference.');}
    if (p.flow) {assertDrawFlow(m, p.flow, battle(m)?.destinyDraws?.[p.side!]!); if (p.flow.side !== p.side || f.actor !== p.side || p.flow.source !== battle(m)?.site || p.flow.category !== 'battle' || p.flow.scope !== battle(m)?.destinyScopes?.[p.side!] || !battle(m)?.destinyPlans?.[p.side!] || (p.flow.retain ? p.flow.next.handler !== 'selection:drawn' : p.flow.next.handler !== 'battle:plan-draw')) throw Error('Invalid battle draw actor.');}
    if (!sides.includes(p.side!) || p.card !== undefined && m.cards[p.card]?.owner !== p.side || p.redraw !== undefined && typeof p.redraw !== 'boolean') throw Error('Invalid battle destiny continuation.');
  }
  for (const f of m.stack) if(f.kind==='resolution' && f.action.handler==='battle:shot-finish') {
    const p=data(f),shot=battle(m)?.shots[p.index!];
    if(!shot||shot.side!==f.actor||p.redraw!==undefined&&typeof p.redraw!=='boolean')throw Error('Invalid weapon destiny continuation.');
    if(p.flow){assertDrawFlow(m,p.flow,{card:shot.card,value:shot.destiny,...(shot.substitution?{substitution:shot.substitution}:{})});if(p.flow.side!==f.actor||p.flow.source!==shot.weapon||p.flow.category!=='weapon'||p.flow.retain||p.flow.includeTotal||p.flow.drawn?.handler!=='battle:weapon-drawn'||(p.flow.drawn.payload as Payload).index!==p.index)throw Error('Invalid weapon destiny flow.');}
  }
  const history = m.data.battles as History | undefined;
  if (history && (!Number.isSafeInteger(history.turn) || history.turn < 1 || history.turn > m.turn.number || new Set(history.sites).size !== history.sites.length || new Set(history.participants).size !== history.participants.length || history.participants.some(id => !m.cards[id]))) throw Error('Invalid battle history.');
  const b = battle(m); if (!b) return;
  if (b.cancelled !== undefined && (typeof b.cancelled !== 'boolean' || b.cancelled && (b.stage !== 'complete' || !b.premature))) throw Error('Invalid canceled battle.');
  if (b.destinySwitched !== undefined && typeof b.destinySwitched !== 'boolean') throw Error('Invalid battle destiny switch.');
  if (b.destinyResults !== undefined) {
    if (!b.destinyResults || Object.keys(b.destinyResults).length !== 2 || !sides.every(s => Object.hasOwn(b.destinyResults!, s))) throw Error('Invalid completed battle destinies.');
    for (const side of sides) {
      const result = b.destinyResults[side]; if (result === null) continue;
      if (!result || !Array.isArray(result.draws) || result.draws.some(d => !validDraw(m,d,side)) ||
        result.total !== null && (!Number.isFinite(result.total) || result.total < 0) ||
        (result.total === null) !== !result.draws.some(d => d.value !== null)) throw Error('Invalid completed battle destinies.');
    }
  }
  if (b.attritionProtected !== undefined) {
    if (!Array.isArray(b.attritionProtected) || new Set(b.attritionProtected.map(r=>r.id)).size !== b.attritionProtected.length) throw Error('Invalid frozen attrition immunity.');
    for (const ref of b.attritionProtected) {assertCardReference(m,ref);if(ref.zone!=='table' || !b.participants[m.cards[ref.id].owner].includes(ref.id))throw Error('Invalid frozen attrition immunity.');}
  }
  if (b.powerDestinies !== undefined && (!b.powerDestinies || typeof b.powerDestinies !== 'object' || Array.isArray(b.powerDestinies) || Object.entries(b.powerDestinies).some(([side, plan]) => !sides.includes(side as Side) || !plan))) throw Error('Invalid power destiny plans.');
  if (b.destinyScopes) {
    if (Object.keys(b.destinyScopes).some(side => !sides.includes(side as Side))) throw Error('Invalid battle destiny scopes.');
    for (const side of sides) assertDestinyScope(m, b.destinyScopes[side], side, b.site, 'battle');
  }
  if (b.gamblersLuck && (m.cards[b.gamblersLuck.card]?.blueprint !== '5_48' || m.cards[b.gamblersLuck.card].owner !== b.gamblersLuck.side || ![1, 2].includes(b.gamblersLuck.amount))) throw Error('Invalid Gambler’s Luck grant.');
  if (b.destinyPlans) for (const side of sides) {
    const plan = b.destinyPlans[side]; if (!plan) continue;
    if (!Number.isSafeInteger(plan.remaining) || plan.remaining < 0 ||
      !Array.isArray(plan.draws) || plan.draws.some(d => !validDraw(m, d, side)) ||
      plan.selection && (!b.gamblersLuck || b.gamblersLuck.side !== side || plan.selection.x !== b.gamblersLuck.amount + 1 || plan.selection.y !== b.gamblersLuck.amount)) throw Error('Invalid battle destiny plan.');
  }

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
    if (new Set(b.participants[side]).size !== b.participants[side].length || b.participants[side].some(id => m.cards[id]?.owner !== side && (!b.departed?.includes(id) || m.cards[id]?.originalOwner !== side))) throw Error('Invalid battle participants.');
    for (const values of [b.power, b.attrition, b.damage, b.initialAttrition, b.initialDamage]) if (!Number.isFinite(values[side]) || values[side] < 0) throw Error('Invalid battle totals.');
    const drawing = m.stack.some(f => f.kind === 'resolution' && f.action.handler === 'battle:destiny-finish' && data(f).side === side);
    if (b.destiny[side] !== null && (!Number.isFinite(b.destiny[side]) || b.destiny[side]! < 0 && !drawing)) throw Error('Invalid battle destiny.');
    if (b.destinyCards[side] !== null && m.cards[b.destinyCards[side]!]?.owner !== side) throw Error('Invalid destiny owner.');
    const powerPlan=b.powerDestinies?.[side];
    if(powerPlan){
      if(typeof powerPlan.scope!=='string'||powerPlan.count!==1||powerPlan.remaining!==0||!Array.isArray(powerPlan.draws)||powerPlan.draws.length>1||powerPlan.draws.some(d=>!validDraw(m,d,side))||powerPlan.total!==null&&(!Number.isFinite(powerPlan.total)||powerPlan.total<0||powerPlan.draws.length!==1))throw Error('Invalid power destiny plan.');
      assertDestinyScope(m,powerPlan.scope,side,b.site,'power');
    }
    if (b.destinyDraws?.[side] && !validDraw(m, b.destinyDraws[side]!, side, true)) throw Error('Invalid battle destiny record.');
  }
  for (const shot of b.shots) if (shot.host!==undefined&&(!m.cards[shot.host]||cardDefinition(m,shot.host).type!=='Character') || !weapons[m.cards[shot.weapon]?.blueprint] || !m.cards[shot.target] || !sides.includes(shot.side) ||
    shot.substitution !== undefined && !validDraw(m, {card: shot.card, value: shot.destiny, substitution: shot.substitution}, shot.side, true) ||
    shot.card !== null && m.cards[shot.card]?.owner !== shot.side || shot.destiny !== null && !Number.isFinite(shot.destiny) ||
    shot.total !== undefined && shot.total !== null && (!Number.isFinite(shot.total) || shot.total < 0) ||
    shot.hit !== null && typeof shot.hit !== 'boolean') throw Error('Invalid weapon destiny.');
  for (const ids of [b.hits, b.fired]) if (new Set(ids).size !== ids.length || ids.some(id => !m.cards[id])) throw Error('Invalid weapon usage.');
}
