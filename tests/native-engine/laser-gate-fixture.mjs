import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
export const gate=load(new URL('../../lib/native-engine/laser-gate.ts',import.meta.url));
export const bridge=load(new URL('../../lib/native-engine/retract-bridge.ts',import.meta.url));
export const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
export const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
export const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
export const ability=load(new URL('../../lib/native-engine/ability.ts',import.meta.url));
const {premiereRules:base}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
export const rules={...base,starting:undefined,supports:()=>true,setupComplete:()=>true,
 actions:(m,w,s)=>[...base.actions(m,w,s).filter(a=>!a.handler.startsWith('laser-gate:')),...gate.laserGateActions(m,w,s)],
 initiate:(m,r,c)=>r.action.handler.startsWith('laser-gate:')?gate.laserGateInitiate(m,r):base.initiate(m,r,c),
 resolve:(m,r,c)=>r.action.handler.startsWith('laser-gate:')?gate.laserGateResolve(m,r):base.resolve(m,r,c),
 validate:m=>{base.validate(m);gate.assertLaserGate(m)}};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id;}
export const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return runtime.prompt(m,rules,p.side)};
export const step=(m,id)=>runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);
export function seek(m,fn){for(let i=0;i<200;i++){if(fn(m))return m;const p=prompt(m);m=step(m,p.choices.find(c=>c.id==='pass')?.id??p.choices[0].id);}throw Error('boundary');}
export function fixture(){
 const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
 let m=runtime.createMatch('laser-gate',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['2_113','2_113','2_113','2_138','1_283','1_284','1_285','1_310']:['1_19','1_28','1_110','1_129','1_124']),...d.main].slice(0,60)})),rules);
 const core=pull(m,'dark','1_283'),corridor=pull(m,'dark','1_284'),bay=pull(m,'dark','1_285');m.locations.push(core,corridor,bay);
 const card=pull(m,'dark','2_113','hand'),second=pull(m,'dark','2_113','hand'),third=pull(m,'dark','2_113','hand'),retract=pull(m,'dark','2_138','hand'),hero=pull(m,'light','1_19','table',core),weak=pull(m,'light','1_28','table',core),vehicle=pull(m,'dark','1_310','table',bay),sky=pull(m,'light','1_110','hand');
 for(const side of ['dark','light'])for(let i=0;i<10;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=runtime.startTurns(m,rules);m=seek(m,x=>x.stack.length===1&&x.turn.phase==='deploy');if(prompt(m).side!=='dark')m=step(m,'pass');
 return {m,card,second,third,retract,core,corridor,bay,hero,weak,vehicle,sky};
}
export const deploy=(f,id=f.card,a=f.core,b=f.corridor)=>{let m=step(f.m,'laser-gate:deploy:'+id+':'+a+':'+b);return seek(m,x=>x.cards[id].zone==='table');};
export const ready=m=>seek(m,x=>x.stack.length===1&&prompt(x).side==='dark');
