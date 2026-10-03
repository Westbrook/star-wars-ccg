import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const selection=load(new URL('../../lib/native-engine/destiny-selection.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
const stages={'destiny-cost':'cost','before-force-use':'use-before','force-used':'used','about-to-draw-destiny':'before','destiny-drawn':'drawn','destiny-draw-complete':'complete','destiny-total':'total'};
const next={id:'result',label:'Continue',handler:'probe:result',payload:{}};
function rules(mode='paid',opts={}){return {...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 actions:(m,w,side)=>w.timing==='start'&&!m.data.started?[{id:'start',label:'Draw',handler:'probe:start',payload:null}]:[],
 automatic:(m,w)=>stages[w.event?.kind]?[{id:'observe:'+w.serial,label:'Resolve draw timing',handler:w.event.kind==='destiny-cost'?'probe:tax':'probe:observe',actor:'light',payload:{event:w.event,index:m.stack.length-2}}]:[],
 initiate:(m,r)=>{if(r.action.handler==='probe:start')m.data.started=true},
 resolve:(m,r,c)=>{
  const p=r.action.payload;
  if(r.action.handler==='probe:start'){
   const n=['two','second-unpaid'].includes(mode)?2:1;
   if(opts.selection)selection.drawDestinySelection(m,'light',m.data.source,'probe',3,1,next);
   else destiny.drawDestiny(m,'light',m.data.source,'probe',{...next,payload:{remaining:n-1,draws:[]}},n===1);
  }else if(r.action.handler==='probe:tax'){
   (m.data.trace??=[]).push('cost');const target=m.stack[p.index];
   if(!m.players.light.force.length)destiny.failDestinyCost(m,target,false);
   else m.stack.push({kind:'decision',side:'light',handler:'probe:pay',payload:{index:p.index,id:target.action.id}});
  }else if(r.action.handler==='probe:paid')m.data.paid=(m.data.paid??0)+1;
  else if(r.action.handler==='probe:observe'){
   (m.data.trace??=[]).push(stages[p.event.kind]);const pending=m.stack[p.index];
   if(mode==='substituted'&&p.event.kind==='about-to-draw-destiny')assert.ok(destiny.substituteDestiny(m,pending,m.data.source,3));
   if(mode==='redraw'&&p.event.kind==='destiny-drawn'&&!m.data.redrawn){m.data.redrawn=true;assert.ok(destiny.redrawDestiny(m,pending))}
  }else if(r.action.handler==='probe:result'){
   if(p.remaining>0)destiny.drawDestiny(m,'light',m.data.source,'probe',{...next,payload:{remaining:p.remaining-1,draws:[...p.draws,p.draw]}},false);
   else if(p.remaining===0&&p.total===undefined)destiny.completeDestinyTotal(m,'light',m.data.source,'probe',[...p.draws,p.draw],{...next,payload:{}});
   else m.data.result=p;
  }else premiereRules.resolve(m,r,c);
 },
 decisions:(m,d)=>d.handler==='probe:pay'?[{id:'pay',label:'Use 1 Force'},{id:'decline',label:'Do not draw'}]:premiereRules.decisions(m,d),
 choose:(m,d,id,c)=>{
  if(d.handler!=='probe:pay')return premiereRules.choose(m,d,id,c);
  const target=m.stack[d.payload.index];assert.equal(target.action.id,d.payload.id);
  if(id==='decline')destiny.failDestinyCost(m,target,true);
  else {const parent={kind:'resolution',actor:'light',cancelled:false,awaitingResponses:true,action:{id:'paid:'+m.serial,label:'Pay draw cost',handler:'probe:paid',payload:null,payment:{light:1}}};m.stack.push(parent);runtime.queueForcePayment(m,parent,parent.action.payment)}
 },...opts.rules};}
function fixture(mode='paid',opts={}){
 const r=rules(mode,opts);let m=runtime.createMatch('draw-cost',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_28','1_115']:[]),...d.main].slice(0,60)})),r);
 const source=m.players.light.reserve.at(-1);state.moveCard(m,source,'playing');m.data.source=source;
 const available=mode==='unpaid'?0:mode==='second-unpaid'?1:4;
 for(let i=0;i<available;i++)state.moveCard(m,m.players.light.reserve.at(-1),'force');
 for(const bp of ['1_115','1_28']){const id=m.players.light.reserve.find(id=>m.cards[id].blueprint===bp);state.moveCard(m,id,'hand');state.moveCard(m,id,'reserve')}
 if(mode==='empty')for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');
 m=runtime.startTurns(m,r);return{m:step(m,r,'start'),r,available};
}
function prompt(m,r){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,r,id,side=prompt(m,r).side){const before=clone(m),n=runtime.applyCommand(clone(m),r,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const s of ['dark','light'])assert.deepEqual(runtime.project(n,r,s),runtime.project(clone(n),r,s));return n}
function seek(m,r,done,mode='paid'){for(let i=0;i<700;i++){if(done(m))return m;const p=prompt(m,r);m=step(m,r,m.stack.at(-1)?.handler==='probe:pay'?(mode==='declined'?'decline':'pay'):p.mandatory?p.choices[0].id:'pass')}throw Error('Missing boundary')}
const finish=(m,r,mode)=>seek(m,r,x=>!!x.data.result,mode);
const reference=()=>JSON.parse(fs.readFileSync(new URL('./gemp/destiny-cost-results.json',import.meta.url)));
for(const mode of ['paid','declined','unpaid','substituted','redraw','two','second-unpaid','empty'])test('shared destiny-cost GEMP timing: '+mode,()=>{
 const f=fixture(mode),m=finish(f.m,f.r,mode),expected=reference().find(x=>x.name===mode);
 assert.deepEqual({name:mode,events:m.data.trace??[],total:m.data.result.total,paid:f.available-m.players.light.force.length,unresolved:m.players.light.destiny.length},expected);
});
test('an unpaid draw is skipped, not a failed physical draw or a substituted zero',()=>{
 for(const mode of ['unpaid','declined']){const f=fixture(mode),reserve=[...f.m.players.light.reserve],m=finish(f.m,f.r,mode);assert.deepEqual(m.players.light.reserve,reserve);assert.deepEqual(m.data.result.draw,{card:null,value:null,skipped:mode==='unpaid'?'cost-unpaid':'cost-declined'});assert.equal(m.data.result.total,null);assert.deepEqual(m.data.trace,['cost'])}
});
test('payment response can change Reserve top before the draw',()=>{
 const f=fixture();let m=seek(f.m,f.r,x=>event(x)?.kind==='force-used');const next=m.players.light.reserve[1];state.moveCard(m,next,'hand');state.moveCard(m,next,'reserve');m=finish(m,f.r);assert.equal(m.data.result.draw.card,next);assert.equal(m.data.result.total,5);
});
test('cost boundary cannot receive substitution or conversion before payment',()=>{
 const f=fixture();let m=seek(f.m,f.r,x=>event(x)?.kind==='destiny-cost');const p=m.stack.at(-2);assert.equal(destiny.substituteDestiny(m,p,m.data.source,3),false);assert.equal(selection.convertDestinySelection(m,p,2,1,next),false);
});
test('failure binds only the exact live cost frame and preserves voluntary refusal',()=>{
 const f=fixture();let m=seek(f.m,f.r,x=>event(x)?.kind==='destiny-cost'),p=m.stack.at(-2);
 assert.equal(destiny.failDestinyCost(m,clone(p),false),false);assert.ok(destiny.failDestinyCost(m,p,true));assert.ok(destiny.failDestinyCost(m,p,false));assert.equal(p.action.payload.costFailure,'cost-declined');assert.throws(()=>destiny.failDestinyCost(m,p,'yes'));
});
test('malformed saved cost and skip states are rejected before a command',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>event(x)?.kind==='destiny-cost');for(const corrupt of [p=>p.costFailure='yes',p=>{p.costFailure='cost-unpaid';p.substitution={source:m.data.source,value:3}},p=>p.substitution={source:m.data.source,value:3}]){const bad=clone(m);corrupt(bad.stack.at(-2).action.payload);assert.throws(()=>prompt(bad,f.r))}
 for(const d of [{card:m.data.source,value:null,skipped:'cost-unpaid'},{card:null,value:0,skipped:'cost-unpaid'},{card:null,value:null,skipped:'other'}])assert.equal(destiny.validDraw(m,d,'light'),false);
});
test('conceding during cost choice freezes payment and Reserve',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='probe:pay'),n=step(m,f.r,'concede','light');assert.deepEqual(n.players,m.players);assert.equal(n.result.winner,'dark');assert.ok(!n.data.result);
});
test('cost choices reject stale and opponent commands without mutation',()=>{
 const f=fixture(),m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='probe:pay'),before=clone(m);assert.throws(()=>step(m,f.r,'pay','dark'));assert.throws(()=>runtime.applyCommand(m,f.r,'light',{revision:m.revision-1,choice:'pay'}));assert.deepEqual(m,before);
});
test('selection pays each candidate and excludes an unpaid candidate',()=>{
 const f=fixture('second-unpaid',{selection:true});let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='selection:choose');assert.equal(m.players.light.destiny.length,1);assert.equal(prompt(m,f.r).choices.length,1);assert.deepEqual(m.data.trace.filter(s=>s==='cost'||s==='used'),['cost','used','cost','cost']);m=step(m,f.r,prompt(m,f.r).choices[0].id);m=finish(m,f.r);assert.equal(m.data.result.total,1);assert.equal(m.players.light.destiny.length,0);
});
for(const mode of ['paid','unpaid'])test('battle adapter resumes after '+mode+' draw cost without a false failed-draw response',()=>{
 const base=rules(mode),r={...base,actions:premiereRules.actions,initiate:premiereRules.initiate,automatic:(m,w)=>w.event?.side==='light'?base.automatic(m,w):[],resolve:(m,f,c)=>f.action.handler.startsWith('probe:')?base.resolve(m,f,c):premiereRules.resolve(m,f,c)};
 let m=runtime.createMatch('battle-tax',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['101_2','1_28']:['101_5']),...d.main].slice(0,60)})),r);
 const pull=(side,bp,site)=>{const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id);state.moveCard(m,id,'table');if(site)m.cards[id].location=site;return id};
 const site=pull('light','1_129');m.locations.push(site);pull('light','101_2',site);pull('light','1_28',site);pull('dark','101_5',site);m.data.source=site;
 for(const side of ['dark','light'])for(let i=0;i<(side==='light'&&mode==='unpaid'?0:4);i++)state.moveTop(m,side,'reserve','force');
 m=runtime.startTurns(m,r);m=seek(m,r,x=>x.turn.phase==='battle'&&x.stack.length===1&&prompt(x,r).side==='dark');m=step(m,r,'battle:'+site);
 const events=[];for(let i=0;i<600&&event(m)?.kind!=='battle-destiny-complete';i++){
  const e=event(m);if(e?.side==='light'&&events.at(-1)!==e.kind)events.push(e.kind);
  const p=prompt(m,r),ids=p.choices.map(c=>c.id);m=step(m,r,m.stack.at(-1)?.handler==='probe:pay'?'pay':ids.includes('draw-destiny')?(p.side==='light'?'draw-destiny':'skip-destiny'):p.mandatory?p.choices[0].id:'pass');
 }
 assert.equal(event(m)?.kind,'battle-destiny-complete');assert.ok(!events.includes('battle-destiny-failed'));
 assert.equal(events.includes('about-to-draw-destiny'),mode==='paid');assert.equal(events.includes('battle-destiny-drawn'),mode==='paid');
 if(mode==='unpaid')assert.equal(m.data.battle.destiny.light,null);
});
