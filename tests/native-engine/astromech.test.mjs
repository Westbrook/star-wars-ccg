import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,resolve:(m,r,c)=>{if(r.action.handler==='probe:done')m.data.observed=r.action.payload;else premiereRules.resolve(m,r,c)}};
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
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const selection=load(new URL('../../lib/native-engine/destiny-selection.ts',import.meta.url));
const values=load(new URL('../../lib/native-engine/destiny-values.ts',import.meta.url));
const next={id:'observed',label:'Record result',handler:'probe:done',payload:{}};
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/r2-results.json',import.meta.url)));
const event=m=>m.stack.at(-1)?.event;
function base(){let m=fresh({light:['2_14','2_14','1_130','1_153','1_124','1_147'],dark:['1_194']});const site=location(m,'light','1_129'),source=pull(m,'dark','1_251','playing');force(m,'dark',4);force(m,'light',4);m=phase(m,'deploy');return {m,site,source};}
function drawR2(modifier=0){let {m,site,source}=base();const card=topDestiny(m,'light','2_14');destiny.drawDestiny(m,'light',source,'probe',next,true,modifier);m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');return {m,card,site,source};}
function finish(m){return seek(m,x=>!!x.data.observed)}
for(const value of [2,5])test('owner chooses printed '+value+' before just-drawn responses; refresh preserves it',()=>{
 let {m,card}=drawR2(1);assert.equal(prompt(m).side,'light');assert.deepEqual(ids(m),['value:2','value:5']);assert.equal(runtime.prompt(m,rules,'dark').choices.length,0);assert.throws(()=>step(m,'value:'+value,'dark'),/Illegal/);assert.throws(()=>step(m,'value:3'),/Illegal/);
 m=step(clone(m),'value:'+value);assert.equal(event(m).kind,'destiny-drawn');assert.equal(board.printed(m,card,'destiny'),value);assert.equal(m.stack.at(-2).action.payload.draw.value,value+1);assert.throws(()=>values.choosePrintedDestiny(m,card,value===2?5:2));
 m=finish(clone(m));assert.equal(m.data.observed.total,value+1);assert.equal(m.cards[card].zone,'used');assert.equal(values.selectedPrintedDestiny(m,card),undefined);
});
test('the same physical R2 card chooses anew after cleanup and a new draw',()=>{
 let {m,card,source}=drawR2();m=finish(step(m,'value:2'));delete m.data.observed;state.moveCard(m,card,'reserve');destiny.drawDestiny(m,'light',source,'probe',next);m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');m=finish(step(m,'value:5'));assert.equal(m.data.observed.total,5);
});
test('canceling and redrawing discards old value and prompts for the replacement R2',()=>{
 let {m,card,source}=drawR2();const replacement=topDestiny(m,'light','2_14');m=step(m,'value:5');assert.equal(destiny.redrawDestiny(m,m.stack.at(-2)),true);m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');assert.equal(m.cards[card].zone,'used');assert.equal(m.stack.at(-1).payload.card.id,replacement);m=finish(step(m,'value:2'));assert.equal(m.data.observed.total,2);
});
test('retained draws lock each R2 value independently before choosing a candidate',()=>{
 let {m,source}=base();const second=pull(m,'light','2_14','hand'),first=pull(m,'light','2_14','hand');state.moveCard(m,second,'reserve');state.moveCard(m,first,'reserve');selection.drawDestinySelection(m,'light',source,'probe',2,1,next);m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');m=step(m,'value:2');m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');assert.equal(board.printed(m,first,'destiny'),2);m=step(m,'value:5');m=seek(m,x=>x.stack.at(-1)?.handler==='selection:choose');assert.equal(board.printed(m,first,'destiny'),2);assert.equal(board.printed(m,second,'destiny'),5);m=finish(step(m,'destiny-choice:1'));assert.equal(m.data.observed.total,5);assert.equal(m.cards[first].zone,'used');assert.equal(m.cards[second].zone,'used');
});
for(const mutate of [m=>m.stack.at(-1).side='dark',m=>m.stack.at(-1).payload.card.version++,m=>m.stack.at(-1).payload.start.retain='yes',m=>m.stack.at(-1).payload.start.includeTotal='yes',m=>m.stack.at(-1).payload.start.category=9,m=>values.choosePrintedDestiny(m,m.stack.at(-1).payload.card.id,2)])test('malformed or already answered printed destiny decision is rejected: '+mutate,()=>{const {m}=drawR2();mutate(m);assert.throws(()=>prompt(m));});
function scomp(value=1,siteBp='1_129',side='dark'){
 let {m,site,source}=base();if(siteBp!=='1_129')site=location(m,'light',siteBp);const r2=pull(m,'light','2_14','table',site),card=topDestiny(m,side,side==='dark'?'1_194':'1_124');destiny.drawDestiny(m,side,source,'probe',next,true,value-board.printed(m,card,'destiny'));m=seek(m,x=>event(x)?.kind==='destiny-drawn');return {m,site,source,r2,card};
}
const offered=m=>ids(m).filter(id=>id.startsWith('r2:'));
for(const value of [-1,0,1,2,3,3.5,4,5,6,7])for(const site of ['1_129','1_130'])test('Scomp response follows current value '+value+' at '+site,()=>{
 let {m,r2}=scomp(value,site);const eligible=site==='1_129'&&((value>=1&&value<=3)||(value>=4&&value<=6));assert.equal(offered(m).length,eligible?1:0);if(!eligible){const ref=oracle.find(r=>r.name==='scomp-'+site+'-'+value);if(ref)assert.deepEqual(ref,{name:ref.name,uses:0,force:0,hand:0});return;}
 const branch=value<=3?'activate':'draw',reserve=m.players.light.reserve[0],force=m.players.light.force.length,hand=m.players.light.hand.length,activated=m.turn.activated;m=step(clone(m),'r2:'+r2+':'+branch);m=seek(m,x=>event(x)?.kind==='destiny-drawn');m=priority(m,'light');assert.equal(offered(m).length,0);assert.equal(m.players.light.force.length-force,branch==='activate'?1:0);assert.equal(m.players.light.hand.length-hand,branch==='draw'?1:0);assert.equal(m.cards[reserve].zone,branch==='activate'?'force':'hand');assert.equal(m.turn.activated,activated);const ref=oracle.find(r=>r.name==='scomp-'+site+'-'+value);if(ref)assert.deepEqual(ref,{name:ref.name,uses:1,force:m.players.light.force.length-force,hand:m.players.light.hand.length-hand});m=finish(m);assert.equal(m.data.observed.total,Math.max(0,value));
});
test('no Scomp response to own draw, canceled draw, empty Reserve, or completed draw',()=>{
 let f=scomp(2,'1_129','light');f.m=priority(f.m,'light');assert.equal(offered(f.m).length,0);
 f=scomp(2);f.m.stack.at(-2).cancelled=true;assert.equal(offered(f.m).length,0);
 f=scomp(2);for(const id of [...f.m.players.light.reserve])state.moveCard(f.m,id,'hand');assert.equal(offered(f.m).length,0);
 f=scomp(2);f.m=seek(f.m,x=>event(x)?.kind==='destiny-draw-complete');f.m=priority(f.m,'light');assert.equal(offered(f.m).length,0);
});
test('Scomp options track modifications before initiation; substitution supplies its fixed value',()=>{
 let {m,r2}=scomp(2);assert.deepEqual(offered(m),['r2:'+r2+':activate']);m.stack.at(-2).action.payload.draw.value=5;assert.deepEqual(offered(m),['r2:'+r2+':draw']);
 const p=m.stack.at(-2).action.payload;p.draw={card:null,value:1,substitution:{source:r2,value:5}};assert.deepEqual(offered(m),['r2:'+r2+':draw']);
});
for(const zone of ['lost','hand'])test('inactive R2 in '+zone+' cannot respond',()=>{const {m,r2,site}=scomp();state.moveCard(m,r2,zone);assert.equal(offered(m).length,0)});
test('initiated effect survives source departure and takes current Reserve top',()=>{
 let {m,r2}=scomp(4);m=step(m,'r2:'+r2+':draw');state.moveCard(m,r2,'lost');const original=m.players.light.reserve[0];state.moveCard(m,original,'hand');const current=m.players.light.reserve[0];m=finish(clone(m));assert.equal(m.cards[current].zone,'hand');
});
test('canceled response consumes this draw opportunity but leaves Reserve unchanged',()=>{
 let {m,r2}=scomp(2);const reserve=clone(m.players.light.reserve);m=step(m,'r2:'+r2+':activate');m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='astromech:respond').cancelled=true;m=seek(m,x=>event(x)?.kind==='destiny-drawn');m=priority(m,'light');assert.deepEqual(m.players.light.reserve,reserve);assert.equal(offered(m).length,0);
});
function battleBoard(){let m=fresh({light:['2_14','1_153','1_124'],dark:['1_194','1_312']});const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site);pull(m,'light','1_28','table',site);pull(m,'dark','101_5','table',site);const trooper=pull(m,'dark','1_194','table',site);force(m,'dark',6);force(m,'light',6);m=phase(m,'battle');m=step(m,'battle:'+site);return {m,site,luke,trooper};}
for(const value of [2,5])for(const type of ['battle','weapon'])test('actual '+type+' destiny adapter receives chosen R2 value '+value,()=>{
 let {m,luke,trooper,site}=battleBoard();const card=topDestiny(m,'light','2_14');
 if(type==='weapon'){
  const gun=pull(m,'light','1_153','table',site);m.cards[gun].attachedTo=luke;m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');m=step(m,'fire:'+gun+':'+trooper);
 }else {m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');}
 m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');assert.equal(m.stack.at(-1).payload.card.id,card);m=step(m,'value:'+value);const events=[],capture=stage=>events.push({stage,side:'light',value:stage==='drawn'?combat.battle(m).destiny.light:stage==='total'?event(m).total:event(m).value,unresolved:Number(m.cards[card].zone==='destiny'),used:Number(m.cards[card].zone==='used')});if(type==='battle')capture('drawn');assert.equal(event(m).kind,type==='weapon'?'weapon-destiny-drawn':'battle-destiny-drawn');m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(event(m).value,value);if(type==='battle')capture('complete');m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,value);assert.equal(m.cards[card].zone,'used');if(type==='battle'){capture('total');assert.deepEqual(events,oracle.find(r=>r.name==='printed-'+value).events);}
});
for(const type of ['battle','weapon'])test('Scomp response sees opponent '+type+' destiny before completion',()=>{
 let {m,site,luke,trooper}=battleBoard();const r2=pull(m,'light','2_14','table',site);topDestiny(m,'dark','1_194');
 if(type==='weapon'){
  const gun=pull(m,'dark','1_312','table',site);m.cards[gun].attachedTo=trooper;m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'dark');m=step(m,'fire:'+gun+':'+luke);
 }else {m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='dark');m=step(m,'draw-destiny');}
 m=seek(m,x=>event(x)?.kind===(type==='weapon'?'weapon-destiny-drawn':'battle-destiny-drawn'));assert.deepEqual(offered(m),['r2:'+r2+':activate']);const force=m.players.light.force.length;m=step(m,'r2:'+r2+':activate');m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');assert.equal(m.players.light.force.length,force+1);
});
test('excluded R2 cannot use Scomp link during its battle',()=>{
 let {m,site}=battleBoard();const r2=pull(m,'light','2_14','table',site);load(new URL('../../lib/native-engine/ground.ts',import.meta.url)).record(m).barriers[r2]=m.turn.number;topDestiny(m,'dark','1_194');m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='dark');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');assert.equal(offered(m).length,0);
});
for(const change of [p=>p.branch='invalid',p=>p.window++,p=>p.source.version++,p=>p.source.zone='hand'])test('saved R2 response rejects corrupt binding: '+change,()=>{
 let {m,r2}=scomp();m=step(m,'r2:'+r2+':activate');change(m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='astromech:respond').action.payload);assert.throws(()=>prompt(m));
});
for(const change of [m=>m.data.printedDestinyChoices={},m=>m.data.printedDestinyChoices[0].value=3,m=>m.data.printedDestinyChoices[0].card.version++,m=>m.data.printedDestinyChoices[0].card.zone='hand',m=>m.data.printedDestinyChoices.push(clone(m.data.printedDestinyChoices[0]))])test('saved printed value rejects corrupt record: '+change,()=>{
 let {m}=drawR2();m=step(m,'value:2');change(m);assert.throws(()=>prompt(m));
});
test('a source leaving and returning cannot reuse the same just-drawn opportunity',()=>{
 let {m,r2,site}=scomp();m=step(m,'r2:'+r2+':activate');m=seek(m,x=>event(x)?.kind==='destiny-drawn');state.moveCard(m,r2,'hand');state.moveCard(m,r2,'table');m.cards[r2].location=site;m=priority(m,'light');assert.equal(offered(m).length,0);
});
test('an initiated R2 effect with an emptied Reserve resolves without an extra card',()=>{
 let {m,r2}=scomp(4);m=step(m,'r2:'+r2+':draw');for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');const hand=m.players.light.hand.length;m=finish(m);assert.equal(m.players.light.hand.length,hand);
});
test('an initiated R2 effect keeps its chosen branch if the triggering draw later changes',()=>{
 let {m,r2}=scomp(4);const hand=m.players.light.hand.length,force=m.players.light.force.length;m=step(m,'r2:'+r2+':draw');m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:finish').action.payload.draw.value=2;m=finish(m);assert.equal(m.players.light.hand.length,hand+1);assert.equal(m.players.light.force.length,force);assert.equal(m.data.observed.total,2);
});
test('R2 ground deployment pays three Force and preserves full-match admission gate',()=>{
 let {m,site}=base();const r2=pull(m,'light','2_14','hand');m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);const force=m.players.light.force.length;m=step(m,'deploy:'+r2+':'+site);m=seek(m,x=>x.cards[r2].zone==='table');assert.equal(m.players.light.force.length,force-3);assert.equal(m.cards[r2].location,site);assert.equal(premiereRules.supports('2_14'),false);
});

