import {fixture as vessels,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load,deploy,settled} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load,deploy,settled};
export const mod=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
export function fixture(pilotBp='2_23',mode='matched'){
 const f=vessels({light:['1_129','1_130','1_3','2_23','2_70','1_145','2_47','2_47','2_14'],dark:['1_284','1_173','1_299','1_302']});let m=f.m;const side=pilotBp==='1_173'?'dark':'light';
 const shipBp=mode==='other-ship'?(side==='dark'?'1_305':'1_147'):side==='dark'?'1_299':pilotBp==='2_23'?'2_70':'1_145';
 const ship=mode==='other-ship'?(side==='dark'?f.scout:f.ywing):pull(m,side,shipBp,'hand'),pilot=pull(m,side,pilotBp,'hand');state.moveCard(m,ship,'table');m.cards[ship].location=mode==='landed'?f.site:f.planet;
 const enemy=side==='dark'?f.ywing:pull(m,'dark','1_302','hand');state.moveCard(m,enemy,'table');m.cards[enemy].location=f.planet;
 m.turn.side=side;m.turn.phase='deploy';m.stack[0].priority=side;m.stack[0].passes=0;
 return {...f,m,ship,pilot,side,mode,pilotBp,enemy};
}
export function deployed(f){let m=deploy(f.m,f.pilot,f.ship,'pilot');if(f.mode.endsWith('canceled'))mod('game-text').suppressGameText(m,f.planet,f.mode.startsWith('pilot')?f.pilot:f.ship);return m;}
export function battleStart(f,m=deployed(f)){m=priority(phase(m,'battle'),f.side);return seek(step(m,'battle:'+f.planet),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');}
export function values(f,m){return {power:mod('occupancy').vesselPower(m,f.ship),maneuver:mod('piloting').vesselManeuver(m,f.ship),immunity:mod('combat-modifiers').attritionImmunity(m,f.ship),draws:m.data.battle?mod('battle-destiny').battleDrawPolicy(m,f.side).count:null};}
export function searchFixture(mode='success'){
 const f=fixture();const {m}=f;state.moveCard(m,f.pilot,'table');m.cards[f.pilot].location=f.site;const slips=Object.values(m.cards).filter(c=>c.blueprint==='2_47').map(c=>c.id);if(mode==='failure')for(const id of slips)state.moveCard(m,id,'hand');m.turn.phase='control';return {...f,slips};
}
export const searching=f=>seek(step(f.m,'wedge:begin:'+f.pilot),x=>x.stack.at(-1)?.handler==='wedge:choose');
export const searchDone=m=>seek(m,x=>x.stack.length===1);
