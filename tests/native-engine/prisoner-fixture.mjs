import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
export const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
export const runtime=mod('runtime'),state=mod('state'),board=mod('board'),battle=mod('battle');
export const rules={...mod('premiere-rules').premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
export const clone=x=>JSON.parse(JSON.stringify(x));
export const decks=()=>['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_129','1_132','1_19','1_152','1_40','1_109','1_109']:['1_284','1_168','2_142','2_142','1_317']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
export function pull(m,side,bp,zone='table',location){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);if(location)c.location=location;return c.id;}
export function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side);}
export const ids=m=>prompt(m).choices.map(c=>c.id);
export function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const side of ['light','dark'])assert.deepEqual(runtime.project(r,rules,side),runtime.project(clone(r),rules,side));return r;}
export function seek(m,f){for(let n=0;n<600;n++){if(f(m))return m;const cs=ids(m);m=step(m,cs.includes('pass')?'pass':cs.includes('skip-destiny')?'skip-destiny':cs[0]);}throw Error('unreached boundary');}
export const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
export const priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
export const phase=(m,side,phase)=>seek(m,x=>x.turn.side===side&&x.turn.phase===phase&&x.stack.length===1&&prompt(x).side===side);
export function fixture(prison=false,stage='battle-damage'){
 let m=runtime.createMatch('prisoner',60,decks(),rules);const site=pull(m,prison?'dark':'light',prison?'1_284':'1_129');m.locations.push(site);
 const target=pull(m,'light','1_19','table',site),second=pull(m,'light','1_28','table',site),gun=pull(m,'light','1_152','table',site),device=pull(m,'light','1_40','table',site);
 m.cards[gun].attachedTo=target;m.cards[device].attachedTo=target;
 const escort=pull(m,'dark','1_194','table',site),card=pull(m,'dark','2_142','hand');
 for(let i=0;i<9;i++)pull(m,'dark','1_194','table',site);
 for(const s of ['light','dark'])for(let i=0;i<10;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','battle');m=priority(boundary(step(m,'battle:'+site),stage),'light');
 return {m,site,target,second,gun,device,escort,card};
}
export function pending(f){return priority(boundary(step(f.m,'forfeit:'+f.target),'about-to-forfeit'),'dark');}
export const offer=(m,f)=>ids(m).find(id=>id.startsWith('prisoner:'+f.card+':'+f.target+':'));
export const destination=m=>seek(m,x=>x.stack.at(-1)?.handler==='prisoner:destination');
export const finished=m=>seek(m,x=>!x.stack.some(f=>(f.kind==='resolution'?f.action.handler:f.handler)?.startsWith('prisoner:')||(f.kind==='resolution'&&f.action.handler.startsWith('forfeiture:'))));
