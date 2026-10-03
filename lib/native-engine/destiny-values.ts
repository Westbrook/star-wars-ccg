import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import type {Json, Match} from './types';
type Choice = {card: CardReference; value: number};
const choices = (m: Match) => (m.data.printedDestinyChoices ?? []) as unknown as Choice[];
export const alternateDestinies = (m: Match, id: string): readonly number[] => m.cards[id]?.blueprint === '2_14' ? [2, 5] : [];
/** A draw's selected printed value remains fixed for that unresolved card visit. */
export function selectedPrintedDestiny(m: Match, id: string): number | undefined {
  return choices(m).find(c => c.card.id === id && sameCard(m,c.card))?.value;
}
export function choosePrintedDestiny(m: Match, id: string, value: number): void {
  if (m.cards[id]?.zone !== 'destiny' || !alternateDestinies(m,id).includes(value) || selectedPrintedDestiny(m,id) !== undefined) throw Error('Invalid printed destiny choice.');
  m.data.printedDestinyChoices = [...choices(m).filter(c => sameCard(m,c.card)),{card:referenceCard(m,id),value}] as unknown as Json;
}
export function assertPrintedDestinies(m: Match): void {
  if (m.data.printedDestinyChoices !== undefined && !Array.isArray(m.data.printedDestinyChoices)) throw Error('Invalid printed destiny choices.');
  const seen = new Set<string>();
  for (const c of choices(m)) {
    if (!c || !alternateDestinies(m,c.card?.id).includes(c.value)) throw Error('Invalid printed destiny value.');
    assertCardReference(m,c.card); const key=c.card.id+':'+c.card.version;
    if (c.card.zone !== 'destiny' || seen.has(key)) throw Error('Invalid printed destiny reference.');
    seen.add(key);
  }
}
