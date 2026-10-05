import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
export const bridge=load(new URL('../../lib/native-engine/retract-bridge.ts',import.meta.url));
export const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
export const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
const {premiereRules:base}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
export const rules={...base,starting:undefined,supports:()=>true,setupComplete:()=>true,
 actions:(m,w,s)=>[...base.actions(m,w,s).filter(a=>!a.handler.startsWith('retract:')),...bridge.retractBridgeActions(m,w,s)],
 initiate:(m,r,c)=>r.action.handler.startsWith('retract:')?bridge.retractBridgeInitiate(m,r):base.initiate(m,r,c),
 resolve:(m,r,c)=>r.action.handler.startsWith('retract:')?bridge.retractBridgeResolve(m,r):base.resolve(m,r,c),
 decisions:(m,d)=>d.handler.startsWith('retract:')?bridge.retractBridgeChoices(m,d):base.decisions(m,d),
 choose:(m,d,id,c)=>d.handler.startsWith('retract:')?bridge.retractBridgeChoose(m,d,id):base.choose(m,d,id,c),
 validate:m=>{base.validate(m);bridge.assertRetractBridge(m)}};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id;}
export const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return runtime.prompt(m,rules,p.side)};
export function step(m,id){return runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);}
export function seek(m,fn){for(let i=0;i<200;i++){if(fn(m))return m;const p=prompt(m);m=step(m,p.choices.find(c=>c.id==='pass')?.id??p.choices[0].id);}throw Error('boundary');}
export function fixture(){
 const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
 let m=runtime.createMatch('retract-bridge',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['2_138','1_283','1_285','1_284']:['1_101','1_110','1_19','1_109','1_129']),...d.main].slice(0,60)})),rules);
 const core=pull(m,'dark','1_283'),corridor=pull(m,'dark','1_284'),bay=pull(m,'dark','1_285');m.locations.push(core,corridor,bay);
 const sense=pull(m,'light','1_109','hand'),card=pull(m,'dark','2_138','hand'),edge=pull(m,'light','1_101','hand'),sky=pull(m,'light','1_110','hand'),hero=pull(m,'light','1_19','table',corridor),trooper=pull(m,'dark','1_194','hand');
 for(const s of ['dark','light'])for(let i=0;i<10;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=runtime.startTurns(m,rules);m=seek(m,x=>x.stack.length===1&&x.turn.phase==='deploy');if(prompt(m).side!=='dark')m=step(m,'pass');
 return {m,core,corridor,bay,card,edge,sky,hero,trooper,sense};
}
export const play=(m,card,mode='rearrange')=>step(m,prompt(m).choices.find(c=>c.id.startsWith('retract:play:'+card+':'+mode)).id);
