import {assertLossPreventions,resolveWithLossPrevention} from './loss-prevention';
import {resumeStartingInterrupts} from './starting-interrupts';
import {mayActivateNormally,needsDeclaration,askActivationAmount,activationAmountChoices,chooseActivationAmount,resolveDeclaredActivation,assertDeclaredActivation,declaration,opposingInserts} from './declared-activation';
import {validForceQuantity, wholeForce} from './force-quantity';
import {assertCardReference, referenceCard, type CardReference} from './identity';
import {assertActivations, recordActivation, mayActivate, type ActivationBatch} from './activation';
import {assertState, initialState, lifeForce, moveTop, publicState, recirculate} from './state';
import {secureEntropy, type Entropy} from './random';
import {initializeSetup, setupPrompt, applySetup, projectSetup, assertSetup, type LocationSetupRules} from './setup';
import {other, sides, type Action, type Command, type Deck, type Decision, type Definition, type Json, type Match, type Payment, type Phase, type Prompt, type Resolution, type Side, type Timing, type Window} from './types';

/** Time comes from the trusted service, never from a player's command. */
export type Context = {entropy: Entropy; now: number};
export type RequiredAction = Action & {actor: Side};

/** A versioned server rules package supplies legality and effect implementations.
 * It rejects every card with incomplete reachable behavior. Text is never code,
 * and the kernel alone does not admit any production deck. */
export interface Rules {
  id: string;
  starting?: LocationSetupRules;
  definition(blueprint: string): Definition;
  supports(blueprint: string): boolean;
  setupComplete(match: Match): boolean;
  generation(match: Match, side: Side): number;
  automatic(match: Match, window: Window): RequiredAction[];
  actions(match: Match, window: Window, side: Side): Action[];
  initiate(match: Match, resolution: Resolution, context: Context): void;
  resolve(match: Match, resolution: Resolution, context: Context): void;
  decisions(match: Match, decision: Decision): {id: string; label: string}[];
  choose(match: Match, decision: Decision, choice: string, context: Context): void;
  canPass?(match: Match, window: Window, side: Side): boolean;
  view?(match: Match, seat: Side, now: number): Json;
  interrupt?(match: Match, context: Context): boolean;
  expire?(match: Match, context: Context): boolean;
  validate(match: Match): void;
}

const phases: readonly Phase[] = ['activate', 'control', 'deploy', 'battle', 'move', 'draw'];
const top = (match: Match) => match.stack.at(-1);
const core = (id: string, label: string): Action => ({id, label, handler: id, payload: null});

function validate(match: Match, rules: Rules): void {
  assertState(match);
  assertActivations(match);
  assertLossPreventions(match);
  assertDeclaredActivation(match);
  for (let index = 0; index < match.stack.length; index++) {
    const f = match.stack[index];
    if (f.kind === 'resolution' && f.action.unrespondable !== undefined && f.action.unrespondable !== true) throw Error('Invalid action response policy.');
    if (f.kind !== 'resolution' || f.action.handler !== 'core:canceled') continue;
    const w = match.stack[index + 1];
    if (!f.cancelled || f.awaitingResponses !== undefined || f.action.payload !== null || f.action.source !== undefined ||
        w?.kind !== 'window' || w.timing !== 'response' || w.event !== undefined) throw Error('Invalid retired action.');
  }
  if (match.rules !== rules.id) throw Error('This match requires its original rules version.');
  if (rules.starting) assertSetup(match, rules.starting);
  assertPayments(match);
  assertPhaseContinuations(match);
  rules.validate(match);
  if (match.status === 'playing' && !match.stack.length) throw Error('A playing match needs a continuation.');
}

export function createMatch(id: string, size: 40 | 60, decks: readonly Deck[], rules: Rules): Match {
  const unsupported = [...new Set(decks.flatMap(deck => [...deck.cards]))].filter(id => !rules.supports(id));
  if (unsupported.length) throw Error('Unimplemented card behavior: ' + unsupported.join(', '));
  const match = initialState(id, size, decks, rules.id, rules.definition);
  if (rules.starting) initializeSetup(match, rules.starting);
  validate(match, rules);
  return match;
}

