import {fixture} from './space-slug-fixture.mjs';
import {deploy,pull,seek,priority,step,ids,state,load} from './vessels-fixture.mjs';
export function start({pilot=false,dark=[]}={}){
 const f=fixture({dark});let m=deploy(f.m,f.ywing,f.big);if(pilot)m=deploy(m,f.lightPilot,f.ywing,'pilot');
 m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');
 const dice=['1_70','1_88'].map(bp=>pull(m,'light',bp,'hand'));for(const id of dice.reverse())state.moveCard(m,id,'reserve');
 m=step(m,ids(m).find(id=>id.includes(':hunt:')));return {...f,m};
}

export function inspectionFixture(){
 const f=start({dark:['1_266']});let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');m=priority(m,'dark');const scan=pull(m,'dark','1_266','hand');m=step(m,'scan:play:'+scan);
 const loss=load(new URL('../../lib/native-engine/table.ts',import.meta.url));loss.loseFromTable(m,[f.ywing]);m=seek(m,x=>x.stack.at(-1)?.handler==='scan:peek');return {...f,m,scan};
}
