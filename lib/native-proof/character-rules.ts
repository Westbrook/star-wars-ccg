import {isFrontierStudy,isJawa} from './frontier-rules';
import {isDesertStudy,desertCharacters,desertDeployCost,desertCanDeploy,desertPowerBonus,characterForfeit} from './desert-rules';
import {definition,printed} from './catalog';
import type {Match,Side} from './types';

// These handlers are admitted only by the closed garrison and four-turn fixtures. No
// implicit text parsing or additional cards are enabled in earlier saved games.
export const isGarrisonStudy=(s:string)=>s==='guard-post'||s==='rebel-post';
export const usesCharacterRules=(s:string)=>isGarrisonStudy(s)||s==='second-contact'||isDesertStudy(s);
export const isGuard=(blueprint:string)=>blueprint==='1_26'||blueprint==='1_181';
export function supportedCharacter(m:Match,side:Side,blueprint:string){
 if(isFrontierStudy(m.scenario)&&blueprint===(side==='light'?'1_12':'1_182'))return true;
 if(isDesertStudy(m.scenario))return desertCharacters(side).includes(blueprint);
 return blueprint===(side==='light'?'1_28':'1_194')||usesCharacterRules(m.scenario)&&(side==='light'?blueprint==='1_26':['1_170','1_181'].includes(blueprint));
}
export function characterDeployCost(blueprint:string,m?:Match,site?:string){return m&&site&&isDesertStudy(m.scenario)?desertDeployCost(m,blueprint,site):printed(blueprint,'deploy');}
export function characterCanDeploy(m:Match,blueprint:string,site:string){
 if(isDesertStudy(m.scenario)&&!desertCanDeploy(m,blueprint,site))return false;
 return blueprint!=='1_170'||definition(m.cards[site].blueprint).name.startsWith('Death Star:');
}
export function characterCanMove(m:Match,id:string){return !usesCharacterRules(m.scenario)||!isGuard(m.cards[id].blueprint);}
export function characterPower(m:Match,id:string,initiator?:Side){
 const c=m.cards[id];let power=printed(c.blueprint,'power');
 if(!usesCharacterRules(m.scenario))return power;
 if(isGuard(c.blueprint)&&initiator&&c.owner!==initiator)power+=4;
 if(c.blueprint==='1_170'&&c.location&&!definition(m.cards[c.location].blueprint).name.startsWith('Death Star:'))power-=1;
 return power+(isDesertStudy(m.scenario)?desertPowerBonus(m,id):0);
}
export function characterView(m:Match,id:string){
 const c=m.cards[id];if(!usesCharacterRules(m.scenario)||!supportedCharacter(m,c.owner,c.blueprint))return undefined;
 const battle=m.battle,participating=!!battle&&!battle.resolved&&battle.participants[c.owner].includes(id);
 return {...(isDesertStudy(m.scenario)?{forfeit:characterForfeit(m,id),printedForfeit:printed(c.blueprint,'forfeit')}:{}),power:characterPower(m,id,participating?battle.initiator:undefined),printedPower:printed(c.blueprint,'power'),canMove:characterCanMove(m,id),notes:isFrontierStudy(m.scenario)&&isJawa(c.blueprint)?['Deploys only on Tatooine. Normally uses 1 Force from each player.','Light Jawas at Jawa Camp use only 1 Light Force.']:c.blueprint==='101_2'?['Your warriors here and at adjacent sites are forfeit +1.','Luke is a warrior, so his own forfeit is 5 while active.']:c.blueprint==='1_196'?['Power +1 with another active Tusken Raider present.','Four or more Raiders add 2 to total power here, once.']:isGuard(c.blueprint)?['Power +4 only when defending a battle.','Cannot move; this is printed game text.']:c.blueprint==='1_170'?['Deploys only on Death Star.','Power −1 at other sites; may move elsewhere.']:[]};
}
