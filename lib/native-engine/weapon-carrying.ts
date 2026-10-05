import {gameTextActive} from './game-text';
import type {Match} from './types';
export const disarmingEffect=(bp:string)=>bp==='1_48'||bp==='1_214';
export const disarmedByEffect=(m:Match,id:string)=>Object.values(m.cards).some(c=>c.attachedTo===id&&disarmingEffect(c.blueprint)&&gameTextActive(m,c.id));
export const canCarryWeapon=(m:Match,id:string)=>!disarmedByEffect(m,id);
