import {ability, mayBeHighestAbility, mayApplySenseAbility} from './ability';
import {cardDefinition, name} from './board';
import {drawDestiny, validDraw, type Draw} from './destiny';
import {topLevel} from './equipment';
import {resolveCancelledReact,reactCard} from './ground';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {openWindow, retireAction} from './runtime';
import {moveCard} from './state';
import {loseFromTable} from './table';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

const sense = (bp: string) => ['1_109', '1_267'].includes(bp);
const alter = (bp: string) => ['1_71', '1_234'].includes(bp);
const effect = (m: Match, id: string) => ['Effect', 'Utinni Effect'].includes(cardDefinition(m, id).type);
// These unconditional printed immunities apply during deployment as well.
const alterImmune = (m: Match, id: string) => ['1_42', '1_208', '4_16', '1_64', '1_221', '5_110'].includes(m.cards[id].blueprint);
export type CancellationPayload = {card: string; target: string; mode: 'card' | 'react' | 'effect' | 'counter'; character?: string;
  targetRef?: CardReference; characterRef?: CardReference; targetIndex?: number; actionId?: string; windowSerial?: number; eligible?: boolean; draw?: Draw; excluded?: CardReference[]; exclusionUsed?: boolean; noCharacter?: boolean};
const action = (step: string, p: CancellationPayload): Action => ({id: 'cancel:' + step + ':' + p.card + ':' + p.target + ':' + (p.character ?? 'direct'),
  label: 'Resolve cancellation', source: p.card, handler: 'cancel:' + step, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: CancellationPayload) => m.stack.push({kind: 'resolution', actor: m.cards[p.card].owner, cancelled: false, action: action(step, p)});
export function highestAbilityCharacters(m: Match, side: Side, excluded: CardReference[] = []): string[] {
  const cards = Object.values(m.cards).filter(c => c.zone === 'table' && c.owner === side && cardDefinition(m, c.id).type === 'Character' && ability(m, c.id) > 0 && mayBeHighestAbility(m, c.id) && !excluded.some(ref => ref.id === c.id && sameCard(m, ref)));
  const max = Math.max(0, ...cards.map(c => ability(m, c.id)));
  return cards.filter(c => ability(m, c.id) === max).map(c => c.id);
}
export const cancellationCharacters = (m: Match, side: Side, excluded: CardReference[] = []) => highestAbilityCharacters(m, side, excluded).filter(id => mayApplySenseAbility(m, id));
function pending(m: Match, p: CancellationPayload): Resolution | undefined {
  const f = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex], w = p.targetIndex === undefined ? undefined : m.stack[p.targetIndex + 1];
  return f?.kind === 'resolution' && !f.cancelled && !f.awaitingResponses && f.action.id === p.actionId &&
    w?.kind === 'window' && w.serial === p.windowSerial && sameCard(m, p.targetRef!) ? f : undefined;
}
export function cancellationActions(m: Match, w: Window, side: Side): Action[] {
  const result: Action[] = [], highest = cancellationCharacters(m, side), parent = m.stack.at(-2);
  // An initiation response has no event. Subsequent effect/destiny responses
  // must never reopen cancellation of the already-resolving Interrupt.
  const responding = w.timing === 'response' && w.event === undefined && parent?.kind === 'resolution' && !parent.awaitingResponses && !parent.cancelled ? parent : undefined;
  for (const card of m.players[side].hand) {
    const bp = m.cards[card].blueprint; if (!sense(bp) && !alter(bp)) continue;
    const offer = (p: CancellationPayload, direct = false) => {
      for (const character of direct ? [undefined] : highest) {
        const a = action('play', {...p, ...(character ? {character} : {})});
        a.label = name(m, card) + ' · cancel ' + (p.mode === 'react' ? 'react by ' : '') + name(m, p.target) + (character ? ' · draw against ' + name(m, character) : '');
        result.push(a);
      }
    };
    if (responding) {
      const target = responding.action.source, p = responding.action.payload as {react?: boolean; card?: string};
      const bound = {targetIndex: m.stack.length - 2, actionId: responding.action.id, windowSerial: w.serial};
      if (p?.react && reactCard(responding.action) && sense(bp)) offer({card, target:reactCard(responding.action)!, mode: 'react', ...bound});
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
  const p = r.action.payload as CancellationPayload;
  p.targetRef = referenceCard(m, p.target);
  if (p.character) p.characterRef = referenceCard(m, p.character);
  moveCard(m, p.card, 'playing');
}
function validTarget(m: Match, p: CancellationPayload): boolean {
  if (!sameCard(m, p.targetRef!)) return false;
  if (p.mode === 'effect') return m.cards[p.target].zone === 'table' && effect(m, p.target) && !alterImmune(m, p.target);
  return !!pending(m, p) && (!alter(m.cards[p.card].blueprint) || !effect(m, p.target) || !alterImmune(m, p.target));
}
export function cancellationResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as CancellationPayload, h = r.action.handler;
  if (r.cancelled) {if (m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost'); return;}
  if (h === 'cancel:play') {
    queue(m, 'finish', p);
    if (!validTarget(m, p)) return;
    if (p.mode === 'counter') queue(m, 'apply', p);
    else {
      // The highest target was chosen at initiation (or explicit retargeting).
      // Later numerical changes do not choose a different character.
      p.eligible = !p.noCharacter && sameCard(m, p.characterRef!);
      drawDestiny(m, r.actor, p.card, 'sense-alter', action('result', p));
    }
  } else if (h === 'cancel:result') {
    if (p.eligible && sameCard(m, p.characterRef!) && p.draw!.value !== null && p.draw!.value < ability(m, p.character!) && validTarget(m, p)) {
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
    const p = r.action.payload as CancellationPayload, bp = m.cards[p?.card]?.blueprint;
    if (!p || !sense(bp) && !alter(bp) || m.cards[p.card].owner !== r.actor || m.cards[p.card].zone !== 'playing' ||
        !['cancel:play','cancel:result','cancel:apply','cancel:event','cancel:finish'].includes(r.action.handler) ||
        !['card','react','effect','counter'].includes(p.mode) || !m.cards[p.target]) throw Error('Invalid cancellation continuation.');
    assertCardReference(m, p.targetRef!, p.target);
    if (p.mode === 'counter') {
      if (p.character !== undefined || !(sense(bp) && alter(m.cards[p.target].blueprint) || alter(bp) && sense(m.cards[p.target].blueprint))) throw Error('Invalid counterplay.');
    } else {
      if (!p.noCharacter && (!p.character || m.cards[p.character]?.owner !== r.actor || cardDefinition(m, p.character).type !== 'Character')) throw Error('Invalid cancellation character.');
      if (!p.noCharacter) assertCardReference(m, p.characterRef!, p.character);
      else if (!p.exclusionUsed || p.character !== undefined || p.characterRef !== undefined) throw Error('Invalid excluded cancellation character.');
    }
    if (p.excluded !== undefined) {
      if (!Array.isArray(p.excluded) || !p.excluded.length || new Set(p.excluded.map(ref => ref.id)).size !== p.excluded.length || p.exclusionUsed !== true) throw Error('Invalid cancellation exclusions.');
      for (const ref of p.excluded) {assertCardReference(m, ref); if (ref.zone !== 'table' || cardDefinition(m, ref.id).type !== 'Character') throw Error('Invalid cancellation exclusion target.');}
    }
    if (p.exclusionUsed && (!p.excluded?.length || p.mode === 'counter') || p.noCharacter && !p.exclusionUsed) throw Error('Invalid cancellation exclusion state.');
    if (p.exclusionUsed !== undefined && p.exclusionUsed !== true || p.noCharacter !== undefined && p.noCharacter !== true) throw Error('Invalid cancellation exclusion flags.');
    if (p.mode === 'effect') {
      if (!alter(bp) || !effect(m, p.target) || p.targetIndex !== undefined || p.targetRef!.zone !== 'table') throw Error('Invalid Effect cancellation.');
    } else {
      const f = m.stack[p.targetIndex!], w = m.stack[p.targetIndex! + 1];
      if (!Number.isSafeInteger(p.targetIndex) || p.targetIndex! < 0 || p.targetIndex! >= index || f?.kind !== 'resolution' || f.action.id !== p.actionId ||
          w?.kind !== 'window' || w.timing !== 'response' || w.event !== undefined || w.serial !== p.windowSerial ||
          f.action.handler !== 'core:canceled' && (p.mode === 'react' ? !(f.action.payload as {react?: boolean})?.react || reactCard(f.action) !== p.target : f.action.source !== p.target)) throw Error('Invalid pending cancellation target.');
      if (p.mode === 'react' && !sense(bp)) throw Error('Only Sense cancels reacts.');
    }
    if (r.action.handler === 'cancel:result' && (!p.draw || !validDraw(m, p.draw, r.actor) || typeof p.eligible !== 'boolean')) throw Error('Invalid cancellation destiny.');
  }
}
