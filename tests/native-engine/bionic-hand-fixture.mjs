import {load} from '../native-proof/load-engine.mjs';
import {fixture as base,deploy,boundary,finish,runtime,rules,state,priority,step,seek,pull} from './disarm-fixture.mjs';
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export function fixture(){const f=base('dark','dark','remote-doctor',{light:['5_12','5_12','1_155','1_109','1_109'],dark:['1_214']});for(let i=0;i<8;i++)state.moveCard(f.m,f.m.players.light.reserve.at(-1),'force');f.hand=pull(f.m,'light','5_12','hand');f.second=pull(f.m,'dark','1_214','hand');return f;}
export function handReady(){const f=fixture();f.m=finish(step(f.m,deploy(f)));f.m.turn.phase='deploy';f.m.turn.side='light';f.m.stack[0].priority='light';return f;}
export const attach=f=>'attach:'+f.hand+':'+f.target;
export function rearmed(){const f=handReady();f.m=priority(finish(step(f.m,attach(f))),'light');return f;}
export function totalReady(weapon='spare'){
 const f=rearmed();f.weapon=weapon==='saber'?pull(f.m,'light','1_155','hand'):f.spare;
 f.m=finish(step(f.m,weapon==='saber'?'saber:equip:'+f.weapon+':'+f.target:'equip:'+f.weapon+':'+f.target));
 f.m.turn.phase='battle';f.m.stack[0].priority='light';f.m=priority(boundary(step(f.m,'battle:'+f.site),'battle-weapons'),'light');
 const dice=[pull(f.m,'light','1_109','hand'),pull(f.m,'light','1_109','hand')];for(const c of dice)state.moveCard(f.m,c,'reserve');
 f.m=boundary(step(f.m,(weapon==='saber'?'saber:fire:':'fire:')+f.weapon+':'+f.dark),'destiny-total');return f;
}
export {deploy,boundary,finish,runtime,rules,state,priority,step,seek,pull};
