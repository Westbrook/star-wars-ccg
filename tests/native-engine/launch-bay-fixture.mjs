import {fixture} from './captured-ships-fixture.mjs';
import {bayDecks,deployBay} from './ship-sites-fixture.mjs';
import {pull,phase} from './prisoner-fixture.mjs';
export function launchFixture(){
 const decks=bayDecks().map(d=>{const extra=d.side==='dark'?['1_304','1_300','1_167']:['1_132'];return {...d,cards:[...d.cards.slice(0,10),...extra,...d.cards.slice(10,-extra.length)]};});
 const f=fixture(2,{capture:false,decks});
 f.bay=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');f.m=deployBay(f.m,f.bay,f.host);
 return f;
}
