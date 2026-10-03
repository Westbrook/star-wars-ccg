import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const {activatedThisPhase}=load(new URL('../../lib/native-engine/activation.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// A required test observer records each actual activation event, including
// core batches, without depending on a particular card's continuation layout.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 automatic:(m,w)=>[...premiereRules.automatic(m,w),...(w.event?.kind==='force-activated'?[{id:'probe:'+w.serial,label:'Observe activation',handler:'probe:activation',payload:w.event.side,actor:w.event.side}]:[])],
 resolve:(m,r,c)=>{if(r.action.handler==='probe:activation')(m.data.activationTrace??=[]).push(r.action.payload);else premiereRules.resolve(m,r,c)}};
const clone=x=>JSON.parse(JSON.stringify(x));
const extras={light:['1_132','1_72','1_72','1_2','1_22','1_37','1_37','1_41'],dark:['1_284','1_267']};
function fresh(){return runtime.createMatch('stew',60,manifest.decks.map(d=>({side:d.side,cards:[...extras[d.side],...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,id,side=prompt(m).side){const before=clone(m),next=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(next);for(const s of ['light','dark'])assert.deepEqual(runtime.project(next,rules,s),runtime.project(clone(next),rules,s));return next}
function seek(m,fn){for(let i=0;i<900;i++){if(fn(m))return m;const p=prompt(m);assert.ok(p);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('Boundary not reached')}
function phase(m,side,name){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.side===side&&x.turn.phase===name&&x.stack.length===1&&x.stack[0].timing==='phase')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function base(side='dark'){let m=fresh();const site=location(m,'light','1_132');location(m,'dark','1_284');const card=pull(m,'light','1_72','hand');m=phase(m,side,side==='light'?'activate':'control');m=priority(m,'light');return {m,site,card};}
function addBonus(m,site){const beru=pull(m,'light','1_2','table',site),owen=pull(m,'light','1_22','table',site),hydro=pull(m,'light','1_37');m.cards[hydro].attachedTo=site;return {beru,owen,hydro};}
function trim(m,side,n){for(const id of m.players[side].reserve.slice(n))state.moveCard(m,id,'used')}
function play(m,card){return step(priority(m,'light'),'stew:play:'+card)}
function finish(m,card,{first='light',extra=0,draw=false,onState=()=>{}}={}){
 return seekWith(m,x=>x.cards[card].zone==='lost'&&x.stack.length===1,{first,extra,draw,onState});
}
function seekWith(m,done,{first='light',extra=0,draw=false,onState=()=>{}}={}){
 for(let i=0;i<500;i++){
  onState(m);if(done(m))return m;const p=prompt(m);assert.ok(p);const ids=p.choices.map(c=>c.id);
  const choice=ids.includes('stew:first:'+first)?'stew:first:'+first:ids.includes('stew:amount:'+extra)?'stew:amount:'+extra:draw&&ids.some(id=>id.startsWith('hydroponics:'))?ids.find(id=>id.startsWith('hydroponics:')):ids.includes('pass')?'pass':ids[0];m=step(m,choice);
 }throw Error('Result did not finish');
}
for(const turn of ['dark','light'])for(const first of ['dark','light'])test('turn player orders Beru Stew on '+turn+' turn, '+first+' first',()=>{
 let {m,card,site}=base(turn);const hydro=pull(m,'light','1_37');m.cards[hydro].attachedTo=site;
 const reserves=clone({light:m.players.light.reserve,dark:m.players.dark.reserve}),generation=m.turn.activated;
 m=seek(play(m,card),x=>x.stack.at(-1)?.handler==='stew:order');assert.equal(prompt(m).side,turn);assert.throws(()=>step(m,'stew:first:'+first,turn==='light'?'dark':'light'),/Illegal/);
 m=finish(m,card,{first});
 assert.deepEqual(m.data.activationTrace,[first,first,first==='light'?'dark':'light',first==='light'?'dark':'light']);assert.equal(m.turn.activated,generation);
 for(const side of ['light','dark'])assert.deepEqual(m.players[side].force,[reserves[side][1],reserves[side][0]]);
});
for(const n of [0,1,3])test('optional extra amount '+n+' follows both mandatory groups',()=>{
 let {m,card,site}=base();addBonus(m,site);m=seekWith(play(m,card),x=>x.stack.at(-1)?.handler==='stew:amount');assert.equal(prompt(m).side,'light');assert.equal(m.players.light.force.length,2);assert.equal(m.players.dark.force.length,2);assert.deepEqual(prompt(m).choices.map(c=>c.id),[0,1,2,3].map(n=>'stew:amount:'+n));
 m=finish(step(m,'stew:amount:'+n),card);assert.equal(m.players.light.force.length,2+n);assert.equal(m.players.dark.force.length,2);
});
for(const vapor of [false,true])test('Hydroponics responds separately within mandatory activation '+vapor,()=>{
 let {m,card,site}=base('light');const {hydro}=addBonus(m,site);if(vapor){const v=pull(m,'light','1_41');m.cards[v].attachedTo=site;}
 const before=m.players.light.hand.length,seen=new Set();m=finish(play(m,card),card,{extra:3,draw:true,onState:x=>{const e=x.stack.at(-1)?.event;if(e?.kind==='force-activated'&&e.side==='light')seen.add(e.count)}});
 assert.deepEqual([...seen],[1,2,3,4,5]);assert.equal(m.data.activationTrace.filter(s=>s==='light').length,5);assert.equal(activatedThisPhase(m,'light'),5);assert.equal(m.players.light.hand.length,before-1+(vapor?2:1));assert.equal(m.players.light.force.length,vapor?3:4);assert.equal(m.turn.activated,0);
 assert.equal(m.cards[hydro].zone,'table');
});
for(const [light,dark] of [[0,4],[4,0],[0,0],[1,1],[1,4],[4,1]])test('activation results allow depleted Reserve '+light+'/'+dark,()=>{
 let {m,card}=base();trim(m,'light',light);trim(m,'dark',dark);assert.ok(prompt(m).choices.some(c=>c.id==='stew:play:'+card));m=finish(play(m,card),card);assert.equal(m.players.light.force.length,Math.min(2,light));assert.equal(m.players.dark.force.length,Math.min(2,dark));assert.equal(m.status,'playing');
});
test('bonus uses the table after both groups, including contributor departure during a response',()=>{
 let {m,card,site}=base('light');const {beru,hydro}=addBonus(m,site);m=seekWith(play(m,card),x=>x.stack.at(-1)?.event?.kind==='force-activated');state.moveCard(m,beru,'hand');m=seekWith(clone(m),x=>x.stack.at(-1)?.handler==='stew:amount');assert.deepEqual(prompt(m).choices.map(c=>c.id),[0,1,2].map(n=>'stew:amount:'+n));m=finish(step(m,'stew:amount:2'),card);assert.equal(m.players.light.force.length,4);assert.equal(m.cards[hydro].zone,'table');
});
test('extra amount is capped by remaining Reserve; each unit stops cleanly if it empties',()=>{
 let {m,card,site}=base();addBonus(m,site);trim(m,'light',3);m=seekWith(play(m,card),x=>x.stack.at(-1)?.handler==='stew:amount');assert.deepEqual(prompt(m).choices.map(c=>c.id),['stew:amount:0','stew:amount:1']);m=finish(step(m,'stew:amount:1'),card);assert.equal(m.players.light.force.length,3);assert.equal(m.players.light.reserve.length,0);assert.equal(m.status,'playing');
});
test('canceling Stew before its result prevents all activation',()=>{
 let {m,card}=base();m=play(m,card);m.stack.find(f=>f.action?.handler==='stew:play').cancelled=true;m=finish(m,card);assert.equal(m.players.light.force.length,0);assert.equal(m.players.dark.force.length,0);
});
test('an actual successful Sense cancels Stew before either player activates',()=>{
 let {m,card,site}=base();const sense=pull(m,'dark','1_267','hand'),vader=pull(m,'dark','101_5','table',site),draw=pull(m,'dark','1_194','hand');state.moveCard(m,draw,'reserve');m=play(m,card);m=priority(m,'dark');const choice='cancel:play:'+sense+':'+card+':'+vader;assert.ok(prompt(m).choices.some(c=>c.id===choice));m=finish(step(m,choice),card);assert.equal(m.players.light.force.length,0);assert.equal(m.players.dark.force.length,0);assert.equal(m.cards[sense].zone,'used');
});
for(const first of ['light','dark'])test('drawing final Life Force during '+first+'-first activation ends the game immediately',()=>{
 let {m,card,site}=base('light');const hydro=pull(m,'light','1_37');m.cards[hydro].attachedTo=site;for(const id of m.players.light.reserve.slice(1))state.moveCard(m,id,'hand');assert.equal(state.lifeForce(m,'light'),1);
 m=seekWith(play(m,card),x=>x.status==='finished',{first,draw:true});assert.deepEqual(m.result,{winner:'dark',loser:'light',reason:'life-force'});assert.equal(m.players.dark.force.length,first==='dark'?2:0);assert.equal(runtime.prompt(m,rules,'light'),null);
});
test('unique play allowance is consumed even on cancellation and resets on the next turn',()=>{
 let {m,card}=base();const second=pull(m,'light','1_72','hand');m=play(m,card);m.stack.find(f=>f.action?.handler==='stew:play').cancelled=true;m=finish(m,card);m=priority(m,'light');assert.ok(!prompt(m).choices.some(c=>c.id==='stew:play:'+second));m=phase(m,'light','activate');m=priority(m,'light');assert.ok(prompt(m).choices.some(c=>c.id==='stew:play:'+second));
});
test('Stew is available during battle weapons but not unrelated response or damage windows',()=>{
 let {m,card,site}=base();pull(m,'light','1_28','table',site);pull(m,'dark','1_194','table',site);state.moveTop(m,'dark','reserve','force');m=phase(m,'dark','battle');m=priority(m,'dark');m=step(m,'battle:'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');m=priority(m,'light');assert.ok(prompt(m).choices.some(c=>c.id==='stew:play:'+card));m=play(m,card);assert.ok(!prompt(m).choices.some(c=>c.id.startsWith('stew:play:')));m=finish(m,card);assert.equal(m.cards[card].zone,'lost');
});
test('saved continuations reject a wrong source, order, seat, count or missing parent',()=>{
 let {m,card,site}=base('light');addBonus(m,site);m=seek(play(m,card),x=>x.stack.at(-1)?.handler==='stew:order');const wrong=clone(m);wrong.stack.at(-1).side='dark';assert.throws(()=>prompt(wrong));
 m=seekWith(m,x=>x.stack.at(-1)?.event?.kind==='force-activated');
 for(const mutate of [x=>x.stack.find(f=>f.action?.handler==='stew:activate').action.payload.order=['light','light'],x=>x.stack.find(f=>f.action?.handler==='stew:activate').action.payload.remaining=3,x=>x.stack.find(f=>f.action?.handler==='stew:activate').action.payload.card=site,x=>x.stack.splice(x.stack.findIndex(f=>f.action?.handler==='stew:finish'),1)]){const bad=clone(m);mutate(bad);assert.throws(()=>prompt(bad));}
 m=seekWith(m,x=>x.stack.at(-1)?.handler==='stew:amount');for(const bound of [-1,4]){const bad=clone(m);bad.stack.at(-1).payload.maximum=bound;assert.throws(()=>prompt(bad));}
});
test('activation response projections conceal the moved card and pending group payload',()=>{
 let {m,card,site}=base('light');addBonus(m,site);m=seekWith(play(m,card),x=>x.stack.at(-1)?.event?.kind==='force-activated');const activated=m.players.light.force[0];for(const side of ['light','dark']){const v=runtime.project(m,rules,side);assert.ok(!JSON.stringify(v).includes('"'+activated+'"'));assert.equal(v.stack,undefined);assert.equal(v.players.light.counts.force,1);}
});
test('computer uses only projected choices to play Stew, order results and choose extra activation',()=>{
 const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));let {m,card,site}=base();addBonus(m,site);pull(m,'light','1_28','hand');const initial=runtime.project(m,rules,'light');assert.equal(chooseComputerAction(initial,'light'),'stew:play:'+card);m=play(m,card);
 for(let i=0;i<200&&!(m.cards[card].zone==='lost'&&m.stack.length===1);i++){const p=prompt(m),v=runtime.project(m,rules,p.side),before=clone(v),choice=chooseComputerAction(v,p.side);assert.ok(p.choices.some(c=>c.id===choice));assert.deepEqual(v,before);assert.equal(chooseComputerAction(clone(v),p.side),choice);m=step(m,choice);}
 assert.equal(m.cards[card].zone,'lost');assert.deepEqual(m.data.activationTrace,['dark','dark','light','light','light','light','light']);assert.equal(m.players.light.force.length,5);
});
test('computer extra activation preserves one Reserve card and avoids needless resource growth',()=>{
 const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));const v={status:'playing',turn:{side:'dark'},table:[],players:{light:{hand:[],lost:[],destiny:[],lifeForce:10,counts:{reserve:2,force:2}}},prompt:{side:'light',timing:'decision',mandatory:true,choices:[0,1,2,3].map(n=>({id:'stew:amount:'+n,label:'Activate '+n}))}};
 assert.equal(chooseComputerAction(v,'light'),'stew:amount:1');v.players.light.counts.force=6;assert.equal(chooseComputerAction(v,'light'),'stew:amount:0');
});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/stew-results.json',import.meta.url)));
for(const expected of oracle)test((expected.name.startsWith('empty-')?'documented empty-Reserve GEMP discrepancy: ':'executed GEMP result comparison: ')+expected.name,()=>{
 const mode=expected.name;let {m,card,site}=base(['light-turn','hydro','vapor','source-leaves'].includes(mode)?'light':'dark'),beru;
 if(mode.startsWith('bonus')||mode==='source-leaves')({beru}=addBonus(m,site));
 else if(['hydro','vapor'].includes(mode)){const h=pull(m,'light','1_37');m.cards[h].attachedTo=site;}
 if(mode==='vapor'){const v=pull(m,'light','1_41');m.cards[v].attachedTo=site;}
 if(mode.startsWith('empty-')){
  if(mode!=='empty-dark')trim(m,'light',0);if(mode!=='empty-light')trim(m,'dark',0);
  assert.equal(expected.offered,false);assert.ok(prompt(m).choices.some(c=>c.id==='stew:play:'+card));return;
 }
 if(['short-light','short-both'].includes(mode))trim(m,'light',1);if(['short-dark','short-both'].includes(mode))trim(m,'dark',1);
 const reserve=new Set(m.players.light.reserve);let orderPrompt=false,changed=false,extra=-1;
 m=finish(play(m,card),card,{extra:Math.max(0,expected.extra),draw:true,onState:x=>{
  if(x.stack.at(-1)?.handler==='stew:order')orderPrompt=true;
  if(x.stack.at(-1)?.handler==='stew:amount')extra=expected.extra;
  if(mode==='source-leaves'&&!changed&&x.stack.at(-1)?.event?.kind==='force-activated'){state.moveCard(x,beru,'hand');changed=true;}
 }});
 assert.deepEqual({light:m.players.light.force.length,dark:m.players.dark.force.length,draws:m.players.light.hand.filter(id=>reserve.has(id)).length,extra},{light:expected.light,dark:expected.dark,draws:expected.draws,extra:expected.extra});
 // GEMP shortcuts order selection. Native exposes the official turn-player
 // choice and matches these numeric outcomes when Light is chosen first.
 assert.equal(expected.orderPrompt,false);assert.equal(orderPrompt,true);if(mode==='source-leaves')assert.equal(changed,true);
});
import crypto from 'node:crypto';
test('Stew evidence fingerprints actual GEMP execution without opening deck admission',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/stew-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.junitTests,2);assert.equal(p.unchangedProductionFiles,6820);assert.equal(premiereRules.supports('1_72'),false);
});

const activationPolicy=load(new URL('../../lib/native-engine/activation.ts',import.meta.url));
test('legacy Stew saves with one mandatory unit remaining resume through the shared batch',()=>{
 let {m,card,site}=base('light');addBonus(m,site);m=seekWith(play(m,card),x=>x.stack.at(-1)?.event?.kind==='force-activated');
 const legacy=clone(m),batch=legacy.stack.findIndex(f=>f.action?.handler==='core:activate-batch');assert.ok(batch>=0);const remaining=legacy.stack[batch].action.payload.remaining;legacy.stack.splice(batch,1);legacy.stack.find(f=>f.action?.handler==='stew:activate').action.payload.remaining=remaining;
 const a=finish(m,card,{extra:3}),b=finish(legacy,card,{extra:3});assert.deepEqual(a.players,b.players);assert.deepEqual(a.data.activationTrace,b.data.activationTrace);assert.equal(a.turn.activated,b.turn.activated);
});
test('Stew remains playable under an activation prohibition and skips that player and optional bonus',()=>{
 let {m,card,site}=base('light');addBonus(m,site);activationPolicy.preventActivation(m,site,'light');assert.ok(prompt(m).choices.some(c=>c.id==='stew:play:'+card));const seen=[];m=finish(play(m,card),card,{extra:3,onState:x=>seen.push(x.stack.at(-1)?.handler)});assert.equal(m.players.light.force.length,0);assert.equal(m.players.dark.force.length,2);assert.ok(!seen.includes('stew:amount'));
});
test('a new prohibition after the first Stew activation stops that group, preserving the other player',()=>{
 let {m,card,site}=base('light');addBonus(m,site);m=seekWith(play(m,card),x=>x.stack.at(-1)?.event?.kind==='force-activated');activationPolicy.preventActivation(m,site,'light');m=finish(m,card,{extra:3});assert.equal(m.players.light.force.length,1);assert.equal(m.players.dark.force.length,2);assert.equal(activatedThisPhase(m,'light'),1);
});
