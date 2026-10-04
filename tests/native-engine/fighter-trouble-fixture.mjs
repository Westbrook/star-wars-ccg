import {fixture as vessels,pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,deploy,prompt} from './vessels-fixture.mjs';
export {pull,state,rules,step,seek,phase,priority,ids,clone,runtime,load,deploy,prompt};
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export function fixture(mode='bonus'){
 const f=vessels({light:['1_129','1_13','2_72','1_145','1_70','1_109','1_28','1_158'],dark:['1_284','1_253','1_253','1_302','1_262','1_317']});let m=f.m;
 const target=pull(m,'light',mode==='other-ship'?'1_145':'2_72','table',f.planet),jek=pull(m,'light','1_13','hand'),card=pull(m,'dark','1_253','hand'),second=pull(m,'dark','1_253','hand'),few=pull(m,'light','1_70','hand'),sense=pull(m,'light','1_109','hand'),enemy=pull(m,'dark','1_302','table',f.planet),die=pull(m,'dark','1_262','hand');
 state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;m.turn.side='light';m.turn.phase='deploy';m.stack[0].priority='light';m.stack[0].passes=0;
 const before=m.players.light.force.length;if(mode!=='unpiloted')m=deploy(m,jek,target,'pilot');const deploymentCost=before-m.players.light.force.length;
 if(mode==='suppressed')mod('game-text').suppressGameText(m,f.planet,target);
 const power=mod('occupancy').vesselPower(m,target),maneuver=mod('piloting').vesselManeuver(m,target);m.turn.side='dark';m.turn.phase='battle';m.stack[0].priority='dark';m.stack[0].passes=0;
 return {...f,m,mode,target,jek,card,second,few,sense,enemy,die,deploymentCost,power,maneuver};
}
export function ended(f){let m=step(f.m,'battle:'+f.planet);for(let n=0;n<700;n++){
 if(m.stack.at(-1)?.event?.kind==='battle-ended'){if(f.mode==='empty')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else state.moveCard(m,f.die,'reserve');if(f.mode==='no-force')for(const id of [...m.players.dark.force])state.moveCard(m,id,'hand');return priority(m,'dark');}
 const p=prompt(m);m=step(m,p.choices.find(c=>c.id==='skip-destiny')?.id??p.choices.find(c=>c.id==='battle-lose:reserve')?.id??p.choices.find(c=>c.id==='pass')?.id??p.choices[0].id);
 }throw Error('Battle did not end');}
export const start=f=>step(ended(f),'fighter-trouble:play:'+f.card+':'+f.target);
export const drawn=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn'&&x.stack.at(-1).event.category==='fighter-trouble');
export const finish=(m,f)=>seek(m,x=>x.cards[f.card].zone==='lost');
export const bonus=(m,f)=>step(priority(m,'dark'),'fighter-trouble:bonus:'+f.target);
