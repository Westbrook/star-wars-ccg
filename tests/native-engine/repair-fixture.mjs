import {fixture as vessels,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load};
const stats=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));
export function fixture(side='light',mode='fighter',copies=1,damage=true){
 const f=vessels({light:['1_129','2_15','2_15','1_140','1_158','2_81'],dark:['1_284','2_101','2_101','1_302','1_318']});const {m}=f;
 const ship=mode==='capital'?pull(m,side,side==='light'?'1_140':'1_302','table',f.planet):side==='light'?f.ywing:f.scout;
 if(m.cards[ship].zone!=='table')state.moveCard(m,ship,'table');m.cards[ship].location=mode==='landed'?f.site:f.planet;
 const droids=Array.from({length:copies},()=>{const id=pull(m,side,side==='light'?'2_15':'2_101','table',m.cards[ship].location);m.cards[id].attachedTo=ship;m.cards[id].aboardRole='passenger';return id;});
 const weapon=pull(m,side==='light'?'dark':'light',side==='light'?'1_318':'2_81','hand');if(damage)stats.ionizeShip(m,weapon,ship);
 m.turn.side=side;m.turn.phase='control';m.stack[0].priority=side;m.stack[0].passes=0;
 return {...f,m,ship,droids,droid:droids[0],side,weapon};
}
export const endControl=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='phase-end'&&x.stack.at(-1).event.phase==='control');
export const repair=m=>step(m,ids(m).find(id=>id.startsWith('ion-repair:')));
export const finish=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='attributes-restored');
