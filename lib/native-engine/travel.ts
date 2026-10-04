import {unitsAt,isVessel,characterPresent,belowDecks} from './occupancy';
import {movesFree} from './movement-costs';
import {vehicleDestination} from './vessel-travel';
import {ability} from './ability';
import {canSearch, recordFailedSearch, searchFunctions, type Search} from './search-policy';
import {canPlayCard, recordCardPlay} from './persona';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {adjacent, atSite, cardDefinition, controls, moveWithAttachments, name, sitePlacements, system} from './board';
import {battle, battleHistory, members} from './battle';
import {canMove, canLandspeed, groundResolve, record} from './ground';
import {openWindow, queueForcePayment, type Context} from './runtime';
import {moveCard, shufflePile} from './state';
import {other, type Action, type Decision, type Json, type Match, type Resolution, type Side, type Window} from './types';

export const bayCosts: Record<string, Record<Side, number>> = {'1_124': {dark: 1, light: 1}, '1_285': {dark: 0, light: 2}, '1_129': {dark: 2, light: 1}, '1_291': {dark: 1, light: 2}, '3_59': {dark: 3, light: 1}, '3_147': {dark: 2, light: 1}};
type TravelState = {turn: number; failedSearch: boolean; runPlayed: boolean; shuffles: number};
type Payload = {card?: string; from?: string; to?: string; room?: string; selected?: string[]; remaining?: string[]; placement?: string; target?: string; targetRef?: CardReference; memberRefs?: Record<string, CardReference>; originRef?: CardReference; fromRef?: CardReference; toRef?: CardReference};
export const travelState = (m: Match): TravelState => {
  const s = m.data.travel as TravelState | undefined;
  return s?.turn === m.turn.number ? s : {turn: m.turn.number, failedSearch: false, runPlayed: false, shuffles: s?.shuffles ?? 0};
};
const remember = (m: Match) => {const s = travelState(m); m.data.travel = s as unknown as Json; return s;};
const baySearch: Search = {blueprint: '101_4', side: 'dark', function: searchFunctions.dockingBay, owner: 'dark', pile: 'reserve'};
export function markRunPlayed(m: Match): void {remember(m).runPlayed = true;}
const data = (f: Resolution | Decision) => ('action' in f ? f.action.payload : f.payload) as Payload;
const action = (id: string, label: string, handler: string, p: Payload): Action => ({id, label, handler: 'travel:' + handler, payload: p as unknown as Json});
function decision(m: Match, side: Side, handler: string, p: Payload): void {m.stack.push({kind: 'decision', side, handler: 'travel:' + handler, payload: p as unknown as Json});}
function then(m: Match, side: Side, handler: string, p: Payload, respondable = false): void {
  m.stack.push({kind: 'resolution', actor: side, cancelled: false, ...(respondable ? {awaitingResponses: true} : {}), action: action('travel-step:' + handler, handler, handler, p)});
}
export const transitEligible = (m: Match, side: Side, from: string, to?: string) => unitsAt(m, from).filter(c => c.owner === side && !c.attachedTo && canMove(m,c.id) && (!isVessel(m,c.id)||cardDefinition(m,c.id).type==='Vehicle'&&(!to||vehicleDestination(m,c.id,to)))).map(c=>c.id);
const bays = (m: Match) => m.locations.filter(id => bayCosts[m.cards[id].blueprint]);
/** The whole party pays once. Explicitly free movement cannot be increased (AR pp66,70). */
export function transitCost(m: Match, side: Side, from: string, to: string, party?:string[]): number {
  if (from === to || !bays(m).includes(from) || !bays(m).includes(to)) throw Error('Invalid docking-bay route.');
  if (party?.length && party.every(id=>movesFree(m,id))) return 0;
  if (side === 'dark' && m.cards[from].blueprint === '1_285') return 0;
  return bayCosts[m.cards[from].blueprint][side] + (side === 'dark' && m.cards[to].blueprint === '3_59' ? 4 : 0);
}
const searchCandidates = (m: Match) => m.players.dark.reserve.filter(id => bayCosts[m.cards[id].blueprint] && canPlayCard(m, id) && sitePlacements(m, id).length).sort();
const battleInitiation = (m: Match, w: Window) => {
  const parent = m.stack.at(-2);
  return w.timing === 'response' && parent?.kind === 'resolution' && parent.action.handler === 'battle:begin' && !parent.cancelled && !parent.awaitingResponses && battle(m)?.stage === 'begin';
};
const runEligible = (m: Match, id: string, to: string) => m.cards[id]?.zone === 'table' && m.cards[id].blueprint === '101_2' && !m.cards[id].attachedTo && !!m.cards[id].location && adjacent(m, m.cards[id].location!, to) && canLandspeed(m, id) && !battleHistory(m).participants.includes(id);
export function travelActions(m: Match, w: Window, side: Side): Action[] {
  const result: Action[] = [];
  if (w.timing === 'phase' && side === m.turn.side) {
    if (m.turn.phase === 'move') for (const from of bays(m)) {
      if (!transitEligible(m, side, from).length) continue;
      for (const to of bays(m).filter(id => id !== from && transitEligible(m,side,from,id).some(card=>m.players[side].force.length >= transitCost(m, side, from, id,[card])))) result.push(action('transit:' + from + ':' + to, 'Docking-bay transit · ' + name(m, from) + ' → ' + name(m, to), 'party', {from, to, selected: []}));
    }
    if (m.turn.phase === 'deploy' && side === 'dark' && m.players.dark.reserve.length && canSearch(m, baySearch))
      for (const room of m.locations.filter(id => m.cards[id].blueprint === '101_4' && controls(m, 'dark', id)))
        result.push(action('search:' + room, 'Search Reserve for a docking bay', 'search', {room}));
  }
  if (side === 'light' && battleInitiation(m, w)) {
    const b = battle(m)!;
    for (const card of m.players.light.hand) {
      if (m.cards[card].blueprint === '101_3' && !travelState(m).runPlayed)
        for (const luke of Object.values(m.cards).filter(c => c.owner === side && runEligible(m, c.id, b.site)))
          result.push(action('run-luke:' + card + ':' + luke.id, 'Run Luke, Run! · move Luke to battle for free', 'run', {card, target: luke.id, from: luke.location, to: b.site}));
      // Move-away initiation needs a related destination, not affordable movement.
      if (m.cards[card].blueprint === '1_98' && b.initiator !== side && m.locations.some(id => id !== b.site && cardDefinition(m,id).subType==='Site' && system(m, id) === system(m, b.site))) {
        const rebels = members(m, side).filter(id => characterPresent(m, id) && cardDefinition(m, id).subType === 'Rebel' && ability(m, id) > 2);
        for (const target of rebels) result.push(action('escape:' + card + (rebels.length > 1 ? ':' + target : ''),
          'Narrow Escape · target ' + name(m, target) + ' and attempt to move your cards with ability away', 'escape',
          {card, target, from: b.site, remaining: members(m, side).filter(id => ability(m, id) > 0)}));
      }
    }
  }
  return result;
}
export function travelInitiate(m: Match, r: Resolution): void {
  const p = data(r);
  if (r.action.handler === 'travel:party') decision(m, r.actor, 'party', p);
  if (['travel:run', 'travel:escape'].includes(r.action.handler)) {
    p.targetRef = referenceCard(m, p.target!);
    if (r.action.handler === 'travel:escape') p.memberRefs = Object.fromEntries(p.remaining!.map(id => [id, referenceCard(m, id)]));
    moveCard(m, p.card!, 'playing');
  }
  if (r.action.handler === 'travel:run') markRunPlayed(m);
}
function shuffle(m: Match, context: Context): void {shufflePile(m, 'dark', 'reserve', context.entropy); remember(m).shuffles++;}
// Move-away grants automatic disembarking only when the movement succeeds (AR p71).
// Landed starships have ability but cannot use landspeed; nested cargo crew cannot exit directly.
const escapeEligible = (m: Match, id: string, from: string, to: string) =>
  m.cards[id]?.zone === 'table' && cardDefinition(m,id).type === 'Character' && !belowDecks(m,id) &&
  m.cards[id].location === from && canLandspeed(m,id) && adjacent(m,from,to);
