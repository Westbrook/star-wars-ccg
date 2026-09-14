import type {Match,Side} from './types';

export const isOpeningStudy=(scenario:string)=>scenario==='first-contact'||scenario==='second-contact';
export const openingEndpoint=(m:Match)=>m.scenario==='second-contact'?5:3;
// Closed four-turn pool: characters with explicit handlers, their weapons and
// Barriers; the remaining listed characters cannot deploy on these Death Star sites.
export const secondContactSafe=(side:Side)=>side==='dark'
 ?['1_194','1_170','1_181','1_249','1_317','1_312','1_182','1_196']
 :['1_28','1_26','1_105','1_152','1_153','1_12','101_2'];
// Two cheap Dark troopers are deliberate: four ability plus initiating a battle
// costs at least 7 Force before Dark's second battle phase (only 6 generated).
// This caps pre-activation Light battle losses at 6, keeping its final activation
// inside the ten supported Reserve cards. See the reachability audit in tests.
export function secondContactOrder(m:Match,side:Side){
 const pool=Object.values(m.cards).filter(c=>c.owner===side).map(c=>c.id).sort(),of=(b:string)=>pool.filter(id=>m.cards[id].blueprint===b),dark=side==='dark';
 const troopers=of(dark?'1_194':'1_28'),guard=of(dark?'1_181':'1_26'),blasters=of(dark?'1_317':'1_152');
 const hand=[...troopers.slice(0,dark?2:4),...(dark?of('1_170'):[]),guard[0],...of(dark?'1_249':'1_105'),blasters[0],...of(dark?'1_312':'1_153')];
 const front=[...hand,...troopers.slice(dark?2:4),...guard.slice(1),...blasters.slice(1),...of(dark?'1_182':'1_12'),...of(dark?'1_196':'101_2')];
 if(hand.length!==8||new Set(front).size!==front.length||front.length!==(dark?22:18))throw Error('Invalid four-turn card order.');
 return [...front,...pool.filter(id=>!front.includes(id))];
}
