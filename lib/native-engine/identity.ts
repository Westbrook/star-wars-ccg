import {piles, type Match, type Zone} from './types';

/** Physical deck IDs are permanent. References to a particular visit to a zone
 * are not: leaving and returning must not revive an old target or modifier. */
export type CardReference = {id: string; zone: Zone; version: number};
export const cardVersion = (m: Match, id: string): number => (m.data.cardVersions as Record<string, number> | undefined)?.[id] ?? 0;
export function referenceCard(m: Match, id: string): CardReference {
  const card = m.cards[id]; if (!card) throw Error('Unknown referenced card.');
  return {id, zone: card.zone, version: cardVersion(m, id)};
}
export function sameCard(m:Match,ref:CardReference):boolean {
  const c=ref&&m.cards[ref.id];if(!c||cardVersion(m,ref.id)!==ref.version)return false;
  if(c.zone===ref.zone)return true;
  // Going undercover and breaking cover do not leave play. Keep modifiers and
  // original targets bound to this physical visit, while ordinary captivity and
  // inactive cargo retain their stricter state/targeting boundaries.
  if(!['table','inactive'].includes(c.zone)||!['table','inactive'].includes(ref.zone))return false;
  const records=(m.data.undercover??[]) as unknown as {card:CardReference;ended?:true}[];
  return Array.isArray(records)&&records.some(p=>p.card?.id===ref.id&&p.card.version===ref.version&&(c.zone==='table'||!p.ended&&!c.attachedTo&&!c.captivity&&!c.coveredBy));
}
export function assertCardReference(m: Match, ref: CardReference, id?: string): void {
  if (!ref || !m.cards[ref.id] || id !== undefined && ref.id !== id || ![...piles, 'table', 'playing', 'leaving', 'buried', 'stacked', 'captive', 'inactive', 'out'].includes(ref.zone) || !Number.isSafeInteger(ref.version) || ref.version < 0 || ref.version > cardVersion(m, ref.id)) throw Error('Invalid card instance reference.');
}
export function assertCardVersions(m: Match): void {
  const versions = m.data.cardVersions;
  if (versions === undefined) return; // Pre-instance snapshots begin at zero.
  if (!versions || typeof versions !== 'object' || Array.isArray(versions) || Object.entries(versions).some(([id, version]) => !m.cards[id] || !Number.isSafeInteger(version) || typeof version !== 'number' || version < 1)) throw Error('Invalid card instance history.');
}
