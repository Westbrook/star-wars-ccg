import {decks as preparationDecks} from './preparation-starting-fixture.mjs';
export {rules,runtime} from './preparation-starting-fixture.mjs';
export const decks=(options={})=>preparationDecks(options).map(d=>({...d,cards:d.cards.map(c=>['9_51','9_139'].includes(c)?d.side==='light'?'6_77':'6_160':c)}));
