import {load} from '../native-proof/load-engine.mjs';
import {runtime,rules,state,pull,location,step,seek,priority,prompt,force} from './noble-fixture.mjs';
export {runtime,rules,state,pull,location,step,seek,priority,prompt,force};
export const {forceDrainCost,mayBattleForFree,occupiesGroundAndSpace}=load(new URL('../../lib/native-engine/battle-plan.ts',import.meta.url));
export const ordinary=m=>m.stack.length===1&&m.stack[0].kind==='window'&&m.stack[0].timing==='phase';
export function fixture({side='dark',plan=false,order=false,ground=true,space=false,contested=false,battle=false,zone='table',amount=4}={}){
 const extras={light:['8_35','8_35','1_129','1_130','1_127','1_140','1_71','102_1','3_61','3_63'],dark:['8_118','8_118','1_284','1_302','1_234','102_6']};
 let m=runtime.createMatch('battle-plan',60,['light','dark'].map(side=>({side,cards:[...extras[side],...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules),sites=['1_129','1_130','1_127'].map(bp=>location(m,'light',bp));location(m,'dark','1_284');
 const effects={light:pull(m,'light','8_35',plan?zone:'hand'),dark:pull(m,'dark','8_118',order?zone:'hand')};
 const troop=pull(m,side,side==='light'?'1_28':'1_194',ground?'table':'hand',ground?sites[0]:undefined);
 const ship=pull(m,side,side==='light'?'1_140':'1_302',space?'table':'hand',space?sites[2]:undefined);
 if(contested||battle)pull(m,side==='light'?'dark':'light',side==='light'?'1_194':'1_28','table',sites[0]);
 if(contested)pull(m,side==='light'?'dark':'light',side==='light'?'1_302':'1_140','table',sites[2]);
 force(m,side,amount);m=runtime.startTurns(m,rules);m=seek(m,x=>ordinary(x)&&x.turn.side===side&&x.turn.phase===(battle?'battle':'control'));m=priority(m,side);
 return {m,side,effects,sites,troop,ship};
}
