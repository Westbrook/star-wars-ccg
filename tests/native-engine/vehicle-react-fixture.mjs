import {fixture as vehicles,prepared,step,seek,priority,state,pull} from './open-vehicles-fixture.mjs';
export * from './open-vehicles-fixture.mjs';
export function fixture({bp='1_149',boarding=false,battleMode=false}={}){
 const f=vehicles(bp,'101_2',['1_30'],['1_267','101_4']);let m=prepared(f);
 if(boarding){delete m.cards[f.rider].attachedTo;delete m.cards[f.rider].aboardRole;}
 state.moveCard(m,f.vader,'table');m.cards[f.vader].location=f.camp;
 if(battleMode){state.moveCard(m,f.droid,'table');m.cards[f.droid].location=f.camp;const wolf=pull(m,'light','1_30','table');m.cards[wolf].location=f.camp;f.wolf=wolf;}
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase===(battleMode?'battle':'control')&&x.stack.length===1);m=priority(m,'dark');m=step(m,(battleMode?'battle:':'drain:')+f.camp);m=priority(m,'light');return {...f,m,sense:pull(m,'dark','1_267','hand'),zero:pull(m,'dark','101_4','hand')};
}
