import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {piles, type Match} from './types';

/** AR p10: revealing does not remove a card. Moving/replacing it, including
 * within the same pile, or shuffling that pile ends the reveal. Zone identity
 * alone cannot detect those operations, so track only cards ever revealed. */
export type PileReveal = {card: CardReference; manipulation: number};
const versions = (m:Match) => (m.data.revealVersions ?? {}) as Record<string,number>;
export function revealPileCard(m:Match,id:string):PileReveal {
  if(!(piles as readonly string[]).includes(m.cards[id]?.zone))throw Error('Reveal requires a pile card.');
  const v=(m.data.revealVersions??={}) as Record<string,number>;v[id]??=0;
  return {card:referenceCard(m,id),manipulation:v[id]};
}
export function invalidatePileReveals(m:Match,ids:readonly string[]):void {
  const v=versions(m);
  for(const id of ids)if(v[id]!==undefined){if(!Number.isSafeInteger(v[id]+1))throw Error('Reveal history exhausted.');v[id]++;}
}
export const stillRevealed=(m:Match,p:PileReveal):boolean=>sameCard(m,p.card)&&versions(m)[p.card.id]===p.manipulation;
export function assertPileReveal(m:Match,p:PileReveal):void {
  if(!p)throw Error('Missing pile reveal.');assertCardReference(m,p.card);
  if(!(piles as readonly string[]).includes(p.card.zone)||!Number.isSafeInteger(p.manipulation)||p.manipulation<0||versions(m)[p.card.id]===undefined||p.manipulation>versions(m)[p.card.id])throw Error('Invalid pile reveal.');
}
export function assertRevealVersions(m:Match):void {
  const v=m.data.revealVersions;if(v===undefined)return;
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.entries(v).some(([id,n])=>!m.cards[id]||typeof n!=='number'||!Number.isSafeInteger(n)||n<0))throw Error('Invalid reveal history.');
}
