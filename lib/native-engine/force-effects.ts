import {cardDefinition, name, printed} from './board';
import {highestAbilityCharacters, type CancellationPayload} from './cancellation';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {canEnterTable} from './persona';
import {openWindow, queueForcePayment} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

type Payload = {card: string; targetIndex?: number; actionId?: string; windowSerial?: number; selected?: CardReference[]};
const blueprint = (side: Side) => side === 'light' ? '102_1' : '102_6';
const action = (step: string, p: Payload, label: string): Action => ({id: 'force-effect:' + step + ':' + p.card, label,
  handler: 'force-effect:' + step, source: p.card, payload: p as unknown as Json,
  ...(step === 'deploy' ? {} : {unrespondable: true})});
const target = (m: Match, p: Payload): Resolution | undefined => {
  const r = m.stack[p.targetIndex!], w = m.stack[p.targetIndex! + 1];
  return r?.kind === 'resolution' && !r.cancelled && !r.awaitingResponses && r.action.id === p.actionId &&
    w?.kind === 'window' && w.timing === 'response' && w.event === undefined && w.serial === p.windowSerial ? r : undefined;
};
// Jedi / Dark Jedi are current ability >= 6 and the printed side, not a
// substring in a title or an icon. Shared ability modifiers remain outstanding.
const jedi = (m: Match, id: string, source: string) => m.cards[id]?.zone === 'table' &&
  cardDefinition(m, id).side === other(m.cards[source].owner) && cardDefinition(m, id).type === 'Character' && printed(m, id, 'ability') >= 6;
