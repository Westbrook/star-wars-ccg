import {definition,printed} from './catalog';
import type {Match,Side} from './types';

// These handlers are admitted only by the new closed garrison fixtures. No
// implicit text parsing or additional cards are enabled in earlier saved games.
export const isGarrisonStudy=(s:string)=>s==='guard-post'||s==='rebel-post';
export const isGuard=(blueprint:string)=>blueprint==='1_26'||blueprint==='1_181';
export function supportedCharacter(m:Match,side:Side,blueprint:string){
 return blueprint===(side==='light'?'1_28':'1_194')||isGarrisonStudy(m.scenario)&&(side==='light'?blueprint==='1_26':['1_170','1_181'].includes(blueprint));
}
export function characterDeployCost(blueprint:string){return printed(blueprint,'deploy');}
export function characterCanDeploy(m:Match,blueprint:string,site:string){
 return blueprint!=='1_170'||definition(m.cards[site].blueprint).name.startsWith('Death Star:');
}
export function characterCanMove(m:Match,id:string){return !isGarrisonStudy(m.scenario)||!isGuard(m.cards[id].blueprint);}
export function characterPower(m:Match,id:string,initiator?:Side){
 const c=m.cards[id];let power=printed(c.blueprint,'power');
 if(!isGarrisonStudy(m.scenario))return power;
 if(isGuard(c.blueprint)&&initiator&&c.owner!==initiator)power+=4;
 if(c.blueprint==='1_170'&&c.location&&!definition(m.cards[c.location].blueprint).name.startsWith('Death Star:'))power-=1;
 return power;
}
export function characterView(m:Match,id:string){
 const c=m.cards[id];if(!isGarrisonStudy(m.scenario)||!supportedCharacter(m,c.owner,c.blueprint))return undefined;
 const battle=m.battle,participating=!!battle&&!battle.resolved&&battle.participants[c.owner].includes(id);
 return {power:characterPower(m,id,participating?battle.initiator:undefined),printedPower:printed(c.blueprint,'power'),canMove:characterCanMove(m,id),notes:isGuard(c.blueprint)?['Power +4 only when defending a battle.','Cannot move; this is printed game text.']:c.blueprint==='1_170'?['Deploys only on Death Star.','Power −1 at other sites; may move elsewhere.']:[]};
}
