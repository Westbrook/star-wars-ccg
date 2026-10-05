import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const {recordEquipment}=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));
import {runtime,state,rules,pull,location,force,phase,priority,step,prompt,seek} from './noble-fixture.mjs';
export {runtime,state,rules,step,prompt};
export const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Exact physical starter counts, controlled initial zones; no mid-action interventions.
export function fixture(mode){
 const duel=mode.startsWith('duel'),light=mode.startsWith('friendly'),lightInitiates=mode.endsWith('light');
 let m=runtime.createMatch('starter-timing-reachability',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),rules);
 const site=location(m,'light','1_129'),near=location(m,'light','1_130'),remote=location(m,'dark','1_284');
 const luke=pull(m,'light','101_2','table',mode==='friendly-dark'?near:site),vader=pull(m,'dark','101_5','table',near),rebel=pull(m,'light','1_28','table',site),storm=pull(m,'dark','1_194','table',site),raider=pull(m,'dark','1_196','table',site);
 for(const [side,bp,at] of [['light','1_6',site],['light','1_18',site],['light','1_31',site],['light','1_30',near],['dark','1_186',site]])pull(m,side,bp,'table',at);
 const attach=(side,bp,host)=>{const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;if(['1_64','1_221'].includes(bp))recordEquipment(m).training[id]='power';return id;};
 for(const bp of ['1_152','1_35','1_40','1_64'])attach('light',bp,rebel);attach('light','1_153',luke);
 for(const bp of ['1_317','1_201','1_207','1_221'])attach('dark',bp,storm);attach('dark','1_312',vader);attach('dark','1_315',raider);pull(m,'dark','1_224','table');
 for(const [side,bp] of [['light','1_162'],['dark','1_322']])pull(m,side,bp,'buried',remote);
 const hand={};for(const c of manifest.cards.filter(c=>c.type==='Interrupt'))hand[c.gempId]=pull(m,c.side,c.gempId,'hand');
 pull(m,'light','1_28','hand');pull(m,'dark','1_194','hand');
 pull(m,'light','1_28','lost');pull(m,'dark','1_194','lost');
 force(m,'light',10);force(m,'dark',10);
 m=phase(m,duel?'move':'battle');if(lightInitiates)m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);
 // Deterministic draws from remaining exact starter copies, before initiating the action.
 const prepared=new Set();for(const side of duel?['dark','light']:[light?'light':'dark'])for(let n=0;n<(duel?2:1);n++){const bp=duel?(side==='light'?'1_28':'1_194'):(side==='light'?'1_131':'1_285');const id=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&['reserve','force'].includes(c.zone)&&!prepared.has(c.id))?.id;if(!id)throw Error('Missing prepared destiny '+bp);prepared.add(id);state.moveCard(m,id,'reserve');}
 m=priority(m,lightInitiates?'light':'dark');m=step(m,duel?'move:'+vader+':'+site:'battle:'+site);if(duel)m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');
 const baseline=[];for(let n=0;n<3;n++){baseline.push({side:prompt(m).side,choices:prompt(m).choices.map(c=>c.id)});if(prompt(m).side===(light?'light':'dark'))break;m=step(m,'pass');}
 const card=hand[duel?'101_6':light?'1_80':'1_237'];return {m,mode,duel,light,site,luke,vader,rebel,storm,card,hand,baseline};
}
export function play(f){return step(f.m,(f.duel?'duel:obsession:':'accident:play:')+f.card);}
