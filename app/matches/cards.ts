import manifest from '@/data/native-proof/manifest.json';
import sealed from '@/data/native-engine/sealed-cards.json';
import additional from '@/data/native-engine/additional-cards.json';
import objectiveFaces from '@/data/native-engine/objective-faces.json';
import type {Card} from '@/lib/native-engine/types';
const allFaces=new Map([...sealed,...manifest.cards,...additional].map(c=>[c.gempId,c]));
const reverseFaces=new Set(Object.values(objectiveFaces));
// Deck builders enumerate physical front-face copies, never separate reverses.
export const nativeCards=new Map([...allFaces].filter(([id])=>!reverseFaces.has(id)));
/** Read the active face without changing the physical card's blueprint. */
export function nativeCard(card:Pick<Card,'blueprint'|'face'>){
 const back=(objectiveFaces as Record<string,string>)[card.blueprint];
 return allFaces.get(card.face==='back'&&back?back:card.blueprint);
}
export const nativeStarters=manifest.decks;
