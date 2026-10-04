import {matchingPilot} from './piloting';
import {battleAbility} from './battle-effects';
import {battle, members} from './battle';
import {battleDestinyRequirement, cardDefinition, name} from './board';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {sides, type Match, type Side} from './types';

export type DrawModifierKind = 'add' | 'limit' | 'if-unable' | 'no-limit' | 'ability';
export type BattleDrawModifier = {
  source: CardReference; side: Side; kind: DrawModifierKind; amount: number;
  function: string; duration: 'battle' | 'source'; participation: boolean; cumulative: boolean;
};
export type BattleDrawPolicy = {ordinary: number; minimum: number; count: number; limit: number | null};
const numeric = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
/** A successfully resolved card action may register a battle-long modifier.
 * Continuous text uses source duration and rechecks its original table instance. */
export function addBattleDrawModifier(m: Match, source: string, side: Side, kind: DrawModifierKind, amount: number,
  options: {function?: string; duration?: 'battle' | 'source'; participation?: boolean; cumulative?: boolean} = {}): void {
  const b = battle(m);
  if (!b || b.stage === 'complete' || !m.cards[source] || !sides.includes(side) || !['add','limit','if-unable','no-limit','ability'].includes(kind) || !numeric(amount) || kind === 'no-limit' && amount !== 1)
    throw Error('Invalid battle draw modifier.');
  const entry: BattleDrawModifier = {source: referenceCard(m, source), side, kind, amount,
    function: options.function ?? kind, duration: options.duration ?? 'battle', participation: options.participation ?? false, cumulative: options.cumulative ?? false};
  assertModifier(m, entry);
  (b.drawModifiers ??= []).push(entry);
}
function assertModifier(m: Match, p: BattleDrawModifier): void {
  if (!p || !sides.includes(p.side) || !['add','limit','if-unable','no-limit','ability'].includes(p.kind) || !numeric(p.amount) || p.kind === 'no-limit' && p.amount !== 1 ||
    typeof p.function !== 'string' || !p.function || !['battle','source'].includes(p.duration) || typeof p.participation !== 'boolean' || typeof p.cumulative !== 'boolean' || p.participation && p.duration !== 'source') throw Error('Invalid battle draw modifier.');
  assertCardReference(m, p.source);
  if (p.duration === 'source' && p.source.zone !== 'table') throw Error('Continuous draw modifier requires a table source.');
}
export function assertBattleDrawModifiers(m: Match): void {
  const mods = battle(m)?.drawModifiers;
  if (mods !== undefined) {if (!Array.isArray(mods)) throw Error('Invalid battle draw modifiers.'); mods.forEach(p => assertModifier(m, p));}
}
/** Count entitlement separately from its physical cap: substituting an early
 * draw can still leave room for another scheduled physical draw (AR p33). */
export function battleDrawPolicy(m: Match, side: Side, baseLimit: number | null = null): BattleDrawPolicy {
  const b = battle(m); if (!b) throw Error('Missing battle draw policy.');
  const own = members(m, side), allMembers = sides.flatMap(s => members(m, s));
  const active = (b.drawModifiers ?? []).filter(p => p.side === side && (p.duration === 'battle' || sameCard(m, p.source) &&
    (!p.participation || allMembers.includes(p.source.id))));
  const groups = new Map<string, BattleDrawModifier>();
  const mods: Pick<BattleDrawModifier, 'kind' | 'amount'>[] = [];
  for (const p of active) {
    if (p.cumulative) {mods.push(p); continue;}
    const key = name(m, p.source.id) + ':' + p.function + ':' + p.kind;
    const prior = groups.get(key);
    if (!prior || (p.kind === 'limit' ? p.amount < prior.amount : p.amount > prior.amount)) groups.set(key, p);
  }
  mods.push(...groups.values());
  // Actual continuous ground text; the rest of Ardan's card remains gated.
  if (cardDefinition(m, b.site).subType === 'Site' && own.some(id => m.cards[id].blueprint === '4_103')) mods.push({kind: 'if-unable', amount: 1});
  if(own.some(id=>matchingPilot(m,id)))mods.push({kind:'if-unable',amount:1});
  // Successfully played optional additions persist after the gambler leaves.
  if (b.gamblersLuck?.side === side) mods.push({kind: 'add', amount: b.gamblersLuck.amount});
  const ability = battleAbility(m, side), siteRequirement = battleDestinyRequirement(m, side, b.site);
  const requirement = Math.max(siteRequirement > 4 ? siteRequirement : 0, ...mods.filter(p => p.kind === 'ability').map(p => p.amount));
  const ordinary = ability < requirement ? 0 : (ability >= 4 ? 1 : 0) + mods.filter(p => p.kind === 'add').reduce((n, p) => n + p.amount, 0);
  const minimum = Math.max(0, ...mods.filter(p => p.kind === 'if-unable').map(p => p.amount));
  const caps = [...(baseLimit === null ? [] : [baseLimit]), ...mods.filter(p => p.kind === 'limit').map(p => p.amount)];
  const cap = mods.some(p => p.kind === 'no-limit') || !caps.length ? null : Math.min(...caps);
  // If-unable text supplies a floor, never extra draws on top of other text.
  // When it alone supplies entitlement, its X is also the maximum draw group.
  const limit = minimum > ordinary ? minimum : cap === null ? null : Math.max(cap, minimum);
  return {ordinary, minimum, count: Math.max(ordinary, minimum), limit};
}
