import {runtime,rules,state,pull,phase} from './prisoner-fixture.mjs';
export function controlFixture({controlled=true,stolen=false,extraDark=[]}={}){
 const decks=['light','dark'].map(side=>({side,cards:[...(side==='dark'?[...extraDark,'4_160','4_161','4_162','4_165','4_167','1_179','1_289','5_164']:['1_129']),...Array(60).fill(side==='dark'?'1_194':'1_28')].slice(0,60)}));
 let m=runtime.createMatch('control-station',60,decks,rules);const from=pull(m,'dark','1_289'),to=pull(m,'dark','5_164'),station=pull(m,'dark','4_160'),theatre=pull(m,'dark','4_161'),corridor=pull(m,'dark','4_162');m.locations.push(from,to,station,theatre,corridor);
 const ship=pull(m,'dark','4_167','table',from),rebel=pull(m,'light','1_28',controlled?'table':'hand',controlled?station:undefined),leader=pull(m,'dark','1_179','hand');
 if(stolen)Object.assign(m.cards[ship],{owner:'light',originalOwner:'dark'});
 for(const s of ['dark','light'])for(let i=0;i<8;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','move');return {m,from,to,station,theatre,corridor,ship,rebel,leader};
}
