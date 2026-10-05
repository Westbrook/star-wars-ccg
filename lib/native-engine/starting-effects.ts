import {battlePlanBlueprints,battlePlanDeployment,battlePlanInitiate} from './battle-plan';
import {tryEffectBlueprints,tryEffectInitiate} from './try-effects';
import {resistanceBlueprints,resistanceDeployment,resistanceInitiate} from './resistance';
import {name} from './board';
import type {Match,Resolution} from './types';
/** Explicit real deployment adapters; printed eligibility alone never admits
 * an unimplemented Effect to the native engine. */
export const startingEffectBlueprints=[...tryEffectBlueprints,...resistanceBlueprints,...battlePlanBlueprints];
export function initiateStartingEffect(m:Match,card:string){
 const plan=battlePlanBlueprints.includes(m.cards[card].blueprint);
 const resist=resistanceBlueprints.includes(m.cards[card].blueprint);
 if(!startingEffectBlueprints.includes(m.cards[card].blueprint))throw Error('Unimplemented starting Effect.');
 const r:Resolution={kind:'resolution',actor:m.cards[card].owner,cancelled:false,action:plan?battlePlanDeployment(m,card):resist?resistanceDeployment(m,card):{id:'try-effect:deploy:'+card,handler:'try-effect:deploy',source:card,label:'Deploy '+name(m,card),payload:{card}}};
 m.stack.push(r);if(plan)battlePlanInitiate(m,r);else if(resist)resistanceInitiate(m,r);else tryEffectInitiate(m,r);
}