const candidates = (m: Match, p: Payload) => Object.keys(m.cards).filter(id => jedi(m, id, p.card));
export function forceEffectActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [];
  if (w.timing === 'phase' && m.turn.phase === 'deploy' && m.turn.side === side)
    for (const card of m.players[side].hand.filter(id => m.cards[id].blueprint === blueprint(side)))
      actions.push(action('deploy', {card}, 'Deploy ' + name(m, card)));
  const r = m.stack.at(-2);
  if (w.timing !== 'response' || w.event !== undefined || r?.kind !== 'resolution' || r.cancelled || r.awaitingResponses || !m.players[side].force.length) return actions;
  for (const c of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.blueprint === blueprint(side))) {
    const p: Payload = {card: c.id, targetIndex: m.stack.length - 2, actionId: r.action.id, windowSerial: w.serial};
    if (r.action.handler === 'cancel:play') {
      const q = r.action.payload as CancellationPayload;
      if (!q.exclusionUsed && q.character && jedi(m, q.character, c.id))
        actions.push(action('exclude', {...p, selected: []}, name(m, c.id) + ' · exclude ' + (side === 'light' ? 'Dark Jedi' : 'Jedi') + ' from the ability check'));
    } else if (r.action.handler === 'assault:play' && r.actor === other(side) && !(r.action.payload as {defensiveDestiny?: boolean}).defensiveDestiny) {
      const a = action('boost', p, name(m, c.id) + ' · use 1 Force to add a destiny to your power total');
      a.payment = {[side]: 1}; actions.push(a);
    }
  }
  return actions;
}
export function forceEffectInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'force-effect:deploy') moveCard(m, p.card, 'playing');
  else if (r.action.handler === 'force-effect:exclude')
    m.stack.push({kind: 'decision', side: r.actor, handler: 'force-effect:select', payload: p as unknown as Json});
}
export function forceEffectResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'force-effect:deploy') {
    if (r.cancelled || !canEnterTable(m, p.card)) moveCard(m, p.card, 'lost');
    else {moveCard(m, p.card, 'table'); openWindow(m, 'response', other(r.actor), {kind: 'deployed', card: p.card});}
    return;
  }
  const pending = target(m, p); if (r.cancelled || !pending) return;
  if (r.action.handler === 'force-effect:boost') (pending.action.payload as {defensiveDestiny?: boolean}).defensiveDestiny = true;
  else if (r.action.handler === 'force-effect:exclude') {
    const q = pending.action.payload as CancellationPayload;
    q.exclusionUsed = true; q.excluded = p.selected!;
    const eligible = highestAbilityCharacters(m, pending.actor, q.excluded);
    if (!q.character || !sameCard(m, q.characterRef!) || !eligible.includes(q.character)) {
      if (!eligible.length) {delete q.character; delete q.characterRef; q.noCharacter = true;}
      else m.stack.push({kind: 'decision', side: pending.actor, handler: 'force-effect:retarget', payload: p as unknown as Json});
    }
  } else throw Error('Unknown Force Effect action.');
}
export function forceEffectChoices(m: Match, d: Decision) {
  const p = d.payload as Payload, r = target(m, p);
  if (!r) throw Error('Missing Force Effect target.');
  if (d.handler === 'force-effect:retarget') return highestAbilityCharacters(m, r.actor, (r.action.payload as CancellationPayload).excluded)
    .map(id => ({id: 'force-effect:target:' + id, label: 'Use ' + name(m, id) + ' · ability ' + printed(m, id, 'ability')}));
  const selected = p.selected!;
  return [...candidates(m, p).filter(id => selected.some(ref => ref.id === id) || selected.length < m.players[d.side].force.length)
    .map(id => ({id: 'force-effect:select:' + id, label: (selected.some(ref => ref.id === id) ? 'Remove ' : 'Exclude ') + name(m, id)})),
    ...(selected.length ? [{id: 'force-effect:confirm', label: `Use ${selected.length} Force · confirm exclusions`}] : [])];
}
export function forceEffectChoose(m: Match, d: Decision, choice: string): void {
  const p = d.payload as Payload, r = target(m, p);
  if (!r) throw Error('Missing Force Effect target.');
  if (d.handler === 'force-effect:retarget') {
    const id = choice.slice('force-effect:target:'.length), q = r.action.payload as CancellationPayload;
    if (!highestAbilityCharacters(m, r.actor, q.excluded).includes(id)) throw Error('Invalid highest-ability replacement.');
    q.character = id; q.characterRef = referenceCard(m, id); return;
  }
  if (choice === 'force-effect:confirm') {
    const parent = m.stack.at(-1);
    if (parent?.kind !== 'resolution' || parent.action.handler !== 'force-effect:exclude' || parent.action.source !== p.card || !p.selected?.length) throw Error('Missing exclusion payment.');
    parent.action.payload = p as unknown as Json; parent.action.payment = {[d.side]: p.selected.length};
    queueForcePayment(m, parent, parent.action.payment); return;
  }
  const id = choice.slice('force-effect:select:'.length), selected = p.selected!;
  if (!candidates(m, p).includes(id)) throw Error('Invalid Jedi exclusion.');
  if (selected.some(ref => ref.id === id)) p.selected = selected.filter(ref => ref.id !== id);
  else selected.push(referenceCard(m, id));
  m.stack.push({...d, payload: p as unknown as Json});
}
export function assertForceEffects(m: Match): void {
  for (const [index, f] of m.stack.entries()) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('force-effect:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as Payload, side = f.kind === 'resolution' ? f.actor : (f as Decision).side;
    if (!p || !m.cards[p.card] || m.cards[p.card].blueprint !== blueprint(m.cards[p.card].owner) ||
      !(f.kind === 'resolution' ? ['force-effect:deploy','force-effect:exclude','force-effect:boost'] : ['force-effect:select','force-effect:retarget']).includes(h) ||
      h !== 'force-effect:retarget' && m.cards[p.card].owner !== side) throw Error('Invalid Force Effect continuation.');
    if (f.kind === 'resolution' && (f.action.source !== p.card || f.action.id !== action(h.slice(13), p, '').id || (h === 'force-effect:deploy' ? f.action.unrespondable !== undefined : f.action.unrespondable !== true))) throw Error('Invalid Force Effect identity.');
    if (h === 'force-effect:deploy') {if (m.cards[p.card].zone !== 'playing') throw Error('Invalid pending Effect deployment.'); continue;}
    const r = target(m, p);
    if (!Number.isSafeInteger(p.targetIndex) || p.targetIndex! < 0 || p.targetIndex! >= index || !r ||
      (h === 'force-effect:boost' ? r.action.handler !== 'assault:play' || r.actor === side : r.action.handler !== 'cancel:play')) throw Error('Invalid Force Effect target.');
    if (h === 'force-effect:boost') {
      if (f.kind !== 'resolution' || f.action.payment?.[side] !== 1 || (f.action.payment?.[other(side)] ?? 0) !== 0 || p.selected !== undefined) throw Error('Invalid Assault bonus cost.');
    } else {
      if (!Array.isArray(p.selected) || new Set(p.selected.map(ref => ref.id)).size !== p.selected.length || p.selected.length > m.deckSize) throw Error('Invalid Jedi selection.');
      for (const ref of p.selected) {assertCardReference(m, ref); if (ref.zone !== 'table' || cardDefinition(m, ref.id).type !== 'Character' || cardDefinition(m, ref.id).side !== other(m.cards[p.card].owner) || printed(m, ref.id, 'ability') < 6) throw Error('Invalid Jedi reference.');}
      if (h === 'force-effect:select') {
        const parent = m.stack[index - 1];
        if (parent?.kind !== 'resolution' || parent.action.handler !== 'force-effect:exclude' || !parent.awaitingResponses || parent.action.source !== p.card ||
          (parent.action.payload as Payload).actionId !== p.actionId || (parent.action.payload as Payload).targetIndex !== p.targetIndex ||
          (parent.action.payload as Payload).windowSerial !== p.windowSerial || p.selected.length > m.players[side].force.length) throw Error('Invalid exclusion selection parent.');
      }
      if (h === 'force-effect:retarget') {if (r.actor !== side || !p.selected.length || !(r.action.payload as CancellationPayload).exclusionUsed) throw Error('Invalid retarget choice.');}
      if (h === 'force-effect:exclude' && f.kind === 'resolution' && f.action.payment && (f.action.payment[side] !== p.selected.length || (f.action.payment[other(side)] ?? 0) !== 0 || !p.selected.length)) throw Error('Invalid exclusion cost.');
    }
  }
}
