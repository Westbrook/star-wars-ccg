import {definition} from './definitions';
import {sides, type Json, type Match, type Side} from './types';

/** The declared search function is part of its identity, not its current filter
 * or selected card. AR p12: a verified failure follows same-title copies for
 * this player, this deck/pile, and the remainder of this turn. */
export type Search = {
  blueprint: string; side: Side; function: string; owner: Side;
  pile: 'reserve' | 'force' | 'used' | 'lost';
};
type Failure = Search & {turn: number};
export const searchFunctions = {
  kintan: 'kintan:topmost-character',
  dockingBay: 'control-room:deploy-docking-bay',
  scavenge: 'tusken-scavengers:equipment',
} as const;
const title = (blueprint: string) => definition(blueprint).name.replace(/\s*\(V\)$/, '');
const equivalent = (a: Search, b: Search) => a.side === b.side && a.owner === b.owner && a.pile === b.pile &&
  a.function === b.function && title(a.blueprint) === title(b.blueprint);
const saved = (m: Match) => (m.data.failedSearches ?? []) as unknown as Failure[];

/** Read old snapshots without mutating them during prompt/projection. These
 * historical flags represented exactly these functions, not every search. */
function legacy(m: Match): Failure[] {
  const result: Failure[] = [];
  const characters = m.data.failedCharacterSearches as Partial<Record<Side, number>> | undefined;
  for (const side of sides) if (characters?.[side]) result.push({blueprint: '1_254', side, function: searchFunctions.kintan, owner: side, pile: 'lost', turn: characters[side]!});
  const travel = m.data.travel as {turn: number; failedSearch: boolean} | undefined;
  if (travel?.failedSearch) result.push({blueprint: '101_4', side: 'dark', function: searchFunctions.dockingBay, owner: 'dark', pile: 'reserve', turn: travel.turn});
  if (m.data.scavengeFailedTurn !== undefined) result.push({blueprint: '1_275', side: 'dark', function: searchFunctions.scavenge, owner: 'light', pile: 'used', turn: m.data.scavengeFailedTurn as number});
  return result;
}
/** This checks the failed-search rule only. Timing, costs, nonempty piles and
 * card-specific conditions still belong to the action offering the search. */
export function canSearch(m: Match, search: Search): boolean {
  assertSearch(search);
  return ![...saved(m), ...legacy(m)].some(f => f.turn === m.turn.number && equivalent(f, search));
}
/** Call only after an actual failed search has been verified. Canceling or
 * declining a search never calls this. Pile changes do not clear a failure. */
export function recordFailedSearch(m: Match, search: Search): void {
  assertSearch(search);
  const current = saved(m).filter(f => f.turn === m.turn.number);
  if (!current.some(f => equivalent(f, search))) current.push({...search, turn: m.turn.number});
  m.data.failedSearches = current as unknown as Json;
}
function assertSearch(search: Search): void {
  if (!search || typeof search !== 'object' || Array.isArray(search) || !sides.includes(search.side) || !sides.includes(search.owner) ||
      !['reserve', 'force', 'used', 'lost'].includes(search.pile) || typeof search.function !== 'string' || !search.function.trim() ||
      typeof search.blueprint !== 'string') throw Error('Invalid search identity.');
  definition(search.blueprint);
}
export function assertSearchPolicy(m: Match): void {
  const failures = m.data.failedSearches;
  if (failures === undefined) return;
  if (!Array.isArray(failures)) throw Error('Invalid failed search history.');
  const seen: Failure[] = [];
  for (const value of failures) {
    const f = value as unknown as Failure;
    assertSearch(f);
    if (!Number.isSafeInteger(f.turn) || f.turn < 1 || f.turn > m.turn.number || seen.some(prior => prior.turn === f.turn && equivalent(prior, f))) throw Error('Invalid failed search history.');
    seen.push(f);
  }
}
