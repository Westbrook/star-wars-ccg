import {cardDefinition} from './definitions';
import type {Match} from './types';

/** AR Appendix B, Lift Tube: never unpiloted; it may never exist anywhere
 * other than an interior mobile site, even if its game text is canceled. */
export const liftTube=(m:Match,id:string)=>['1_148','1_308'].includes(m.cards[id]?.blueprint);
export function liftTubeDestination(m:Match,site:string):boolean {
 const c=m.cards[site];if(!c||c.zone!=='table'||c.coveredBy||c.blownAway||!m.locations.includes(site))return false;
 const d=cardDefinition(m,site),icons=d.icons as string[];
 return d.subType==='Site'&&icons.includes('Interior')&&icons.includes('Mobile');
}
