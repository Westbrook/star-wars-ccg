import {decks as base} from './preparation-starting-fixture.mjs';
export {rules,runtime,playing,step,prompt,advance} from './preparation-starting-fixture.mjs';
export const decks=({size=60,first='dark',three=false,immune=false}={})=>base({size,first}).map(d=>({...d,cards:[d.cards[0],three?d.cards[1]:d.side==='light'?'6_77':'6_160',...Array(2).fill(d.side==='light'?'102_1':'102_6'),...(immune?[d.side==='light'?'4_21':'4_134']:[]),...Array(size).fill(d.side==='light'?'1_28':'1_194')].slice(0,size)}));
