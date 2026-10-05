import {preparationStarting} from './preparation-starting';
import {invalidHothStarting,hothStartingOptions,deployHothStarting,assertHothStarting,hothStartingPlacements} from './hoth-setup';
import {sectorDefinitions,caveDefinitions} from './sector-definitions';
import manifest from '../../data/native-proof/manifest.json';
import {definition} from './definitions';
import type {LocationSetupRules} from './setup';
import type {Side} from './types';

// Printed setup metadata only. This is not a registry of fully playable cards.
export const premiereSites: Record<string, {system: string; icons: Record<Side, number>}> = Object.fromEntries([
  ['1_125', 'Death Star', 0, 0], ['106_8', 'Tatooine', 1, 1], ['106_18', 'Tatooine', 1, 1], ['101_1', 'Death Star', 1, 1], ['101_4', 'Death Star', 1, 0], ['1_124', 'Death Star', 1, 1], ['1_284', 'Death Star', 1, 0], ['1_285', 'Death Star', 1, 1],
  ['1_129', 'Tatooine', 1, 1], ['1_130', 'Tatooine', 1, 1], ['1_131', 'Tatooine', 1, 1], ['1_132', 'Tatooine', 1, 2], ['1_291', 'Tatooine', 1, 1], ['1_292', 'Tatooine', 1, 1], ['1_293', 'Tatooine', 1, 1], ['1_295', 'Tatooine', 2, 1],
  ['5_79', 'Bespin', 1, 1],
  ['3_61', 'Hoth', 0, 1], ['3_63', 'Hoth', 1, 1], ['3_56', 'Hoth', 1, 1], ['3_144', 'Hoth', 2, 1], ['3_62', 'Hoth', 1, 1], ['3_149', 'Hoth', 1, 0], ['3_148', 'Hoth', 2, 0], ['104_4', 'Hoth', 1, 0], ['3_150', 'Hoth', 2, 0], ['3_60', 'Hoth', 0, 1], ['3_59', 'Hoth', 0, 1], ['3_147', 'Hoth', 1, 1],
].map(([id, system, dark, light]) => [id, {system, icons: {dark, light}}])) as Record<string, {system: string; icons: Record<Side, number>}>;

export const premiereSystems: Record<string,{system:string;icons:Record<Side,number>;parsec:number;mobile?:boolean;hyperspeed?:number}> = {
  '106_2':{system:'Corulag',icons:{dark:1,light:2},parsec:4},
  '106_12':{system:'Corulag',icons:{dark:2,light:1},parsec:4},
  '3_55':{system:'Hoth',icons:{dark:1,light:2},parsec:5},
  '3_143':{system:'Hoth',icons:{dark:2,light:1},parsec:5},
  '5_76':{system:'Bespin',icons:{dark:1,light:2},parsec:6},
  '5_164':{system:'Bespin',icons:{dark:2,light:1},parsec:6},
  '2_143':{system:'Death Star',icons:{dark:3,light:0},parsec:0,mobile:true,hyperspeed:1},
  '1_135':{system:'Yavin 4',icons:{dark:1,light:2},parsec:4},
  '1_296':{system:'Yavin 4',icons:{dark:2,light:1},parsec:4},
  '1_127':{system:'Tatooine',icons:{dark:1,light:2},parsec:7},
  '1_289':{system:'Tatooine',icons:{dark:2,light:1},parsec:7},
};
export const premiereLocations:Record<string,{system:string;icons:Record<Side,number>}>={...premiereSites,...premiereSystems,...sectorDefinitions,...caveDefinitions};

const definitions = new Map(manifest.cards.map(card => [card.gempId, card]));
export const premiereSetup: LocationSetupRules = {
  interrupts:preparationStarting,
  invalidStarting:invalidHothStarting,additionalOptions:hothStartingOptions,deployAdditional:deployHothStarting,validateAdditional:assertHothStarting,
  firstPlayer: match => match.setup?.selected.dark && match.cards[match.setup.selected.dark]?.blueprint==='2_143' ? 'light' : 'dark',
  // Ordinary locations plus the two implemented preparation Interrupts and
  // their eligible Effects. Other special starting sequences remain gated.
  ordinarySetup: match => Object.values(match.cards).every(card => definitions.has(card.blueprint)||['6_77','6_160','9_139','9_51','4_21','4_134','6_58','6_147','8_35','8_118','2_143'].includes(card.blueprint)),
  location: (match, id) => {
    const blueprint = match.cards[id]?.blueprint, site = premiereLocations[blueprint];
    return site && !caveDefinitions[blueprint] && (!sectorDefinitions[blueprint] || sectorDefinitions[blueprint].unique) ? {identity: definition(blueprint).name, group: site.system, icons: site.icons, convertible: true} : null;
  },
  name: (match, id) => definition(match.cards[id].blueprint).name,
  placements: (match, ids) => {
    const hoth=hothStartingPlacements(match,ids);if(hoth)return hoth;
    const same = premiereLocations[match.cards[ids[0]].blueprint].system === premiereLocations[match.cards[ids[1]].blueprint].system;
    const hasSystem=ids.some(id=>premiereSystems[match.cards[id].blueprint]||sectorDefinitions[match.cards[id].blueprint]);
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
