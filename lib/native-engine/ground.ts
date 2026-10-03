import {lightsaberDrainBonus} from './lightsabers';
import {deployed} from './deployment';
import {isUnique, canEnterTable} from './persona';
import {assertLedger, lossLedger, lossRemaining, type LossLedger} from './loss';
import {abilityAt, adjacent, atSite, cardDefinition, controls, deploymentPayment, drainAmount, isGuard, moveWithAttachments, name, presence, sitePlacements} from './board';
import {moveCard, moveTop} from './state';
import {openWindow, type RequiredAction} from './runtime';
import {other, sides, type Action, type Decision, type Json, type Match, type Payment, type Resolution, type Side, type Window} from './types';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {nighttimeSites} from './equipment-state';

export type GroundState = {turn: number; moved: string[]; reacted: string[]; drained: string[]; barriers: Record<string, number>; cancelledReactTitles?: string[]};
type Payload = {card?: string; site?: string; from?: string; placement?: string; react?: boolean; via?: string; target?: string; amount?: number; lossIndex?: number; targetRef?: CardReference; cardRef?: CardReference};
export type Loss = {side: Side; remaining: number; source: string; site: string | null; reductionUsed: boolean; worseIncrease?: number; ledger?: LossLedger};
const payload = (action: Action) => action.payload as Payload;
export function usage(m: Match): GroundState {
  const stored = m.data.ground as GroundState | undefined;
  return stored?.turn === m.turn.number ? stored : {turn: m.turn.number, moved: [], reacted: [], drained: [], barriers: {...stored?.barriers}};
}
export function record(m: Match): GroundState {const current = usage(m); m.data.ground = current as unknown as Json; return current;}
export const barred = (m: Match, id: string) => (usage(m).barriers[id] ?? 0) >= m.turn.number;
/** Comlink grants a continuous react permission; it does not use its bearer’s device action. */
export function registerReact(m: Match, id: string): void {const used = record(m).reacted; if (!used.includes(id)) used.push(id);}
export const canDeployAsReact = (m: Match, id: string) => !usage(m).reacted.includes(id) && !usage(m).cancelledReactTitles?.includes(name(m, id));
/** Canceled hand deployment returns its card, never refunds Force, and prevents
 * another non-unique copy of that title deploying as a react this turn (AR p170).
 * Movement keeps its original board position and only locks that physical card. */
export function resolveCancelledReact(m: Match, r: Resolution): boolean {
  const p = payload(r.action);
  if (!r.cancelled || !p?.react) return false;
  const deployment = ['ground:deploy', 'battle:equip', 'equipment:attach', 'equipment:mine', 'gaffi:equip','saber:equip'].includes(r.action.handler);
  if (!deployment && r.action.handler !== 'ground:move') throw Error('Unknown canceled react.');
  const card = m.cards[p.card!];
  registerReact(m, card.id);
  if (deployment) {
    if (!isUnique(m, card.id)) {const titles = record(m).cancelledReactTitles ??= []; if (!titles.includes(name(m, card.id))) titles.push(name(m, card.id));}
    if (card.zone === 'playing') moveCard(m, card.id, 'hand');
  }
  openWindow(m, 'response', other(r.actor), {kind: 'react-cancelled', card: card.id, deployment});
  return true;
}
export function reactionSources(m: Match, site: string, side: Side): string[] {
  return Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location && (c.location === site || adjacent(m, c.location, site)) &&
    (c.blueprint === '1_6' || c.blueprint === '1_201' && !!c.attachedTo)).map(c => c.id);
}
export function pendingReactSite(m: Match, w: Window, side: Side): string | null {
  const p = pending(m);
  if (w.timing !== 'response' || !p || p.awaitingResponses || p.cancelled || p.actor === side) return null;
  if (p.action.handler === 'ground:drain') {const site = payload(p.action).site!; return controls(m, p.actor, site) ? site : null;}
  return p.action.handler === 'battle:begin' ? payload(p.action).site! : null;
}
const action = (id: string, label: string, handler: string, data: Payload, payment?: Payment, source?: string): Action =>
  ({id, label, handler: 'ground:' + handler, payload: data as Json, ...(payment ? {payment} : {}), ...(source ? {source} : {})});
