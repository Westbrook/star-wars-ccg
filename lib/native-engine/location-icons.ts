import {premiereLocations} from './premiere-setup';
import type {Match,Side} from './types';
/** A destroyed site retains its board position and marker, but no Force icons. */
export const forceIcons=(m:Match,id:string,side:Side)=>m.cards[id]?.blownAway?0:premiereLocations[m.cards[id]?.blueprint]?.icons[side]??0;