export function openWindow(match: Match, timing: Timing, priority: Side, event?: Json): void {
  const e = event as {kind?: string; card?: string; cards?: string[]; cardRefs?: unknown; target?:string;targetRef?:unknown} | undefined;
  if(e && ['cards-lost','character-lost'].includes(e.kind??'') && e.cards?.length===0)return;
  if (e && ['forfeited','character-lost','cards-lost'].includes(e.kind ?? '') && e.cardRefs === undefined)
    event = {...e, cardRefs: (e.cards ?? (e.card ? [e.card] : [])).filter(id => match.cards[id]?.zone === 'lost').map(id => referenceCard(match,id))} as Json;
  if(e && ['about-to-lose','about-to-forfeit'].includes(e.kind??'') && e.cardRefs===undefined)
    event={...e,cardRefs:(e.cards??(e.card?[e.card]:[])).filter(id=>match.cards[id]?.zone==='table').map(id=>referenceCard(match,id))} as Json;
  if(e?.kind==='hit'&&e.target&&match.cards[e.target]?.zone==='table'&&e.targetRef===undefined)event={...e,targetRef:referenceCard(match,e.target)} as Json;
  match.stack.push({kind: 'window', serial: ++match.serial, timing, priority, passes: 0, completed: [], ...(event === undefined ? {} : {event})});
}

/** Real activation, including card text, counts each unit and yields its own
 * response window. Merely placing a card on Force does not call this helper. */
export function activateOneForce(m: Match, side: Side): boolean {
  if (m.status==='setup'||!mayActivate(m,side) || !m.players[side].reserve.length) return false;
  const id = moveTop(m,side,'reserve','force');
  openWindow(m,'response',other(side),recordActivation(m,side,id) as unknown as Json);
  return true;
}

/** Card-text activation rounds once, then rechecks Reserve and prohibitions
 * after each unit's responses. It never spends the turn's generation allowance. */
export function activateForce(m: Match, side: Side, source: string, amount: number, maximum?: number): void {
  if(m.status==='setup')return;
  const count=wholeForce(amount), sourceRef=referenceCard(m,source);
  if (!sides.includes(side)) throw Error('Invalid activation side.');
  if(maximum!==undefined && (!Number.isSafeInteger(maximum)||maximum<count))throw Error('Invalid variable activation maximum.');
  if (!count) return;
  const p: ActivationBatch={id:'activation-'+ ++m.serial,side,source:sourceRef,requested:amount,count,remaining:count,...(maximum===undefined?{}:{maximum,declaredWithInsert:opposingInserts(m,side)})};
  m.stack.push({kind:'resolution',actor:side,cancelled:false,action:{id:p.id,handler:'core:activate-batch',source,label:'Activate Force',payload:p as unknown as Json}});
}
function extraActivationChoices(d:Decision){const p=d.payload as unknown as ActivationBatch;return Array.from({length:p.maximum!-p.count+1},(_,n)=>({id:'core:activation-extra:'+n,label:n?'Activate '+n+' more Force':'Finish activation'}));}
function activateBatch(m: Match, r: Resolution): void {
  const p=r.action.payload as unknown as ActivationBatch;
  if(r.cancelled||!mayActivate(m,p.side)||!m.players[p.side].reserve.length)return;
  if(!p.remaining){
    if(p.maximum!==undefined&&p.declaredWithInsert&&p.maximum>p.count&&!opposingInserts(m,p.side))m.stack.push({kind:'decision',side:p.side,handler:'core:activation-extra',payload:p as unknown as Json});
    return;
  }
  p.remaining--; m.stack.push(r); activateOneForce(m,p.side);
}

/** Retire an initiated action without shifting suspended frame indices. The
 * card rule owns cancellation disposal/results; this inert slot is removed
 * together with its response window when the canceling action finishes. */
