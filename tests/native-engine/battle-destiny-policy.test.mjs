import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const policy=load(new URL('../../lib/native-engine/battle-destiny.ts',import.meta.url));
const limits=load(new URL('../../lib/native-engine/destiny-limits.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x)),event=m=>m.stack.at(-1)?.event;
const stages={'destiny-cost':'cost','about-to-draw-destiny':'before','destiny-drawn':'drawn','destiny-draw-complete':'complete','destiny-total':'total'};
const done={id:'done',label:'Record',handler:'probe:done',payload:{}};
const next=(remaining,values=[])=>({id:'next',label:'Continue draws',handler:'probe:next',payload:{remaining,values}});
function rules(mode){return {...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 automatic:(m,w)=>[...premiereRules.automatic(m,w),...(m.data.observing&&w.event?.side==='dark'&&stages[w.event.kind]?[{id:'observe:'+w.serial,label:'Observe',handler:'probe:observe',actor:'dark',payload:{event:w.event,index:m.stack.length-2}}]:[])],
 resolve:(m,r,c)=>{
  const p=r.action.payload;
  if(r.action.handler==='probe:observe'){
   (m.data.trace??=[]).push(stages[p.event.kind]);const draw=m.stack[p.index];
   if(p.event.kind==='destiny-cost'){
    m.data.costs=(m.data.costs??0)+1;
    if(mode.startsWith('cost')&&(mode!=='cost-substitution'||m.data.costs>1))assert.ok(destiny.failDestinyCost(m,draw,mode==='cost-voluntary'));
   }
   if(p.event.kind==='about-to-draw-destiny'){
    m.data.before=(m.data.before??0)+1;
    if(mode==='cost-substitution'&&m.data.before===1)assert.ok(destiny.substituteDestiny(m,draw,m.data.source,3));
   }
   if(p.event.kind==='destiny-drawn'){
    if(p.event.card)m.data.reveals=(m.data.reveals??0)+1;
    if(!m.data.intervened&&['cost-cancel','cost-redraw'].includes(mode)){m.data.intervened=true;if(mode==='cost-redraw')assert.ok(destiny.redrawDestiny(m,draw));else draw.cancelled=true}
   }
  }else if(r.action.handler==='probe:next'){
   const values=[...p.values,p.draw];
   if(p.remaining)destiny.drawDestiny(m,'dark',m.data.source,'battle',next(p.remaining-1,values),false,0,undefined,false,m.data.scope);
   else destiny.completeDestinyTotal(m,'dark',m.data.source,'battle',values,done);
  }else if(r.action.handler==='probe:done')m.data.result=p;
  else premiereRules.resolve(m,r,c);
 }
}}
function pull(m,side,bp,zone='hand',site){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,'missing '+bp);state.moveCard(m,id,zone);if(site)m.cards[id].location=site;return id}
function fixture(mode='ardan'){
 const r=rules(mode),ardan=mode.startsWith('ardan')||mode.startsWith('cost'),high=['fallback-vs-cap','no-limit','cost-substitution','cost-cancel'].includes(mode);
 let m=runtime.createMatch('battle-draw-policy',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['4_103','1_194','1_194','1_262','1_284','1_194']:[]),...d.main].slice(0,60)})),r);
 const site=pull(m,'light',mode==='ardan-hard-six'?'1_130':'1_129','table');m.locations.push(site);
 const character=pull(m,'dark',ardan?'4_103':'1_194','table',site),luke=pull(m,'light','101_2','table',site);
 if(high)pull(m,'dark','101_5','table',site);
 const cards=['1_194','1_262','1_284'].map(bp=>pull(m,'dark',bp));
 for(const side of ['dark','light'])for(let i=0;i<4;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=runtime.startTurns(m,r);m=seek(m,r,x=>x.turn.phase==='battle'&&x.stack.length===1);m=step(m,r,'battle:'+site);m=seek(m,r,x=>event(x)?.kind==='battle-weapons');
 for(const id of cards.slice().reverse())state.moveCard(m,id,'reserve');
 const add=(kind,amount,source=site,options)=>policy.addBattleDrawModifier(m,source,'dark',kind,amount,options);
 const amount=['add-below-four','hard-denied','fallback-vs-cap','no-limit'].includes(mode)?2:['cost-substitution','cost-cancel'].includes(mode)?1:0;
 if(amount)add('add',amount);
 if(mode==='hard-denied')add('ability',6);
 if(mode.startsWith('fallback'))add('if-unable',2,character,{duration:'source',participation:true});
 if(['ardan-cap-zero','fallback-no-limit'].includes(mode))add('limit',0);
 if(['fallback-vs-cap','no-limit'].includes(mode))add('limit',1);
 if(mode.endsWith('no-limit'))add('no-limit',1);
 return {m,r,site,character,luke,cards};
}
function prompt(m,r){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,r,id,side=prompt(m,r).side){const before=clone(m),n=runtime.applyCommand(clone(m),r,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const seat of ['dark','light'])assert.deepEqual(runtime.project(n,r,seat),runtime.project(clone(n),r,seat));return n}
function seek(m,r,predicate){for(let i=0;i<500;i++){if(predicate(m))return m;const p=prompt(m,r);assert.ok(p,'game ended');m=step(m,r,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function probe(f){
 let {m,r}=f;m=seek(m,r,x=>event(x)?.kind==='battle-destiny-before');
 const p=policy.battleDrawPolicy(m,'dark');m.data.source=f.site;m.data.scope=combat.battleDestinyScope(m,'dark');m.data.observing=true;
 if(p.count)destiny.drawDestiny(m,'dark',f.site,'battle',next(p.count-1),false,0,undefined,false,m.data.scope);
 else m.data.result={total:null};
 m=seek(m,r,x=>!!x.data.result);return{m,p};
}
const modes=['ardan','ardan-cap-zero','ardan-hard-six','add-below-four','hard-denied','fallback-two','fallback-vs-cap','no-limit','fallback-no-limit','cost-involuntary','cost-voluntary','cost-substitution','cost-redraw','cost-cancel'];
for(const mode of modes)test('GEMP battle destiny policy: '+mode,()=>{
 const f=fixture(mode),{m,p}=probe(f),expected=JSON.parse(fs.readFileSync(new URL('./gemp/battle-draw-policy-results.json',import.meta.url))).find(x=>x.name===mode);
 assert.deepEqual({name:mode,count:p.count,limit:p.limit,minimum:p.minimum,total:m.data.result.total,events:m.data.trace??[],physicalReveals:m.data.reveals??0,unresolved:m.players.dark.destiny.length},expected);
});
for(const [mode,count,total]of [['ardan',1,1],['ardan-cap-zero',1,1],['ardan-hard-six',1,1],['add-below-four',2,6],['hard-denied',0,null],['fallback-two',2,6],['fallback-vs-cap',2,6],['no-limit',3,6],['fallback-no-limit',2,6]])test('complete battle draw plan: '+mode,()=>{
 const f=fixture(mode);let m=count?seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='battle:destiny'):f.m;
 if(count){assert.equal(prompt(m,f.r).side,'dark');m=step(m,f.r,'draw-destiny')}
 m=seek(m,f.r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.dark,total);
 const scope=combat.battle(m).destinyScopes.dark;assert.equal(limits.destinySequence(m,scope).physical,count);assert.equal(m.players.dark.destiny.length,0);
});
test('declining an if-unable draw declines the complete group',()=>{
 const f=fixture('fallback-two');let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='battle:destiny'),reserve=[...m.players.dark.reserve];m=step(m,f.r,'skip-destiny');m=seek(m,f.r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.dark,null);assert.deepEqual(m.players.dark.reserve,reserve);
});
test('noncumulative title/function additions do not stack; distinct functions and cumulative grants do',()=>{
 const f=fixture('add-below-four'),m=f.m,copy=pull(m,'dark','1_194','table',f.site);combat.syncBattle(m);combat.battle(m).drawModifiers=[];
 const add=(source,amount,options)=>policy.addBattleDrawModifier(m,source,'dark','add',amount,options);
 add(f.character,2);add(copy,2);assert.equal(policy.battleDrawPolicy(m,'dark').count,2);
 add(copy,1,{function:'different'});assert.equal(policy.battleDrawPolicy(m,'dark').count,3);
 add(copy,1,{cumulative:true});add(f.character,1,{cumulative:true});assert.equal(policy.battleDrawPolicy(m,'dark').count,5);
});
test('continuous modifiers expire with their source instance while resolved additions persist',()=>{
 const f=fixture('add-below-four'),m=f.m;combat.battle(m).drawModifiers=[];
 policy.addBattleDrawModifier(m,f.character,'dark','add',2,{duration:'source',participation:true});
 policy.addBattleDrawModifier(m,f.character,'dark','add',1,{function:'resolved'});
 assert.equal(policy.battleDrawPolicy(m,'dark').count,3);state.moveCard(m,f.character,'hand');combat.syncBattle(m);assert.equal(policy.battleDrawPolicy(m,'dark').count,1);
 state.moveCard(m,f.character,'table');m.cards[f.character].location=f.site;combat.syncBattle(m);assert.equal(policy.battleDrawPolicy(m,'dark').count,1);
});
test('Ardan requires current participation, and his permission is not shared with the opponent',()=>{
 const f=fixture(),m=f.m;assert.equal(policy.battleDrawPolicy(m,'dark').minimum,1);assert.equal(policy.battleDrawPolicy(m,'light').minimum,0);
 combat.battle(m).departed=[f.character];assert.equal(policy.battleDrawPolicy(m,'dark').minimum,0);
});
test('no-limit does not create extra entitlement or overcome ability conditions',()=>{
 const f=fixture('hard-denied');policy.addBattleDrawModifier(f.m,f.site,'dark','no-limit',1);assert.deepEqual(policy.battleDrawPolicy(f.m,'dark'),{ordinary:0,count:0,minimum:0,limit:null});
});
test('cost override counts substitutions, allows redraws and is bound to the battle scope',()=>{
 const f=fixture('cost-substitution'),{m}=probe(f),scope=m.data.scope;assert.equal(limits.destinySequence(m,scope).substituted,1);assert.equal(limits.destinySequence(m,scope).skipped,1);assert.equal(limits.mayBypassDestinyCost(m,scope),false);
 const g=fixture();combat.battle(g.m).stage='power';const bound=combat.battleDestinyScope(g.m,'dark'),nested=limits.beginDestinySequence(g.m,'dark',g.site,'battle');assert.equal(limits.mayBypassDestinyCost(g.m,bound),true);assert.equal(limits.mayBypassDestinyCost(g.m,nested),false);combat.battle(g.m).stage='weapons';assert.equal(limits.mayBypassDestinyCost(g.m,bound),false);
});
test('malformed saved modifiers and substitution counters are rejected on resume',()=>{
 const f=fixture('fallback-two');
 for(const change of [p=>p.amount=-1,p=>p.amount=0.5,p=>p.side='other',p=>p.kind='unknown',p=>p.source.version=999,p=>p.function='',p=>p.duration='turn',p=>p.participation='yes',p=>p.cumulative=1]){const bad=clone(f.m);change(combat.battle(bad).drawModifiers[0]);assert.throws(()=>prompt(bad,f.r))}
 const m=clone(f.m),scope=combat.battleDestinyScope(m,'dark');limits.destinySequence(m,scope).substituted=-1;assert.throws(()=>prompt(m,f.r));
 assert.throws(()=>policy.addBattleDrawModifier(f.m,f.site,'dark','add',1,{participation:true}));
});
for(const [mode,count,total] of [['cost-involuntary',1,1],['cost-voluntary',0,null],['cost-substitution',0,3]])test('battle adapter applies cost permission: '+mode,()=>{
 const f=fixture(mode);f.m.data.observing=true;f.m.data.source=f.site;
 let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='battle:destiny');m=step(m,f.r,'draw-destiny');m=seek(m,f.r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.dark,total);assert.equal(limits.destinySequence(m,combat.battle(m).destinyScopes.dark).physical,count);
});
test('explicit ability restrictions below four still prohibit added destinies',()=>{
 const f=fixture('add-below-four');policy.addBattleDrawModifier(f.m,f.site,'dark','ability',3);assert.equal(policy.battleDrawPolicy(f.m,'dark').count,0);
});
test('continuous addition is counted once before drawing and its later loss does not unschedule draws',()=>{
 const f=fixture('add-below-four');combat.battle(f.m).drawModifiers=[];
 policy.addBattleDrawModifier(f.m,f.character,'dark','add',2,{duration:'source',participation:true});pull(f.m,'dark','1_170','table',f.site);combat.syncBattle(f.m);
 let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='battle:destiny');m=step(m,f.r,'draw-destiny');m=seek(m,f.r,x=>event(x)?.kind==='destiny-draw-complete');state.moveCard(m,f.character,'hand');combat.syncBattle(m);assert.equal(policy.battleDrawPolicy(m,'dark').count,0);
 m=seek(m,f.r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.dark,6);assert.equal(limits.destinySequence(m,combat.battle(m).destinyScopes.dark).physical,2);
});
test('if-unable cost permission is rechecked when its participant leaves during cost responses',()=>{
 const f=fixture('cost-involuntary');pull(f.m,'dark','1_170','table',f.site);combat.syncBattle(f.m);f.m.data.observing=true;
 let m=seek(f.m,f.r,x=>x.stack.at(-1)?.handler==='battle:destiny');m=step(m,f.r,'draw-destiny');m=seek(m,f.r,x=>event(x)?.kind==='destiny-cost');state.moveCard(m,f.character,'hand');combat.syncBattle(m);
 m=seek(m,f.r,x=>event(x)?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.dark,null);assert.equal(limits.destinySequence(m,combat.battle(m).destinyScopes.dark).skipped,1);
});
