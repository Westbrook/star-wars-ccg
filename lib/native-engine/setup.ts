import {beginStartingInterrupts,startingStackAllowed,startingInterruptPrompt,applyStartingInterrupt,projectStartingInterrupts,assertStartingInterrupts,type StartingInterruptRules} from './starting-interrupts';
import {moveCard, shufflePile} from './state';
import {other, sides, type Match, type Prompt, type Side, type StartingLocation} from './types';
import type {Entropy} from './random';

export type Placement = {id: string; label: string; order: string[]};
/** This path handles ordinary starting locations. A package must explicitly
 * reject decks needing Objectives, Starting Effects/Interrupts or other setup
 * effects until their separate starting-card sequence is implemented. */
export interface LocationSetupRules {
  ordinarySetup(match: Match): boolean;
  interrupts?: StartingInterruptRules;
  firstPlayer?(match: Match): Side;
  invalidStarting?(match: Match): string[];
  additionalOptions?(match: Match): {side:Side;choices:{id:string;label:string;card?:string}[]}|null;
  deployAdditional?(match:Match,choice:string,entropy:Entropy):void;
  validateAdditional?(match:Match):void;
  location(match: Match, id: string): StartingLocation | null;
  placements(match: Match, selected: string[]): {side: Side; choices: Placement[]};
  name(match: Match, id: string): string;
}

const selected = (m: Match) => sides.flatMap(side => m.setup!.selected[side] ? [m.setup!.selected[side]!] : []);
const candidates = (m: Match, rules: LocationSetupRules, side: Side) => {
  const rejected = new Set([...m.setup!.rejected.flat(),...(m.setup!.setAside??[])]);
  return m.players[side].reserve.filter(id => !rejected.has(id) && rules.location(m, id));
};
function prepareChoices(m: Match, rules: LocationSetupRules): void {
  for (const side of sides) if (!candidates(m, rules, side).length) m.setup!.committed[side] = true;
  if (sides.every(side => m.setup!.committed[side])) m.setup!.stage = 'reveal';
}

export function initializeSetup(m: Match, rules: LocationSetupRules): void {
  if (!rules.ordinarySetup(m)) throw Error('This deck requires an unimplemented starting-card sequence.');
  m.setup = {stage: 'choose', selected: {dark: null, light: null}, committed: {dark: false, light: false},
    revealed: false, rejected: [], priority: 'dark', covered: null};
  prepareChoices(m, rules);
}

function placements(m: Match, rules: LocationSetupRules) {
  const ids = [...selected(m),...(m.setup!.additional??[])];
  if (m.setup!.covered || ids.length < 2) return {side: 'dark' as Side, choices: [{id: 'place', label: 'Place starting locations', order: ids}]};
  const result = rules.placements(m, ids);
  if (!sides.includes(result.side) || !result.choices.length || new Set(result.choices.map(c => c.id)).size !== result.choices.length || result.choices.some(c =>
    !c.id || c.order.length !== ids.length || new Set(c.order).size !== ids.length || c.order.some(id => !ids.includes(id)))) throw Error('Invalid starting placement rules.');
  return result;
}

export function setupPrompt(m: Match, rules: LocationSetupRules, seat: Side): Prompt {
  const setup = m.setup!;
  if(setup.stage.startsWith('starting-'))return startingInterruptPrompt(m,rules.interrupts!,seat,rules.name);
  let side: Side = setup.priority;
  let choices: Prompt['choices'] = [];
  if (setup.stage === 'choose') {
    side = !setup.committed[seat] ? seat : !setup.committed.dark ? 'dark' : 'light';
    if (side === seat) choices = candidates(m, rules, side).map(id => ({id: 'select:' + id, card: id,
      label: rules.name(m, id), forceIcons: {...rules.location(m, id)!.icons}}));
  } else if (setup.stage === 'reveal') {
    side = 'dark'; choices = [{id: 'reveal', label: 'Reveal starting choices together'}];
  } else if (setup.stage === 'conversion') {
    choices = [{id: 'accept', label: 'Allow the opponent to convert my location'}, {id: 'decline', label: 'Decline conversion'}];
  } else if (setup.stage === 'placement') {
    const options = placements(m, rules); side = options.side;
    choices = options.choices.map(({id, label}) => ({id: 'place:' + id, label}));
  } else if (setup.stage === 'additional') {
    const options=rules.additionalOptions?.(m);if(!options||!options.choices.length)throw Error('Missing required starting deployment.');side=options.side;choices=options.choices.map(({id,label,card})=>({id,label,...(card?{card,forceIcons:{...rules.location(m,card)!.icons}}:{})}));
  } else if (setup.stage === 'shuffle') {
    side = 'dark'; choices = [{id: 'begin', label: 'Shuffle both decks and draw opening hands'}];
  }
  return {revision: m.revision, side, timing: 'setup', mandatory: true, choices: side === seat ? choices : []};
}

