import {mod,runtime,state,rules,pull,phase,step,ids,seek,priority} from './prisoner-fixture.mjs';
export {mod,runtime,state,rules,pull,phase,step,ids,seek,priority};
export function fixture({side='dark',aboard=false}={}){
 const decks=['light','dark'].map(s=>({side:s,cards:[...(s==='light'?['1_129','1_132','1_17','2_40','1_152','1_40','1_149','1_19','1_28','1_234']:['1_285','1_184','1_195','2_129','1_317','1_207','1_194','1_194','1_302','1_234']),...Array(60).fill(s==='light'?'1_28':'1_194')].slice(0,60)}));
 // Keep physical card sides correct: Alter belongs to the Dark deck only.
 decks[0].cards=decks[0].cards.map(bp=>bp==='1_234'?'1_71':bp);
 let m=runtime.createMatch('undercover-'+side,60,decks,rules);
 const site=pull(m,'light','1_129'),to=pull(m,'light','1_132'),bay=pull(m,'dark','1_285');m.locations.push(site,to,bay);
 const spy=pull(m,side,side==='light'?'1_17':'1_184','table',site),effect=pull(m,side,side==='light'?'2_40':'2_129','hand'),enemy=pull(m,side==='light'?'dark':'light',side==='light'?'1_194':'1_28','table',site);
 let host;if(aboard){host=pull(m,side,side==='light'?'1_149':'1_302','table',site);m.cards[spy].attachedTo=host;m.cards[spy].aboardRole='passenger';if(side==='dark')throw Error('Use Light enclosed vehicle fixture.');}
 for(const s of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),side,'deploy');return {m,side,site,to,bay,spy,effect,enemy,host};
}
export function deployed(f){return seek(step(f.m,'undercover:deploy:'+f.effect+':'+f.spy),m=>mod('undercover-state').activeUndercoverSpy(m,f.spy));}
export function movement(f){return priority(phase(deployed(f),f.side==='light'?'dark':'light','move'),f.side);}
