import {fixture as vessels,runtime,state,rules,clone,pull,ids,step,seek,phase,priority,load,settled} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,ids,step,seek,phase,priority,load,settled};
export const mod=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
export function fixture(mode='matched'){
 const f=vessels({dark:['1_306','1_306','1_168','1_179','1_167','1_299','106_10','1_302','2_143'],light:[]});let m=f.m;
 const planet=f.planet;
 const ship=pull(m,'dark',mode==='other-ship'?'1_299':'1_306','hand'),pilot=pull(m,'dark',mode==='other-pilot'?'1_179':'1_168','hand'),target=['landed','unpiloted'].includes(mode)?f.site:planet;
 return {...f,m,mode,planet,ship,pilot,target};
}
export const pairId=f=>'pair-deploy:'+f.ship+':'+f.pilot+':'+f.target;
export function deployed(f){
 let m=settled(step(f.m,f.mode==='unpiloted'?'vessel:deploy:'+f.ship+':'+f.target:pairId(f)));
 if(f.mode.endsWith('canceled'))mod('game-text').suppressGameText(m,f.planet,f.mode.startsWith('pilot')?f.pilot:f.ship);
 if(f.mode==='pilot-departed')mod('table').returnToHand(m,[f.pilot]);
 return m;
}
export function values(f,m){return {power:mod('occupancy').vesselPower(m,f.ship),maneuver:mod('piloting').vesselManeuver(m,f.ship),hyperspeed:mod('piloting').vesselHyperspeed(m,f.ship),immunity:mod('combat-modifiers').attritionImmunity(m,f.ship),operational:mod('occupancy').operational(m,f.ship),navigation:mod('piloting').hasNavigation(m,f.ship)};}