export function retireAction(match: Match, index: number, actionId: string, windowSerial: number): Resolution {
  const frame = match.stack[index], response = match.stack[index + 1];
  if (frame?.kind !== 'resolution' || frame.action.id !== actionId || frame.cancelled || frame.awaitingResponses ||
      response?.kind !== 'window' || response.timing !== 'response' || response.event !== undefined || response.serial !== windowSerial)
    throw Error('Cancellation requires its original pending action.');
  const retired = structuredClone(frame); retired.cancelled = true;
  frame.cancelled = true;
  frame.action = {id: frame.action.id, label: 'Canceled action', handler: 'core:canceled', payload: null};
  return retired;
}

/** Called by the setup resolver, after starting cards and both starting hands. */
export function startTurns(before: Match, rules: Rules): Match {
  validate(before, rules);
  const match = structuredClone(before);
  enterTurns(match, rules); match.revision++;
  validate(match, rules);
  return match;
}

function enterTurns(match: Match, rules: Rules): void {
  if (rules.starting) assertSetup(match, rules.starting);
  if (match.status !== 'setup' || match.stack.length || match.setup && match.setup.stage !== 'complete' || !rules.setupComplete(match)) throw Error('Starting setup is incomplete.');
  delete match.data.deployments;delete match.data.cardPlays;
  match.status = 'playing';
  const first=rules.starting?.firstPlayer?.(match)??'dark';
  if(!sides.includes(first))throw Error('Invalid first player.');
  match.turn.side=first;
  openWindow(match, 'start', first);
}

function affordable(match: Match, action: Action): boolean {
  const payment = action.payment ?? {};
  return Object.keys(payment).every(key => (sides as readonly string[]).includes(key)) && sides.every(side => {
    const amount = payment[side] ?? 0;
    return validForceQuantity(amount) && (match.status==='setup'||wholeForce(amount) <= match.players[side].force.length);
  });
}

type ForcePayment = {
  parentIndex: number; parentId: string; amounts: Record<Side, number>; remaining: Record<Side, number>;
  order: Side[]; position: number; opened: boolean;
};
/** Keep the parent suspended until every cost-result response has resolved. */
export function queueForcePayment(m: Match, parent: Resolution, payment: Payment): void {
  if(m.status==='setup')return;
  if (!affordable(m, {...parent.action, payment})) throw Error('Insufficient Force or invalid payment.');
  const amounts = {dark: wholeForce(payment.dark ?? 0), light: wholeForce(payment.light ?? 0)};
  // Dual-pile deployment costs use the opponent’s pile first (GEMP PayDeployCostEffect).
  const order = [other(parent.actor), parent.actor].filter(side => amounts[side] > 0);
  if (!order.length) return;
  const parentIndex = m.stack.indexOf(parent);
  if (parentIndex < 0 || !parent.awaitingResponses) throw Error('Missing unpaid action.');
  const p: ForcePayment = {parentIndex, parentId: parent.action.id, amounts, remaining: {...amounts}, order, position: 0, opened: false};
  m.stack.push({kind: 'resolution', actor: parent.actor, cancelled: false,
    action: {id: 'core:payment:' + (m.serial + 1), label: 'Pay Force cost', handler: 'core:payment', payload: p as unknown as Json}});
}
function assertPayments(m: Match): void {
  const parents = new Set<number>();
  for (const [index, f] of m.stack.entries()) if (f.kind === 'resolution' && f.action.handler === 'core:payment') {
    const p = f.action.payload as unknown as ForcePayment, parent = p && m.stack[p.parentIndex];
    if (!p || parents.has(p.parentIndex) || !Number.isSafeInteger(p.parentIndex) || p.parentIndex < 0 || p.parentIndex >= index || parent?.kind !== 'resolution' ||
      parent.action.id !== p.parentId || !parent.awaitingResponses || parent.actor !== f.actor || f.awaitingResponses || f.cancelled ||
      !p.amounts || !p.remaining || !Array.isArray(p.order) || !p.order.length || p.order.length > 2 || new Set(p.order).size !== p.order.length ||
      p.order.some(side => !sides.includes(side)) || JSON.stringify(p.order) !== JSON.stringify([other(f.actor), f.actor].filter(side => p.amounts[side] > 0)) || !Number.isSafeInteger(p.position) || p.position < 0 || p.position >= p.order.length || typeof p.opened !== 'boolean' ||
      sides.some(side => !Number.isSafeInteger(p.amounts[side]) || p.amounts[side] < 0 || p.amounts[side] > m.deckSize ||
        p.amounts[side] !== wholeForce(parent.action.payment?.[side] ?? 0) || !Number.isSafeInteger(p.remaining[side]) || p.remaining[side] < 0 || p.remaining[side] > p.amounts[side] ||
        p.order.includes(side) !== (p.amounts[side] > 0) || p.order.indexOf(side) < p.position && p.remaining[side] !== 0 ||
        p.order.indexOf(side) > p.position && p.remaining[side] !== p.amounts[side] ||
        !p.opened && side === p.order[p.position] && p.remaining[side] !== p.amounts[side])) throw Error('Invalid Force payment continuation.');
    parents.add(p.parentIndex);
  }
}
/** Empty cost windows can settle immediately because neither player can act.
 * Re-evaluate after every unit: a response can change later legal responses. */
