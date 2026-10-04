import {fixture as vesselFixture,pull,phase,priority,step,seek,ids,load,deploy,state} from './vessels-fixture.mjs';
const {sitePlacements}=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
export function fixture(extra={}){
 const f=vesselFixture({light:['5_85','5_85','5_85','5_85','4_81','4_81','4_81','1_135','1_140','1_70','1_88','1_129',...(extra.light??[])],dark:['5_174','4_155','1_302','1_289','1_284','1_284',...(extra.dark??[])]});
 return f;
}
export function deploySector(m,id,group='Tatooine',position=0){
 const side=m.cards[id].owner;m=seek(m,x=>x.turn.side===side&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,side);
 const placements=sitePlacements(m,id).filter(p=>p.sector===group&&!p.replace),p=placements[position<0?placements.length-1:position];if(!p)throw Error('No sector placement');
 m=step(m,'site:'+id+':'+p.id);return priority(seek(m,x=>x.stack.length===1),side);
}
export {pull,phase,priority,step,seek,ids,load,deploy,state};
export function asteroidFixture(){
 const f=fixture();let m=f.m;const a=pull(m,'light','4_81','hand'),b=pull(m,'light','4_81','hand');m=deploySector(m,a);m=deploySector(m,b);
 m=deploy(m,f.ywing,a);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);const die=pull(m,'dark','1_262','hand');state.moveCard(m,die,'reserve');m=priority(m,'dark');return {...f,m,locations:[a,b]};
}
