import assert from 'node:assert/strict';
import {mod,runtime,state,rules,clone,pull,prompt,ids,step,seek,boundary,priority,phase} from './prisoner-fixture.mjs';
export {mod,runtime,state,rules,clone,pull,prompt,ids,step,seek,boundary,priority,phase};
export const decks=()=>['light','dark'].map(side=>({side,cards:[...(side==='light'?['2_3','2_3','1_11','1_129','1_132','1_127','1_143','1_147','1_140','1_149','1_150','1_5','1_5','1_152','1_40','1_65','1_13']:['1_284','1_168','1_317','1_317','1_305','1_179']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
export function fixture(mode='ground'){
 let m=runtime.createMatch('chewbacca',60,decks(),rules);const site=pull(m,'light','1_129'),adj=pull(m,'light','1_132'),planet=pull(m,'light','1_127');m.locations=[site,adj,planet];
 const chewie=pull(m,'light','2_3','hand'),han=pull(m,'light','1_11','hand'),ship=pull(m,'light','1_143','table',mode==='landed'?site:planet),enemy=pull(m,'dark','1_194','table',site),gun=pull(m,'dark','1_317','table',site);m.cards[gun].attachedTo=enemy;
 for(let i=0;i<8;i++)pull(m,'dark','1_194','table',site);
 for(const side of ['light','dark'])for(let i=0;i<14;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'light','deploy');return {m,mode,site,adj,planet,chewie,han,ship,enemy,gun};
}
export const settle=m=>seek(m,x=>x.stack.length===1);
export function deployChewie(f,where=f.site,role){let m=priority(f.m,'light');const id=role?'vessel:aboard:'+f.chewie+':'+where+':'+role:'deploy:'+f.chewie+':'+where;assert.ok(ids(m).includes(id),id);return settle(step(m,id));}
export function ground(f){return deployChewie(f);}
export function damage(f,bp='1_5'){
 let m=ground(f),target=pull(m,'light',bp,'table',f.site);m=phase(m,'dark','battle');m=boundary(step(m,'battle:'+f.site),'battle-damage');m=priority(m,'light');return {...f,m,target};
}
/** Actual battle ready for an ordinary Imperial Blaster shot at a droid. */
export function shotFixture(){
 const f=fixture();let m=ground(f);const target=pull(m,'light','1_5','table',f.site),destiny=pull(m,'dark','1_317','hand');state.moveCard(m,destiny,'reserve');m=phase(m,'dark','battle');m=priority(boundary(step(m,'battle:'+f.site),'battle-weapons'),'dark');return {...f,m,target};
}
