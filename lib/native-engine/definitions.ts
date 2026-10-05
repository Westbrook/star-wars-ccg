import manifest from '../../data/native-proof/manifest.json';
import additionalCards from '../../data/native-engine/additional-cards.json';
import objectiveFaces from '../../data/native-engine/objective-faces.json';
import type {Match} from './types';

const cards = new Map([...manifest.cards, ...additionalCards].map(card => [card.gempId, card]));
export function definition(blueprint: string, face?: 'back') {
  const active = face === 'back' ? (objectiveFaces as Record<string,string>)[blueprint] : blueprint;
  if (!active) throw Error('Card has no implemented reverse face: ' + blueprint);
  const card = cards.get(active);
  if (!card) throw Error('Card needs an explicit native definition: ' + blueprint);
  return card;
}
export const cardDefinition = (m: Match, id: string) => definition(m.cards[id].blueprint, m.cards[id].face);
