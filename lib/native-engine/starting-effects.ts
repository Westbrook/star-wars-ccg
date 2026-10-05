import {tryEffectBlueprints,tryEffectInitiate} from './try-effects';
import {resistanceBlueprints,resistanceDeployment,resistanceInitiate} from './resistance';
import {name} from './board';
import type {Match,Resolution} from './types';
/** Explicit real deployment adapters; printed eligibility alone never admits
 * an unimplemented Effect to the native engine. */
export const startingEffectBlueprints=[...tryEffectBlueprints,...resistanceBlueprints];
export function initiateStartingEffect(m:Match,card:string){
 const resist=resistanceBlueprints.includes(m.cards[card].blueprint);
 if(!startingEffectBlueprints.includes(m.cards[card].blueprint))throw Error('Unimplemented starting Effect.');
 const r:Resolution={kind:'resolution',actor:m.cards[card].owner,cancelled:false,action:resist?resistanceDeployment(m,card):{id:'try-effect:deploy:'+card,handler:'try-effect:deploy',source:card,label:'Deploy '+name(m,card),payload:{card}}};
 m.stack.push(r);if(resist)resistanceInitiate(m,r);else tryEffectInitiate(m,r);
}
