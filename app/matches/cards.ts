import manifest from '@/data/native-proof/manifest.json';
import sealed from '@/data/native-engine/sealed-cards.json';
import additional from '@/data/native-engine/additional-cards.json';
export const nativeCards=new Map([...sealed,...manifest.cards,...additional].map(c=>[c.gempId,c]));
export const nativeStarters=manifest.decks;
