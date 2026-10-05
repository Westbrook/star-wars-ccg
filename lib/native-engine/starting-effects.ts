import {battlePlanBlueprints,battlePlanDeployment,battlePlanInitiate} from './battle-plan';
import {tryEffectBlueprints,tryEffectInitiate} from './try-effects';
import {resistanceBlueprints,resistanceDeployment,resistanceInitiate} from './resistance';
import {name} from './board';
import {forceEffectBlueprints,forceEffectDeployment,forceEffectInitiate} from './force-effects';
import {phaseEffectBlueprints,phaseEffectDeployment,phaseEffectInitiate} from './phase-effects';
import type {Match,Resolution} from './types';
/** Explicit real deployment adapters; printed eligibility alone never admits
 * an unimplemented Effect to the native engine. */
const preparationEffectBlueprints=[...tryEffectBlueprints,...resistanceBlueprints,...battlePlanBlueprints];
export const startingEffectBlueprints=[...preparationEffectBlueprints,...forceEffectBlueprints,...phaseEffectBlueprints];
// Every adapter is a normal Effect with no deploy cost. Preparation also
// requires unconditional Alter immunity and the printed table/your-side clause.
// Ability, Ability, Ability is immune but deploys on the OPPONENT'S side.
export const eligibleStartingEffect=(blueprint:string,interrupt:string)=>
 ['6_77','6_160'].includes(interrupt)?startingEffectBlueprints.includes(blueprint):
 ['9_51','9_139'].includes(interrupt)&&preparationEffectBlueprints.includes(blueprint);
export function initiateStartingEffect(m:Match,card:string){
 const plan=battlePlanBlueprints.includes(m.cards[card].blueprint);
 const resist=resistanceBlueprints.includes(m.cards[card].blueprint);
 const force=forceEffectBlueprints.includes(m.cards[card].blueprint);
 const phase=phaseEffectBlueprints.includes(m.cards[card].blueprint);
 if(!startingEffectBlueprints.includes(m.cards[card].blueprint))throw Error('Unimplemented starting Effect.');
 const r:Resolution={kind:'resolution',actor:m.cards[card].owner,cancelled:false,action:plan?battlePlanDeployment(m,card):resist?resistanceDeployment(m,card):force?forceEffectDeployment(m,card):phase?phaseEffectDeployment(m,card):{id:'try-effect:deploy:'+card,handler:'try-effect:deploy',source:card,label:'Deploy '+name(m,card),payload:{card}}};
 m.stack.push(r);if(plan)battlePlanInitiate(m,r);else if(resist)resistanceInitiate(m,r);else if(force)forceEffectInitiate(m,r);else if(phase)phaseEffectInitiate(m,r);else tryEffectInitiate(m,r);
}
