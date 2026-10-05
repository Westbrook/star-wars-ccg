import {mod,runtime,state,rules,pull,phase,step,ids,seek,clone} from './prisoner-fixture.mjs';
export {mod,runtime,state,rules,pull,phase,step,ids,seek,clone};
export function fixture({objective=false}={}){
 const decks=['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_129','1_10','1_19','1_11','1_21','1_6','1_151']:['104_4','1_166','104_6','1_179','1_165','3_91','3_91','1_310','3_143','7_299','106_11','8_114']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
 const m=runtime.createMatch('isb-agents',60,decks,rules),site=pull(m,'light','1_129'),hoth=pull(m,'dark','104_4');m.locations.push(site,hoth);
 let source;if(objective){source=pull(m,'dark','7_299');mod('objectives').registerObjective(m,source);mod('objectives').completeObjective(m,source);}
 for(const side of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 return {m,site,hoth,source};
}
export function ready(f){return phase(runtime.startTurns(f.m,rules),'dark','deploy');}
export function refresh(m){state.assertState(m);rules.validate(m);for(const side of ['light','dark']){const before=runtime.project(m,rules,side);assertEqual(before,runtime.project(clone(m),rules,side));}return clone(m);}
function assertEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Projection changed after serialized refresh.');}
