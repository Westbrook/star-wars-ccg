import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime = load(new URL('../../lib/native-engine/runtime.ts', import.meta.url));
const state = load(new URL('../../lib/native-engine/state.ts', import.meta.url));
const policy = load(new URL('../../lib/native-engine/search-policy.ts', import.meta.url));
const {premiereRules} = load(new URL('../../lib/native-engine/premiere-rules.ts', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json', import.meta.url)));
const rules = {...premiereRules, starting: undefined, supports: () => true, setupComplete: () => true};
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => runtime.createMatch('search-policy', 60, manifest.decks.map(d => ({side: d.side, cards: d.main})), rules);
const kintan = {blueprint: '1_254', side: 'dark', function: policy.searchFunctions.kintan, owner: 'dark', pile: 'lost'};
const bay = {blueprint: '101_4', side: 'dark', function: policy.searchFunctions.dockingBay, owner: 'dark', pile: 'reserve'};
const scavenge = {blueprint: '1_275', side: 'dark', function: policy.searchFunctions.scavenge, owner: 'light', pile: 'used'};

test('failure follows the title and function, independently of the physical source or pile membership', () => {
  const m = fresh(); policy.recordFailedSearch(m, kintan);
  const cards = Object.values(m.cards).filter(c => c.blueprint === kintan.blueprint);
  assert.ok(cards.length);
  for (const card of cards) state.moveCard(m, card.id, 'out');
  for (const id of [...m.players.dark.lost]) state.moveCard(m, id, 'hand');
  const replacement = m.players.dark.reserve[0]; state.moveCard(m, replacement, 'lost');
  assert.equal(policy.canSearch(m, kintan), false);
  assert.equal(policy.canSearch(clone(m), kintan), false);
  assert.equal(policy.canSearch(m, {...kintan, blueprint: '1_275'}), true);
});
for (const [field, value] of [['side', 'light'], ['owner', 'light'], ['pile', 'reserve'], ['function', 'other-function']]) {
  test('a failed search does not prohibit a different ' + field, () => {
    const m = fresh(); policy.recordFailedSearch(m, kintan);
    assert.equal(policy.canSearch(m, {...kintan, [field]: value}), true);
    assert.equal(policy.canSearch(m, kintan), false);
  });
}
test('same printed title across blueprints shares the restriction, but searching player stays distinct', () => {
  const m = fresh();
  // Both are Death Star: Docking Bay 327. This tests the policy, not a new card action.
  const source = {...bay, blueprint: '1_124'};
  const otherVersion = {...source, blueprint: '1_285'};
  assert.equal(premiereRules.definition(source.blueprint).name, premiereRules.definition(otherVersion.blueprint).name);
  policy.recordFailedSearch(m, source);
  assert.equal(policy.canSearch(m, otherVersion), false);
  assert.equal(policy.canSearch(m, {...otherVersion, side: 'light'}), true);
});
test('several search failures coexist and expire on the next turn', () => {
  const m = fresh(); for (const search of [kintan, bay, scavenge]) policy.recordFailedSearch(m, search);
  for (const search of [kintan, bay, scavenge]) assert.equal(policy.canSearch(m, search), false);
  m.turn.number++;
  for (const search of [kintan, bay, scavenge]) assert.equal(policy.canSearch(m, search), true);
  policy.recordFailedSearch(m, bay);
  assert.equal(m.data.failedSearches.length, 1);
  assert.equal(policy.canSearch(m, kintan), true);
  assert.equal(policy.canSearch(m, bay), false);
});
test('recording a repeated failure is idempotent and does not retain mutable caller data', () => {
  const m = fresh(), search = {...kintan};
  policy.recordFailedSearch(m, search); policy.recordFailedSearch(m, search);
  search.function = 'changed';
  assert.equal(m.data.failedSearches.length, 1);
  assert.equal(policy.canSearch(m, kintan), false);
  policy.assertSearchPolicy(m);
});
for (const [name, search, legacy] of [
  ['Kintan', kintan, {failedCharacterSearches: {dark: 1}}],
  ['Control Room', bay, {travel: {turn: 1, failedSearch: true, runPlayed: false, shuffles: 1}}],
  ['Tusken Scavengers', scavenge, {scavengeFailedTurn: 1}],
]) test('legacy ' + name + ' saves retain their exact restriction without query mutation', () => {
  const m = fresh(); Object.assign(m.data, legacy); const before = clone(m);
  assert.equal(policy.canSearch(m, search), false);
  assert.equal(policy.canSearch(m, {...search, function: 'unrelated'}), true);
  assert.equal(policy.canSearch(m, {...search, owner: search.owner === 'dark' ? 'light' : 'dark'}), true);
  for (const side of ['light', 'dark']) runtime.project(m, rules, side);
  assert.deepEqual(m, before);
  policy.recordFailedSearch(m, search); policy.assertSearchPolicy(m);
  m.turn.number++;
  assert.equal(policy.canSearch(m, search), true);
});
test('search queries, prompt and projection do not expose or mutate search history', () => {
  const m = runtime.startTurns(fresh(), rules); policy.recordFailedSearch(m, kintan);
  const before = clone(m);
  for (const side of ['light', 'dark']) {
    runtime.prompt(m, rules, side);
    const projection = runtime.project(m, rules, side);
    assert.ok(!JSON.stringify(projection).includes('failedSearches'));
  }
  assert.deepEqual(m, before);
});
for (const [name, change] of [
  ['null history', m => m.data.failedSearches = null],
  ['object history', m => m.data.failedSearches = {}],
  ['null entry', m => m.data.failedSearches = [null]],
  ['unknown card', m => m.data.failedSearches[0].blueprint = 'unimplemented'],
  ['wrong player', m => m.data.failedSearches[0].side = 'spectator'],
  ['wrong owner', m => m.data.failedSearches[0].owner = 'spectator'],
  ['unsupported pile', m => m.data.failedSearches[0].pile = 'hand'],
  ['empty function', m => m.data.failedSearches[0].function = ' '],
  ['future turn', m => m.data.failedSearches[0].turn = 2],
  ['zero turn', m => m.data.failedSearches[0].turn = 0],
  ['fractional turn', m => m.data.failedSearches[0].turn = 0.5],
  ['duplicate', m => m.data.failedSearches.push({...m.data.failedSearches[0]})],
]) test('corrupt ' + name + ' is rejected before a command can mutate the saved match', () => {
  const m = runtime.startTurns(fresh(), rules); policy.recordFailedSearch(m, kintan); change(m);
  const before = clone(m);
  assert.throws(() => runtime.applyCommand(m, rules, 'dark', {revision: m.revision, choice: 'pass'}));
  assert.deepEqual(m, before);
});

const oracle = JSON.parse(fs.readFileSync(new URL('./gemp/search-policy-results.json', import.meta.url)));
for (const expected of oracle.filter(o => !o.name.startsWith('room-'))) test('executed GEMP failed-search policy: ' + expected.name, () => {
  const m = fresh(); policy.recordFailedSearch(m, kintan);
  let query = {...kintan};
  if (expected.name === 'different-title') query.blueprint = '1_275';
  if (expected.name === 'different-player') query.side = 'light';
  if (expected.name === 'different-owner') query.owner = 'light';
  if (expected.name === 'different-pile') query.pile = 'reserve';
  if (expected.name === 'different-function') query.function = policy.searchFunctions.dockingBay;
  if (expected.name === 'source-moved') for (const c of Object.values(m.cards).filter(c => c.blueprint === '1_254')) state.moveCard(m, c.id, 'hand');
  if (expected.name === 'next-turn') m.turn.number++;
  assert.equal(policy.canSearch(m, query), expected.allowed);
});
