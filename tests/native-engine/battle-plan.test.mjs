import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,runtime,rules,state,pull,location,step,seek,priority,prompt,force,ordinary,forceDrainCost,mayBattleForFree,occupiesGroundAndSpace} from './battle-plan-fixture.mjs';
const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
for(const side of ['light','dark'])for(const source of ['plan','order','both'])for(const ground of [false,true])for(const space of [false,true])test(`${side} ${source} occupation: ground=${ground}, space=${space}`,()=>{
 const f=fixture({side,plan:source!=='order',order:source!=='plan',ground,space});assert.equal(occupiesGroundAndSpace(f.m,side),ground&&space);assert.equal(forceDrainCost(f.m,side,f.sites[0]),ground&&space?0:3);assert.equal(mayBattleForFree(f.m,side,f.sites[0]),source==='both'||source===(side==='light'?'plan':'order'));
});
test('contested site and system count; shielded and destroyed locations do not',()=>{
 const f=fixture({plan:true,order:true,space:true,contested:true});assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),0);f.m.cards[f.sites[2]].blownAway=true;assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),3);delete f.m.cards[f.sites[2]].blownAway;location(f.m,'light','3_61');const shield=location(f.m,'light','3_63');f.m.cards[f.troop].location=shield;assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),3);
});
test('Plan on table disables Order even with canceled text; leaving table restores Order',()=>{
 const f=fixture({plan:true,order:true});suppressGameText(f.m,f.sites[0],f.effects.light);assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),0);assert.equal(mayBattleForFree(f.m,'light',f.sites[0]),false);assert.equal(mayBattleForFree(f.m,'dark',f.sites[0]),true);state.moveCard(f.m,f.effects.light,'hand');assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),3);suppressGameText(f.m,f.sites[0],f.effects.dark);assert.equal(forceDrainCost(f.m,'dark',f.sites[0]),0);
});
for(const side of ['light','dark'])for(const amount of [0,2,3,4])test(`${side} paid drain affordability ${amount}`,()=>{
 const f=fixture({side,plan:true,amount}),id='drain:'+f.sites[0];let m=f.m;assert.equal(prompt(m).choices.some(c=>c.id===id),amount>=3);if(amount<3){assert.throws(()=>step(m,id));return;}const used=m.players[side].used.length;m=step(m,id);m=seek(m,x=>x.stack.some(r=>r.kind==='resolution'&&r.action.handler==='ground:drain'&&!r.awaitingResponses));assert.equal(m.players[side].force.length,amount-3);assert.equal(m.players[side].used.length-used,3);m=seek(m,ordinary);assert.ok(!prompt(priority(m,side)).choices.some(c=>c.id===id));
});
for(const side of ['light','dark'])for(const free of [false,true])test(`${side} can explicitly choose ${free?'free':'paid'} battle`,()=>{
 const f=fixture({side,plan:side==='light',order:side==='dark',battle:true,amount:1}),id=(free?'battle-free:':'battle:')+f.sites[0];let m=f.m;assert.ok(prompt(m).choices.some(c=>c.id===id));assert.equal(chooseComputerAction(runtime.project(m,rules,side),side),'battle-free:'+f.sites[0]);const used=m.players[side].used.length;m=step(m,id);m=seek(m,x=>x.stack.some(r=>r.kind==='resolution'&&r.action.handler==='battle:begin'&&!r.awaitingResponses));assert.equal(m.players[side].force.length,free?1:0);assert.equal(m.players[side].used.length-used,free?0:1);assert.equal(m.data.battles.sites.length,1);
});
for(const side of ['light','dark'])test(side+' free battle works with no Force; free deployment is unique and Alter immune',()=>{
 const f=fixture({side,plan:true,order:true,battle:true,amount:0});assert.ok(prompt(f.m).choices.some(c=>c.id==='battle-free:'+f.sites[0]));assert.ok(!prompt(f.m).choices.some(c=>c.id==='battle:'+f.sites[0]));
 const g=fixture({side,plan:true,order:true,zone:'hand'});let m=seek(g.m,x=>ordinary(x)&&x.turn.side===side&&x.turn.phase==='deploy');m=priority(m,side);const copy=pull(m,side,side==='light'?'8_35':'8_118','hand');m=step(m,'battle-plan:deploy:'+g.effects[side]);assert.equal(m.cards[g.effects[side]].zone,'playing');m=seek(m,ordinary);assert.equal(m.cards[g.effects[side]].zone,'table');m=priority(m,side);assert.ok(!prompt(m).choices.some(c=>c.id==='battle-plan:deploy:'+copy));
 const opponent=side==='light'?'dark':'light',q=fixture({side:opponent,plan:true,order:true});m=q.m;const alter=pull(m,opponent,opponent==='light'?'1_71':'1_234','hand'),other=pull(m,side,side==='light'?'102_1':'102_6','table');const choices=prompt(m).choices;assert.ok(choices.some(c=>c.id.startsWith('cancel:play:'+alter+':'+other+':')));assert.ok(!choices.some(c=>c.id.startsWith('cancel:play:'+alter+':'+q.effects[side]+':')));
});
const setup=await import('./battle-plan-setup-fixture.mjs');
for(const first of ['light','dark'])for(const count of [1,2,3])for(const reverse of [false,true])test(`ordinary setup ${first}, ${count} Effects, reverse=${reverse}`,()=>{
 let m=setup.ready({first});for(let n=0;n<200&&m.status==='setup';n++){const p=setup.prompt(m),d=m.stack.at(-1);let c=p.choices.find(c=>c.id==='pass')??p.choices[0];if(d?.handler==='prep-start:choose'){const offered=p.choices.filter(c=>c.id.startsWith('prep-start:deploy:'));c=d.payload.count>=count?p.choices.find(c=>c.id==='prep-start:done'):reverse?offered.at(-1):offered[0];}m=setup.step(structuredClone(m),c.id,p.side);}assert.equal(m.status,'playing');for(const side of ['light','dark']){assert.equal(Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&['4_21','4_134','6_58','6_147','8_35','8_118'].includes(c.blueprint)).length,count);assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].reserve.length,50-count);}
});
const {seeded}=await import('./match-runner.mjs');
for(const size of [40,60])test('CPU completes '+size+' cards from ordinary three-Effect setup',t=>{
 let m=setup.runtime.createMatch('battle-plan-full-'+size,size,setup.decks({size}),setup.rules),opened=false,paidDrains=0,freeBattles=0;const entropy=seeded(8);
 for(let n=0;n<18000&&m.status!=='finished';n++){let side='dark',v=setup.runtime.project(m,setup.rules,side);if(!v.prompt?.choices.length){side='light';v=setup.runtime.project(m,setup.rules,side);}const choice=chooseComputerAction(v,side);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');if(choice.startsWith('drain:'))paidDrains++;if(choice.startsWith('battle-free:'))freeBattles++;m=setup.runtime.applyCommand(structuredClone(m),setup.rules,side,{revision:m.revision,choice},entropy);if(!opened&&m.status==='playing'){opened=true;for(const s of ['light','dark']){for(const i of [3,5,7])assert.equal(m.cards[s+'-'+i].zone,'table');assert.equal(m.players[s].hand.length,8);}}}
 assert.ok(opened);assert.equal(m.result?.reason,'life-force');assert.ok(paidDrains>0);assert.ok(freeBattles>0);t.diagnostic('Completed turn '+m.turn.number+'; '+m.revision+' commands; '+paidDrains+' paid drains, '+freeBattles+' free battles');
});
const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/battle-plan-results.json',import.meta.url)));
for(const row of reference)test('GEMP '+JSON.stringify(row),()=>{
 if(row.kind==='query'){
  const f=fixture({side:row.side,plan:row.source!=='order',order:row.source!=='plan',ground:row.ground,space:row.space,contested:row.contested});if(row.mode==='suppressed-plan')suppressGameText(f.m,f.sites[0],f.effects.light);assert.equal(forceDrainCost(f.m,row.side,f.sites[0]),row.drain);assert.equal(mayBattleForFree(f.m,row.side,f.sites[0]),row.free);
 }else if(row.kind==='deployment'){
  const f=fixture({side:row.side,plan:true,order:true,zone:'hand'});let m=priority(seek(f.m,x=>ordinary(x)&&x.turn.side===row.side&&x.turn.phase==='deploy'),row.side),before=m.players[row.side].force.length;m=seek(step(m,'battle-plan:deploy:'+f.effects[row.side]),ordinary);assert.equal(m.cards[f.effects[row.side]].zone,'table');assert.equal(before-m.players[row.side].force.length,row.cost);
 }else{
  const f=fixture({side:row.side,plan:true,order:true,space:row.space??false,battle:row.kind==='battle'});let m=f.m;const id=(row.kind==='drain'?'drain:':row.free?'battle-free:':'battle:')+f.sites[0],before=m.players[row.side].force.length;
  if(row.kind==='battle'){assert.equal(row.offered.length,2);assert.ok(prompt(m).choices.some(c=>c.id==='battle:'+f.sites[0]));assert.ok(prompt(m).choices.some(c=>c.id==='battle-free:'+f.sites[0]));}
  m=step(m,id);m=seek(m,x=>x.stack.some(r=>r.kind==='resolution'&&r.action.handler===(row.kind==='drain'?'ground:drain':'battle:begin')&&!r.awaitingResponses));assert.equal(before-m.players[row.side].force.length,row.cost);
 }
});
const startingReference=JSON.parse(fs.readFileSync(new URL('./gemp/battle-plan-starting-results.json',import.meta.url)));
for(const row of startingReference)test('GEMP three-Effect setup '+JSON.stringify([row.first,row.stopAfter,row.reverse]),()=>{
 const selected={light:[],dark:[]};for(const t of row.trace.filter(t=>t.text.toLowerCase().includes('deploy from reserve'))){const bp=t.answer?t.parameters.blueprintId[t.parameters.cardId.indexOf(t.answer)]:null;assert.ok(!t.answer||bp);selected[t.side].push(bp);}const indices={light:0,dark:0};
 let m=setup.ready({first:row.first});for(let n=0;n<200&&m.status==='setup';n++){const p=setup.prompt(m),d=m.stack.at(-1);let c=p.choices.find(c=>c.id==='pass')??p.choices[0];if(d?.handler==='prep-start:choose'){const bp=selected[p.side][indices[p.side]++];assert.notEqual(bp,undefined);c=bp?p.choices.find(c=>c.id.startsWith('prep-start:deploy:')&&m.cards[c.id.slice('prep-start:deploy:'.length)].blueprint===bp):p.choices.find(c=>c.id==='prep-start:done');assert.ok(c);}m=setup.step(m,c.id,p.side);}
 for(const side of ['light','dark'])assert.equal(indices[side],selected[side].length);assert.equal(m.status,'playing');assert.deepEqual(m.data.preparationStarts.map(id=>m.cards[id].owner),row.lostOrder);assert.deepEqual(Object.values(m.cards).filter(c=>c.zone==='table'&&['4_21','4_134','6_58','6_147','8_35','8_118'].includes(c.blueprint)).map(c=>c.blueprint).sort(),row.table);
 for(const side of ['light','dark'])assert.deepEqual({reserve:m.players[side].reserve.length,hand:m.players[side].hand.length,lost:m.players[side].lost.map(id=>m.cards[id].blueprint)},row.piles[side]);
});
test('Battle Plan receipt binds executed harnesses and unchanged production source',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/battle-plan-provenance.json',import.meta.url)));for(const [file,sha] of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),sha);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.componentBranches,reference.length);assert.equal(p.setupBranches,startingReference.length);
});
