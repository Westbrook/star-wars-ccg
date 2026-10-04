import {fixture as ships,location,phase,priority,deploy} from './vessels-fixture.mjs';
export * from './vessels-fixture.mjs';
export function fixture(extra=[]){
 const f=ships({light:['1_135','1_130','1_131','1_132',...extra],dark:['1_296']});
 const dune=location(f.m,'light','1_130'),camp=location(f.m,'light','1_131'),farm=location(f.m,'light','1_132'),yavin=location(f.m,'light','1_135');
 f.m.locations=[f.site,dune,camp,farm,f.planet,f.remote,yavin];return {...f,dune,camp,farm,yavin};
}
export const moving=m=>priority(phase(m,'move'),'dark');
export const driven=f=>deploy(deploy(f.m,f.crawler,f.site),f.driver,f.crawler,'driver');