function costWindow(m: Match, rules: Rules, side: Side, event: Json): void {
  openWindow(m, 'response', other(side), event);
  const w = top(m) as Window;
  if (required(m, w, rules).length || sides.some(priority => available(m, {...w, priority}, rules).length || rules.canPass?.(m, {...w, priority}, priority) === false)) return;
  m.stack.pop();
}
function payForceStep(m: Match, rules: Rules, frame: Resolution): void {
  const p = frame.action.payload as unknown as ForcePayment, side = p.order[p.position];
  if (!p.opened) {
    p.opened = true; m.stack.push(frame);
    costWindow(m, rules, side, {kind: 'before-force-use', side, amount: p.amounts[side]}); return;
  }
  if (p.remaining[side] === 0) {
    p.position++; p.opened = false;
    if (p.position < p.order.length) m.stack.push(frame);
    return;
  }
  // Depletion caused by a response must not silently grant an unpaid effect.
  // Such prevention/replacement needs an explicit rules result before admission.
  if (!m.players[side].force.length) throw Error('Pending Force cost cannot be completed.');
  moveTop(m, side, 'force', 'used'); p.remaining[side]--; m.stack.push(frame);
  costWindow(m, rules, side, {kind: 'force-used', side, amount: 1, total: p.amounts[side], remaining: p.remaining[side]});
}

function required(match: Match, window: Window, rules: Rules): RequiredAction[] {
  const actions = rules.automatic(match, window).filter(action => !window.completed.includes(action.id));
  if (new Set(actions.map(a => a.id)).size !== actions.length || actions.some(a => a.id === 'pass' || a.id === 'concede' || a.id.startsWith('core:'))) throw Error('Ambiguous required action.');
  return actions;
}

function available(match: Match, window: Window, rules: Rules): Action[] {
  const actions: Action[] = [];
  if (window.timing === 'phase' && window.priority === match.turn.side) {
    const player = match.players[match.turn.side];
    if (match.turn.phase === 'activate' && match.turn.activated < Math.floor(match.turn.generation) && player.reserve.length && mayActivate(match,window.priority) && mayActivateNormally(match))
      actions.push(needsDeclaration(match) ? core('core:declare-activation','Declare your Force activation') : core('core:activate', 'Activate one Force'));
    if (match.turn.phase === 'draw' && player.force.length) actions.push(core('core:draw', 'Draw one card'));
  }
  const extra = rules.actions(match, window, window.priority);
  if (extra.some(action => action.id.startsWith('core:') || action.id === 'pass' || action.id === 'concede')) throw Error('Reserved action identity.');
  actions.push(...extra.filter(action => affordable(match, action)));
  if (new Set(actions.map(a => a.id)).size !== actions.length) throw Error('Ambiguous legal action.');
  return actions;
}

