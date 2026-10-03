import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {duel}=load(new URL('../../lib/native-engine/duel.ts',import.meta.url));
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
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices.some(c=>c.id==='lose:force')?'lose:force':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}

function fixture(dark=[1,1],light=[1,1]){
 let m=fresh({dark:['5_141','5_141','101_6','101_6','1_194','1_194'],light:['1_109','5_41','5_41','101_3','101_3','1_28','1_28']});
 const site=location(m,'light','1_129'),from=location(m,'dark','1_293'),vader=pull(m,'dark','101_5','table',from),luke=pull(m,'light','101_2','table',site),card=pull(m,'dark','101_6','hand'),second=pull(m,'dark','101_6','hand'),run=pull(m,'light','101_3','hand'),run2=pull(m,'light','101_3','hand');
 pull(m,'light','1_109','hand');
 const lost={dark:[],light:[]};for(const side of ['dark','light'])for(let i=0;i<3;i++)lost[side].push(pull(m,side,side==='dark'?'1_194':'1_28','lost'));
 force(m,'dark',12);force(m,'light',12);m=phase(m,'move');
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

const modifiers=load(new URL('../../lib/native-engine/duel-modifiers.ts',import.meta.url));
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/duel-modifiers-results.json',import.meta.url)));
const beforeDraws=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='duel-destiny-before');
const adding=(m,side)=>{m=priority(m,side);const id=m.players[side].hand.find(id=>m.cards[id].blueprint===(side==='dark'?'5_141':'5_41'));assert.ok(id);m=step(m,'duel-interrupt:add:'+id);return beforeDraws(m)};
for(const mode of ['focused','courage','both','count-minus','total-tie','total-fraction','total-clamp'])test('executed GEMP duel modifier outcome: '+mode,()=>{
 const f=fixture([1,1,1],[1,1,1]),before=clone(f.m.players);let m=beforeDraws(start(f));
 if(['focused','both'].includes(mode))m=adding(m,'dark');if(['courage','both'].includes(mode))m=adding(m,'light');
 if(mode==='count-minus')modifiers.addDuelModifier(m,f.card,'dark','draws',-1);
 if(mode.startsWith('total-'))modifiers.addDuelModifier(m,f.card,mode==='total-clamp'?'dark':'light','total',mode==='total-clamp'?-50:mode==='total-tie'?2:2.25);
 m=finish(m);const d=duel(m);const row={name:mode,darkDraws:d.draws.dark.filter(x=>x.value!==null).length,lightDraws:d.draws.light.filter(x=>x.value!==null).length,darkTotal:d.total.dark,lightTotal:d.total.light,winner:d.winner??'none',vaderLost:m.cards[f.vader].zone==='lost',lukeLost:m.cards[f.luke].zone==='lost',runLost:m.cards[f.run].zone==='lost',darkForceLost:before.dark.force.length-m.players.dark.force.length,lightForceLost:before.light.force.length-m.players.light.force.length,darkRetrieved:f.lost.dark.filter(id=>m.cards[id].zone==='used').length,lightRetrieved:f.lost.light.filter(id=>m.cards[id].zone==='used').length};
 const reference=oracle.find(r=>r.name===mode);
 // AR Appendix B Brainiac explicitly rounds a 0.14159 margin to zero.
 // Pinned GEMP rounds this synthetic 0.25 margin up; retain its raw evidence.
 if(mode==='total-fraction'){assert.equal(reference.darkForceLost,1);assert.equal(reference.lightRetrieved,1);assert.deepEqual(row,{...reference,darkForceLost:0,lightRetrieved:0})}else assert.deepEqual(row,reference);assert.equal(modifiers.duelModifier(m,'dark','draws'),0);if(mode==='total-fraction'){assert.equal(d.difference,0);assert.equal(d.winner,'light');assert.equal(m.cards[f.vader].zone,'lost')}
});
test('addition Interrupts are available only during the duel modification step',()=>{const f=fixture();assert.ok(!ids(f.m).some(id=>id.startsWith('duel-interrupt:')));let m=start(f);assert.ok(!ids(m).some(id=>id.startsWith('duel-interrupt:')));m=beforeDraws(m);assert.ok(ids(m).some(id=>id.startsWith('duel-interrupt:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');assert.ok(!ids(m).some(id=>id.startsWith('duel-interrupt:')))});
test('an added draw survives its resolved Interrupt moving to Lost and cannot be added twice by a unique title',()=>{const f=fixture([1,1,1]);let m=adding(beforeDraws(start(f)),'dark');assert.equal(modifiers.duelModifier(m,'dark','draws'),1);assert.equal(m.data.duelModifiers[0].source.zone,'playing');assert.equal(m.cards[m.data.duelModifiers[0].source.id].zone,'lost');m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('duel-interrupt:')));m=result(m);assert.equal(duel(m).drawCounts.dark,3)});
test('Sense cancels the addition without canceling the duel or refunding the unique play',()=>{const f=fixture([1,1,1],[1,1,1]);let m=beforeDraws(start(f));const focus=m.players.dark.hand.find(id=>m.cards[id].blueprint==='5_141'),sense=m.players.light.hand.find(id=>m.cards[id].blueprint==='1_109');assert.ok(sense);m=step(m,'duel-interrupt:add:'+focus);m=step(m,'cancel:play:'+sense+':'+focus+':'+f.luke);m=beforeDraws(m);assert.equal(m.cards[focus].zone,'lost');assert.equal(modifiers.duelModifier(m,'dark','draws'),0);m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('duel-interrupt:')));m=result(m);assert.equal(duel(m).drawCounts.dark,2)});
test('count is frozen separately when each player begins drawing',()=>{const f=fixture([1,1,1],[1,1,1]);let m=beforeDraws(start(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1).event.side==='dark');assert.equal(duel(m).drawCounts.dark,2);modifiers.addDuelModifier(m,f.card,'dark','draws',1);modifiers.addDuelModifier(m,f.card,'light','draws',1);m=result(m);assert.equal(duel(m).draws.dark.length,2);assert.equal(duel(m).draws.light.length,3)});
test('duel total remains live until results, then stays frozen',()=>{const f=fixture();let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.card,'light','total',5);m=result(m);assert.equal(duel(m).total.light,9);const totals=clone(duel(m).total);assert.throws(()=>modifiers.addDuelModifier(m,f.card,'dark','total',99),/unresolved duel/);m.data.duelModifiers[0].amount=99;m=finish(m);assert.deepEqual(duel(m).total,totals)});
test('continuous source departure expires totals without changing the frozen draw count',()=>{const f=fixture([1,1,1]);let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.from,'dark','draws',1,{whileSourceActive:true});modifiers.addDuelModifier(m,f.from,'dark','total',10,{whileSourceActive:true});m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');assert.equal(duel(m).drawCounts.dark,3);const id=f.from;m.locations=m.locations.filter(x=>x!==id);state.moveCard(m,id,'hand');m=result(m);assert.equal(duel(m).draws.dark.length,3);assert.equal(duel(m).total.dark,7)});
test('continuous source returning cannot revive a prior modifier',()=>{const f=fixture();let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.from,'dark','total',5,{whileSourceActive:true});m.locations=m.locations.filter(x=>x!==f.from);state.moveCard(m,f.from,'hand');state.moveCard(m,f.from,'table');m.locations.push(f.from);assert.equal(modifiers.duelModifier(m,'dark','total'),0);m=result(m);assert.equal(duel(m).total.dark,6)});
test('a subsequent duel does not inherit modifiers from the previous serial',()=>{const f=fixture();let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.card,'dark','total',3);assert.equal(modifiers.duelModifier(m,'dark','total'),3);duel(m).serial=++m.serial;assert.equal(modifiers.duelModifier(m,'dark','total'),0)});
test('duplicate noncumulative grants, independent functions and cumulative grants are distinct',()=>{const f=fixture();let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.card,'dark','draws',1);modifiers.addDuelModifier(m,f.second,'dark','draws',1);assert.equal(modifiers.duelModifier(m,'dark','draws'),1);modifiers.addDuelModifier(m,f.second,'dark','draws',2,{function:'another'});assert.equal(modifiers.duelModifier(m,'dark','draws'),3);modifiers.addDuelModifier(m,f.second,'dark','draws',1,{cumulative:true});assert.equal(modifiers.duelModifier(m,'dark','draws'),4)});
test('failed extra draws preserve a partial total; zero draws on both sides still has no winner',()=>{const f=fixture([1],[1]);let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.card,'dark','draws',2);m=result(m);assert.equal(duel(m).draws.dark.length,4);assert.equal(duel(m).destinyTotals.dark,1);m=finish(m);assert.equal(duel(m).winner,'dark');const g=fixture();m=beforeDraws(start(g));for(const side of ['dark','light'])modifiers.addDuelModifier(m,g.card,side,'draws',-5);m=finish(m);assert.equal(duel(m).winner,null);assert.deepEqual(duel(m).draws,{dark:[],light:[]})});
test('new draw counts remain subject to the shared physical draw limit',()=>{const f=fixture([1,1,1]);let m=adding(beforeDraws(start(f)),'dark');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');const limits=load(new URL('../../lib/native-engine/destiny-limits.ts',import.meta.url));limits.setDestinyLimit(m,duel(m).scopes.dark,1);m=result(m);assert.equal(duel(m).draws.dark.length,3);assert.equal(duel(m).draws.dark.filter(x=>x.card).length,1);assert.equal(duel(m).destinyTotals.dark,1)});
test('legacy two-draw saves resume and can receive a new scoped grant',()=>{const f=fixture([1,1,1]);let m=beforeDraws(start(f));delete duel(m).serial;delete duel(m).drawCounts;modifiers.addDuelModifier(m,f.card,'dark','draws',1);assert.ok(duel(m).serial);m=finish(m);assert.equal(duel(m).draws.dark.length,3)});
test('corrupt modifier amounts, instances and frozen plans are rejected',()=>{const f=fixture();let m=beforeDraws(start(f));modifiers.addDuelModifier(m,f.card,'dark','draws',1);for(const patch of [{amount:0.5},{amount:null},{duel:999999},{kind:'power'},{side:'both'},{whileSourceActive:'yes'}]){const bad=clone(m);Object.assign(bad.data.duelModifiers[0],patch);assert.throws(()=>prompt(bad),/duel modifier/)}m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');for(const value of [-1,0.5,null]){const bad=clone(m);duel(bad).drawCounts.dark=value;assert.throws(()=>prompt(bad),/draw plan/)}const bad=clone(m);bad.data.duelModifiers[0].source.version=999;assert.throws(()=>prompt(bad),/reference/)});

test('legacy in-progress draw sequence retains its original two-draw plan',()=>{const f=fixture([1,1,1]);let m=beforeDraws(start(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');delete duel(m).serial;delete duel(m).drawCounts;modifiers.addDuelModifier(m,f.card,'dark','draws',1);m=result(m);assert.equal(duel(m).draws.dark.length,2);assert.equal(duel(m).drawCounts.dark,2)});
