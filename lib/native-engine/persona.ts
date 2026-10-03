import {playProhibited} from './deploy-costs';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition, definition} from './definitions';
import {sides, type Action, type Match, type Side} from './types';

const registry: Record<string, {uniqueness: string; personas: string[]}> = identities;
const identity = (bp: string) => {const value = registry[bp]; if (!value) throw Error('Missing native identity metadata.'); return value;};
export const isUnique = (m: Match, id: string) => identity(m.cards[id].blueprint).uniqueness === 'UNIQUE';
export const hasPersona = (m: Match, id: string, persona: string) => !!m.cards[id] && identity(m.cards[id].blueprint).personas.includes(persona);
const limit = (bp: string): number => {
  const u = identity(bp).uniqueness;
  if (u.startsWith('DIAMOND')) throw Error('Diamond uniqueness requires system-scoped implementation.');
  return u === 'UNIQUE' ? 1 : u.startsWith('RESTRICTED_') ? Number(u.slice(11)) : Infinity;
};
const title = (bp: string) => (identity(bp).uniqueness === 'UNRESTRICTED' ? 'none:' : 'dot:') + definition(bp).name.replace(/\s*\(V\)$/, '');
const samePersona = (a: string, b: string) => identity(a).personas.some(p => identity(b).personas.includes(p));
type Play = {card: string; blueprint: string; side: Side};
type History = {turn: number; cards: Play[]};
const history = (m: Match): History => {
  const h = m.data.cardPlays as unknown as History | undefined;
  return h?.turn === m.turn.number ? h : {turn: m.turn.number, cards: []};
};
/** Ordinary placement eligibility only. Persona replacement/conversion has its
 * own rules; captures, stolen cards and permanent personas are not inferred. */
export function canEnterTable(m: Match, id: string): boolean {
  const c = m.cards[id], type = cardDefinition(m, id).type, max = limit(c.blueprint);
  const onTable = Object.values(m.cards).filter(o => o.id !== id && (o.zone === 'table' || o.zone === 'stacked') && !o.coveredBy);
  if (onTable.filter(o => title(o.blueprint) === title(c.blueprint) && (type !== 'Location' || o.owner === c.owner)).length >= max) return false;
  if (onTable.some(o => o.owner === c.owner && samePersona(c.blueprint, o.blueprint))) return false;
  if (['Character', 'Starship', 'Vehicle'].includes(type) && Object.values(m.cards).some(o => o.id !== id && o.owner === c.owner && o.zone === 'out' &&
      (samePersona(c.blueprint, o.blueprint) || isUnique(m, id) && title(o.blueprint) === title(c.blueprint)))) return false;
  return true;
}
export function canPlayThisTurn(m: Match, id: string): boolean {
  const bp = m.cards[id].blueprint, max = limit(bp), plays = history(m).cards;
  if (plays.filter(p => title(p.blueprint) === title(bp)).length >= max) return false;
  // AR p75 includes persona in the per-turn restriction. Pinned GEMP's title
  // counter does not implement that extra check; the divergence is recorded.
  if (max === 1 && plays.some(p => samePersona(bp, p.blueprint))) return false;
  return true;
}
export function canPlayCard(m: Match, id: string): boolean {
  return !playProhibited(m,id) && canPlayThisTurn(m, id) && (cardDefinition(m, id).type === 'Interrupt' || canEnterTable(m, id));
}
/** Record when a real play/deployment is initiated, before costs and responses.
 * A canceled action still consumes its allowance. No record for revival. */
export function recordCardPlay(m: Match, id: string): void {
  const h = history(m); h.cards.push({card: id, blueprint: m.cards[id].blueprint, side: m.cards[id].owner});
  m.data.cardPlays = h as unknown as import('./types').Json;
}
const playHandlers = new Set(['farm:deploy', 'deploy-effect:deploy', 'bacta:deploy', 'phase-effect:deploy', 'ability-effect:deploy', 'battle-effect:deploy','force-effect:deploy','ground:deploy','ground:site','ground:barrier','ground:reduce','battle:equip','battle:takeel','battle:reduce',
  'equipment:attach','equipment:macroscan','equipment:mine','gaffi:equip','saber:equip','travel:run','travel:escape']);
const interruptProviders = ['gravel:', 'trooper-assault:', 'duel-interrupt:', 'cancel:','interrupt:','duel:','revival:','assault:','accident:','stun:','scan:','scavenge:','worse:','doomed:','stakes:','substitution:','gambler:'];
export function actionPlayCard(m: Match, a: Action): string | undefined {
  const p = a.payload as {card?: string} | null, id = p?.card;
  if (!id || m.cards[id]?.zone !== 'hand') return;
  if (playHandlers.has(a.handler) || cardDefinition(m, id).type === 'Interrupt' && interruptProviders.some(prefix => a.handler.startsWith(prefix))) return id;
}
export function assertCardPlays(m: Match): void {
  const h = m.data.cardPlays as unknown as History | undefined;
  if (h === undefined) return;
  if (!h || !Number.isSafeInteger(h.turn) || h.turn < 1 || h.turn > m.turn.number || !Array.isArray(h.cards) ||
    h.cards.some(p => !p || !sides.includes(p.side) || !m.cards[p.card] || m.cards[p.card].owner !== p.side || m.cards[p.card].blueprint !== p.blueprint || !registry[p.blueprint])) throw Error('Invalid card play history.');
}
