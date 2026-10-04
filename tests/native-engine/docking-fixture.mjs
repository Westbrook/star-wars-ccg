import {fixture as shuttle,deploy,prepared,moving,force,priority,settled,step,seek,pull,location} from './shuttle-fixture.mjs';
export * from './shuttle-fixture.mjs';
export function fixture(){const f=shuttle({light:['1_135'],dark:['1_309']});f.yavin=location(f.m,'light','1_135');f.third=pull(f.m,'dark','1_309','hand');force(f.m,'dark',20);let m=prepared(f);m=deploy(m,f.second,f.planet);m=deploy(m,f.pilot,f.carrier,'pilot');m=priority(settled(step(m,'transport:deploy:'+f.scout+':'+f.carrier+':starship')),'dark');m=moving(m);m=priority(settled(step(m,'transport:shuttle:'+f.crawler+':'+f.carrier+':vehicle')),'dark');return {...f,m};}
export const docking=m=>seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');
export const dock=f=>docking(step(f.m,'dock:'+f.carrier+':'+f.second));
export const transfer=(m,card,to,role)=>docking(step(m,'transfer:'+card+':'+to+':'+role));
