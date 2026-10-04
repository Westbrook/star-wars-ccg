import {locationAbility} from './location-ability';
import {ability} from './ability';
import {cardDefinition, forfeit, power, totalPower} from './board';
import {unitsAt} from './occupancy';
import {battleMembers} from './participation';
import type {Battle} from './battle';
import {sides, type Match} from './types';

/** Derived public information, shared by both seats. Only active characters and sites are returned; no hidden card identities or
 * pile order leave this projection. Clients need not reimplement modifiers. */
export function publicValues(m: Match) {
  const battle = m.data.battle as Battle | undefined;
  const activeBattle = battle && battle.stage !== 'complete' ? battle : undefined;
  const participants = new Set(activeBattle ? sides.flatMap(side => battleMembers(m, side)) : []);
  const characters = Object.fromEntries(Object.values(m.cards).filter(c => c.zone === 'table' && cardDefinition(m, c.id).type === 'Character').map(c => {
    const inBattle = activeBattle && participants.has(c.id);
    return [c.id, {power: power(m, c.id, !!inBattle && activeBattle.initiator !== c.owner),
      defendingPower: power(m, c.id, true), ability: ability(m, c.id), forfeit: forfeit(m, c.id)}];
  }));
  const sites = Object.fromEntries(m.locations.map(site => [site, Object.fromEntries(sides.map(side => {
    const active = activeBattle?.site === site ? (id: string) => participants.has(id) : () => true;
    return [side, {power: totalPower(m, side, site, false, active), defendingPower: totalPower(m, side, site, true, active),
      ability: locationAbility(m,side,site,unitsAt(m,site).filter(c=>c.owner===side&&active(c.id)).reduce((n,c)=>n+ability(m,c.id),0))}];
  }))]));
  return {characters, sites};
}
