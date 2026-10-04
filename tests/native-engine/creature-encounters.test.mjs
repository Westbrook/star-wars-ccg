import test from 'node:test';
import {fixture,wampaFixture} from './creature-encounter-fixture.mjs';
import assert from 'node:assert/strict';
import {fixture as groundFixture,deploy,pull,location,force,phase,priority,step,seek,load,rules} from './ground-creature-fixture.mjs';
import {ids,prompt,clone} from './noble-fixture.mjs';
const {moveCard}=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {creatureDeploySite,creatureDeployCost}=load(new URL('../../lib/native-engine/ground-creatures.ts',import.meta.url));
const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const {sitePlacements}=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const {selectiveCreature}=load(new URL('../../lib/native-engine/creature-encounters.ts',import.meta.url));
const last=m=>m.data.creatureEncounters?.at(-1);
const start=m=>step(m,ids(m).find(id=>id.startsWith('encounter:begin:')));
const finished=m=>seek(m,x=>last(x)?.stage==='complete');
test('Wampa and One-Arm deploy free at Wampa Cave without presence',()=>{
 const f=fixture(),wampa=pull(f.m,'dark','3_93','hand'),arm=pull(f.m,'dark','7_212','hand');const before=f.m.players.dark.force.length;
 assert.equal(creatureDeployCost(f.m,wampa,f.cave),0);assert.equal(creatureDeploySite(f.m,wampa,f.bay),false);assert.equal(creatureDeploySite(f.m,arm,f.bay),false);assert.equal(creatureDeploySite(f.m,wampa,f.site),false);
 f.m=step(f.m,'ground-creature:deploy:'+arm+':'+f.cave);f.m=priority(seek(f.m,x=>x.stack.length===1),'dark');assert.equal(f.m.players.dark.force.length,before);assert.ok(f.m.data.selectiveWampas);f.m=step(f.m,'ground-creature:deploy:'+wampa+':'+f.cave);f.m=seek(f.m,x=>x.stack.length===1);assert.equal(f.m.players.dark.force.length,before);assert.equal(last(f.m),undefined);assert.equal(selectiveCreature(f.m,wampa),true);
});
test('One-Arm selectivity persists after source removal and across JSON recovery',()=>{
 const f=fixture(),arm=pull(f.m,'dark','7_212','hand');let m=step(f.m,'ground-creature:deploy:'+arm+':'+f.cave);m=seek(m,x=>x.stack.length===1);moveCard(m,arm,'lost');const a=pull(m,'dark','3_93','table',f.cave),b=pull(m,'dark','3_93','table',f.cave);m=clone(m);assert.ok(selectiveCreature(m,a)&&selectiveCreature(m,b));assert.ok(!ids(m).some(id=>id.startsWith('encounter:')));rules.validate(m);
});
test('Wampa regular habitat includes Hoth interior sites, but deployment requires unoccupied marker or Cave',()=>{
 const f=fixture(),w=pull(f.m,'dark','3_93','hand');pull(f.m,'light','1_28','table',f.bay);assert.equal(creatureDeploySite(f.m,w,f.bay),false);assert.equal(creatureDeploySite(f.m,w,f.cave),true);suppressGameText(f.m,f.site,f.cave);assert.equal(creatureDeployCost(f.m,w,f.cave),4);
});
for(const phaseName of ['deploy','control','move'])test('different creatures attack automatically in '+phaseName+' with no weapon segment',()=>{
 const f=groundFixture('dark');let m=phase(f.m,phaseName);const a=pull(m,'light','6_48','table',f.site);moveCard(m,f.creature,'table');m.cards[f.creature].location=f.site;assert.equal(prompt(m).mandatory,true);m=start(m);assert.equal(m.stack.at(-1).event.kind,'attack-initiated');m=finished(m);assert.equal(m.cards[a].zone,'lost');assert.equal(m.cards[f.creature].zone,'table');assert.deepEqual(last(m).totals,[3,4]);assert.equal(m.turn.phase,phaseName);assert.equal(m.data.battle,undefined);
});
test('same-side Wampas compare variable ferocity; equal totals lose both with recoverable Lost ordering',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave),b=pull(f.m,'dark','3_93','table',f.cave);const dice=[pull(f.m,'dark','1_249','hand'),pull(f.m,'dark','1_249','hand')];for(const d of dice)moveCard(f.m,d,'reserve');let m=start(f.m);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.deepEqual(last(m).totals,[7,7]);assert.equal(m.cards[a].zone,'leaving');assert.equal(m.cards[b].zone,'leaving');m=step(clone(m),prompt(m).choices[0].id);m=finished(m);assert.equal(m.cards[a].zone,'lost');assert.equal(m.cards[b].zone,'lost');assert.equal(last(m).lost.length,2);
});
test('unequal ferocity loses only the lower creature and both draws enter Used',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave),b=pull(f.m,'dark','3_93','table',f.cave);const high=pull(f.m,'dark','1_262','hand'),low=pull(f.m,'dark','1_249','hand');moveCard(f.m,high,'reserve');moveCard(f.m,low,'reserve');const m=finished(start(f.m));assert.deepEqual(last(m).totals,[7,8]);assert.equal(m.cards[a].zone,'lost');assert.equal(m.cards[b].zone,'table');assert.equal(m.cards[high].zone,'used');assert.equal(m.cards[low].zone,'used');
});
test('fixed ferocity remains when Reserve is empty and text cancellation removes variable ferocity',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave),b=pull(f.m,'dark','3_93','table',f.cave);for(const id of [...f.m.players.dark.reserve])moveCard(f.m,id,'hand');suppressGameText(f.m,f.site,a);const m=finished(start(f.m));assert.deepEqual(last(m).totals,[0,3]);assert.equal(m.cards[a].zone,'lost');assert.equal(m.cards[b].zone,'table');
});
test('another eligible pair is required after the first resolves',()=>{
 const f=groundFixture('dark',{dark:['3_93']});const a=pull(f.m,'light','6_48','table',f.site),c=pull(f.m,'dark','3_93','table',f.site);moveCard(f.m,f.creature,'table');f.m.cards[f.creature].location=f.site;let m=finished(start(f.m));m=seek(m,x=>prompt(x)?.mandatory&&ids(x).some(id=>id.startsWith('encounter:')));m=finished(start(m));assert.equal(m.data.creatureEncounters.length,2);assert.equal([a,f.creature,c].filter(id=>m.cards[id].zone==='table').length,1);
});
test('saved encounters bind participants, totals, actor and shared destiny callback',()=>{
 const f=fixture();pull(f.m,'dark','3_93','table',f.cave);pull(f.m,'dark','3_93','table',f.cave);let m=start(f.m);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');const bad=clone(m);bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw').action.payload.next.payload.index=1;assert.throws(()=>rules.validate(bad));const bad2=clone(m);last(bad2).creatures[1]=last(bad2).creatures[0];assert.throws(()=>rules.validate(bad2));
});
test('departure before a draw ends the encounter without drawing or replacing its pair',()=>{
 const f=fixture();const a=pull(f.m,'dark','3_93','table',f.cave);pull(f.m,'dark','3_93','table',f.cave);let m=start(f.m);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');const used=m.players.dark.used.length;moveCard(m,a,'hand');m=finished(step(m,'pass'));assert.equal(last(m).ended,true);assert.equal(m.players.dark.used.length,used);assert.equal(last(m).draws.flat().length,0);
});
for(const choice of ['eat','cave'])test('Wampa hunts with 3 plus destiny and offers '+choice+' for a defeated character',()=>{
 const f=wampaFixture(),victim=pull(f.m,'light','1_28','table',f.bay);f.m.cards[f.wampa].location=f.bay;let m=priority(phase(f.m,'battle'),'dark');const die=pull(m,'dark','1_249','hand');moveCard(m,die,'reserve');m=step(m,'creature:begin:'+f.wampa+':'+f.bay+':hunt:light');m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');assert.equal(m.data.creatureAttack.ferocity,7);m=step(m,choice);m=seek(m,x=>x.data.creatureAttack.stage==='complete');assert.equal(m.cards[victim].zone,choice==='eat'?'lost':'table');if(choice==='cave')assert.equal(m.cards[victim].location,f.cave);
});
test('canceling variable ferocity after drawing removes the full text-defined value',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave);pull(f.m,'dark','3_93','table',f.cave);let m=start(f.m);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');suppressGameText(m,f.site,a);m=finished(m);assert.equal(last(m).totals[0],0);assert.equal(m.cards[a].zone,'lost');assert.equal(last(m).draws[0].length,1);
});
test('both ferocities are checked at comparison after the second creature draws',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave);pull(f.m,'dark','3_93','table',f.cave);let m=start(f.m);m=seek(m,x=>last(x)?.index===1&&x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');suppressGameText(m,f.site,a);m=finished(m);assert.equal(last(m).totals[0],0);assert.equal(m.cards[a].zone,'lost');
});
test('a selected pair survives JSON recovery and never admits a later third creature',()=>{
 const f=fixture(),a=pull(f.m,'dark','3_93','table',f.cave),b=pull(f.m,'dark','3_93','table',f.cave);let m=start(f.m);const pair=clone(last(m).creatures);moveCard(m,f.creature,'table');m.cards[f.creature].location=f.cave;m=finished(clone(m));assert.deepEqual(last(m).creatures,pair);assert.ok(pair.every(c=>[a,b].includes(c.id)));assert.equal(m.cards[f.creature].zone,'table');
});
test('an encounter ending on departure preserves its paid outer inspection',()=>{
 const f=groundFixture('dark',{dark:['1_266']});pull(f.m,'light','1_28','hand');const scan=pull(f.m,'dark','1_266','hand');let m=step(f.m,'scan:play:'+scan);const paid=m.players.dark.force.length;
 const target=pull(m,'light','6_48','table',f.site);moveCard(m,f.creature,'table');m.cards[f.creature].location=f.site;m=start(m);moveCard(m,target,'hand');m=finished(step(m,'pass'));assert.equal(last(m).ended,true);assert.equal(m.cards[scan].zone,'playing');m=seek(m,x=>x.stack.at(-1)?.handler==='scan:peek');m=step(clone(m),'scan:continue');m=seek(m,x=>x.cards[scan].zone==='used');assert.equal(m.players.dark.force.length,paid);
});
test('an encounter does not consume a surviving creature’s mandatory hunt that turn',()=>{
 const f=groundFixture('dark');pull(f.m,'light','6_48','table',f.site);pull(f.m,'light','1_28','table',f.site);moveCard(f.m,f.creature,'table');f.m.cards[f.creature].location=f.site;let m=finished(start(f.m));m=priority(phase(m,'battle'),'dark');assert.ok(ids(m).includes('creature:begin:'+f.creature+':'+f.site+':hunt:light'));
});
test('saved comparison rejects a fabricated winner and unfinished totals',()=>{
 const f=fixture();pull(f.m,'dark','3_93','table',f.cave);pull(f.m,'dark','3_93','table',f.cave);let m=seek(start(f.m),x=>last(x)?.stage==='loss');const bad=clone(m);last(bad).defeated=[];assert.throws(()=>rules.validate(bad));const unfinished=clone(m);last(unfinished).totals[0]=null;assert.throws(()=>rules.validate(unfinished));
});
test('Wampa ferocity updates if its text is canceled during the defender’s destiny',()=>{
 const f=wampaFixture();pull(f.m,'light','1_19','table',f.bay);f.m.cards[f.wampa].location=f.bay;let m=priority(phase(f.m,'battle'),'dark');m=step(m,'creature:begin:'+f.wampa+':'+f.bay+':hunt:light');m=seek(m,x=>x.stack.at(-1)?.handler==='creature:destiny');m=step(m,'attack-draw');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');suppressGameText(m,f.site,f.wampa);m=seek(m,x=>x.data.creatureAttack.stage==='complete');assert.equal(m.data.creatureAttack.totals.creature,0);assert.equal(m.data.creatureAttack.defeated,false);
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/creature-encounter-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP creature encounter: '+row.case,()=>{
 if(['eat','relocate'].includes(row.case)){
  const f=wampaFixture(),victim=pull(f.m,'light','1_28','table',f.bay);f.m.cards[f.wampa].location=f.bay;let m=priority(phase(f.m,'battle'),'dark');moveCard(m,pull(m,'dark','1_249','hand'),'reserve');m=step(m,'creature:begin:'+f.wampa+':'+f.bay+':hunt:light');m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');m=step(m,row.case==='eat'?'eat':'cave');m=seek(m,x=>x.data.creatureAttack.stage==='complete');assert.deepEqual({case:row.case,ferocity:m.data.creatureAttack.ferocity,victimLost:m.cards[victim].zone==='lost',atCave:m.cards[victim].location===f.cave},row);
 }else if(row.case==='one-arm-left'){
  const f=fixture(['3_93']);const arm=pull(f.m,'dark','7_212','hand'),ws=Array.from({length:3},()=>pull(f.m,'dark','3_93','hand'));let m=f.m;const before=m.players.dark.force.length;for(const [i,id]of [arm,...ws].entries()){if(i===3)moveCard(m,arm,'hand');m=step(m,'ground-creature:deploy:'+id+':'+f.cave);m=priority(seek(m,x=>x.stack.length===1),'dark');}assert.deepEqual({case:row.case,survivors:ws.filter(id=>m.cards[id].zone==='table'&&m.cards[id].location===f.cave).length,deploymentCost:before-m.players.dark.force.length},row);assert.equal(last(m),undefined);
 }else{
  const f=fixture();const ws=[pull(f.m,'dark','3_93','hand'),pull(f.m,'dark','3_93','hand')],dice=[pull(f.m,'dark','1_249','hand'),pull(f.m,'dark',row.case==='tie'?'1_249':'1_262','hand')];for(const d of dice.reverse())moveCard(f.m,d,'reserve');const before=f.m.players.dark.force.length;let m=step(f.m,'ground-creature:deploy:'+ws[0]+':'+f.cave);m=priority(seek(m,x=>x.stack.length===1),'dark');m=step(m,'ground-creature:deploy:'+ws[1]+':'+f.cave);m=seek(m,x=>ids(x).some(id=>id.startsWith('encounter:begin:')));m=start(m);let weaponSegment=false;for(let n=0;n<300&&last(m).stage!=='complete';n++){weaponSegment ||= m.stack.at(-1)?.event?.kind==='attack-weapons';m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);}assert.equal(last(m).stage,'complete');assert.deepEqual({case:row.case,ferocity:[...last(m).totals].sort((a,b)=>a-b),lost:ws.filter(id=>m.cards[id].zone==='lost').length,weaponSegment,deploymentCost:before-m.players.dark.force.length},row);
 }
});