export function prompt(match: Match, rules: Rules, seat: Side): Prompt | null {
  validate(match, rules);
  if (!sides.includes(seat)) throw Error('Invalid seat.');
  if (match.status === 'setup' && !match.stack.length) return rules.starting ? setupPrompt(match, rules.starting, seat) : null;
  if (match.status !== 'playing'&&match.status!=='setup') return null;
  const frame = top(match);
  if (!frame) throw Error('Missing continuation.');
  if (frame.kind === 'decision') {
    return {revision: match.revision, side: frame.side, timing: 'decision', mandatory: true,
      choices: seat === frame.side ? (frame.handler==='core:activation-amount' ? activationAmountChoices(match,frame) : frame.handler==='core:activation-extra' ? extraActivationChoices(frame) : rules.decisions(match, frame)) : []};
  }
  if (frame.kind !== 'window') throw Error('Unsettled action stack.');
  const mandatory = required(match, frame, rules);
  // The turn player orders simultaneous automatic actions, even an opponent's.
  const side = mandatory.length ? match.turn.side : frame.priority;
  return {revision: match.revision, side, timing: frame.timing, mandatory: !!mandatory.length,
    choices: seat !== side ? [] : mandatory.length ? mandatory.map(({id, label}) => ({id, label}))
      : [...available(match, frame, rules).map(({id, label}) => ({id, label})),
        ...(rules.canPass?.(match, frame, side) === false ? [] : [{id: 'pass', label: 'Pass'}])]};
}

function concludeIfEmpty(match: Match): void {
  if (match.status !== 'playing') return;
  const depleted = sides.filter(side => lifeForce(match, side) === 0);
  // Effects must order simultaneous final losses; never choose by array order.
  if (depleted.length === 2) throw Error('Resolve simultaneous final losses in rules order.');
  if (depleted.length === 1) {
    const loser = depleted[0];
    match.result = {winner: other(loser), loser, reason: 'life-force'};
    match.status = 'finished';
  }
}

type PhaseContinuation = {step: 'advance' | 'ready'; phase: Phase; turn: number};
function phaseContinuation(m: Match, step: PhaseContinuation['step']): void {
  m.stack.push({kind: 'resolution', actor: m.turn.side, cancelled: false,
    action: {id: 'core:phase', label: 'Continue phase', handler: 'core:phase',
      payload: {step, phase: m.turn.phase, turn: m.turn.number}}});
}
function assertPhaseContinuations(m: Match): void {
  for (const [index, f] of m.stack.entries()) if (f.kind === 'window' && ['phase-start','phase-end'].includes((f.event as {kind?: string})?.kind ?? '')) {
    const e = f.event as {kind: string; phase: Phase; side: Side; turn: number; sources: CardReference[]}, parent = m.stack[index - 1];
    if (f.timing !== 'response' || e.phase !== m.turn.phase || e.side !== m.turn.side || e.turn !== m.turn.number ||
        !Array.isArray(e.sources) || parent?.kind !== 'resolution' || parent.action.handler !== 'core:phase' ||
        (parent.action.payload as PhaseContinuation).step !== (e.kind === 'phase-start' ? 'ready' : 'advance')) throw Error('Invalid phase boundary.');
    const seen = new Set<string>();
    for (const ref of e.sources) {assertCardReference(m, ref); if (ref.zone !== 'table' || seen.has(ref.id)) throw Error('Invalid phase boundary source.'); seen.add(ref.id);}
  }
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler === 'core:phase') {
    const p = f.action.payload as PhaseContinuation;
    if (!p || !['advance','ready'].includes(p.step) || p.phase !== m.turn.phase || p.turn !== m.turn.number ||
        f.actor !== m.turn.side || f.cancelled || f.awaitingResponses || f.action.source || f.action.payment)
      throw Error('Invalid phase continuation.');
  }
}
function phaseEvent(m: Match, kind: 'phase-start' | 'phase-end'): Json {
  return {kind, phase: m.turn.phase, side: m.turn.side, turn: m.turn.number,
    sources: Object.values(m.cards).filter(c => c.zone === 'table').sort((a,b) => a.id.localeCompare(b.id)).map(c => referenceCard(m, c.id))} as unknown as Json;
}
function beginPhase(m: Match): void {
  phaseContinuation(m, 'ready');
  openWindow(m, 'response', m.turn.side, phaseEvent(m, 'phase-start'));
}
function resolvePhase(m: Match, r: Resolution): void {
  const p = r.action.payload as PhaseContinuation;
  if (p.step === 'ready') {openWindow(m, 'phase', m.turn.side); return;}
  const next = phases[phases.indexOf(m.turn.phase) + 1];
  if (next) {m.turn.phase = next; beginPhase(m);}
  else {recirculate(m); openWindow(m, 'end', m.turn.side);}
}
function closeWindow(match: Match, window: Window, rules: Rules): void {
  match.stack.pop();
  if (window.timing === 'response' || (window.event as {kind?:string})?.kind==='activation-between') return;
  if (window.timing === 'start') {
    const generation = rules.generation(match, match.turn.side);
    if (!validForceQuantity(generation)) throw Error('Invalid Force generation.');
    // Preserve the frozen numeric generation. The legal whole-card allowance
    // is its floor because normal activation is an "up to" bound.
    match.turn.generation = generation; match.turn.activated = 0;
    beginPhase(match);
  } else if (window.timing === 'phase') {
    phaseContinuation(match, 'advance');
    openWindow(match, 'response', match.turn.side, phaseEvent(match, 'phase-end'));
  } else {
    match.turn = {number: match.turn.number + 1, side: other(match.turn.side), phase: 'activate', generation: 0, activated: 0};
    openWindow(match, 'start', match.turn.side);
  }
}

