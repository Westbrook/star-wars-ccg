import {cardDefinition} from './definitions';
export {cardDefinition, definition} from './definitions';
import {hasCharacteristic, isSpecies, nonUnique} from './characteristics';
import {premiereSites} from './premiere-setup';
import {other, type Match, type Payment, type Side} from './types';
import {equipmentState, nighttimeSites} from './equipment-state';

export function printed(m: Match, id: string, property: string): number {
  const card = cardDefinition(m, id), value = (card.stats as Record<string, string>)[property];
  if (property === 'ability' && card.subType === 'Droid') return 0;
  if (value === undefined || !Number.isFinite(Number(value))) throw Error('Printed value needs a handler: ' + property);
  return Number(value);
}
export const name = (m: Match, id: string) => cardDefinition(m, id).name;
export const system = (m: Match, site: string) => premiereSites[m.cards[site]?.blueprint]?.system;
export const atSite = (m: Match, site: string) => Object.values(m.cards).filter(c => c.zone === 'table' && c.location === site && !c.attachedTo && cardDefinition(m, c.id).type === 'Character');
export const adjacent = (m: Match, a: string, b: string) => m.locations.includes(a) && m.locations.includes(b) && system(m, a) === system(m, b) && Math.abs(m.locations.indexOf(a) - m.locations.indexOf(b)) === 1;
export const abilityAt = (m: Match, side: Side, site: string) => atSite(m, site).filter(c => c.owner === side).reduce((sum, c) => sum + printed(m, c.id, 'ability'), 0);
export const presence = (m: Match, side: Side, site: string) => abilityAt(m, side, site) >= 1;
export const generation = (m: Match, side: Side) => 1 + m.locations.reduce((sum, id) => sum + premiereSites[m.cards[id].blueprint].icons[side], 0);

export function controls(m: Match, side: Side, site: string): boolean {
  if (!m.locations.includes(site) || !presence(m, side, site) || presence(m, other(side), site)) return false;
  // Dark control of the Core Shaft increases Light's ability needed to control
  // Death Star sites, but does not erase ordinary Light presence there.
  if (side === 'light' && system(m, site) === 'Death Star' && m.locations.some(id => m.cards[id].blueprint === '101_1' && presence(m, 'dark', id) && !presence(m, 'light', id)))
    return abilityAt(m, side, site) >= 2;
  return true;
}

export const uniqueCharacters = new Set(['101_2', '101_5']);
export const characterLimits: Record<string, number> = {'101_2': 1, '101_5': 1, '1_30': 3, '1_31': 3};
export const isGuard = (blueprint: string) => ['1_26', '1_181'].includes(blueprint);
export const isJawa = (blueprint: string) => ['1_12', '1_182'].includes(blueprint);
export const attached = (m: Match, id: string) => Object.values(m.cards).filter(c => c.zone === 'table' && c.attachedTo === id);
export const isWarrior = (m: Match, id: string) => (cardDefinition(m, id).icons as string[]).includes('Warrior') || attached(m, id).some(c => ['1_64', '1_221'].includes(c.blueprint) && equipmentState(m).training[c.id] === 'warrior');
function equipmentBonus(m: Match, id: string, stat: 'power' | 'forfeit'): number {
  const host = m.cards[id], seen = new Set<string>(); let bonus = 0;
  for (const c of attached(m, id)) {
    if (seen.has(c.blueprint)) continue;
    // Separate training modes share a card title but modify different things.
    if (['1_64', '1_221'].includes(c.blueprint) && stat === 'power' && equipmentState(m).training[c.id] === 'power') {bonus++; seen.add(c.blueprint);}
    if (c.blueprint === '1_207') {bonus += host.location && system(m, host.location) === 'Death Star' ? 2 : 1; seen.add(c.blueprint);}
    if (c.blueprint === '1_40') {if (host.location && system(m, host.location) === 'Tatooine') bonus += 2; seen.add(c.blueprint);}
  }
  return bonus;
}

