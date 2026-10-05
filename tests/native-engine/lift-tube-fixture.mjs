import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority} from './noble-fixture.mjs';
export {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority};
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture({side='light',deployed=false,gate=true}={}){
 const prefix={dark:['1_308','1_283','1_284','101_4','1_285','2_113','1_194','1_194','1_194','1_194','1_194','1_302','1_267'],light:['1_148','1_28','1_28','1_28','1_28','1_28','1_19','1_129','1_127','1_140']};
 let m=runtime.createMatch('lift-tube',60,manifest.decks.map(d=>({side:d.side,cards:[...prefix[d.side],...d.main].slice(0,60)})),rules);
 const core=location(m,'dark','1_283'),corridor=location(m,'dark','1_284'),room=location(m,'dark','101_4'),bay=location(m,'dark','1_285'),planet=location(m,'light','1_127'),outside=location(m,'light','1_129');m.locations=[core,corridor,room,bay,planet,outside];
 const tube=pull(m,side,side==='light'?'1_148':'1_308',deployed?'table':'hand',deployed?core:undefined);
 const passengers=Array.from({length:5},()=>pull(m,side,side==='light'?'1_28':'1_194','table',core));
 const enemy=pull(m,side==='light'?'dark':'light',side==='light'?'1_194':'1_19','table',bay);
 const gateCard=pull(m,'dark','2_113',gate?'table':'hand');if(gate)mod('laser-gate').bindLaserGate(m,gateCard,core,corridor);
 const carrier=pull(m,side,side==='light'?'1_140':'1_302','table',planet),sense=pull(m,'dark','1_267','hand');
 force(m,'light',10);force(m,'dark',10);m=phase(m,'deploy');m=seek(m,x=>x.turn.side===side&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,side);
 return {m,side,tube,passengers,enemy,core,corridor,room,bay,planet,outside,gateCard,carrier,sense};
}
export const settled=m=>seek(m,x=>x.stack.length===1);
export const deployTube=f=>({...f,m:priority(settled(step(f.m,'vessel:deploy:'+f.tube+':'+f.core)),f.side)});
export const movePhase=f=>({...f,m:priority(seek(f.m,x=>x.turn.side===f.side&&x.turn.phase==='move'&&x.stack.length===1),f.side)});
export function reactFixture({side='light',battle=false,aboard=false}={}){
 let f=fixture({side,deployed:true}),m=f.m;
 if(aboard)for(const id of f.passengers.slice(0,4)){m.cards[id].attachedTo=f.tube;m.cards[id].aboardRole='passenger';}
 if(battle){const defender=f.passengers.at(-1);m.cards[defender].location=f.bay;}
 const opponent=side==='light'?'dark':'light';m=seek(m,x=>x.turn.side===opponent&&x.turn.phase===(battle?'battle':'control')&&x.stack.length===1);m=priority(m,opponent);m=step(m,(battle?'battle:':'drain:')+f.bay);m=priority(m,side);
 return {...f,m};
}
export function finishReact(m){return seek(m,x=>x.stack.length===1);}
