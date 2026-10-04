import {fixture,pull,step,seek,priority} from './vessels-fixture.mjs';
const light=['1_129','106_1','106_6','106_6','106_2','106_8','1_8','1_28','1_12','1_31','1_41','1_26','1_131','1_19','106_7'];
const dark=['1_284','106_11','106_16','106_16','106_12','106_18','1_194','1_196','1_315','1_181','1_168','106_13'];
export function setup(side='light',phase='deploy'){const f=fixture({light,dark});f.m.turn.side=side;f.m.turn.phase=phase;f.m.stack[0].priority=side;return f;}
const table=(f,side,bp,site=f.site)=>pull(f.m,side,bp,'table',site);
const boundary=(m,event)=>seek(m,x=>x.stack.at(-1)?.event?.kind===event);
const cfg=side=>side==='light'?{source:'106_1',recruit:'106_6',troop:'1_28',leader:'1_8',alien:'1_31',corulag:'106_2',guard:'1_26'}:{source:'106_11',recruit:'106_16',troop:'1_194',leader:'1_179',alien:'1_196',corulag:'106_12',guard:'1_181'};
export function deployedSearch(side){const f=setup(side),c=cfg(side);f.source=pull(f.m,side,c.source,'hand');f.m=priority(boundary(step(f.m,'deploy:'+f.source+':'+f.site),'deployed'),side);return f;}
