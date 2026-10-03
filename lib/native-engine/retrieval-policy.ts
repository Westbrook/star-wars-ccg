import {cardDefinition, name} from './board';
import {validForceQuantity, wholeForce} from './force-quantity';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {sides, type Match, type Side} from './types';

type Kind = 'add' | 'reset' | 'secret-plans-immunity';
export type RetrievalModifier = {
  source: CardReference; side: Side; kind: Kind; amount: number; blueprints: string[] | null;
  function: string; duration: 'turn' | 'source'; turn: number; cumulative: boolean;
};
const kinds: Kind[] = ['add', 'reset', 'secret-plans-immunity'];
function assertModifier(m: Match, p: RetrievalModifier): void {
  if (!p || !sides.includes(p.side) || !kinds.includes(p.kind) || typeof p.amount !== 'number' || !validForceQuantity(Math.abs(p.amount)) ||
      p.kind === 'reset' && p.amount < 0 || p.kind === 'secret-plans-immunity' && p.amount !== 1 ||
      typeof p.function !== 'string' || !p.function || !['turn', 'source'].includes(p.duration) ||
      !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number || typeof p.cumulative !== 'boolean' ||
      p.blueprints !== null && (!Array.isArray(p.blueprints) || !p.blueprints.length || p.blueprints.some(b => typeof b !== 'string' || !b))) throw Error('Invalid retrieval modifier.');
  assertCardReference(m, p.source);
  if (p.duration === 'source' && p.source.zone !== 'table') throw Error('Continuous retrieval modifier requires a table source.');
}
/** Rule-owned registrations only; none of these values are client commands.
 * Continuous effects retain their table instance; resolved turn effects persist
 * after their source leaves. Noncumulative copies share a title/function group. */
export function addRetrievalModifier(m: Match, source: string, side: Side, kind: Kind, amount: number,
  options: {blueprints?: string[]; function?: string; duration?: 'turn' | 'source'; cumulative?: boolean} = {}): void {
  const p: RetrievalModifier = {source: referenceCard(m, source), side, kind, amount, blueprints: options.blueprints ? [...options.blueprints] : null,
    function: options.function ?? kind, duration: options.duration ?? 'turn', turn: m.turn.number, cumulative: options.cumulative ?? false};
  assertModifier(m, p);
  const all = (m.data.retrievalModifiers ??= []) as unknown as RetrievalModifier[];
  all.push(p);
}
export function assertRetrievalModifiers(m: Match): void {
  const all = m.data.retrievalModifiers;
  if (all === undefined) return;
  if (!Array.isArray(all)) throw Error('Invalid retrieval modifiers.');
  for (const p of all) assertModifier(m, p as unknown as RetrievalModifier);
}
function modifiers(m: Match, side: Side, source: string): Pick<RetrievalModifier, 'kind' | 'amount'>[] {
  const active = ((m.data.retrievalModifiers ?? []) as unknown as RetrievalModifier[]).filter(p => p.side === side &&
    (!p.blueprints || p.blueprints.includes(m.cards[source].blueprint)) && (p.duration === 'turn' ? p.turn === m.turn.number : sameCard(m, p.source)));
  const groups = new Map<string, RetrievalModifier>(), result: Pick<RetrievalModifier, 'kind' | 'amount'>[] = [];
  for (const p of active) {
    if (p.cumulative) {result.push(p); continue;}
    const key = name(m, p.source.id) + ':' + p.function + ':' + p.kind;
    const prior = groups.get(key);
    if (!prior || (p.kind === 'reset' ? p.amount < prior.amount : Math.abs(p.amount) > Math.abs(prior.amount))) groups.set(key, p);
  }
  result.push(...groups.values());
  // Actual table text. Their remaining abilities and full admission are separate.
  if (side === 'light') {
    const title = cardDefinition(m, source).name;
    const dark = Object.values(m.cards).filter(c => c.owner === 'dark' && c.zone === 'table');
    if (['On The Edge', 'Off The Edge'].includes(title) && dark.some(c => c.blueprint === '8_108')) result.push({kind: 'add', amount: -3});
    if (title === 'Noble Sacrifice' && dark.some(c => c.blueprint === '8_114')) result.push({kind: 'add', amount: -3});
  }
  return result;
}
/** Quantity is evaluated once after initiation responses, before selecting the
 * first card or asking for Secret Plans payment. Later per-card responses do
 * not recalculate the already determined retrieval. */
export function retrievalAmount(m: Match, side: Side, source: string, base: number): number {
  const mods = modifiers(m, side, source), resets = mods.filter(p => p.kind === 'reset').map(p => p.amount);
  const amount = Math.max(0, resets.length ? Math.min(...resets) : base + mods.filter(p => p.kind === 'add').reduce((n, p) => n + p.amount, 0));
  return wholeForce(amount);
}
export function retrievalImmuneToSecretPlans(m: Match, side: Side, source: string): boolean {
  return modifiers(m, side, source).some(p => p.kind === 'secret-plans-immunity');
}
