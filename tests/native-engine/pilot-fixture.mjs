import {fixture as shuttle,pull,force,priority,step,settled} from './shuttle-fixture.mjs';
export * from './shuttle-fixture.mjs';
export function fixture(side='dark'){
 const f=shuttle({light:['1_141','1_105','1_129'],dark:['1_300']});const barrier=pull(f.m,'light','1_105','hand');const gold=pull(f.m,'light','1_141','hand'),black=pull(f.m,'dark','1_300','hand');force(f.m,'dark',8);force(f.m,'light',8);f.m.turn.side=side;f.m.stack[0].priority=side;return {...f,gold,black,barrier};
}
export const pair=(m,ship,pilot,target)=>step(m,'pair-deploy:'+ship+':'+pilot+':'+target);
export const deployedPair=(m,ship,pilot,target)=>priority(settled(pair(m,ship,pilot,target)),m.turn.side);
