import manifest from '../../data/native-proof/manifest.json';
import {definition} from './definitions';
import type {LocationSetupRules} from './setup';
import type {Side} from './types';

// Printed setup metadata only. This is not a registry of fully playable cards.
export const premiereSites: Record<string, {system: string; icons: Record<Side, number>}> = Object.fromEntries([
  ['101_1', 'Death Star', 1, 1], ['101_4', 'Death Star', 1, 0], ['1_124', 'Death Star', 1, 1], ['1_284', 'Death Star', 1, 0], ['1_285', 'Death Star', 1, 1],
  ['1_129', 'Tatooine', 1, 1], ['1_130', 'Tatooine', 1, 1], ['1_131', 'Tatooine', 1, 1], ['1_132', 'Tatooine', 1, 2], ['1_291', 'Tatooine', 1, 1], ['1_292', 'Tatooine', 1, 1], ['1_293', 'Tatooine', 1, 1], ['1_295', 'Tatooine', 2, 1],
  ['5_79', 'Bespin', 1, 1],
  ['3_60', 'Hoth', 0, 1], ['3_59', 'Hoth', 0, 1], ['3_147', 'Hoth', 1, 1],
].map(([id, system, dark, light]) => [id, {system, icons: {dark, light}}])) as Record<string, {system: string; icons: Record<Side, number>}>;

export const premiereSystems: Record<string,{system:string;icons:Record<Side,number>;parsec:number;mobile?:boolean;hyperspeed?:number}> = {
  '2_143':{system:'Death Star',icons:{dark:3,light:0},parsec:0,mobile:true,hyperspeed:1},
  '1_135':{system:'Yavin 4',icons:{dark:1,light:2},parsec:4},
  '1_296':{system:'Yavin 4',icons:{dark:2,light:1},parsec:4},
  '1_127':{system:'Tatooine',icons:{dark:1,light:2},parsec:7},
  '1_289':{system:'Tatooine',icons:{dark:2,light:1},parsec:7},
};
export const premiereLocations:Record<string,{system:string;icons:Record<Side,number>}>={...premiereSites,...premiereSystems};

const definitions = new Map(manifest.cards.map(card => [card.gempId, card]));
export const premiereSetup: LocationSetupRules = {
  firstPlayer: match => match.setup?.selected.dark && match.cards[match.setup.selected.dark]?.blueprint==='2_143' ? 'light' : 'dark',
  // These authored decks have no Objectives, Starting Effects/Interrupts or
  // other starting actions. Unknown cards cannot enter this setup path.
  ordinarySetup: match => Object.values(match.cards).every(card => definitions.has(card.blueprint)),
  location: (match, id) => {
    const blueprint = match.cards[id]?.blueprint, site = premiereLocations[blueprint];
    return site ? {identity: definition(blueprint).name, group: site.system, icons: site.icons, convertible: true} : null;
  },
  name: (match, id) => definition(match.cards[id].blueprint).name,
  placements: (match, ids) => {
    const same = premiereLocations[match.cards[ids[0]].blueprint].system === premiereLocations[match.cards[ids[1]].blueprint].system;
    const hasSystem=ids.some(id=>premiereSystems[match.cards[id].blueprint]);
    if(hasSystem)return {side:'light',choices: same ? [
      {id:'left',label:'Place Light’s location left of Dark’s',order:[ids[1],ids[0]]},
      {id:'right',label:'Place Light’s location right of Dark’s',order:[...ids]},
    ] : [{id:'separate',label:'Place locations in separate systems',order:[...ids]}]};
    return same ? {side: 'light', choices: [
      {id: 'left', label: 'Place Light’s site left of Dark’s', order: [ids[1], ids[0]]},
      {id: 'right', label: 'Place Light’s site right of Dark’s', order: [...ids]},
    ]} : {side: 'dark', choices: [{id: 'separate', label: 'Place sites in separate systems', order: [...ids]}]};
  },
};
