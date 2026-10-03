import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('noble-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
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

const restrictions=load(new URL('../../lib/native-engine/retrieval-contributors.ts',import.meta.url));
const stats=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));
const persona=load(new URL('../../lib/native-engine/persona.ts',import.meta.url));
export function fixture(mode='retrieve',extra=[]){
 let m=fresh({light:['1_99','1_115','1_115','1_115','1_115','1_115','1_152','1_35',...extra],dark:['1_267','8_114','13_86']});
 const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),target=pull(m,'light','1_28','table',site),noble=pull(m,'light','1_99','hand'),deployed=pull(m,'dark','1_194','hand'),vader=pull(m,'dark','101_5','table',remote),sense=pull(m,'dark','1_267','hand'),gun=pull(m,'light','1_152','hand'),device=pull(m,'light','1_35','hand');
 const lost=Array.from({length:5},()=>pull(m,'light','1_115','lost'));force(m,'light',8);force(m,'dark',6);
 if(mode==='attachments')for(const id of [gun,device]){state.moveCard(m,id,'table');m.cards[id].attachedTo=target;m.cards[id].location=site;}
 if(mode==='tarl')pull(m,'dark','8_114','table',remote);if(mode==='plans')pull(m,'dark','13_86','table');
 m=phase(m,'deploy');
 if(mode==='blocked')restrictions.preventRetrievalContribution(m,remote,target);
 if(mode==='forfeit-four')stats.addStatModifier(m,remote,target,'forfeit','add',2);
 topDestiny(m,'dark','101_4');m=step(m,'deploy:'+deployed+':'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed');
 return {m,site,remote,target,noble,deployed,vader,sense,lost,gun,device};
}
const nobleChoice=(m,card)=>ids(m).find(id=>id.startsWith('noble:play:'+card+':'));
function progress(m){const p=prompt(m);return step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='noble:retrieve')?'noble:retrieve':p.choices.some(c=>c.id==='plans:pay')?'plans:pay':p.choices[0].id)}
function finish(m,card){for(let n=0;n<300;n++){if(m.cards[card].zone==='lost')return m;m=progress(m)}throw Error('sacrifice did not finish')}
function respondable(m,card){return seek(m,x=>x.stack.at(-2)?.action?.handler==='noble:play'&&!x.stack.at(-2).awaitingResponses)}

export {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority,progress,finish,respondable,nobleChoice,restrictions,stats,persona};
