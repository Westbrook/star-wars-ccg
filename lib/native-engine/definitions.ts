import manifest from '../../data/native-proof/manifest.json';
import additionalCards from '../../data/native-engine/additional-cards.json';
import type {Match} from './types';

const cards = new Map([...manifest.cards, ...additionalCards].map(card => [card.gempId, card]));
export function definition(blueprint: string) {
  const card = cards.get(blueprint);
  if (!card) throw Error('Card needs an explicit native definition: ' + blueprint);
  return card;
}
export const cardDefinition = (m: Match, id: string) => definition(m.cards[id].blueprint);