/** Mutates only the transaction's cloned state; the runtime owns validation/CAS. */
export function applySetup(m: Match, rules: LocationSetupRules, seat: Side, choice: string, entropy: Entropy): void {
  const s = m.setup!;
  if(s.stage.startsWith('starting-')){applyStartingInterrupt(m,rules.interrupts!,seat,choice,entropy,rules.firstPlayer?.(m)??'dark');return;}
  if (s.stage === 'choose') {
    s.selected[seat] = choice.slice('select:'.length); s.committed[seat] = true;
    if (sides.every(side => s.committed[side])) s.stage = 'reveal';
  } else if (s.stage === 'reveal') {
    const invalid=rules.invalidStarting?.(m)??[];
    if(invalid.length){s.setAside=[...(s.setAside??[]),...invalid];for(const id of invalid){const side=m.cards[id].owner;s.selected[side]=null;s.committed[side]=false;}s.revealed=false;s.stage='choose';prepareChoices(m,rules);return;}
    s.revealed = true;
    const ids = selected(m);
    s.stage = ids.length === 2 && rules.location(m, ids[0])!.identity === rules.location(m, ids[1])!.identity ? 'conversion' : rules.additionalOptions?.(m)?'additional':'placement';
    s.priority = 'dark';
  } else if (s.stage === 'conversion') {
    if (choice === 'accept') {s.covered = s.selected[seat]; s.stage = 'placement';}
    else if (seat === 'dark') s.priority = 'light';
    else {
      s.rejected.push(selected(m)); s.selected = {dark: null, light: null};
      s.committed = {dark: false, light: false}; s.revealed = false; s.priority = 'dark'; s.stage = 'choose';
      prepareChoices(m, rules);
    }
  } else if (s.stage === 'placement') {
    const placement = placements(m, rules).choices.find(p => 'place:' + p.id === choice)!;
    if (s.covered) {
      const covered = s.covered, converting = selected(m).find(id => id !== covered)!;
      const convertible = rules.location(m, covered)!.convertible;
      moveCard(m, covered, 'table');
      if (convertible) {
        moveCard(m, converting, 'table'); m.cards[covered].coveredBy = converting; m.locations = [converting];
      } else {
        // AR starting setup: an attempted conversion of an unconvertible
        // location puts the converting copy out of play and setup continues.
        moveCard(m, converting, 'out'); m.locations = [covered];
      }
    } else {
      for (const id of placement.order) if(m.cards[id].zone!=='table')moveCard(m, id, 'table');
      m.locations = [...placement.order];
    }
    s.stage = rules.additionalOptions?.(m)?'additional':'shuffle';
    if(s.stage==='shuffle')beginStartingInterrupts(m,rules.interrupts);
  } else if(s.stage==='additional'){
    if(!rules.deployAdditional)throw Error('Missing starting deployment rules.');rules.deployAdditional(m,choice,entropy);s.stage=rules.additionalOptions?.(m)?'additional':'placement';
  } else if (s.stage === 'shuffle') {
    for (const side of sides) shufflePile(m, side, 'reserve', entropy);
    for (const side of sides) {
      for (const id of m.players[side].reserve.slice(0, 8)) moveCard(m, id, 'hand', 'bottom');
    }
    s.stage = 'complete';
  } else throw Error('Starting setup already completed.');
}

export function projectSetup(m: Match, rules: LocationSetupRules, seat: Side) {
  const s = m.setup!;
  const card = (id: string | null) => id ? {...m.cards[id], name: rules.name(m, id), forceIcons: {...rules.location(m, id)!.icons}} : null;
  return {
    ...(s.interrupts?{interrupts:projectStartingInterrupts(m,seat,rules.name)}:{}),
    stage: s.stage, committed: {...s.committed},
    selected: Object.fromEntries(sides.map(side => [side, s.revealed || side === seat ? card(s.selected[side]) : null])),
    rejected: s.rejected.map(pair => pair.map(card)),
    setAside:(s.setAside??[]).map(card),
    candidates: s.stage === 'choose' && !s.committed[seat] ? candidates(m, rules, seat).map(card) : [],
  };
}