export function deploymentPayment(m: Match, id: string, site: string): Payment | null {
  if (cardDefinition(m, id).status === 'metadata-only') return null;
  const card = m.cards[id], def = cardDefinition(m, id);
  if (def.type !== 'Character' || !m.locations.includes(site)) return null;
  const side = card.owner, blueprint = card.blueprint;
  if (!premiereSites[m.cards[site].blueprint].icons[side] && !presence(m, side, site)) return null;
  const onTable = Object.values(m.cards).filter(c => c.zone === 'table');
  const limit = characterLimits[blueprint];
  if (limit && onTable.filter(c => c.owner === side && c.blueprint === blueprint).length >= limit) return null;
  if (uniqueCharacters.has(blueprint) && onTable.filter(c => c.owner === other(side) && uniqueCharacters.has(c.blueprint)).length >= 2) return null;
  if ((isJawa(blueprint) || blueprint === '1_196' || blueprint === '101_2') && system(m, site) !== 'Tatooine') return null;
  if (['1_170', '101_5'].includes(blueprint) && system(m, site) !== 'Death Star') return null;
  if (isJawa(blueprint)) {
    const ownCamp = m.cards[site].blueprint === (side === 'light' ? '1_131' : '1_292');
    return ownCamp ? {[side]: 1} : {dark: 1, light: 1};
  }
  let cost = printed(m, id, 'deploy');
  if (blueprint === '101_2' && m.cards[site].blueprint === '1_132') cost--;
  if (['1_28', '1_194'].includes(blueprint)) {
    const faction = side === 'light' ? 'Rebel' : 'Imperial';
    if (atSite(m, site).some(c => c.owner === side && cardDefinition(m, c.id).subType === faction && printed(m, c.id, 'ability') > 2)) cost = 0;
  }
  return {[side]: Math.max(0, cost)};
}

function mosEisleyBonus(m: Match, id: string): number {
  const card = m.cards[id], site = card.location;
  return card.zone === 'table' && card.owner === 'dark' && !!site && m.locations.includes(site) && m.cards[site].blueprint === '1_295' &&
    (['SPY', 'THIEF', 'BOUNTY_HUNTER', 'SMUGGLER'] as const).some(trait => hasCharacteristic(m, id, trait)) ? 1 : 0;
}

export function power(m: Match, id: string, defending = false, active: (id: string) => boolean = () => true): number {
  const card = m.cards[id], site = card.location, blueprint = card.blueprint;
  let value = printed(m, id, 'power');
  if (isGuard(blueprint) && defending) value += 4;
  if (blueprint === '1_170' && site && system(m, site) !== 'Death Star') value--;
  if (blueprint === '1_196' && site && atSite(m, site).filter(c => isSpecies(m, c.id, 'TUSKEN_RAIDER') && nonUnique(m, c.id) && active(c.id)).length >= 2) value++;
  if (blueprint === '1_12' && site && m.cards[site].blueprint === '1_292') value--;
  // Core Shaft's erratum applies anywhere, not only on Death Star (AR Appendix A).
  if (blueprint === '101_2' && m.locations.some(at => m.cards[at].blueprint === '101_1' && controls(m, 'light', at))) value += 2;
  const currentBattle = m.data.battle as {site: string; stage: string; runLuke?: boolean} | undefined;
  if (blueprint === '101_2' && currentBattle?.runLuke && currentBattle.stage !== 'complete' && site === currentBattle.site &&
      !Object.values(m.cards).some(c => c.zone === 'table' && c.blueprint === '101_5' && c.location && (c.location === site || adjacent(m, c.location, site)))) value += 2;
  value += equipmentBonus(m, id, 'power') + mosEisleyBonus(m, id);
  if (blueprint === '1_31' && site && nighttimeSites(m).includes(site)) value += 2;
  return Math.max(0, value);
}

export function forfeit(m: Match, id: string, active: (id: string) => boolean = () => true): number {
  const card = m.cards[id], site = card.location;
  let value = printed(m, id, 'forfeit');
  if (site && card.owner === 'light' && isWarrior(m, id) && active(id) && Object.values(m.cards).some(c => c.zone === 'table' && c.owner === 'light' && c.blueprint === '101_2' && c.location && active(c.id) && (c.location === site || adjacent(m, c.location, site)))) value++;
  if (site && card.owner === 'dark' && isSpecies(m, id, 'TUSKEN_RAIDER') && m.cards[site].blueprint === '1_293') value++;
  if (site && card.blueprint === '1_12' && m.cards[site].blueprint === '1_292') value--;
  value += equipmentBonus(m, id, 'forfeit') + mosEisleyBonus(m, id);
  return Math.max(0, value);
}

