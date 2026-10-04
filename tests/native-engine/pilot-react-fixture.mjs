import {fixture as pairs,pull,state,seek,priority,step} from './pilot-fixture.mjs';
export * from './pilot-fixture.mjs';
export function fixture({battle=false}={}){
 const f=pairs('dark',{light:['1_144','1_144','1_6'],dark:['101_5','1_267','101_4','1_249']});
 const carrier=f.gold,ship=pull(f.m,'light','1_144','hand'),grant=pull(f.m,'light','1_6','table',f.planet);
 state.moveCard(f.m,carrier,'table');f.m.cards[carrier].location=f.planet;
 Object.assign(f.m.cards[grant],{attachedTo:carrier,aboardRole:'passenger'});
 state.moveCard(f.m,f.scout,'table');f.m.cards[f.scout].location=f.planet;
 const enemy=pull(f.m,'dark','101_5','table',f.site),sense=pull(f.m,'dark','1_267','hand'),zero=pull(f.m,'dark','101_4','hand'),barrier=pull(f.m,'dark','1_249','hand');
 if(battle){state.moveCard(f.m,f.ywing,'table');f.m.cards[f.ywing].location=f.planet;}
 let m=seek(f.m,x=>x.turn.side==='dark'&&x.turn.phase===(battle?'battle':'control')&&x.stack.length===1);m=priority(m,'dark');state.moveCard(m,zero,'reserve');m=step(m,(battle?'battle:':'drain:')+f.planet);m=priority(m,'light');
 return {...f,m,carrier,grant,enemy,sense,zero,barrier,ship,pilot:f.lightPilot};
}
export const choice=f=>'pair-deploy:'+f.ship+':'+f.pilot+':'+f.planet+':react:via:'+f.grant;
export const parent=m=>m.stack.at(-2)?.action?.handler==='ground:drain'&&!m.stack.at(-2).awaitingResponses;
