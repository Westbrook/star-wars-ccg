import {fixture,pull,state,step,priority} from './vessels-fixture.mjs';
export function setup(side='light',phase='deploy'){
 const f=fixture({light:['1_129','1_42','106_3','1_108','1_108','2_14','1_28','1_28','1_90'],dark:['1_284','1_285','106_14','1_250','1_250','2_101','1_194','1_194','106_17','106_15']});f.m.turn.side=side;f.m.turn.phase=phase;f.m.stack[0].priority=side;f.effect=pull(f.m,side,side==='light'?'106_3':'106_14','hand');f.card=pull(f.m,side,side==='light'?'1_108':'1_250','hand');return f;
}
export function service(f,side='light'){
 state.moveCard(f.m,f.effect,'table');f.m.cards[f.effect].attachedTo=side==='light'?f.remote:f.site;f.m.cards[f.effect].location=f.m.cards[f.effect].attachedTo;return f;
}
export function drain(side='light'){
 const enemy=side==='light'?'dark':'light',f=service(setup(side,'control'),side);f.m.turn.side=enemy;f.m.stack[0].priority=enemy;
 f.droid=side==='light'?f.droid:pull(f.m,side,'2_101','hand');state.moveCard(f.m,f.droid,'table');f.m.cards[f.droid].location=f.site;
 f.troop=pull(f.m,enemy,enemy==='light'?'1_28':'1_194','table',f.site);
 // Dark service is hosted away from the drain, so opposing control does not cancel it.
 if(side==='dark'){f.m.cards[f.effect].attachedTo=f.planet;f.m.cards[f.effect].location=f.planet;}
 f.m=priority(step(f.m,'drain:'+f.site),side);return f;
}
export function link(side='light',pile='dark'){
 const f=setup(side);f.remote=pull(f.m,'dark','1_285','table');f.m.locations.push(f.remote);f.unit=side==='light'?pull(f.m,side,'2_14','table',f.remote):f.pilot;
 if(side==='dark'){state.moveCard(f.m,f.unit,'table');f.m.cards[f.unit].location=f.remote;}
 f.pile=pile;return f;
}
