import type {publicValues} from './public-values';
import type {Battle} from './battle';
import {definition} from './board';
import {premiereSites} from './premiere-setup';
import type {project} from './runtime';
import {other, type Side} from './types';

export const computerPolicy = 'native-cpu-4';
type View = ReturnType<typeof project>;

/** A deterministic, conservative opponent, not a rules implementation. Its only
 * input is the same private projection a player receives. Current public values
 * are used when available, with printed values as fallback estimates; the engine alone supplies and validates every legal choice.
 * No hidden pile lookup, match stack, engine entropy or wall clock is available. */
export function chooseComputerAction(view: View, side: Side): string | null {
  const p = view.prompt;
  if (view.status === 'finished' || !p || p.side !== side || !p.choices.length) return null;
  const own = view.players[side], opponent = other(side);
  const visible = [...view.table, ...own.hand, ...own.lost, ...own.destiny];
  const rules = view.rules as {values?: ReturnType<typeof publicValues>; battle?: Battle | null} | undefined;
  const battle = rules?.battle?.stage === 'damage' ? rules.battle : null;
  const cards = new Map(visible.map(c => [c.id, c]));
  const stat = (id: string, field: string) => {
    const c = cards.get(id);if (!c) return 0;
    const current = rules?.values?.characters[id];
    if (current && field in current) return current[field as keyof typeof current];
    const n = Number((definition(c.blueprint).stats as Record<string,string>)[field]);
    return Number.isFinite(n) ? n : 0;
  };
  const at = (site: string, seat: Side) => view.table.filter(c => c.zone === 'table' && c.owner === seat && c.location === site && !c.attachedTo && definition(c.blueprint).type === 'Character');
  const strength = (site: string, seat: Side, defending = false) => rules?.values?.sites[site]?.[seat]?.[defending ? 'defendingPower' : 'power'] ?? at(site,seat).reduce((n,c) => n + stat(c.id,'power'),0);
  const icons = (site: string, seat: Side) => premiereSites[cards.get(site)?.blueprint ?? '']?.icons[seat] ?? 0;
  const value = (id: string) => stat(id,'power') * 2 + stat(id,'ability') - stat(id,'deploy');
  const wantsCard = own.hand.length < 9 && (own.lifeForce === null || own.lifeForce > 1);
  const ownStations = view.table.filter(c => c.zone === 'table' && !c.coveredBy && c.owner === side && c.blueprint === '1_37');
  const vaporators = view.table.filter(c => c.zone === 'table' && !c.coveredBy && c.blueprint === '1_41');
  const near = (a: string | undefined, b: string | undefined) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const locations = view.locations ?? [], i = locations.indexOf(a), j = locations.indexOf(b);
    const system = premiereSites[cards.get(a)?.blueprint ?? '']?.system;
    return i >= 0 && j >= 0 && Math.abs(i-j) === 1 && !!system && system === premiereSites[cards.get(b)?.blueprint ?? '']?.system;
  };
  const cheapestCharacter = Math.min(6,...own.hand.filter(c => definition(c.blueprint).type === 'Character').map(c => Math.max(0,stat(c.id,'deploy'))));
  // This is a planning estimate, not a deployment-cost or activation rule.
  // Keep enough projected Force for a character plus a move/battle when the
  // hand already has options. A nearly empty hand needs cards first.
  const activationLeft = view.turn.side === side && view.turn.phase === 'activate' ? Math.min(own.counts?.reserve ?? 0,Math.max(0,view.turn.generation-view.turn.activated)) : 0;
  const canSpareActivation = own.hand.length < 3 || (own.counts?.force ?? 0) + activationLeft > cheapestCharacter + 1;
  const farmScore = (id: string, site: string) => {
    if (cards.get(id)?.blueprint === '1_37') return ownStations.length || own.lifeForce !== null && own.lifeForce <= 4 ? -5 : 22 + at(site,side).filter(c => c.blueprint === '1_2').length * 3;
    if (cards.get(id)?.blueprint !== '1_41') return -5;
    const unprotected = view.table.filter(c => c.zone === 'table' && !c.attachedTo && !c.coveredBy && definition(c.blueprint).type === 'Character' && near(site,c.location) && !vaporators.some(v => near(v.attachedTo,c.location)));
    const protection = unprotected.reduce((n,c) => n + (c.owner === side ? 3 : -3),0);
    const extraDraw = ownStations.length && !vaporators.length ? 12 : 0;
    const owen = at(site,side).some(c => c.blueprint === '1_22') && !vaporators.some(v => v.attachedTo === site) ? 6 : 0;
    const benefit = protection + extraDraw + owen;
    return benefit > 0 ? 10 + benefit : -5;
  };
  const handLoss = (id: string) => 12 - value(id);
  const remainingDamage = battle?.damage[side] ?? 0, remainingAttrition = battle?.attrition[side] ?? 0;
  const hits = battle?.hits.filter(id => cards.get(id)?.owner === side) ?? [];
  const requiredAttrition = p.choices.some(c => c.id.startsWith('forfeit:') && !battle?.attritionProtected?.some(ref => ref.id === c.id.slice(8))) ? remainingAttrition : 0;
  const hitCredit = hits.reduce((sum,id) => sum + stat(id,'forfeit'),0);
  // Mandatory forfeits can clear both obligations. Do not spend an Interrupt
  // reducing damage already covered by hit casualties or required attrition.
  const avoidableDamage = Math.max(0, remainingDamage - Math.max(hitCredit,requiredAttrition));
  const forfeitScore = (id: string) => hits.includes(id) ? 100 - value(id) :
    8 + Math.min(stat(id,'forfeit'),Math.max(remainingDamage,remainingAttrition)) * 4 - value(id);
  const amounts = p.choices.filter(c => c.id.startsWith('battle-reduce:')).map(c => Number(c.id.split(':')[2]));
  const reduceAmount = Math.min(Math.ceil(avoidableDamage),Math.max(0,...amounts));
  const extraActivations = p.choices.filter(c => c.id.startsWith('stew:amount:')).map(c => Number(c.id.split(':')[2]));
  const extraActivation = Math.min(Math.max(0,...extraActivations),Math.max(0,(own.counts?.reserve ?? 0)-1),Math.max(0,6-(own.counts?.force ?? 0)));
  const score = (c: typeof p.choices[number]): number => {
    const [kind,a,b] = c.id.split(':');
    if (c.id === 'concede') return -Infinity;
    if (c.id === 'pass') return 0;
    if (p.timing === 'setup') return c.forceIcons ? 20 + c.forceIcons[side] * 3 - c.forceIcons[opponent] : 10;
    if (c.id === 'core:activate' || c.id === 'core:declare-activation') return 100;
    if (c.id.startsWith('core:activation-amount:')) return 100 + Number(c.id.split(':')[2]);
    if (c.id === 'core:draw') return wantsCard ? 20 : -10;
    if (kind === 'farm-deploy') return farmScore(a,b);
    if (kind === 'hydroponics') return wantsCard && canSpareActivation ? 30 : -5;
    if (kind === 'r2') return b === 'activate' ? 90 : b === 'draw' && wantsCard ? 60 : -5;
    if (kind === 'stew') {
      if (a === 'first') return b === side ? 70 : 60;
      if (a === 'amount') return Number(b) === extraActivation ? 70 : -5;
      if (a === 'play') return (own.counts?.reserve ?? 0) > 2 && own.hand.length >= 2 && (own.counts?.force ?? 0) < 3 ? 18 : -5;
    }
    // No hidden destiny distribution is available. Prefer low-ability targets
    // using their current public value; uncertain high-ability shots can wait.
    if (kind === 'gravel' && a === 'play') {
      const target = c.id.split(':')[3], ability = stat(target,'ability');
      return (own.counts?.reserve ?? 0) > 0 && cards.has(target) && ability <= 3 ? 50 + Math.min(12,Math.max(0,value(target))) - ability * 10 : -5;
    }
    if (c.id === 'draw-destiny') return 80;
    if (c.id === 'skip-destiny') return -10;
    if (kind === 'drain') return 100 + icons(a,opponent);
    if (kind === 'site') return 50;
    if (kind === 'deploy') return 35 + value(a) + (!at(b,side).length ? 12 : 0) + Math.min(10,strength(b,opponent));
    if (kind === 'battle') return strength(a,side) >= strength(a,opponent,true) ? 40 : -10;
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
    if (kind === 'rescue') return hits.includes(b) && value(b) > value(a) ? 115 + value(b) - value(a) : -5;
    if (kind === 'forfeit') return forfeitScore(a);
    if (kind === 'lose-mine') return 10 - value(a);
    if (kind === 'battle-reduce') return Number(b) === reduceAmount && reduceAmount > 0 ? 80 + reduceAmount : -5;
    if (kind === 'revival' && a === 'old-ben') return 55 + value(c.id.split(':')[3]);
    if (kind === 'revival' && a === 'kintan') return own.lost.some(c => definition(c.blueprint).type === 'Character') ? 55 : -5;
    if (kind === 'barrier') return 45 + value(b);
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
