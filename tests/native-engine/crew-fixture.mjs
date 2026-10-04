import {fixture as pilot,pull,deployedPair,phase,priority,step,seek,state} from './pilot-fixture.mjs';
export * from './pilot-fixture.mjs';
export function fixture(side='dark'){
 const f=pilot(side,{light:['1_8'],dark:['1_174']});const dutch=pull(f.m,'light','1_8','hand'),ds=pull(f.m,'dark','1_174','hand');return {...f,dutch,ds,side,ship:side==='light'?f.gold:f.black,ace:side==='light'?dutch:ds};
}
export const paired=f=>deployedPair(f.m,f.ship,f.ace,f.planet);
export function battleInitiated(f,m){const enemy=f.side==='dark'?f.ywing:f.scout;state.moveCard(m,enemy,'table');m.cards[enemy].location=f.planet;m=priority(phase(m,'battle'),f.side);return step(m,'battle:'+f.planet);}

export const battleStart=(f,m)=>seek(battleInitiated(f,m),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
