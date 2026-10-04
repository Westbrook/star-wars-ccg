import {fixture,pull,state,step,seek,priority,load} from './vessels-fixture.mjs';
export function mentorFixture(mode='search',own=false){
 const f=fixture({light:['1_129','1_82','1_82','1_76','1_76','1_21','4_2','1_157','106_7','1_152'],dark:['1_284','1_302','1_277','1_277','101_5','1_304','1_304','1_235','1_324','1_315']});
 f.gift=pull(f.m,'light','1_82','hand');f.cocky=pull(f.m,'light','1_76','hand');f.eye=pull(f.m,'dark','1_277','hand');f.boring=pull(f.m,'dark','1_235','hand');f.obi=pull(f.m,'light','1_21','hand');f.yoda=pull(f.m,'light','4_2','hand');f.vader=pull(f.m,'dark','101_5','hand');f.tie=pull(f.m,'dark','1_304','hand');f.secondTie=pull(f.m,'dark','1_304','hand');f.saber=pull(f.m,'light','1_157','reserve');
 f.mode=mode;f.side=mode.startsWith('eye')?'dark':'light';f.m.turn.side=mode==='search'?'light':f.side==='dark'?'light':own?'light':'dark';f.m.turn.phase=mode==='search'?'deploy':'battle';f.m.stack[0].priority=f.m.turn.side;
 if(mode==='search')return f;
 const space=mode==='tie',site=space?f.planet:f.site,put=id=>{state.moveCard(f.m,id,'table');f.m.cards[id].location=site;};
 if(space){f.xwing=pull(f.m,'light','106_7','hand');put(f.xwing);put(f.tie);put(f.secondTie);}
 else if(mode.startsWith('eye')){put(f.lightPilot);put(mode==='eye-imperial'?f.pilot:f.vader);}
 else {put(f.luke);put(mode==='gift-yoda'?f.yoda:mode==='cocky'?f.lightPilot:f.obi);put(mode==='gift-yoda'?f.vader:f.pilot);}
 f.m=step(f.m,'battle:'+site);if(!space)f.m=seek(f.m,m=>m.stack.at(-1)?.event?.kind==='battle-weapons');f.m=priority(f.m,f.side);return f;
}
export const play=(f,mode=f.mode)=>mode==='search'?'mentor:play:'+f.gift+':search':mode==='tie'?'mentor:play:'+f.cocky+':tie:'+f.tie:load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.actions(f.m,f.m.stack.at(-1),f.side).find(a=>a.handler==='battle-add:play'&&a.source===f[mode.startsWith('eye')?'eye':mode==='cocky'?'cocky':'gift'])?.id;
