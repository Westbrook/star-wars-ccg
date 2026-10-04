import {fixture,pull,state,step,seek,priority,load} from './vessels-fixture.mjs';
export function battleAdditionFixture(mode='skywalkers',own=false){
 const f=fixture({light:['1_129','106_7','1_17','1_102','1_102','1_110','1_110','1_116','1_116','1_119','1_119','1_28','1_152','1_149','1_108','2_14'],dark:['1_284','1_285','101_5','1_194','1_194','1_235','1_249']});
 f.leia=pull(f.m,'light','1_17','hand');f.vader=pull(f.m,'dark','101_5','hand');f.skywalkers=pull(f.m,'light','1_110','hand');f.strong=pull(f.m,'light','1_116','hand');f.courage=pull(f.m,'light','1_119','hand');f.nowhere=pull(f.m,'light','1_102','hand');f.boring=pull(f.m,'dark','1_235','hand');f.barrier=pull(f.m,'dark','1_249','hand');
 f.mode=mode;f.m.turn.side=own?'light':'dark';f.m.turn.phase='battle';f.m.stack[0].priority=f.m.turn.side;f.location=mode==='nowhere'?f.planet:f.site;
 const put=id=>{state.moveCard(f.m,id,'table');f.m.cards[id].location=f.location;};
 if(mode==='nowhere'){f.ywing=pull(f.m,'light','106_7','hand');put(f.ywing);put(f.scout);put(f.pilot);f.m.cards[f.pilot].attachedTo=f.scout;f.m.cards[f.pilot].aboardRole='pilot';}
 else {put(mode==='warrior'?f.lightPilot:mode==='leia'?f.leia:f.luke);put(mode==='vader'?f.vader:f.pilot);if(mode==='skywalkers')put(f.leia);}
 f.m=step(f.m,'battle:'+f.location);
 if(mode==='nowhere')f.m=priority(f.m,'light');else f.m=priority(seek(f.m,m=>m.stack.at(-1)?.event?.kind==='battle-weapons'),'light');
 return f;
}
export const addition=(m,card,amount)=>{const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));const w=m.stack.at(-1);return premiereRules.actions(m,w,'light').find(a=>a.handler==='battle-add:play'&&a.source===card&&(amount===undefined||a.payload.amount===amount))?.id;};