const canPay = (m: Match, payment: Payment) => sides.every(side => (payment[side] ?? 0) <= m.players[side].force.length);
const pending = (m: Match) => m.stack.at(-2)?.kind === 'resolution' ? m.stack.at(-2) as Resolution : null;
export const canMove = (m: Match, id: string) => !isGuard(m.cards[id].blueprint) && !barred(m, id) && !usage(m).moved.includes(id);

export function groundActions(m: Match, window: Window, side: Side): Action[] {
  const actions: Action[] = [];
  if (window.timing === 'phase' && side === m.turn.side) {
    if (m.turn.phase === 'deploy') {
      for (const id of m.players[side].hand) {
        if (cardDefinition(m, id).type === 'Character') {
          for (const site of m.locations) {
            const payment = deploymentPayment(m, id, site);
            if (payment && canPay(m, payment)) actions.push(action('deploy:' + id + ':' + site, 'Deploy ' + name(m, id) + ' to ' + name(m, site), 'deploy', {card: id, site}, payment, id));
          }
        } else if (cardDefinition(m, id).type === 'Location') {
          for (const placement of sitePlacements(m, id)) actions.push(action('site:' + id + ':' + placement.id, 'Deploy ' + name(m, id) + ' · ' + placement.label, 'site', {card: id, placement: placement.id}, {}, id));
        }
      }
    }
    if (m.turn.phase === 'control') for (const site of m.locations) {
      if (controls(m, side, site) && !usage(m).drained.includes(site)) actions.push(action('drain:' + site, 'Force drain at ' + name(m, site), 'drain', {site}));
    }
    if (m.turn.phase === 'move' && m.players[side].force.length) {
      for (const site of m.locations) for (const card of atSite(m, site)) {
        if (card.owner !== side || !canMove(m, card.id)) continue;
        for (const to of m.locations.filter(to => adjacent(m, site, to))) actions.push(action('move:' + card.id + ':' + to, 'Move ' + name(m, card.id) + ' to ' + name(m, to), 'move', {card: card.id, from: site, site: to}, {[side]: 1}));
      }
    }
  }
  if (window.timing !== 'response') return actions;
  const event = window.event as {kind?: string; card?: string} | undefined;
  if (event?.kind === 'deployed' && event.card && m.cards[event.card].zone === 'table' && m.cards[event.card].owner !== side && cardDefinition(m, event.card).type === 'Character') {
    for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === (side === 'light' ? '1_105' : '1_249')))
      actions.push(action('barrier:' + card + ':' + event.card, 'Play ' + name(m, card), 'barrier', {card, target: event.card}, {[side]: 1}, card));
  }
  const parent = pending(m);
  if (parent?.action.handler === 'ground:drain' && !parent.cancelled && side !== parent.actor) {
    const site = payload(parent.action).site!;
    if (controls(m, parent.actor, site)) {
      actions.push(...reactionActions(m, site, side));
    }
  }
  if (parent?.action.handler === 'ground:force-loss' && !parent.cancelled) {
    const loss = parent.action.payload as Loss;
    if (side === loss.side && remainingForceLoss(m, loss) > 0 && !loss.ledger?.irreducible) for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === '1_90')) {
      for (let amount = 1; amount <= m.players[side].force.length; amount++) actions.push(action('reduce:' + card + ':' + amount, 'It Could Be Worse · use ' + amount + ' Force', 'reduce', {card, amount, lossIndex: m.stack.length - 2}, {[side]: amount}, card));
    }
  }
  return actions;
}


