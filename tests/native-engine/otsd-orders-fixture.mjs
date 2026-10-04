import {fixture,pull,step,seek,priority} from './vessels-fixture.mjs';
export function setup(side='light',phase='deploy'){
 const f=fixture({light:['1_129','1_141','106_5','106_5','1_113','1_90','1_109','1_147','106_7','1_140','106_9','1_28','1_115'],dark:['1_284','1_300','106_17','106_17','1_238','1_267','1_194','106_10','106_15','1_317']});f.m.turn.side=side;f.m.turn.phase=phase;f.m.stack[0].priority=side;f.card=pull(f.m,side,side==='light'?'106_5':'106_17','hand');return f;
}
export const table=(f,side,bp,site=f.site)=>pull(f.m,side,bp,'table',site);
export function drain(side='light'){
 const enemy=side==='light'?'dark':'light',f=setup(enemy,'control');f.card=pull(f.m,side,side==='light'?'106_5':'106_17','hand');f.ship=table(f,side,side==='light'?'106_7':'106_10',f.planet);f.troop=table(f,enemy,enemy==='light'?'1_28':'1_194');f.m=priority(step(f.m,'drain:'+f.site),side);return f;
}
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
