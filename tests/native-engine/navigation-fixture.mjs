import {fixture as ships,pull,state,phase,priority,step,seek,prompt,ids,rules,clone,runtime,load,deploy,settled} from './vessels-fixture.mjs';
export {pull,state,phase,priority,step,seek,prompt,ids,rules,clone,runtime,load,deploy,settled};
export const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),pilot=load(new URL('../../lib/native-engine/piloting.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
export function fixture(mode='red3-r2'){
 const f=ships({light:['1_129','1_145','1_142','2_71','2_14','1_24','1_24','1_19','1_135'],dark:['2_143']});let m=f.m;
 const ship=pull(m,'light',mode.startsWith('gold5')?'1_142':mode==='red5-r2'?'2_71':'1_145','table',mode==='landed'?f.site:f.planet),r2=pull(m,'light','2_14','hand'),x1=pull(m,'light','1_24','hand'),x2=pull(m,'light','1_24','hand'),lukePilot=pull(m,'light','1_19','hand'),death=pull(m,'dark','2_143','table');m.locations.push(death);
 if(mode!=='unpiloted'){state.moveCard(m,lukePilot,'table');Object.assign(m.cards[lukePilot],{attachedTo:ship,aboardRole:'pilot',location:m.cards[ship].location});}
 m.turn.side='light';m.turn.phase='deploy';m.stack[0].priority='light';m.stack[0].passes=0;
 return {...f,m,mode,ship,r2,x1,x2,lukePilot,death,astromech:mode==='gold5-duplicates'?x1:r2};
}
export function prepared(f){let m=f.m;if(f.mode!=='no-droid')m=deploy(m,f.astromech,f.ship,'passenger');if(['gold5-mixed','gold5-duplicates'].includes(f.mode))m=deploy(m,f.x2,f.ship,'passenger');return m;}
