import {fixture as vessels,pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,deploy,prompt} from './vessels-fixture.mjs';
export {pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,deploy,prompt};
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export function fixture(mode='nav'){
 const f=vessels({light:['1_129','2_72','1_140','2_14','1_24','1_71','1_28','1_35','1_35'],dark:['1_284','1_218','1_218','1_262','1_302']});const m=f.m;
 const ship=pull(m,'light',mode==='passenger'?'1_140':'2_72','table',f.planet),card=pull(m,'dark','1_218','hand'),second=pull(m,'dark','1_218','hand'),astro=pull(m,'light','2_14','hand'),otherAstro=pull(m,'light','1_24','hand'),alter=pull(m,'light','1_71','hand'),die=pull(m,'dark',mode==='fail'?'1_302':'1_262','hand');
 if(mode==='astro'||mode==='both') {state.moveCard(m,astro,'table');m.cards[astro].location=f.planet;m.cards[astro].attachedTo=ship;m.cards[astro].aboardRole='passenger';if(mode==='astro')m.cards[ship].blueprint='1_145';else m.cards[ship].blueprint='1_140';}
 if(mode==='empty')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else state.moveCard(m,die,'reserve');
 return {...f,m,mode,ship,card,second,astro,otherAstro,alter,die};
}
export const start=(f,astro=false)=>step(f.m,'lost-artoo:deploy:'+f.card+':'+f.ship+':'+(astro?f.astro:'nav'));
export const drawn=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn'&&x.stack.at(-1).event.category==='lost-artoo');
export const finish=m=>priority(seek(m,x=>x.stack.length===1),'dark');