const activationPolicy=load(new URL('../../lib/native-engine/activation.ts',import.meta.url));
test('activation prohibition suppresses R2 activation but leaves its draw branch available',()=>{
 for(const value of [2,5]){let {m,source,r2}=scomp(value);activationPolicy.preventActivation(m,source,'light');assert.deepEqual(offered(m),value===2?[]:['r2:'+r2+':draw']);}
});
test('a prohibition resolving after R2 initiation prevents its activation result',()=>{
 let {m,source,r2}=scomp(2);const before=m.players.light.force.length;m=step(m,'r2:'+r2+':activate');activationPolicy.preventActivation(m,source,'light');m=finish(m);assert.equal(m.players.light.force.length,before);
});

for(const value of [2,5])test('Artoo aboard a Scomp ship responds through actual destiny and refresh: '+value,()=>{
 let {m,r2}=scomp(value);const site=m.cards[r2].location;const id=pull(m,'light','1_147','table',site);
 Object.assign(m.cards[r2],{attachedTo:id,aboardRole:'passenger'});
 const branch=value===2?'activate':'draw',before=m.players.light[branch==='activate'?'force':'hand'].length;
 m=step(clone(m),'r2:'+r2+':'+branch);m=seek(m,x=>event(x)?.kind==='destiny-drawn');assert.equal(m.players.light[branch==='activate'?'force':'hand'].length,before+1);
});