function settle(match: Match, rules: Rules, context: Context): void {
  let transitions = 0;
  while (match.status === 'playing'||match.status==='setup'&&match.stack.length) {
    if (rules.interrupt?.(match,context)) {if (++transitions > 1000) throw Error('Rule interruption did not yield.'); continue;}
    const window = top(match);
    const parent = match.stack.at(-2);
    if (window?.kind === 'window' && window.timing === 'response' && window.event === undefined &&
        parent?.kind === 'resolution' && parent.action.handler === 'core:canceled' && parent.cancelled) {
      match.stack.pop(); continue;
    }
    // Empty cost and phase-boundary windows need no UI step. Check both
    // seats and mandatory triggers before advancing a durable continuation.
    if (window?.kind === 'window' && ['destiny-cost', 'phase-start', 'phase-end', 'about-to-forfeit', 'force-activated'].includes((window.event as {kind?: string})?.kind ?? '') &&
      !required(match, window, rules).length && !sides.some(priority => available(match, {...window, priority}, rules).length || rules.canPass?.(match, {...window, priority}, priority) === false)) {
      match.stack.pop(); continue;
    }
    if (top(match)?.kind !== 'resolution') break;
    if (++transitions > 1000) throw Error('Action resolution did not yield.');
    const pending = top(match) as Resolution;
    // Cost handlers may yield for choices or cost-result responses. The action
    // becomes respondable only when every such continuation has finished.
    if (pending.awaitingResponses) {
      delete pending.awaitingResponses;
      if (!pending.action.unrespondable) {openWindow(match, 'response', other(pending.actor)); break;}
      continue;
    }
    const resolution = match.stack.pop() as Resolution;
    if (resolution.action.handler === 'core:canceled') continue;
    if (resolution.action.handler === 'core:phase') {resolvePhase(match, resolution); continue;}
    if (resolution.action.handler === 'core:payment') payForceStep(match, rules, resolution);
    else if (resolution.action.handler === 'core:declare-activation') {if(!resolution.cancelled)askActivationAmount(match);}
    else if (resolution.action.handler === 'core:declared-activation') resolveDeclaredActivation(match,resolution);
    else if (resolution.action.handler === 'core:activate-batch') activateBatch(match,resolution);
    else if (resolution.action.handler === 'core:activate') {
      if (!resolution.cancelled && activateOneForce(match,resolution.actor)) match.turn.activated++;
    } else if (resolution.action.handler === 'core:draw') {
      if (!resolution.cancelled) moveTop(match, resolution.actor, 'force', 'hand');
    } else resolveWithLossPrevention(match,resolution,()=>rules.resolve(match, resolution, context)); // Includes cancellation cleanup.
    concludeIfEmpty(match);
  }
}

