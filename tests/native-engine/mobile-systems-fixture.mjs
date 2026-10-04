import {fixture as ships,pull,state,phase,priority,step,seek,prompt,ids,rules,clone,runtime,load} from './vessels-fixture.mjs';
export {pull,state,phase,priority,step,seek,prompt,ids,rules,clone,runtime,load};
const mobile=load(new URL('../../lib/native-engine/mobile-systems.ts',import.meta.url)),identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
export const position=(m,id)=>mobile.systemPosition(m,id);
export const setPosition=(m,id,parsec,orbit=null)=>m.data.mobileSystems={[id]:{card:identity.referenceCard(m,id),parsec,orbit}};
export function fixture(parsec=0,orbit=null){
 const f=ships({light:['101_1','1_129','1_135','1_140'],dark:['1_300','2_143','1_284','1_323','1_323','1_302','1_262','1_262']});let m=f.m;
 const death=pull(m,'dark','2_143','table'),yavin=pull(m,'light','1_135','table');m.locations.push(death,yavin);setPosition(m,death,parsec,orbit);
 for(const id of [f.scout,f.ywing]){state.moveCard(m,id,'table');m.cards[id].location=death;}
 const gun=pull(m,'dark','1_323','hand');m.turn.phase='move';m.turn.side='dark';m.stack[0].priority='dark';m.stack[0].passes=0;
 return {...f,m,death,yavin,gun};
}
export const boundary=(m,event)=>seek(m,x=>x.stack.at(-1)?.event?.kind===event);
export const move=(f,parsec,orbit=null)=>boundary(step(f.m,'mobile:move:'+f.death+':'+parsec+':'+(orbit??'deep')),'mobile-moved');
