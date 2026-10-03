import manifest from '@/data/native-proof/manifest.json';
import additional from '@/data/native-engine/additional-cards.json';
export const nativeCards=new Map([...manifest.cards,...additional].map(c=>[c.gempId,c]));
export const nativeStarters=manifest.decks;
