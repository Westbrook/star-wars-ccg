// Controlled component setup; subsequent browser actions use the real service.
import {runtime,rules,mod,pull,phase} from './prisoner-fixture.mjs';
const gate=mod('laser-gate'),state=mod('state');
export function fixture(side='light'){
 const opponent=side==='light'?'dark':'light';
 const decks=['light','dark'].map(owner=>({side:owner,cards:[...(owner==='dark'?['1_283','1_284','2_113','1_308']:['1_148']),...Array(60).fill(owner==='light'?'1_28':'1_194')].slice(0,60)}));
 let m=runtime.createMatch('lift-tube-browser',60,decks,rules);
 const core=pull(m,'dark','1_283'),corridor=pull(m,'dark','1_284');m.locations.push(core,corridor);
 const barrier=pull(m,'dark','2_113');gate.bindLaserGate(m,barrier,core,corridor);
 const tube=pull(m,side,side==='light'?'1_148':'1_308','hand');
 const passenger=pull(m,side,side==='light'?'1_28':'1_194','table',core);
 const boarding=pull(m,side,side==='light'?'1_28':'1_194','table',corridor);
 const waiting=pull(m,side,side==='light'?'1_28':'1_194','table',corridor);
 const enemy=pull(m,opponent,opponent==='light'?'1_28':'1_194','table',core);
 for(const owner of ['light','dark'])for(let n=0;n<10;n++)state.moveCard(m,m.players[owner].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),side,'deploy');
 return {m,side,opponent,core,corridor,barrier,tube,passenger,boarding,waiting,enemy};
}
