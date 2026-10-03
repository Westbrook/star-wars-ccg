import {cardDefinition, name, printed} from './board';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {topLevel} from './equipment';
import {resolveCancelledReact} from './ground';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {openWindow, retireAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

const sense = (bp: string) => ['1_109', '1_267'].includes(bp);
const alter = (bp: string) => ['1_71', '1_234'].includes(bp);
const effect = (m: Match, id: string) => ['Effect', 'Utinni Effect'].includes(cardDefinition(m, id).type);
// These unconditional printed immunities apply during deployment as well.
const alterImmune = (m: Match, id: string) => ['1_64', '1_221'].includes(m.cards[id].blueprint);
type Payload = {card: string; target: string; mode: 'card' | 'react' | 'effect' | 'counter'; character?: string;
  targetRef?: CardReference; characterRef?: CardReference; targetIndex?: number; actionId?: string; windowSerial?: number; eligible?: boolean; draw?: Draw};
const action = (step: string, p: Payload): Action => ({id: 'cancel:' + step + ':' + p.card + ':' + p.target + ':' + (p.character ?? 'direct'),
  label: 'Resolve cancellation', source: p.card, handler: 'cancel:' + step, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
export function highestAbilityCharacters(m: Match, side: Side): string[] {
  const cards = Object.values(m.cards).filter(c => c.zone === 'table' && c.owner === side && cardDefinition(m, c.id).type === 'Character' && printed(m, c.id, 'ability') > 0);
  const max = Math.max(0, ...cards.map(c => printed(m, c.id, 'ability')));
  return cards.filter(c => printed(m, c.id, 'ability') === max).map(c => c.id);
}
function pending(m: Match, p: Payload): Resolution | undefined {
  const f = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex], w = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex + 1];
  return f?.kind === 'resolution' && !f.cancelled && !f.awaitingResponses && f.action.id === p.actionId &&
    w?.kind === 'window' && w.serial === p.windowSerial && sameCard(m, p.targetRef!) ? f : undefined;
}
export function cancellationActions(m: Match, w: Window, side: Side): Action[] {
  const result: Action[] = [], highest = highestAbilityCharacters(m, side), parent = m.stack.at(-2);
  // An initiation response has no event. Subsequent effect/destiny responses
  // must never reopen cancellation of the already-resolving Interrupt.
  const responding = w.timing === 'response' && w.event === undefined && parent?.kind === 'resolution' && !parent.awaitingResponses && !parent.cancelled ? parent : undefined;
  for (const card of m.players[side].hand) {
    const bp = m.cards[card].blueprint; if (!sense(bp) && !alter(bp)) continue;
    const offer = (p: Payload, direct = false) => {
      for (const character of direct ? [undefined] : highest) {
        const a = action('play', {...p, ...(character ? {character} : {})});
        a.label = name(m, card) + ' · cancel ' + (p.mode === 'react' ? 'react by ' : '') + name(m, p.target) + (character ? ' · draw against ' + name(m, character) : '');
        result.push(a);
      }
    };
    if (responding) {
      const target = responding.action.source, p = responding.action.payload as {react?: boolean; card?: string};
      const bound = {targetIndex: m.stack.length - 2, actionId: responding.action.id, windowSerial: w.serial};
      if (p?.react && p.card && sense(bp)) offer({card, target: p.card, mode: 'react', ...bound});
      if (target && m.cards[target]?.zone === 'playing') {
        const tbp = m.cards[target].blueprint, type = cardDefinition(m, target).type;
        if (sense(bp) && alter(tbp) || alter(bp) && sense(tbp)) offer({card, target, mode: 'counter', ...bound}, true);
        if (sense(bp) && type === 'Interrupt' || alter(bp) && effect(m, target) && !alterImmune(m, target))
          offer({card, target, mode: 'card', ...bound});
      }
    }
    if (alter(bp) && topLevel(w)) for (const c of Object.values(m.cards))
      if (c.zone === 'table' && effect(m, c.id) && !alterImmune(m, c.id)) offer({card, target: c.id, mode: 'effect'});
  }
  return result;
}
export function cancellationInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  p.targetRef = referenceCard(m, p.target);
  if (p.character) p.characterRef = referenceCard(m, p.character);
  moveCard(m, p.card, 'playing');
}
function validTarget(m: Match, p: Payload): boolean {
  if (!sameCard(m, p.targetRef!)) return false;
  if (p.mode === 'effect') return m.cards[p.target].zone === 'table' && effect(m, p.target) && !alterImmune(m, p.target);
  return !!pending(m, p) && (!alter(m.cards[p.card].blueprint) || !effect(m, p.target) || !alterImmune(m, p.target));
}
export function cancellationResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler;
  if (r.cancelled) {if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost'); return;}
  if (h === 'cancel:play') {
    queue(m, 'finish', p);
    if (!validTarget(m, p)) return;
    if (p.mode === 'counter') queue(m, 'apply', p);
    else {
      // Highest-ability targeting is evaluated before the draw; comparison uses
      // that character's current ability after destiny, not a later arrival.
      p.eligible = sameCard(m, p.characterRef!) && highestAbilityCharacters(m, r.actor).includes(p.character!);
      drawDestiny(m, r.actor, p.card, 'sense-alter', action('result', p));
    }
  } else if (h === 'cancel:result') {
    if (p.eligible && sameCard(m, p.characterRef!) && p.draw!.value !== null && p.draw!.value < printed(m, p.character!, 'ability') && validTarget(m, p)) {
      queue(m, 'apply', p);
      openWindow(m, 'response', other(r.actor), {kind: 'sense-alter-destiny-successful', source: p.card, side: r.actor});
    }
  } else if (h === 'cancel:apply') {
    if (!validTarget(m, p)) return;
    if (p.mode === 'effect') {queue(m, 'event', p); loseFromTable(m, [p.target]);}
    else {
      const canceled = retireAction(m, p.targetIndex!, p.actionId!, p.windowSerial!);
      if (p.mode === 'react') {if (!resolveCancelledReact(m, canceled)) throw Error('Missing react cancellation handler.');}
      else {moveCard(m, p.target, 'lost'); openWindow(m, 'response', other(r.actor), {kind: 'card-canceled', card: p.target, source: p.card});}
    }
  } else if (h === 'cancel:event') openWindow(m, 'response', other(r.actor), {kind: 'card-canceled', card: p.target, source: p.card});
  else if (h === 'cancel:finish') moveCard(m, p.card, 'used');
  else throw Error('Unknown cancellation continuation.');
}
export function assertCancellation(m: Match): void {
  for (let index = 0; index < m.stack.length; index++) {
    const r = m.stack[index]; if (r.kind !== 'resolution' || !r.action.handler.startsWith('cancel:')) continue;
    const p = r.action.payload as Payload, bp = m.cards[p?.card]?.blueprint;
    if (!p || !sense(bp) && !alter(bp) || m.cards[p.card].owner !== r.actor || m.cards[p.card].zone !== 'playing' ||
        !['cancel:play','cancel:result','cancel:apply','cancel:event','cancel:finish'].includes(r.action.handler) ||
        !['card','react','effect','counter'].includes(p.mode) || !m.cards[p.target]) throw Error('Invalid cancellation continuation.');
    assertCardReference(m, p.targetRef!, p.target);
    if (p.mode === 'counter') {
      if (p.character !== undefined || !(sense(bp) && alter(m.cards[p.target].blueprint) || alter(bp) && sense(m.cards[p.target].blueprint))) throw Error('Invalid counterplay.');
    } else {
      if (!p.character || m.cards[p.character]?.owner !== r.actor || cardDefinition(m, p.character).type !== 'Character') throw Error('Invalid cancellation character.');
      assertCardReference(m, p.characterRef!, p.character);
    }
    if (p.mode === 'effect') {
      if (!alter(bp) || !effect(m, p.target) || p.targetIndex !== undefined || p.targetRef!.zone !== 'table') throw Error('Invalid Effect cancellation.');
    } else {
      const f = m.stack[p.targetIndex!], w = m.stack[p.targetIndex! + 1];
      if (!Number.isSafeInteger(p.targetIndex) || p.targetIndex! < 0 || p.targetIndex! >= index || f?.kind !== 'resolution' || f.action.id !== p.actionId ||
          w?.kind !== 'window' || w.timing !== 'response' || w.event !== undefined || w.serial !== p.windowSerial ||
          f.action.handler !== 'core:canceled' && (p.mode === 'react' ? !(f.action.payload as {react?: boolean; card?: string})?.react || (f.action.payload as {card?: string}).card !== p.target : f.action.source !== p.target)) throw Error('Invalid pending cancellation target.');
      if (p.mode === 'react' && !sense(bp)) throw Error('Only Sense cancels reacts.');
    }
    if (r.action.handler === 'cancel:result' && (!p.draw || !validDraw(m, p.draw, r.actor) || typeof p.eligible !== 'boolean')) throw Error('Invalid cancellation destiny.');
  }
}