export function assertSetup(m: Match, rules: LocationSetupRules): void {
  const s = m.setup;
  if (!s || !['choose', 'reveal', 'conversion', 'placement', 'additional', 'starting-choice', 'starting-reveal', 'starting-resolve', 'shuffle', 'complete'].includes(s.stage) || !sides.includes(s.priority) || typeof s.revealed !== 'boolean' || !Array.isArray(s.rejected)) throw Error('Invalid starting setup.');
  assertStartingInterrupts(m,rules.interrupts,rules.firstPlayer?.(m)??'dark');
  const rejected = s.rejected.flat();
  for(const field of ['setAside','additional'] as const){const ids=s[field];if(ids!==undefined&&(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!rules.location(m,id))))throw Error('Invalid starting supplements.');}
  rules.validateAdditional?.(m);
  if (new Set(rejected).size !== rejected.length || s.rejected.some(pair => pair.length !== 2 || pair.some((id, i) => m.cards[id]?.owner !== sides[i] || !rules.location(m, id)) ||
      rules.location(m, pair[0])!.identity !== rules.location(m, pair[1])!.identity)) throw Error('Invalid rejected starting cards.');
  for (const side of sides) {
    const id = s.selected[side];
    if (typeof s.committed[side] !== 'boolean' || id !== null && (m.cards[id]?.owner !== side || !rules.location(m, id) || !s.committed[side] || rejected.includes(id) || s.setAside?.includes(id))) throw Error('Invalid starting selection.');
  }
  const both = sides.every(side => s.committed[side]);
  if ((s.stage === 'choose' ? both : !both) || s.revealed !== !['choose', 'reveal'].includes(s.stage)) throw Error('Invalid setup disclosure.');
  const ids = selected(m), collision = ids.length === 2 && rules.location(m, ids[0])!.identity === rules.location(m, ids[1])!.identity;
  if (s.stage === 'conversion' && !collision || s.covered !== null && (!collision || !ids.includes(s.covered) || !['placement', 'additional', 'starting-choice', 'starting-reveal', 'starting-resolve', 'shuffle', 'complete'].includes(s.stage))) throw Error('Invalid starting conversion.');
  if (collision && ['placement', 'additional', 'starting-choice', 'starting-reveal', 'starting-resolve', 'shuffle', 'complete'].includes(s.stage) && !s.covered) throw Error('Starting conversion needs consent.');
  // After setup, characters may move and locations may convert. The historical
  // starting choice is retained without asserting that its board is immutable.
  if (s.stage === 'complete' && m.status !== 'setup') return;
  if (m.status === 'playing' || m.stack.length&&!startingStackAllowed(m,rules.interrupts)) throw Error('Gameplay entered unfinished setup.');
  const pending=rules.additionalOptions?.(m);
  if(s.stage==='additional'&&(!pending||!pending.choices.length)||['starting-choice','starting-reveal','starting-resolve','shuffle','complete'].includes(s.stage)&&pending)throw Error('Required starting deployment was skipped.');
  if(s.interrupts?.revealed)return;
  const extra=s.additional??[];
  const placed = ['starting-choice','starting-reveal','starting-resolve','shuffle','complete'].includes(s.stage), drawn = s.stage === 'complete';
  for (const side of sides) {
    const p = m.players[side];
    if (p.hand.length !== (drawn ? 8 : 0) || p.force.length || p.used.length || p.lost.length || p.destiny.length || p.reserve.length !== m.deckSize - (placed && s.selected[side] ? 1 : 0) -extra.filter(id=>m.cards[id].owner===side).length - (drawn ? 8 : 0)) throw Error('Unexpected starting piles.');
    if (!s.committed[side] && !candidates(m, rules, side).length || s.committed[side] && !s.selected[side] && candidates(m, rules, side).length) throw Error('Missing eligible starting choice.');
  }
  if (!placed && (m.locations.length!==extra.length||extra.some(id=>!m.locations.includes(id)))) throw Error('Starting locations revealed before deployment.');
  for (const c of Object.values(m.cards)) {
    if ((!['reserve', ...(drawn ? ['hand'] : [])].includes(c.zone)) !== (placed && ids.includes(c.id) || extra.includes(c.id)) || c.location || c.attachedTo) throw Error('Invalid starting card disposition.');
    const isCovered = placed && c.id === s.covered && rules.location(m, c.id)!.convertible;
    if (Boolean(c.coveredBy) !== Boolean(isCovered)) throw Error('Invalid supporting starting card.');
    if (placed && ids.includes(c.id) || extra.includes(c.id)) {
      const out = s.covered && !rules.location(m, s.covered)!.convertible && c.id !== s.covered;
      if (c.zone !== (out ? 'out' : 'table')) throw Error('Invalid starting conversion disposition.');
    }
  }
  if (placed) {
    const expected = s.covered ? [rules.location(m, s.covered)!.convertible ? ids.find(id => id !== s.covered)! : s.covered] : ids;
    expected.push(...extra);
    if (expected.length !== m.locations.length || expected.some(id => !m.locations.includes(id))) throw Error('Invalid starting board.');
    if (s.covered && rules.location(m, s.covered)!.convertible && m.cards[s.covered].coveredBy !== expected[0]) throw Error('Missing converted starting card.');
  }
}
