import fs from 'node:fs';
import {runtime,rules,state,pull,location,force,phase,priority,step,seek} from './noble-fixture.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(side='dark',turn='dark',mode='normal',extra={}){
 let m=runtime.createMatch('disarm',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...(d.side==='light'?['1_48','1_152','1_152','1_35','1_71']:['1_214','1_172','1_317','1_317','1_234']),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),light=pull(m,'light','1_28','table',site),dark=pull(m,'dark','1_194','table',site),evazan=pull(m,'dark','1_172','table',mode==='remote-doctor'?remote:site);
 const lg=pull(m,'light','1_152','table',site),dg=pull(m,'dark','1_317','table',site);m.cards[lg].attachedTo=light;m.cards[dg].attachedTo=dark;
 const card=pull(m,side,side==='light'?'1_48':'1_214','hand'),target=side==='light'?dark:light,gun=side==='light'?dg:lg,spare=pull(m,side==='light'?'dark':'light',side==='light'?'1_317':'1_152','hand');
 if(mode==='two-weapons'){state.moveCard(m,spare,'table');m.cards[spare].attachedTo=target;m.cards[spare].location=site;}
 const device=pull(m,'light','1_35','table',site);m.cards[device].attachedTo=light;
 if(mode==='no-own-gun')state.moveCard(m,side==='light'?lg:dg,'hand');if(mode==='no-target-gun')state.moveCard(m,gun,'hand');
 force(m,'light',8);force(m,'dark',8);m=phase(m,'control');m.turn.side=turn;m.stack[0].priority=side;
 return {m,side,card,target,gun,spare,device,evazan,site,remote,light,dark,lg,dg};
}
export const deploy=f=>'disarm:deploy:'+f.card+':'+f.target;
export const operate=f=>'disarm:operate:'+f.evazan+':'+f.target;
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export const finish=m=>seek(m,x=>x.stack.length===1);
export {runtime,rules,state,pull,location,force,phase,priority,step,seek};
