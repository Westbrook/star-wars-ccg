import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Json, Match} from './types';

type Restriction = {source: CardReference; target: CardReference; duration: 'turn' | 'source'; turn: number};
const entries = (m: Match) => (m.data.retrievalRestrictions ?? []) as unknown as Restriction[];
function validate(m: Match,p: Restriction): void {
  if(!p||!['turn','source'].includes(p.duration)||!Number.isSafeInteger(p.turn)||p.turn<1||p.turn>m.turn.number)throw Error('Invalid retrieval restriction.');
  assertCardReference(m,p.source);assertCardReference(m,p.target);
  if(p.duration==='source'&&p.source.zone!=='table')throw Error('Retrieval restriction needs a table source.');
}
/** Rule-owned restrictions. Target-instance changes and expiration are checked
 * live; a resolved turn restriction survives its source leaving the table. */
export function preventRetrievalContribution(m: Match,source: string,target: string,duration: 'turn' | 'source' = 'turn'): void {
  const p: Restriction={source:referenceCard(m,source),target:referenceCard(m,target),duration,turn:m.turn.number};validate(m,p);
  m.data.retrievalRestrictions=[...entries(m).filter(p=>p.duration==='source'||p.turn===m.turn.number),p] as unknown as Json;
}
export function mayContributeToRetrieval(m: Match,id: string): boolean {
  if(!m.cards[id])throw Error('Unknown retrieval contributor.');
  return !entries(m).some(p=>p.target.id===id&&sameCard(m,p.target)&&(p.duration==='turn'?p.turn===m.turn.number:sameCard(m,p.source)));
}
export function assertRetrievalRestrictions(m: Match): void {
  if(m.data.retrievalRestrictions!==undefined&&!Array.isArray(m.data.retrievalRestrictions))throw Error('Invalid retrieval restrictions.');
  entries(m).forEach(p=>validate(m,p));
}