/** Shared by Force-drain and battle initiation responses. */
export function reactionActions(m: Match, site: string, side: Side, eligible: (id: string) => boolean = () => true): Action[] {
  const actions: Action[] = [];
      const used = usage(m).reacted;
      for (const from of m.locations.filter(from => adjacent(m, from, site))) for (const card of atSite(m, from)) {
        if (card.owner === side && card.blueprint === '1_30' && !used.includes(card.id) && eligible(card.id) && canMove(m, card.id))
          actions.push(action('react-move:' + card.id + ':' + site, 'React with ' + name(m, card.id), 'move', {card: card.id, from, site, react: true}, {[side]: 1}));
      }
      const sources = reactionSources(m, site, side);
      // Retain the selected Comlink as the source of its granted react permission.
      const options = [...(sources.some(id => m.cards[id].blueprint === '1_6') ? [undefined] : []), ...sources.filter(id => m.cards[id].blueprint === '1_201')];
      for (const via of options) for (const card of m.players[side].hand.filter(id => canDeployAsReact(m, id) && eligible(id) && cardDefinition(m, id).type === 'Character')) {
        const payment = deploymentPayment(m, card, site);
        if (payment && canPay(m, payment)) actions.push(action('react-deploy:' + card + ':' + site + (via ? ':via:' + via : ''), 'Deploy ' + name(m, card) + ' as a react' + (via ? ' using Comlink ' + via : ''), 'deploy', {card, site, react: true, ...(via ? {via} : {})}, payment, card));
      }
  return actions;
}

export function groundAutomatic(m: Match, window: Window): RequiredAction[] {
  if (window.timing !== 'end') return [];
  return Object.entries(usage(m).barriers).filter(([, turn]) => turn <= m.turn.number).map(([target]) => ({
    ...action('expire-barrier:' + target, 'End Barrier on ' + name(m, target), 'expire', {target}), actor: m.turn.side,
  }));
}

export function groundInitiate(m: Match, resolution: Resolution): void {
  const data = payload(resolution.action), kind = resolution.action.handler;
  if (['ground:deploy', 'ground:site', 'ground:barrier', 'ground:reduce'].includes(kind)) moveCard(m, data.card!, 'playing');
  if (kind === 'ground:barrier') data.targetRef = referenceCard(m, data.target!);
  if (kind === 'ground:move') data.cardRef = referenceCard(m, data.card!);
  const current = record(m);
  if (kind === 'ground:drain') current.drained.push(data.site!);
  if (data.react) registerReact(m, data.card!);
}

export const remainingForceLoss = (m: Match, loss: Loss): number => loss.ledger ? lossRemaining(m, loss.side, loss.ledger) : loss.remaining;
export function syncForceLosses(m: Match): void {
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'ground:force-loss' || f.kind === 'decision' && f.handler === 'ground:force-loss') {
    const loss = (f.kind === 'resolution' ? f.action.payload : f.payload) as Loss;
    loss.remaining = remainingForceLoss(m, loss);
  }
}
export function queueForceLoss(m: Match, loss: Loss): void {
  if (!loss.ledger && loss.remaining <= 0) return;
  loss.ledger ??= lossLedger(loss.remaining, loss.source === 'drain' ? 'drain' : 'effect');
  loss.remaining = remainingForceLoss(m, loss);
  m.stack.push({kind: 'resolution', actor: loss.side, action: {id: 'force-loss:' + (m.serial + 1), label: 'Lose ' + loss.remaining + ' Force', handler: 'ground:force-loss', payload: loss as unknown as Json}, cancelled: false});
  openWindow(m, 'response', loss.side, {kind: 'force-loss', side: loss.side});
}

/** AR p170: bringing presence cancels the drain, rather than suspending it
 * while control is contested. Arrival responses may remove the reacting card. */
function cancelDrainAfterReact(m: Match, side: Side, data: Payload): void {
  if (!data.react || !presence(m, side, data.site!)) return;
  const drain = [...m.stack].reverse().find(f => f.kind === 'resolution' && f.action.handler === 'ground:drain' && f.actor !== side && payload(f.action).site === data.site);
  if (drain?.kind !== 'resolution' || drain.cancelled) return;
  drain.cancelled = true;
  // Keep ordinary arrival responses above this result window, while persisting
  // cancellation immediately so later effects cannot revive the same drain.
  openWindow(m, 'response', other(side), {kind: 'force-drain-cancelled', site: data.site!, source: data.card!});
}

