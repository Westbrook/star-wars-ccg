import {undercoverTargetable} from './undercover-state';
import {adjacent, cardDefinition} from './board';
import {gameTextActive} from './game-text';
import type {Match} from './types';

/** Named-card protection is independent of battle attrition immunity. Current
 * provider covers Vaporator's ground-site range; future grants share this query. */
export function immuneToCardTitle(m: Match, target: string, title: string): boolean {
  const c=m.cards[target];
  if (!c || c.zone!=='table'&&!undercoverTargetable(m,target) || c.coveredBy || cardDefinition(m,target).type!=='Character' || !c.location || title!=='Gravel Storm') return false;
  return Object.values(m.cards).some(v=>{
    if (v.blueprint!=='1_41' || !gameTextActive(m,v.id)) return false;
    const site=v.attachedTo ?? v.location;
    return !!site && m.locations.includes(site) && (c.location===site || adjacent(m,c.location!,site));
  });
}
