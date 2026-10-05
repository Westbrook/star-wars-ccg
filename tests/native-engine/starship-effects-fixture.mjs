import {fixture as vessels,runtime,state,rules,clone,pull,ids,step,seek,phase,priority,load,settled} from './vessels-fixture.mjs';
export {runtime,state,rules,clone,pull,ids,step,seek,phase,priority,load,settled};
export const mod=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
export function fixture(mode='han'){
 const f=vessels({light:['1_129','1_65','1_65','1_143','1_143','5_5','1_13','1_140','1_147','1_11'],dark:['1_284','1_302']});let m=f.m;
 const shipBp=mode==='capital'?'1_140':mode==='other-fighter'?'1_147':mode==='opponent'?'1_302':'1_143';
 const ship=pull(m,mode==='opponent'?'dark':'light',shipBp,'table',mode==='landed'?f.site:f.planet),pilot=pull(m,'light',mode==='lando'?'5_5':mode==='other-pilot'?'1_13':'1_11','hand'),effect=pull(m,'light','1_65','hand');
 if(!['unpiloted','capital','other-fighter','opponent'].includes(mode)){state.moveCard(m,pilot,'table');Object.assign(m.cards[pilot],{attachedTo:ship,aboardRole:'pilot',location:m.cards[ship].location});}
 m.turn.side='light';m.turn.phase='deploy';m.stack[0].priority='light';m.stack[0].passes=0;return {...f,m,mode,ship,pilot,effect};
}
export const action=f=>'starship-effect:deploy:'+f.effect+':'+f.ship;
export function deployed(f){let m=settled(step(f.m,action(f)));if(f.mode.endsWith('canceled'))mod('game-text').suppressGameText(m,f.planet,f.mode.startsWith('effect')?f.effect:f.mode.startsWith('pilot')?f.pilot:f.ship);return m;}
export const values=(f,m)=>({power:mod('occupancy').vesselPower(m,f.ship),maneuver:mod('piloting').vesselManeuver(m,f.ship),armor:mod('piloting').vesselArmor(m,f.ship),forfeit:mod('board').forfeit(m,f.ship),immunity:mod('combat-modifiers').attritionImmunity(m,f.ship),effectOwner:m.cards[f.effect].owner});
/** Genuine paid Effect deployment precedes a controlled capture foundation.
 * The returned snapshot is before the ordinary theft response/choice sequence. */
export async function theftFixture(){
 const {fixture:captureFixture,shipDecks}=await import('./captured-ships-fixture.mjs'),p=await import('./prisoner-fixture.mjs');
 const decks=shipDecks();decks[0].cards[30]='1_65';const f=captureFixture(0,{capture:false,decks});let m=f.m;const effect=p.pull(m,'light','1_65','hand');m=p.phase(m,'light','deploy');m=p.step(m,'starship-effect:deploy:'+effect+':'+f.ship);m=p.seek(m,x=>x.stack.length===1);m=p.phase(m,'dark','control');mod('captured-ships').captureStarship(m,f.ship,f.host);m=p.seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-steal');return {...f,m,effect};
}