export function groundResolve(m: Match, resolution: Resolution): void {
  const data = payload(resolution.action), kind = resolution.action.handler, side = resolution.actor;
  if (resolution.cancelled) {
    if (['ground:barrier', 'ground:reduce'].includes(kind) && m.cards[data.card!].zone === 'playing') moveCard(m, data.card!, 'lost');
    else if (['ground:deploy', 'ground:site'].includes(kind)) throw Error('Deployment cancellation needs its explicit rule handler.');
    return;
  }
  if (kind === 'ground:deploy') {
    if (!canEnterTable(m, data.card!)) {moveCard(m, data.card!, 'lost'); return;}
    moveCard(m, data.card!, 'table'); m.cards[data.card!].location = data.site;
    cancelDrainAfterReact(m, side, data);
    deployed(m, data.card!);
  } else if (kind === 'ground:site') {
    const id = data.card!, placement = sitePlacements(m, id).find(p => p.id === data.placement);
    if (!placement) throw Error('The location placement requires revalidation.');
    moveCard(m, id, 'table');
    if (placement.replace) {
      const old = placement.replace;
      if (m.data.nighttimeSites) m.data.nighttimeSites = nighttimeSites(m).map(site => site === old ? id : site); m.cards[old].coveredBy = id; m.locations[m.locations.indexOf(old)] = id;
      for (const card of Object.values(m.cards)) {if (card.location === old) card.location = id; if (card.coveredBy === old) card.coveredBy = id;}
      const current = record(m); current.drained = current.drained.map(site => site === old ? id : site);
    } else m.locations.splice(placement.index!, 0, id);
    deployed(m, id);
  } else if (kind === 'ground:move') {
    if (!sameCard(m, data.cardRef!) || m.cards[data.card!].location !== data.from) return;
    moveWithAttachments(m, data.card!, data.site!); record(m).moved.push(data.card!);
    cancelDrainAfterReact(m, side, data);
    openWindow(m, 'response', other(side), {kind: 'moved', card: data.card!, from: data.from!, site: data.site!});
  } else if (kind === 'ground:barrier') {
    if (sameCard(m, data.targetRef!) && m.cards[data.target!].zone === 'table') record(m).barriers[data.target!] = m.turn.number;
    moveCard(m, data.card!, 'used');
  } else if (kind === 'ground:expire') {
    delete record(m).barriers[data.target!];
  } else if (kind === 'ground:drain') {
    if (controls(m, side, data.site!)) queueForceLoss(m, {side: other(side), remaining: drainAmount(m, side, data.site!) + lightsaberDrainBonus(m, data as {site: string}), source: 'drain', site: data.site!, reductionUsed: false});
  } else if (kind === 'ground:force-loss') {
    const loss = resolution.action.payload as Loss;
    loss.remaining = remainingForceLoss(m, loss);
    if (loss.remaining > 0) m.stack.push({kind: 'decision', side: loss.side, handler: 'ground:force-loss', payload: loss as unknown as Json});
  } else if (kind === 'ground:reduce') {
    const target = m.stack[data.lossIndex!];
    if (target?.kind !== 'resolution' || target.action.handler !== 'ground:force-loss') throw Error('Missing pending Force loss.');
    const loss = target.action.payload as Loss;
    if (!loss.reductionUsed && !loss.ledger?.irreducible) {if (loss.ledger) loss.ledger.reduction = data.amount!; else loss.remaining = Math.max(0, loss.remaining - data.amount!); loss.reductionUsed = true; loss.remaining = remainingForceLoss(m, loss);}
    moveCard(m, data.card!, 'used');
  } else throw Error('Unknown ground effect: ' + kind);
}

