import {fixture,pull,state,priority,step,seek} from './vessels-fixture.mjs';
export function compactorFixture(side='dark',phase='deploy'){
 const f=fixture({light:['1_129','1_149','1_125','1_89','1_108','1_108','2_14','1_28','1_28','1_26','1_152','1_53','106_3'],dark:['1_284','1_285','1_278','1_235','1_250','1_194','1_194','1_254']});
 f.compactor=pull(f.m,'light','1_125','table');f.m.locations.push(f.compactor);f.flyboy=pull(f.m,'light','1_89','hand');f.crush=pull(f.m,'dark','1_278','hand');f.boring=pull(f.m,'dark','1_235','hand');f.scomp=pull(f.m,'light','1_108','hand');f.cylinder=pull(f.m,'dark','1_250','hand');
 f.m.turn.side=side;f.m.turn.phase=phase;f.m.stack[0].priority=side;return f;
}
export function escapeFixture(own=false,exterior=false){const f=compactorFixture(own?'light':'dark','battle');if(exterior){f.remote=pull(f.m,'dark','1_285','table');f.m.locations.push(f.remote);}f.troop=pull(f.m,'light','1_28','table',f.remote);f.enemy=pull(f.m,'dark','1_194','table',f.remote);state.moveCard(f.m,f.droid,'table');f.m.cards[f.droid].location=f.remote;f.m=priority(step(f.m,'battle:'+f.remote),'light');return f;}
export const play=f=>'compactor:play:'+f;
export const scompOffer=(m,card,mode)=>{const {choices}=seekPrompt(m);return choices.find(c=>c.id.startsWith('scomp:play:'+card+':'+mode))?.id;};
import {prompt as seekPrompt} from './vessels-fixture.mjs';
