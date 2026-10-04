import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,priority} from './noble-fixture.mjs';
export {runtime,state,rules,clone,prompt,ids,step,seek,priority};
export const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export const event=m=>m.stack.at(-1)?.event;
export const opposite=s=>s==='light'?'dark':'light';
export const modes=['space','enclosed','unpiloted','landed','cargo','open'];
export function fixture(owner='light',mode='space'){
 const side=opposite(owner),extras={light:['1_129','1_140','1_142','1_151','1_149','1_11','1_28','1_5',...Array(6).fill('1_113')],dark:['1_289','1_302','1_305','1_310','1_179','1_194','1_175',...Array(6).fill('1_238')]};
 let m=runtime.createMatch('assault-presence',60,manifest.decks.map(d=>({side:d.side,cards:[...extras[d.side],...d.main].slice(0,60)})),rules);
 const ground=location(m,'light','1_129'),space=location(m,'dark','1_289'),site=['space','cargo'].includes(mode)?space:ground;
 const ship=owner==='light'?'1_140':'1_302',vehicle=owner==='light'?(mode==='open'?'1_149':'1_151'):'1_310',fighter=owner==='light'?'1_142':'1_305';
 const host=pull(m,owner,['enclosed','unpiloted','open'].includes(mode)?vehicle:mode==='landed'?fighter:ship,'table',site);
 const pilot=pull(m,owner,owner==='light'?'1_11':'1_179','hand'),passenger=pull(m,owner,owner==='light'?'1_28':'1_194','hand');
 const aboard=(id,carrier,role)=>{state.moveCard(m,id,'table');Object.assign(m.cards[id],{location:site,attachedTo:carrier,aboardRole:role})};
 let cargo;
 if(mode==='cargo'){cargo=pull(m,owner,vehicle,'table',site);m.cards[cargo].attachedTo=host;m.cards[cargo].aboardRole='vehicle';aboard(pilot,cargo,'driver');aboard(passenger,cargo,'passenger');}
 else {if(mode!=='unpiloted')aboard(pilot,host,['enclosed','open'].includes(mode)?'driver':'pilot');aboard(passenger,host,'passenger');}
 // Unpiloted and landed hosts cannot supply presence: a trooper permits the drain.
 const guard=['unpiloted','landed'].includes(mode)?pull(m,owner,owner==='light'?'1_28':'1_194','table',site):undefined;
 const card=pull(m,side,side==='light'?'1_113':'1_238','hand');
 const draws=Array.from({length:4},()=>pull(m,side,side==='light'?'1_113':'1_238','hand'));
 force(m,'light',15);force(m,'dark',15);m=runtime.startTurns(m,rules);m=seek(m,x=>x.turn.side===owner&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,owner);
 for(const id of draws.slice().reverse())state.moveCard(m,id,'reserve');
 m=step(m,'drain:'+site);m=priority(m,side);
 return {m,owner,side,mode,site,host,pilot,passenger,cargo,guard,card,draws};
}
export const play=f=>step(f.m,'assault:play:'+f.card);
export const result=m=>seek(m,x=>event(x)?.kind==='assault-result');
export const finish=(m,card)=>seek(m,x=>x.cards[card].zone==='lost'&&x.stack.length===1);
