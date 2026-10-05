import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
export const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
export const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
export const rules={...premiereRules,id:'preparation-starting-test',supports:()=>true};
export const decks=({size=60,first='dark',effects=true,copies=2}={})=>['dark','light'].map(side=>({side,cards:[side==='dark'?(first==='light'?'2_143':'1_291'):'1_132',side==='dark'?'9_139':'9_51',...Array(effects?copies:0).fill(side==='dark'?'4_134':'4_21'),...Array(size).fill(side==='dark'?'1_194':'1_28')].slice(0,size)}));
export const prompt=(m,r=rules)=>{const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side);};
export const step=(m,id,side=prompt(m).side,r=rules)=>runtime.applyCommand(m,r,side,{revision:m.revision,choice:id},()=>42);
export function ready(options={},r=rules){let m=runtime.createMatch('preparation-starting',options.size??60,decks(options),r);for(const side of ['dark','light'])m=step(m,'select:'+side+'-1',side,r);m=step(m,'reveal','dark',r);const p=prompt(m,r);m=step(m,p.choices[0].id,p.side,r);for(const side of ['dark','light'])m=step(m,'starting-select:'+side+'-2',side,r);return step(m,'starting-reveal','dark',r);}
export function advance(m,predicate,r=rules){for(let n=0;n<200;n++){if(predicate(m))return m;const p=prompt(m,r);assert.ok(p,'ended early');const c=p.choices.find(c=>c.id==='pass')??p.choices[0];m=step(m,c.id,p.side,r);}throw Error('No boundary');}
export const playing=(m,r=rules)=>advance(m,x=>x.status==='playing',r);
export const search=(m,r=rules)=>advance(m,x=>x.stack.at(-1)?.handler==='prep-start:choose',r);
