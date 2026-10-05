import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {duel}=load(new URL('../../lib/native-engine/duel.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}

function fixture(dark=[1,1],light=[1,1]){
 let m=fresh({dark:['101_6','101_6','1_194','1_194'],light:['101_3','101_3','1_28','1_28']});
 const site=location(m,'light','1_129'),from=location(m,'dark','1_293'),vader=pull(m,'dark','101_5','table',from),luke=pull(m,'light','101_2','table',site),card=pull(m,'dark','101_6','hand'),second=pull(m,'dark','101_6','hand'),run=pull(m,'light','101_3','hand'),run2=pull(m,'light','101_3','hand');
 const lost={dark:[],light:[]};for(const side of ['dark','light'])for(let i=0;i<3;i++)lost[side].push(pull(m,side,side==='dark'?'1_194':'1_28','lost'));
 force(m,'dark',6);force(m,'light',6);m=phase(m,'move');
 const draws={dark:[],light:[]};for(const side of ['dark','light']){
  for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');
  for(const value of (side==='dark'?dark:light).slice().reverse()){
   const id=m.players[side].hand.find(id=>![card,second,run,run2].includes(id)&&board.printed(m,id,'destiny')===value);assert.ok(id,'destiny fixture '+side+' '+value);state.moveCard(m,id,'reserve');draws[side].unshift(id);
  }
 }
 m=step(m,'move:'+vader+':'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');m=priority(m,'dark');return{m,card,second,run,run2,vader,luke,site,from,lost,draws};
}
function start(f){return step(f.m,'duel:obsession:'+f.card)}
function finish(m){return seek(m,x=>duel(x)?.stage==='complete'&&x.stack.length===1)}
function result(m){return seek(m,x=>x.stack.at(-1)?.event?.kind==='duel-result')}

export {fixture, start, finish, result, step, prompt, clone, duel, runtime, state, rules};