export function groundDecisions(m: Match, decision: Decision): {id: string; label: string}[] {
  if (decision.handler !== 'ground:force-loss') throw Error('Unknown ground decision.');
  if (remainingForceLoss(m, decision.payload as Loss) <= 0) return [];
  const side = decision.side, player = m.players[side];
  return [
    ...(['reserve', 'force', 'used', 'destiny'] as const).filter(pile => player[pile].length).map(pile => ({id: 'lose:' + pile, label: 'Lose the top card of ' + pile})),
    ...player.hand.map(id => ({id: 'lose-hand:' + id, label: 'Lose ' + name(m, id) + ' from hand'})),
  ];
}

export function groundChoose(m: Match, decision: Decision, choice: string): void {
  if (decision.handler !== 'ground:force-loss') throw Error('Unknown ground decision.');
  const loss = {...decision.payload as Loss}, side = decision.side;
  const id = choice.startsWith('lose-hand:') ? choice.slice(10) : m.players[side][choice.slice(5) as 'reserve' | 'force' | 'used' | 'destiny'][0];
  moveCard(m, id, 'lost'); if (loss.ledger) loss.ledger.paid++; else loss.remaining--;
  queueForceLoss(m, loss);
  openWindow(m, 'response', m.turn.side, {kind: 'force-lost', card: id, side, source: loss.source});
}

export function assertGround(m: Match): void {
  const stored = m.data.ground as GroundState | undefined;
  if (stored) {
  if (!Number.isSafeInteger(stored.turn) || stored.turn < 1 || stored.turn > m.turn.number) throw Error('Invalid ground turn.');
  for (const key of ['moved', 'reacted', 'drained'] as const) {
    const ids = stored[key];
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !m.cards[id])) throw Error('Invalid ground usage.');
  }
  if (stored.cancelledReactTitles && (!Array.isArray(stored.cancelledReactTitles) || new Set(stored.cancelledReactTitles).size !== stored.cancelledReactTitles.length || stored.cancelledReactTitles.some(title => typeof title !== 'string' || !Object.values(m.cards).some(c => name(m, c.id) === title)))) throw Error('Invalid canceled-react titles.');
  if (!stored.barriers || Object.entries(stored.barriers).some(([id, turn]) => !m.cards[id] || !Number.isSafeInteger(turn) || turn < 1 || turn > m.turn.number)) throw Error('Invalid Barrier duration.');
  }
  for (const frame of m.stack) {
    if (frame.kind === 'resolution' && frame.action.handler === 'ground:barrier') {const p = payload(frame.action); assertCardReference(m, p.targetRef!, p.target!);}
    if (frame.kind === 'resolution' && frame.action.handler === 'ground:move') {const p = payload(frame.action); assertCardReference(m, p.cardRef!, p.card!);}
    if (frame.kind === 'decision' && frame.handler === 'ground:force-loss' || frame.kind === 'resolution' && frame.action.handler === 'ground:force-loss') {
      const loss = (frame.kind === 'decision' ? frame.payload : frame.action.payload) as Loss;
      if (!sides.includes(loss.side) || loss.side !== (frame.kind === 'decision' ? frame.side : frame.actor) || !Number.isSafeInteger(loss.remaining) || loss.remaining < 0 || typeof loss.reductionUsed !== 'boolean') throw Error('Invalid pending Force loss.');
      if (loss.ledger) {
        assertLedger(loss.ledger);
        if (loss.ledger.kind !== (loss.source === 'drain' ? 'drain' : 'effect')) throw Error('Invalid Force-loss source kind.');
        if (loss.ledger.increase !== (loss.worseIncrease ?? 0) || (loss.ledger.reduction > 0) !== loss.reductionUsed) throw Error('Inconsistent Force-loss modifiers.');
      }
      if (loss.worseIncrease !== undefined && (!Number.isSafeInteger(loss.worseIncrease) || loss.worseIncrease <= 0)) throw Error('Invalid Force loss increase.');
    }
  }
}
