import {fixture as vessels,deploy,phase,priority,pull,location,force} from './vessels-fixture.mjs';
export * from './vessels-fixture.mjs';
export function fixture(bp='1_149',passenger='101_2',extra=[],darkExtra=[]){
 const f=vessels({light:[...extra,'1_129','1_149','1_151','1_130','1_131','1_132','3_59','1_152','1_109','1_132','1_2','1_22'],dark:[...darkExtra,'1_284','1_310','1_317','1_252','101_5']});
 const host=pull(f.m,'light',bp,'hand'),gun=pull(f.m,'light','1_152','hand'),enemyGun=pull(f.m,'dark','1_317','hand'),enemyVehicle=pull(f.m,'dark','1_310','hand');
 const dune=location(f.m,'light','1_130'),camp=location(f.m,'light','1_131'),farm=location(f.m,'light','1_132'),echo=location(f.m,'light','3_59');
 const vader=pull(f.m,'dark','101_5','hand'),high=pull(f.m,'dark','1_252','hand'),lightHigh=pull(f.m,'light','1_109','hand'),zero=pull(f.m,'light','1_132','hand');
 const rider=passenger==='101_2'?f.luke:pull(f.m,'light',passenger,'hand');
 f.m.locations=[f.site,dune,camp,farm,f.planet,f.remote,echo];force(f.m,'light',5);force(f.m,'dark',5);f.m.turn.side='light';f.m.stack[0].priority='light';
 return {...f,host,gun,enemyGun,enemyVehicle,dune,camp,farm,echo,rider,vader,high,lightHigh,zero};
}
export const prepared=f=>deploy(deploy(deploy(f.m,f.host,f.site),f.lightPilot,f.host,'driver'),f.rider,f.host,'passenger');
export const moving=m=>priority(phase(m,'move'),'light');
