import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,pull,location,phase,priority,step,seek,load,rules,runtime,hoth,board,state} from './hoth-fixture.mjs';
import {ids,prompt,clone} from './noble-fixture.mjs';
const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const {creatureDeploySite}=load(new URL('../../lib/native-engine/ground-creatures.ts',import.meta.url));
const {vesselDeploysAt}=load(new URL('../../lib/native-engine/vessels.ts',import.meta.url));
const {transitEligible}=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const startRules={...premiereRules,supports:()=>true,starting:{...premiereRules.starting,ordinarySetup:()=>true}};
function setup({ridge=true,outer=false}={}){return runtime.createMatch('hoth-setup',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['3_61',...(ridge?['3_62']:[]),'1_129']:['1_284',...(outer?['3_149']:[])]),...d.main].slice(0,60)})),startRules);}
const setupStep=(m,choice,side)=>runtime.applyCommand(clone(m),startRules,side??runtime.prompt(m,startRules,'dark').side,{revision:m.revision,choice},()=>0);
function choose(m,side,bp){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id);return setupStep(m,'select:'+id,side);}
function both(m,dark='1_284'){return setupStep(choose(choose(m,'dark',dark),'light','3_61'),'reveal');}
function finishSetup(m){for(let n=0;n<20&&m.status==='setup';n++){const p=runtime.prompt(m,startRules,'dark'),own=runtime.prompt(m,startRules,p.side);m=setupStep(m,own.choices[0].id,p.side);}return m;}
test('markers follow numerical order in either direction; Wampa Cave follows exteriors',()=>{
 const f=fixture(),cave=pull(f.m,'dark','3_150','hand');
 const options=board.sitePlacements(f.m,cave);assert.equal(options.length,1);assert.ok(options[0].index>f.m.locations.indexOf(f.ridge));f.m.locations.reverse();const reversed=board.sitePlacements(f.m,cave);assert.equal(reversed.length,1);assert.ok(reversed[0].index<=f.m.locations.indexOf(f.ridge));
});
test('shield covers Echo sites and first three markers, never the fourth or Cave',()=>{
 const f=fixture();for(const id of [f.gen,f.echo,f.bay,f.trench,f.perimeter])assert.equal(hoth.shielded(f.m,id),true);assert.equal(hoth.shielded(f.m,f.ridge),false);suppressGameText(f.m,f.site,f.gen);assert.equal(hoth.shielded(f.m,f.bay),false);
});
test('Dark characters and ships cannot deploy through shield, including presence exceptions; creatures can',()=>{
 const f=fixture(),trooper=pull(f.m,'dark','1_194','hand'),tie=pull(f.m,'dark','1_305','hand'),wampa=pull(f.m,'dark','3_93','hand');assert.equal(board.deploymentPayment(f.m,trooper,f.perimeter),null);assert.equal(board.deploymentPayment(f.m,trooper,f.bay,true,true),null);assert.equal(vesselDeploysAt(f.m,tie,f.bay),false);assert.equal(creatureDeploySite(f.m,wampa,f.perimeter),true);assert.ok(board.deploymentPayment(f.m,trooper,f.ridge));const rebel=pull(f.m,'light','1_28','hand');assert.ok(board.deploymentPayment(f.m,rebel,f.perimeter));
});
test('Dark docking transit is blocked in both directions but normal landspeed remains',()=>{
 const f=fixture(),trooper=pull(f.m,'dark','1_194','table',f.perimeter),other=pull(f.m,'dark','1_194','table',f.bay);assert.deepEqual(transitEligible(f.m,'dark',f.bay,f.site),[]);state.moveCard(f.m,other,'table');f.m.cards[other].location=f.site;assert.deepEqual(transitEligible(f.m,'dark',f.site,f.bay),[]);let m=priority(phase(f.m,'move'),'dark');assert.ok(ids(m).includes('move:'+trooper+':'+f.trench));
});
test('starting generator requires and deploys North Ridge before opening hands; recovery retains choice',()=>{
 let m=both(setup());assert.equal(m.setup.stage,'additional');assert.deepEqual(runtime.prompt(m,startRules,'light').choices[0].forceIcons,{dark:1,light:1});assert.equal(m.locations.length,0);assert.equal(m.players.light.hand.length,0);assert.deepEqual(runtime.project(m,startRules,'light'),runtime.project(clone(m),startRules,'light'));m=finishSetup(clone(m));assert.equal(m.status,'playing');assert.equal(m.setup.additional.length,1);assert.equal(m.cards[m.setup.additional[0]].blueprint,'3_62');assert.equal(m.players.light.reserve.length,50);assert.equal(m.players.light.hand.length,8);
});
test('a revealed generator without North Ridge is set aside while another starting location is chosen',()=>{
 let m=both(setup({ridge:false}));assert.equal(m.setup.stage,'choose');assert.equal(m.setup.setAside.length,1);assert.equal(m.setup.selected.light,null);assert.equal(m.setup.committed.dark,true);m=choose(m,'light','1_129');m=finishSetup(m);assert.equal(m.status,'playing');assert.equal(m.locations.some(id=>hoth.generator(m,id)),false);assert.equal(m.players.light.reserve.length,51);
});
test('opponent starting outer marker satisfies generator prerequisite without an extra Reserve deployment',()=>{
 let m=finishSetup(both(setup({ridge:false,outer:true}),'3_149'));assert.equal(m.status,'playing');assert.equal(m.setup.additional,undefined);assert.equal(m.locations.length,2);
});
test('normal generator deployment requires a Reserve North Ridge when no outer marker exists',()=>{
 const f=fixture({shield:false,outer:false});let m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');const option=board.sitePlacements(m,f.gen)[0];assert.ok(option);m=step(m,'site:'+f.gen+':'+option.id);m=seek(m,x=>ids(x).some(id=>id.startsWith('hoth:marker:')));assert.equal(prompt(m).mandatory,true);assert.equal(m.cards[f.gen].zone,'playing');assert.equal(hoth.shielded(m,f.perimeter),false);m=step(clone(m),ids(m)[0]);assert.equal(m.stack.at(-1).event.kind,'looked-at-cards-in-pile');assert.equal(hoth.shielded(m,f.perimeter),false);m=seek(m,x=>x.stack.length===1);assert.ok(m.locations.some(id=>hoth.outerHothMarker(m,id)));rules.validate(m);
});
test('a North Ridge in hand cannot satisfy the required Reserve deployment',()=>{
 const f=fixture({shield:false,outer:false});pull(f.m,'light','3_62','hand');assert.deepEqual(board.sitePlacements(f.m,f.gen),[]);
});

