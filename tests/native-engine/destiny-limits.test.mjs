import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const limits=load(new URL('../../lib/native-engine/destiny-limits.ts',import.meta.url));
const selection=load(new URL('../../lib/native-engine/destiny-selection.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
const stages={'destiny-cost':'cost','about-to-draw-destiny':'before','destiny-drawn':'drawn','destiny-draw-complete':'complete','destiny-total':'total'};
const done={id:'done',label:'Record',handler:'probe:done',payload:{}};
const next=(remaining,values=[])=>({id:'next',label:'Continue draws',handler:'probe:next',payload:{remaining,values}});
function rules(mode){return {...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 actions:(m,w)=>w.timing==='start'&&!m.data.started?[{id:'start',label:'Begin draws',handler:'probe:start',payload:null}]:[],
 automatic:(m,w)=>stages[w.event?.kind]?[{id:'observe:'+w.serial,label:'Observe',handler:'probe:observe',actor:'light',payload:{event:w.event,index:m.stack.length-2}}]:[],
 initiate:(m,r)=>{if(r.action.handler==='probe:start')m.data.started=true},
 resolve:(m,r,c)=>{
  const p=r.action.payload;
  if(r.action.handler==='probe:start'){
   const limit=mode==='zero'?0:mode==='two'||mode.endsWith('cap-two')?2:1;
   m.data.scope=limits.beginDestinySequence(m,'light',m.data.source,'probe',limit);
   if(mode.startsWith('select'))selection.drawDestinySelection(m,'light',m.data.source,'probe',3,1,done,0,'used',{scope:m.data.scope});
   else destiny.drawDestiny(m,'light',m.data.source,'probe',next(1),false,0,undefined,false,m.data.scope);
  }else if(r.action.handler==='probe:observe'){
   (m.data.trace??=[]).push(stages[p.event.kind]);const draw=m.stack[p.index];
   if(p.event.kind==='destiny-cost'&&mode==='cost-skip')destiny.failDestinyCost(m,draw,true);
   if(p.event.kind==='about-to-draw-destiny'){
    m.data.before=(m.data.before??0)+1;
    if(mode==='substitute-first'&&m.data.before===1||mode==='substitute-late'&&m.data.before===2)assert.ok(destiny.substituteDestiny(m,draw,m.data.source,3));
    if(mode==='substitute-cap-lowered'&&m.data.before===1){limits.setDestinyLimit(m,m.data.scope,0);assert.ok(destiny.substituteDestiny(m,draw,m.data.source,3))}
    if(mode.startsWith('convert')&&!m.data.intervened){m.data.intervened=true;m.data.conversion=selection.convertDestinySelection(m,draw,2,1,next(1))}
   }
   if(p.event.kind==='destiny-drawn'){
    if(p.event.card)m.data.reveals=(m.data.reveals??0)+1;
    if(!m.data.intervened&&['cancel','redraw'].includes(mode)){m.data.intervened=true;if(mode==='redraw')assert.ok(destiny.redrawDestiny(m,draw));else draw.cancelled=true}
   }
  }else if(r.action.handler==='probe:next'){
   const values=[...p.values,...(p.draws??[p.draw])];
   if(p.remaining)destiny.drawDestiny(m,'light',m.data.source,'probe',next(p.remaining-1,values),false,0,undefined,false,m.data.scope);
   else destiny.completeDestinyTotal(m,'light',m.data.source,'probe',values,done);
  }else if(r.action.handler==='probe:done')m.data.result=p;
  else premiereRules.resolve(m,r,c);
 }
}}
function fixture(mode='one'){
 const r=rules(mode);let m=runtime.createMatch('destiny-limit',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_28','1_115','1_124']:[]),...d.main].slice(0,60)})),r);
 const source=m.players.light.reserve.at(-1);state.moveCard(m,source,'playing');m.data.source=source;
 const cards=['1_28','1_115','1_124'].map(bp=>{const id=m.players.light.reserve.find(id=>m.cards[id].blueprint===bp);state.moveCard(m,id,'hand');return id});for(const id of cards.slice().reverse())state.moveCard(m,id,'reserve');
 m=runtime.startTurns(m,r);return{m:step(m,r,'start'),r,cards};
}
function prompt(m,r){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,r,id,side=prompt(m,r).side){const before=clone(m),n=runtime.applyCommand(clone(m),r,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const s of ['dark','light'])assert.deepEqual(runtime.project(n,r,s),runtime.project(clone(n),r,s));return n}
function seek(m,r,done){for(let i=0;i<600;i++){if(done(m))return m;const p=prompt(m,r);m=step(m,r,p.mandatory?p.choices[0].id:'pass')}throw Error('Missing boundary')}
const finish=(m,r)=>seek(m,r,x=>!!x.data.result);
for(const mode of ['zero','one','two','cancel','redraw','substitute-first','substitute-late','select-cap-one','select-cap-two','convert-cap-one','convert-cap-two','cost-skip','substitute-cap-lowered'])test('GEMP physical draw limits: '+mode,()=>{
 const f=fixture(mode),m=finish(f.m,f.r),expected=JSON.parse(fs.readFileSync(new URL('./gemp/destiny-limit-results.json',import.meta.url))).find(x=>x.name===mode);
 assert.deepEqual({name:mode,events:m.data.trace??[],total:m.data.result.total,physicalReveals:m.data.reveals??0,unresolved:m.players.light.destiny.length,...(mode.startsWith('convert')?{conversion:m.data.conversion}:{})},expected);
});
test('physical, substituted and skipped-cost counts remain distinct after reload',()=>{
 for(const [mode,physical,skipped]of [['one',1,0],['substitute-first',1,0],['cost-skip',0,1],['redraw',1,0],['cancel',1,0]]){const f=fixture(mode),m=finish(f.m,f.r),s=limits.destinySequence(clone(m),m.data.scope);assert.equal(s.physical,physical);assert.equal(s.skipped,skipped);assert.equal(limits.remainingDestinyDraws(m,m.data.scope),0)}
});
test('changing a limit before reveal blocks the card without an extra cost or false draw event',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>event(x)?.kind==='about-to-draw-destiny'),reserve=[...m.players.light.reserve];limits.setDestinyLimit(m,m.data.scope,0);const n=finish(m,f.r);assert.deepEqual(n.players.light.reserve,reserve);assert.equal(n.data.result.total,null);assert.equal(limits.destinySequence(n,n.data.scope).physical,0);assert.ok(!n.data.trace.includes('drawn'));
});
test('a completed substitution remains valid when a later response lowers the limit',()=>{
 const f=fixture('substitute-first');let m=seek(f.m,f.r,x=>x.stack.some(f=>f.action?.handler==='destiny:draw'&&f.action.payload.substitution));limits.setDestinyLimit(m,m.data.scope,0);m=finish(m,f.r);assert.equal(m.data.result.total,3);assert.equal(limits.destinySequence(m,m.data.scope).physical,0);
});
test('limited draws offer no substitution and cannot be converted',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>event(x)?.kind==='about-to-draw-destiny'),pending=m.stack.at(-2);limits.setDestinyLimit(m,m.data.scope,0);assert.equal(destiny.canSubstituteDestiny(m,pending),false);assert.equal(selection.convertDestinySelection(m,pending,2,1,done),false);
});
test('nested sequences cannot consume the outer allowance',()=>{
 const f=fixture('two');let m=seek(f.m,f.r,x=>event(x)?.kind==='destiny-draw-complete');const outer=m.data.scope,nested=limits.beginDestinySequence(m,'light',m.data.source,'nested',1);
 destiny.drawDestiny(m,'light',m.data.source,'nested',{...done,payload:{nested:true}},true,0,undefined,false,nested);m=finish(m,f.r);assert.equal(m.data.result.nested,true);assert.equal(limits.destinySequence(m,outer).physical,1);assert.equal(limits.destinySequence(m,nested).physical,1);delete m.data.result;m=finish(m,f.r);assert.equal(limits.destinySequence(m,outer).physical,2);
});
test('limit increases during draw completion permit the next scheduled draw',()=>{
 const f=fixture();let m=seek(f.m,f.r,x=>event(x)?.kind==='destiny-draw-complete');limits.setDestinyLimit(m,m.data.scope,2);m=finish(m,f.r);assert.equal(m.data.result.total,6);assert.equal(limits.destinySequence(m,m.data.scope).physical,2);
});
test('finite limits truncate a mandatory group and clean unresolved remainder',()=>{
 const f=fixture('select-cap-two');let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='selection:choose');assert.equal(m.players.light.destiny.length,2);assert.equal(prompt(m,f.r).choices.length,2);m=step(m,f.r,'destiny-choice:1');m=finish(m,f.r);assert.equal(m.data.result.total,5);assert.deepEqual(m.players.light.used.slice(0,2),[f.cards[0],f.cards[1]]);assert.equal(m.cards[f.cards[2]].zone,'reserve');
});
test('invalid limits, borrowed scopes and malformed counters fail before state changes',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>event(x)?.kind==='about-to-draw-destiny');for(const limit of [-1,0.5,NaN,Infinity])assert.throws(()=>limits.setDestinyLimit(m,m.data.scope,limit));
 for(const mutate of [s=>s.physical=-1,s=>s.skipped=0.5,s=>s.side='other',s=>s.source='unknown',s=>s.limit=-1]){const bad=clone(m);mutate(limits.destinySequence(bad,bad.data.scope));assert.throws(()=>prompt(bad,f.r))}
 const bad=clone(m);bad.stack.at(-2).action.payload.scope=limits.beginDestinySequence(bad,'dark',bad.data.source,'probe');assert.throws(()=>prompt(bad,f.r));assert.throws(()=>limits.replaceDestinyDraw(m,m.data.scope));
});
test('concession preserves physical accounting and unresolved cards',()=>{
 const f=fixture('select-cap-two'),m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='selection:choose'),n=step(m,f.r,'concede','light');assert.deepEqual(n.data.destinySequences,m.data.destinySequences);assert.deepEqual(n.players,m.players);
});
