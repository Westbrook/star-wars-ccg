import {fixture,shipDecks,ending} from './captured-ships-fixture.mjs';
import {mod,pull,phase,step,seek,ids,state} from './prisoner-fixture.mjs';
export const bayDecks=()=>shipDecks().map(d=>d.side==='light'?{...d,cards:[...d.cards.slice(0,9),'1_135',...d.cards.slice(9,-1)]}:d.side==='dark'?{...d,cards:[...d.cards.slice(0,5),'4_165','4_165','4_165','1_302',...d.cards.slice(5,-4)]}:d);
export function bayFixture(){const f=fixture(2,{capture:false,decks:bayDecks()});f.bay=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');return f;}
export function deployBay(m,bay,host){const choice=ids(m).find(id=>id.startsWith('ship-site:deploy:'+bay+':'+host+':'));if(!choice)throw Error('No bay deployment');m=step(m,choice);return seek(m,x=>x.cards[bay].zone==='table');}
export function captureAtBay(f){let m=ending(f);const high=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_241');state.moveCard(m,high,'used');state.moveCard(m,high,'reserve');m=step(m,'tractor:use:'+f.beam+':'+f.host);return seek(m,x=>!!x.cards[f.ship].capturedShip||x.stack.at(-1)?.handler==='tractor:custody');}
