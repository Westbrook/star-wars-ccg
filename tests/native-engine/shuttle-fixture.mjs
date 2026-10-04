import {fixture as vessels,location,force,pull,deploy,phase,priority} from './vessels-fixture.mjs';
export * from './vessels-fixture.mjs';
export function fixture(extra={light:[],dark:[]}){
 const f=vessels({dark:[...extra.dark,'1_302','1_302','1_309','1_201'],light:[...extra.light,'1_140','1_147','1_150','3_59']});
 const carrier=pull(f.m,'dark','1_302','hand'),second=pull(f.m,'dark','1_302','hand'),corvette=pull(f.m,'light','1_140','hand'),extraCrawler=pull(f.m,'dark','1_309','hand'),comlink=pull(f.m,'dark','1_201','hand'),hoth=location(f.m,'light','3_59');
 force(f.m,'dark',10);force(f.m,'light',10);return {...f,carrier,second,corvette,extraCrawler,comlink,hoth};
}
export const moving=m=>priority(phase(m,'move'),'dark');
export function prepared(f){let m=deploy(f.m,f.carrier,f.planet);m=deploy(m,f.crawler,f.site);m=deploy(m,f.driver,f.crawler,'driver');return m;}