test('saved setup cannot skip North Ridge or reselect a set-aside generator',()=>{
 let m=both(setup());const skipped=clone(m);skipped.setup.stage='shuffle';assert.throws(()=>runtime.prompt(skipped,startRules,'dark'),/Required starting deployment/);
 const bad=both(setup({ridge:false}));bad.setup.selected.light=bad.setup.setAside[0];bad.setup.committed.light=true;bad.setup.stage='reveal';assert.throws(()=>runtime.prompt(bad,startRules,'dark'),/Invalid starting selection/);
});
test('required normal deployment rejects a forged parent binding',()=>{
 const f=fixture({shield:false,outer:false});let m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');m=step(m,'site:'+f.gen+':'+board.sitePlacements(m,f.gen)[0].id);assert.equal(m.stack.at(-1).handler,'hoth:marker');const bad=clone(m);bad.stack.at(-1).payload.parent='forged';assert.throws(()=>runtime.prompt(bad,rules,'dark'),/Invalid required Hoth/);
});
test('Dark landing, takeoff and shuttling stop at the shield while outer sites stay available',()=>{
 const {vesselRoutes}=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));const {transportActions}=load(new URL('../../lib/native-engine/transport.ts',import.meta.url));
 const f=fixture(),planet=location(f.m,'dark','3_143'),ship=pull(f.m,'dark','1_305','table',planet),pilot=pull(f.m,'dark','1_179','table',planet),carrier=pull(f.m,'dark','1_302','table',planet),trooper=pull(f.m,'dark','1_194','table',f.perimeter);
 Object.assign(f.m.cards[pilot],{attachedTo:ship,aboardRole:'pilot'});assert.ok(!vesselRoutes(f.m,ship).some(r=>r.method==='land'&&r.path.at(-1)===f.bay));board.moveWithAttachments(f.m,ship,f.bay);assert.ok(!vesselRoutes(f.m,ship).some(r=>r.method==='takeoff'));
 const m=priority(phase(f.m,'move'),'dark'),w=m.stack.at(-1);assert.ok(!transportActions(m,w,'dark').some(a=>a.label.startsWith('Shuttle')&&a.payload.card.id===trooper));board.moveWithAttachments(m,trooper,f.ridge);assert.ok(transportActions(m,w,'dark').some(a=>a.label.startsWith('Shuttle')&&a.payload.card.id===trooper));
 suppressGameText(m,f.site,f.gen);assert.ok(vesselRoutes(m,ship).some(r=>r.method==='takeoff'));board.moveWithAttachments(m,ship,planet);assert.ok(vesselRoutes(m,ship).some(r=>r.method==='land'&&r.path.at(-1)===f.bay));
});
test('Hoth orbital power is excluded from Dark battles under the shield and restored without it',()=>{
 const f=fixture(),planet=location(f.m,'dark','3_143');pull(f.m,'dark','1_302','table',planet);const trooper=pull(f.m,'dark','1_194','table',f.perimeter);pull(f.m,'light','1_28','table',f.perimeter);let m=priority(phase(f.m,'battle'),'dark');m=step(m,'battle:'+f.perimeter);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');const before=board.totalPower(m,'dark',f.perimeter);assert.equal(board.controls(m,'dark',planet),true);suppressGameText(m,f.site,f.gen);assert.equal(board.totalPower(m,'dark',f.perimeter),before+1);
});
const observations=JSON.parse(fs.readFileSync(new URL('./gemp/hoth-results.json',import.meta.url)));
for(const row of observations)test('executed GEMP Hoth observation '+row.case,()=>{
 if(row.case==='starting-generator'){const m=finishSetup(both(setup()));assert.equal(m.players.light.hand.length,row.openingHand);assert.equal(m.setup.additional.length===1,row.ridgeDeployed);}
 else if(row.case==='shield-boundaries'){
  const f=fixture();const bay=location(f.m,'light','3_59');for(const bp of ['3_62','3_148','104_4','3_150'])location(f.m,bp==='3_62'?'light':'dark',bp);
  for(const [bp,expected]of Object.entries(row.shielded)){const at=f.m.locations.find(id=>f.m.cards[id].blueprint===bp);assert.ok(at,bp);assert.equal(hoth.shielded(f.m,at),expected,bp);}f.m.locations=f.m.locations.filter(id=>id!==f.gen);state.moveCard(f.m,f.gen,'out');assert.equal(hoth.shielded(f.m,bay),row.afterGeneratorLeaves);
 }else if(row.case==='shield-restrictions'){
  const f=fixture(),trooper=pull(f.m,'dark','1_194','hand'),wampa=pull(f.m,'dark','3_93','hand');assert.deepEqual({darkCharacterDeployment:hoth.shieldDeployment(f.m,trooper,f.perimeter),creatureDeployment:hoth.shieldDeployment(f.m,wampa,f.perimeter),outerCharacterDeployment:hoth.shieldDeployment(f.m,trooper,f.ridge),transitIn:hoth.shieldMovement(f.m,'dark',f.ridge,f.perimeter),transitOut:hoth.shieldMovement(f.m,'dark',f.perimeter,f.ridge)},row.prohibited);
 }else if(row.case==='normal-deployment'){
  const f=fixture({shield:false,outer:false});let m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');m=step(m,'site:'+f.gen+':'+board.sitePlacements(m,f.gen)[0].id);m=step(m,ids(m)[0]);m=seek(m,x=>x.stack.at(-1)?.handler==='hoth:placement');assert.equal(m.locations.some(id=>hoth.outerHothMarker(m,id))&&m.cards[f.gen].zone==='playing',row.ridgeBeforeGenerator);m=step(clone(m),ids(m)[0]);m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.gen].zone==='table',row.generatorDeployed);
 }else assert.fail('Uncompared GEMP observation '+row.case);
});
test('losing the selected North Ridge during search responses returns the generator without a shield',()=>{
 const f=fixture({shield:false,outer:false});let m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');m=step(m,'site:'+f.gen+':'+board.sitePlacements(m,f.gen)[0].id);m=step(m,ids(m)[0]);const selected=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='hoth:deploy').action.payload.card.id;state.moveCard(m,selected,'lost');m=seek(m,x=>ids(x).includes('hoth:abort'));m=step(clone(m),'hoth:abort');m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.gen].zone,'hand');assert.equal(hoth.shielded(m,f.perimeter),false);
});
