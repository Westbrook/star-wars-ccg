import {definition} from './board';
import {premiereSites} from './premiere-setup';
import type {project} from './runtime';
import {other, type Side} from './types';

export const computerPolicy = 'native-cpu-1';
type View = ReturnType<typeof project>;

/** A deterministic, conservative opponent, not a rules implementation. Its only
 * input is the same private projection a player receives. Printed statistics
 * are estimates; the engine alone supplies and validates every legal choice.
 * No hidden pile lookup, match stack, engine entropy or wall clock is available. */
export function chooseComputerAction(view: View, side: Side): string | null {
  const p = view.prompt;
  if (view.status === 'finished' || !p || p.side !== side || !p.choices.length) return null;
  const own = view.players[side], opponent = other(side);
  const visible = [...view.table, ...own.hand, ...own.lost, ...own.destiny];
  const cards = new Map(visible.map(c => [c.id, c]));
  const stat = (id: string, field: string) => {
    const c = cards.get(id);if (!c) return 0;
    const n = Number((definition(c.blueprint).stats as Record<string,string>)[field]);
    return Number.isFinite(n) ? n : 0;
  };
  const at = (site: string, seat: Side) => view.table.filter(c => c.zone === 'table' && c.owner === seat && c.location === site && !c.attachedTo && definition(c.blueprint).type === 'Character');
  const strength = (site: string, seat: Side) => at(site,seat).reduce((n,c) => n + stat(c.id,'power'),0);
  const icons = (site: string, seat: Side) => premiereSites[cards.get(site)?.blueprint ?? '']?.icons[seat] ?? 0;
  const value = (id: string) => stat(id,'power') * 2 + stat(id,'ability') - stat(id,'deploy');
  const handLoss = (id: string) => 50 - value(id);
  const score = (c: typeof p.choices[number]): number => {
    const [kind,a,b] = c.id.split(':');
    if (c.id === 'concede') return -Infinity;
    if (c.id === 'pass') return 0;
    if (p.timing === 'setup') return c.forceIcons ? 20 + c.forceIcons[side] * 3 - c.forceIcons[opponent] : 10;
    if (c.id === 'core:activate') return 100;
    if (c.id === 'core:draw') return own.hand.length < 9 && own.lifeForce > 1 ? 20 : -10;
    if (c.id === 'draw-destiny') return 80;
    if (c.id === 'skip-destiny') return -10;
    if (kind === 'drain') return 100 + icons(a,opponent);
    if (kind === 'site') return 50;
    if (kind === 'deploy') return 35 + value(a) + (!at(b,side).length ? 12 : 0) + Math.min(10,strength(b,opponent));
    if (kind === 'battle') return strength(a,side) >= strength(a,opponent) ? 40 : -10;
    if (kind === 'move') {
      const from = cards.get(a)?.location;
      if (!from) return -10;
      // Preserve a sole uncontested garrison. Spread surplus troops or retreat
      // from a losing site; avoid purposeless back-and-forth movement.
      if (!at(b,side).length && !at(b,opponent).length && (at(from,side).length > 1 || strength(from,opponent) > strength(from,side))) return 25 + icons(b,opponent);
      if (strength(b,opponent) && strength(b,side) + stat(a,'power') >= strength(b,opponent) && at(from,side).length > 1) return 15;
      return -10;
    }
    if (kind === 'equip') return 15 + stat(b,'power');
    if (kind === 'transfer') {
      const old = cards.get(a)?.attachedTo;
      return old && stat(b,'power') > stat(old,'power') ? 5 : -10;
    }
    if (kind === 'fire') return 70 + stat(b,'power');
    if (kind === 'forfeit' || kind === 'rescue') return 30 + stat(a,'forfeit') - value(a);
    if (kind === 'lose-hand' || kind === 'battle-lose-hand') return handLoss(a);
    if (kind === 'lose' || kind === 'battle-lose') return a === 'used' ? 10 : a === 'force' ? 9 : 8;
    if (kind === 'retrieve' || kind === 'take') return 20 + value(a);
    if (kind === 'choke' || kind === 'accident-lose' || c.id.startsWith('scavenge:lose:')) return 10 - value(kind === 'scavenge' ? b : a);
    if (c.id === 'confirm') return 80;
    if (kind === 'toggle') return c.label.startsWith('Add ') ? 10 + value(a) : -10;
    if (c.id === 'cancel') return -20;
    if (c.id === 'scan:continue') return 20;
    if (c.id === 'keep') return 10;
    // Mandatory unfamiliar decisions still use an offered choice. Optional
    // unfamiliar text passes until a purposeful policy is added; no free loop.
    return p.mandatory ? 1 : -5;
  };
  // Choice identifiers are opaque tie breakers, never decoded as hidden cards.
  // A stable ordering makes retry/restart decisions identical at a revision.
  const ranked = p.choices.map(c => ({id:c.id,score:score(c)})).filter(c => Number.isFinite(c.score));
  ranked.sort((a,b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ranked[0]?.id ?? null;
}
