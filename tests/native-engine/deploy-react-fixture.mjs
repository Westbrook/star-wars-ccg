import {fixture as vehicles,step,seek,priority,state,pull,force} from './open-vehicles-fixture.mjs';
export * from './open-vehicles-fixture.mjs';
export function fixture({side='light',battleMode=false,bp='1_149'}={}){
 const f=vehicles(bp,'101_2',['1_6','1_151','1_109'],['1_249','1_201','1_267','1_310','1_194','101_4']);let m=f.m;
 const grant=pull(m,side,side==='light'?'1_6':'1_201','table');m.cards[grant].location=f.dune;
 if(side==='dark'){state.moveCard(m,f.driver,'table');m.cards[f.driver].location=f.dune;m.cards[grant].attachedTo=f.driver;}
 const enemy=side==='light'?f.vader:f.luke;state.moveCard(m,enemy,'table');m.cards[enemy].location=f.camp;
 if(battleMode){const resident=side==='light'?f.rider:f.passenger;if(resident===enemy)throw Error('Invalid battle fixture');state.moveCard(m,resident,'table');m.cards[resident].location=f.camp;}
 force(m,side,12);const opponent=side==='light'?'dark':'light';m=seek(m,x=>x.turn.side===opponent&&x.turn.phase===(battleMode?'battle':'control')&&x.stack.length===1);m=priority(m,opponent);m=step(m,(battleMode?'battle:':'drain:')+f.camp);m=priority(m,side);
 return {...f,m,side,opponent,grant,vehicle:side==='light'?f.host:f.enemyVehicle,crew:side==='light'?f.lightPilot:f.passenger,sense:pull(m,opponent,side==='light'?'1_267':'1_109','hand'),zero:side==='light'?pull(m,'dark','101_4','hand'):f.zero,enemy};
}
export const deployChoice=(f,card=f.vehicle,target=f.camp,role)=>'vessel:'+(role?'aboard':'deploy')+':'+card+':'+target+(role?':'+role:'')+':react:via:'+f.grant;
export const parent=m=>m.stack.at(-2)?.action?.handler==='ground:drain'||m.stack.at(-2)?.action?.handler==='battle:begin';