export function totalPower(m: Match, side: Side, site: string, defending = false, active: (id: string) => boolean = () => true): number {
  const members = atSite(m, site).filter(c => c.owner === side && active(c.id));
  return members.reduce((sum, c) => sum + power(m, c.id, defending, active), 0) +
    (members.some(c => c.blueprint === '1_196') && members.filter(c => isSpecies(m, c.id, 'TUSKEN_RAIDER') && nonUnique(m, c.id)).length >= 4 ? 2 : 0);
}

export const battleDestinyRequirement = (m: Match, side: Side, site: string) =>
  side === 'dark' && m.cards[site].blueprint === '1_130' || side === 'light' && m.cards[site].blueprint === '1_293' ? 6 : 4;

export function drainAmount(m: Match, side: Side, site: string): number {
  let value = premiereSites[m.cards[site].blueprint].icons[other(side)];
  const blueprint = m.cards[site].blueprint;
  if (side === 'light' && blueprint === '1_284' || side === 'dark' && blueprint === '1_293') value++;
  if (side === 'light' && blueprint === '101_4' && atSite(m, site).some(c => c.owner === side && cardDefinition(m, c.id).subType === 'Rebel' && printed(m, c.id, 'ability') > 2)) value += 2;
  return value;
}

export function moveWithAttachments(m: Match, id: string, site: string): void {
  const moving = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const card of Object.values(m.cards)) if (card.zone === 'table' && card.attachedTo && moving.has(card.attachedTo) && !moving.has(card.id)) {moving.add(card.id); added = true;}
  }
  for (const movingId of moving) m.cards[movingId].location = site;
}

const siteRank = (m: Match, id: string) => {
  const icons = cardDefinition(m, id).icons as string[];
  return icons.includes('Interior') && icons.includes('Exterior') ? 1 : icons.includes('Interior') ? 0 : 2;
};
/** The Mos Eisley city sites form an uninterrupted group (AR Appendix E).
 * Cantina is not in the current definition package; its future metadata must
 * join this group when that card is admitted. */
export function citySitesTogether(m: Match, order: string[]): boolean {
  const city = order.map((id, i) => ['1_129', '1_291', '1_295'].includes(m.cards[id].blueprint) ? i : -1).filter(i => i >= 0);
  return city.every((i, n) => !n || i === city[n - 1] + 1);
}
export function sitePlacements(m: Match, id: string): {id: string; label: string; replace?: string; index?: number}[] {
  if (!premiereSites[m.cards[id].blueprint]) return [];
  const duplicate = m.locations.find(at => name(m, at) === name(m, id));
  if (duplicate) return m.cards[duplicate].owner === m.cards[id].owner ? [] : [{id: 'over:' + duplicate, label: 'Convert ' + name(m, duplicate), replace: duplicate}];
  const group = m.locations.filter(at => system(m, at) === system(m, id));
  if (!group.length) return [{id: 'at:' + m.locations.length, label: 'Start the ' + system(m, id) + ' group', index: m.locations.length}];
  const first = m.locations.indexOf(group[0]);
  return Array.from({length: group.length + 1}, (_, i) => i).filter(i => {
    const order = [...group]; order.splice(i, 0, id); const ranks = order.map(at => siteRank(m, at));
    return citySitesTogether(m, order) && (ranks.every((v, n) => !n || v >= ranks[n - 1]) || ranks.every((v, n) => !n || v <= ranks[n - 1]));
  }).map(i => ({id: 'at:' + (first + i), label: i === group.length ? 'Place after ' + name(m, group.at(-1)!) : 'Place before ' + name(m, group[i]), index: first + i}));
}
/** Current location modifier, evaluated when the physical weapon destiny draws. */
export function weaponDrawBonus(m: Match, id: string): number {
  const c = m.cards[id];
  return c.owner === 'dark' && c.location && ['1_284', '1_132'].includes(m.cards[c.location].blueprint) ? 1 : 0;
}