export function applyCommand(before: Match, rules: Rules, seat: Side, command: Command, entropy: Entropy = secureEntropy, now = Date.now()): Match {
  assertTime(now);
  validate(before, rules);
  if (!sides.includes(seat) || before.status === 'finished' || before.status === 'setup' && !rules.starting) throw Error('This seat cannot act in this match.');
  if (command.revision !== before.revision) throw Error('Stale match revision.');
  const match = structuredClone(before);
  if (command.choice === 'concede') {
    match.status = 'finished'; match.result = {winner: other(seat), loser: seat, reason: 'concession'};
  } else {
    const legal = prompt(before, rules, seat);
    if (!legal || legal.side !== seat || !legal.choices.some(c => c.id === command.choice)) throw Error('Illegal choice for this seat.');
    const frame = top(match);
    if (match.status === 'setup'&&!match.stack.length) {
      applySetup(match, rules.starting!, seat, command.choice, entropy);
      if (match.setup!.stage === 'complete') enterTurns(match, rules);
    } else if (frame?.kind === 'decision') {
      match.stack.pop();
      if(frame.handler==='core:activation-amount') chooseActivationAmount(match,frame,command.choice);
      else if(frame.handler==='core:activation-extra'){const p=frame.payload as unknown as ActivationBatch;activateForce(match,p.side,p.source.id,Number(command.choice.split(':')[2]));}
      else rules.choose(match, frame, command.choice, {entropy, now});
    } else if (frame?.kind === 'window') {
      const mandatory = required(match, frame, rules);
      if (command.choice === 'pass' && !mandatory.length) {
        if (frame.passes === 1) closeWindow(match, frame, rules);
        else {frame.passes = 1; frame.priority = other(frame.priority);}
      } else {
        const action = mandatory.length ? mandatory.find(a => a.id === command.choice)! : available(match, frame, rules).find(a => a.id === command.choice)!;
        const actor = mandatory.length ? (action as RequiredAction).actor : seat;
        if (!action || !sides.includes(actor)) throw Error('Invalid action actor.');
        if (!affordable(match, action)) throw Error('Insufficient Force or invalid payment.');
        if (mandatory.length) frame.completed.push(action.id);
        frame.passes = 0;
        if (!mandatory.length) frame.priority = other(seat);
        const resolution: Resolution = {kind: 'resolution', actor, action: structuredClone(action), cancelled: false, awaitingResponses: true};
        match.stack.push(resolution);
        if (!action.handler.startsWith('core:')) rules.initiate(match, resolution, {entropy, now});
        queueForcePayment(match, resolution, action.payment ?? {});
      }
    }
    concludeIfEmpty(match);
    settle(match, rules, {entropy, now});
    if(match.status==='setup')resumeStartingInterrupts(match,rules.starting?.interrupts);
  }
  match.revision++;
  validate(match, rules);
  return match;
}

function assertTime(now: number): void {if (!Number.isSafeInteger(now) || now < 0) throw Error('Invalid server time.');}

/** Persist this returned revision through the same compare-and-swap transaction
 * as commands. Idle reads must never start/restart a rules deadline. */
export function advanceTime(before: Match, rules: Rules, now = Date.now(), entropy: Entropy = secureEntropy): Match {
  assertTime(now); validate(before, rules);
  const match = structuredClone(before);
  if (match.status !== 'playing' || !rules.expire?.(match, {entropy, now})) return match;
  settle(match, rules, {entropy, now}); concludeIfEmpty(match);
  match.revision++; validate(match, rules); return match;
}

export function project(match: Match, rules: Rules, seat: Side, now = Date.now()) {
  assertTime(now);
  return {...publicState(match, seat), activation: declaration(match) ? {...declaration(match)!} : null, prompt: prompt(match, rules, seat),
    ...(rules.view ? {rules: rules.view(match, seat, now)} : {}),
    ...(rules.starting ? {setup: projectSetup(match, rules.starting, seat)} : {})};
}
