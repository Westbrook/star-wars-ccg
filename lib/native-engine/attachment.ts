import {cardDefinition} from './definitions';
import {canCarryWeapon} from './weapon-carrying';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Match} from './types';

export type AttachmentAttempt = {cardRef: CardReference; hostRef: CardReference; transfer: boolean; fromHost: string | null};
/** Capture after a hand deployment enters 'playing'; transfers stay on table. */
export function attachmentAttempt(m: Match, card: string, host: string): AttachmentAttempt {
  return {cardRef: referenceCard(m, card), hostRef: referenceCard(m, host), transfer: m.cards[card].zone === 'table', fromHost: m.cards[card].attachedTo ?? null};
}
export function validAttachmentAttempt(m: Match, a: AttachmentAttempt): boolean {
  return !!a && (cardDefinition(m,a.cardRef.id).type!=='Weapon'||canCarryWeapon(m,a.hostRef.id)) && sameCard(m, a.cardRef) && sameCard(m, a.hostRef) && a.hostRef.zone === 'table' &&
    (a.transfer ? a.cardRef.zone === 'table' && m.cards[a.cardRef.id].attachedTo === a.fromHost && m.cards[a.cardRef.id].location === m.cards[a.hostRef.id].location : a.cardRef.zone === 'playing');
}
export function assertAttachmentAttempt(m: Match, a: AttachmentAttempt, card: string, host: string): void {
  if (!a || typeof a.transfer !== 'boolean' || a.fromHost !== null && !m.cards[a.fromHost] || a.transfer !== (a.cardRef?.zone === 'table') || !['table', 'playing'].includes(a.cardRef?.zone) || a.hostRef?.zone !== 'table') throw Error('Invalid attachment attempt.');
  assertCardReference(m, a.cardRef, card); assertCardReference(m, a.hostRef, host);
}
