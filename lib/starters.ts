import manifest from '@/data/starter-decks.json';
import {sameCards, type CatalogCard} from './catalog';

export type StarterDeck = {
  id: string; title: string; side: 'light' | 'dark'; size: 40 | 60;
  format: 'open' | 'open40card'; libraryName: string; description: string;
  main: string[]; outside: string[]; virtualCount: number; contentsSha256: string;
};
export const starterDecks = manifest.decks as StarterDeck[];
export const starterSource = manifest.source;
export function starterFor(side: string, size: number): StarterDeck {
  const deck = starterDecks.find(d => d.side === side && d.size === size);
  if (!deck) throw new Error('Choose a supported starter side and format.');
  return deck;
}
export const starterFormat = (size: number) => size === 60 ? 'Open · 60 cards' : 'GEMP Open 40 · variant';
export const formatResultId = (size: number) => size === 60 ? 'deckstats-format-Open-content' : 'deckstats-format-Open-40-cards-content';

export function checkStarterCards(deck: StarterDeck, cards: CatalogCard[]) {
  if (!cards.length) throw new Error('Wait for the card archive to finish loading.');
  const known = new Map(cards.filter(c => c.gempId).map(c => [c.gempId, c]));
  if (deck.main.length !== deck.size || [...deck.main, ...deck.outside].some(id => known.get(id)?.side !== deck.side)) {
    throw new Error('This starter no longer matches the available card archive. Refresh the page before using it.');
  }
}
export function checkStarterVersion(deck: StarterDeck, main: string[], outside: string[]) {
  if (!sameCards(deck.main, main) || !sameCards(deck.outside, outside)) {
    throw new Error('The rules service has a different version of this starter. Open its full deck editor to review the current list.');
  }
}
export function checkFormatResult(size: number, result: Element | null) {
  if (!result?.classList.contains('deckstats-format-valid')) {
    throw new Error(`${starterFormat(size)}: ${result?.textContent?.trim() || 'The rules service could not verify this format.'}`);
  }
}