const originalRoute = (m: Match, p: Payload) =>
  (!p.fromRef || sameCard(m,p.fromRef)) && (!p.toRef || sameCard(m,p.toRef)) &&
  (!p.originRef || sameCard(m,p.originRef) && (m.cards[p.target!].attachedTo ?? m.cards[p.target!].location) === p.originRef.id);
function escapeOptions(m: Match, p: Payload): {card: string; to: string}[] {
  if (!m.players.light.force.length) return [];
  return (p.remaining ?? []).filter(id => sameCard(m, p.memberRefs?.[id]!) && m.cards[id]?.zone === 'table' && m.cards[id].location === p.from && canMove(m, id)).flatMap(card =>
    m.locations.filter(to => escapeEligible(m,card,p.from!,to)).map(to => ({card, to})));
}
export function travelResolve(m: Match, r: Resolution, context: Context): void {
  const p = data(r), handler = r.action.handler;
  if (r.cancelled) {if (p.card && m.cards[p.card].zone === 'playing') moveCard(m, p.card, 'lost'); return;}
  if (handler === 'travel:transit') {
    const moved = p.selected!.filter(id => sameCard(m, p.memberRefs?.[id]!) && transitEligible(m, r.actor, p.from!, p.to!).includes(id));
    for (const id of moved) {moveWithAttachments(m, id, p.to!); record(m).moved.push(id);}
    if (moved.length) openWindow(m, 'response', other(r.actor), {kind: 'moved', cards: moved, from: p.from!, site: p.to!});
  } else if (handler === 'travel:search') {
    decision(m, 'dark', 'search', p);
  } else if (handler === 'travel:search-deploy') {
    shuffle(m, context);
    groundResolve(m, {...r, action: {...r.action, handler: 'ground:site'}});
  } else if (handler === 'travel:run') {
    then(m, r.actor, 'interrupt-done', {card: p.card!});
    if (sameCard(m, p.targetRef!) && runEligible(m, p.target!, p.to!)) {
      // Nested regular movement has its own response step, even when free.
      then(m, r.actor, 'run-move', {...p, from: m.cards[p.target!].location, fromRef: referenceCard(m,m.cards[p.target!].location!), toRef: referenceCard(m,p.to!)}, true);
    }
  } else if (handler === 'travel:run-move') {
    if (sameCard(m, p.targetRef!) && originalRoute(m,p) && m.cards[p.target!].location === p.from && runEligible(m, p.target!, p.to!)) {
      moveWithAttachments(m, p.target!, p.to!); record(m).moved.push(p.target!); battle(m)!.runLuke = true;
      openWindow(m, 'response', other(r.actor), {kind: 'moved', card: p.target!, from: p.from!, site: p.to!});
    }
  } else if (handler === 'travel:escape') {
    then(m, r.actor, 'interrupt-done', {card: p.card!}); then(m, r.actor, 'escape-next', p);
  } else if (handler === 'travel:escape-next') {
    if (escapeOptions(m, p).length) decision(m, r.actor, 'escape', p);
  } else if (handler === 'travel:escape-move') {
    if (sameCard(m, p.targetRef!) && originalRoute(m,p) && escapeEligible(m,p.target!,p.from!,p.to!)) {
      delete m.cards[p.target!].attachedTo; delete m.cards[p.target!].aboardRole;
      moveWithAttachments(m, p.target!, p.to!); record(m).moved.push(p.target!);
      openWindow(m, 'response', other(r.actor), {kind: 'moved', card: p.target!, from: p.from!, site: p.to!});
    }
  } else if (handler === 'travel:interrupt-done') moveCard(m, p.card!, m.cards[p.card!].blueprint === '1_98' ? 'used' : 'lost');
  else throw Error('Unknown travel effect: ' + handler);
}
export function travelChoices(m: Match, d: Decision): {id: string; label: string}[] {
  const p = data(d);
  if (d.handler === 'travel:party') return [
    ...transitEligible(m, d.side, p.from!, p.to!).map(id => ({id: 'toggle:' + id, label: (p.selected!.includes(id) ? 'Remove ' : 'Add ') + name(m, id)})),
    ...(p.selected!.length && transitCost(m,d.side,p.from!,p.to!,p.selected)<=m.players[d.side].force.length ? [{id: 'confirm', label: 'Move party · ' + transitCost(m, d.side, p.from!, p.to!,p.selected) + ' Force total'}] : []),
    {id: 'cancel', label: 'Cancel transit'},
  ];
  if (d.handler === 'travel:search') {
    const candidates = searchCandidates(m);
    return candidates.length ? candidates.map(id => ({id: 'take:' + id, label: 'Deploy ' + name(m, id)})) : [{id: 'not-found', label: 'No legal docking bay · allow verification'}];
  }
  if (d.handler === 'travel:verify') return [{id: 'verified', label: 'Finish verification and reshuffle'}];
  if (d.handler === 'travel:place') return sitePlacements(m, p.card!).map(option => ({id: 'place:' + option.id, label: option.label}));
  if (d.handler === 'travel:escape') return escapeOptions(m, p).map(({card, to}) => ({id: 'away:' + card + ':' + to, label: (m.cards[card].attachedTo ? 'Disembark and move ' : 'Move ') + name(m, card) + ' to ' + name(m, to) + ' · 1 Force'}));
  throw Error('Unknown travel decision.');
}
export function travelChoose(m: Match, d: Decision, choice: string, context: Context): void {
  const p = data(d);
  if (d.handler === 'travel:party') {
    const parent = m.stack.at(-1);
    if (parent?.kind !== 'resolution' || parent.action.handler !== 'travel:party') throw Error('Missing transit selection.');
    if (choice === 'cancel') {
      m.stack.pop(); const w = m.stack.at(-1); if (w?.kind !== 'window') throw Error('Missing transit opportunity.'); w.priority = d.side; return;
    }
    if (choice.startsWith('toggle:')) {const id = choice.slice(7); p.selected = p.selected!.includes(id) ? p.selected!.filter(c => c !== id) : [...p.selected!, id]; decision(m, d.side, 'party', p); return;}
    p.memberRefs = Object.fromEntries(p.selected!.map(id => [id, referenceCard(m, id)]));
    const payment = {[d.side]: transitCost(m, d.side, p.from!, p.to!,p.selected)};
    parent.action = {...action('transit:' + p.from + ':' + p.to, 'Docking-bay transit', 'transit', p), payment};
    queueForcePayment(m, parent, payment);
  } else if (d.handler === 'travel:search') {
    if (choice === 'not-found') {recordFailedSearch(m, baySearch); decision(m, 'light', 'verify', p);}
    else decision(m, 'dark', 'place', {...p, card: choice.slice(5)});
  } else if (d.handler === 'travel:verify') {shuffle(m, context); openWindow(m, 'response', 'light', {kind: 'reserve-shuffled', side: 'dark'});}
  else if (d.handler === 'travel:place') {
    if (!canPlayCard(m, p.card!)) throw Error('Card play limit reached.');
    recordCardPlay(m, p.card!);
    moveCard(m, p.card!, 'playing'); then(m, 'dark', 'search-deploy', {...p, placement: choice.slice(6)}, true);
  } else if (d.handler === 'travel:escape') {
    const selected = escapeOptions(m, p).find(({card, to}) => choice === 'away:' + card + ':' + to);
    if (!selected) throw Error('Invalid move-away choice.');
    then(m, d.side, 'escape-next', {...p, remaining: p.remaining!.filter(id => id !== selected.card)});
    then(m, d.side, 'escape-move', {target: selected.card, targetRef: p.memberRefs![selected.card], from: p.from, to: selected.to, originRef: referenceCard(m,m.cards[selected.card].attachedTo ?? p.from!), fromRef: referenceCard(m,p.from!), toRef: referenceCard(m,selected.to)}, true);
    const parent = m.stack.at(-1) as Resolution; parent.action.payment = {[d.side]: 1};
    queueForcePayment(m, parent, parent.action.payment);
  } else throw Error('Unknown travel choice.');
}
export function travelView(m: Match, seat: Side): Json {
  const d = m.stack.at(-1);
  const reveal = d?.kind === 'decision' && (d.handler === 'travel:verify' || ['travel:search', 'travel:place'].includes(d.handler) && seat === 'dark');
  // Sorting physical IDs reveals membership, never Reserve order.
  return {searchCards: reveal ? [...m.players.dark.reserve].sort().map(id => ({...m.cards[id]})) : []};
}
export function assertTravel(m: Match): void {
  const s = m.data.travel as TravelState | undefined;
  if (s && (!Number.isSafeInteger(s.turn) || s.turn < 1 || s.turn > m.turn.number || typeof s.failedSearch !== 'boolean' || typeof s.runPlayed !== 'boolean' || !Number.isSafeInteger(s.shuffles) || s.shuffles < 0)) throw Error('Invalid travel history.');
  for (const f of m.stack) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('travel:')) continue;
    const p = data(f as Resolution | Decision);
    if (['travel:run', 'travel:run-move', 'travel:escape', 'travel:escape-move'].includes(h)) {
      assertCardReference(m, p.targetRef!, p.target);
      if (!p.target || p.targetRef!.zone !== 'table' || m.cards[p.target].owner !== (f.kind === 'decision' ? f.side : (f as Resolution).actor)) throw Error('Movement requires an original table target.');
    }
    for (const [key,id] of [['originRef',undefined],['fromRef',p.from],['toRef',p.to]] as const) if (p[key]) {
      assertCardReference(m,p[key]!,id); if (p[key]!.zone !== 'table') throw Error('Movement route requires original table cards.');
    }
    const group = h === 'travel:transit' ? p.selected : ['travel:escape', 'travel:escape-next'].includes(h) ? p.remaining : undefined;
    if (['travel:transit', 'travel:escape', 'travel:escape-next'].includes(h)) {
      if (!Array.isArray(group) || !p.memberRefs || typeof p.memberRefs !== 'object' || Array.isArray(p.memberRefs) || Object.keys(p.memberRefs).length < group.length || new Set(group).size !== group.length) throw Error('Invalid movement group references.');
      for (const [id, ref] of Object.entries(p.memberRefs)) {assertCardReference(m, ref, id); if (ref.zone !== 'table' || m.cards[id].owner !== (f.kind === 'decision' ? f.side : (f as Resolution).actor)) throw Error('Invalid movement group target.');}
      if (group.some(id => !p.memberRefs![id])) throw Error('Missing movement group target.');
    }
  }
  for (const d of m.stack) if (d.kind === 'decision' && d.handler.startsWith('travel:')) {
    const p = data(d);
    if (d.handler === 'travel:party' && (d.side !== m.turn.side || m.turn.phase !== 'move' || !bays(m).includes(p.from!) || !bays(m).includes(p.to!) || p.from === p.to || !Array.isArray(p.selected) || new Set(p.selected).size !== p.selected.length || p.selected.some(id => !transitEligible(m, d.side, p.from!, p.to!).includes(id)))) throw Error('Invalid transit party.');
    if (['travel:search', 'travel:verify', 'travel:place'].includes(d.handler) && (m.turn.side !== 'dark' || m.turn.phase !== 'deploy' || !p.room || !m.cards[p.room] || m.cards[p.room].blueprint !== '101_4')) throw Error('Invalid Reserve search.');
    if (d.handler === 'travel:verify' && (canSearch(m, baySearch) || searchCandidates(m).length || d.side !== 'light')) throw Error('Invalid failed search verification.');
    if (d.handler === 'travel:place' && (!searchCandidates(m).includes(p.card!) || d.side !== 'dark')) throw Error('Invalid docking bay selection.');
    if (d.handler === 'travel:escape' && (d.side !== 'light' || !Array.isArray(p.remaining) || new Set(p.remaining).size !== p.remaining.length || p.remaining.some(id => !m.cards[id]) || !escapeOptions(m, p).length)) throw Error('Invalid move-away continuation.');
  }
}
