import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,deployed,settled,battleStart,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority} from './sunsdown-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),night=load(new URL('../../lib/native-engine/nighttime.ts',import.meta.url)),battle=load(new URL('../../lib/native-engine/battle.ts',import.meta.url)),setup=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
test('A planet system deploys free alongside its sites and generates printed Force',()=>{
 const f=fixture(),old=board.generation(f.m,'dark'),force=f.m.players.dark.force.length;let m=step(f.m,'site:'+f.planet+':at:1');m=settled(m);assert.deepEqual(m.locations,[f.site,f.planet,f.remote]);assert.equal(board.generation(m,'dark'),old+2);assert.equal(m.players.dark.force.length,force);assert.equal(board.adjacent(m,f.site,f.planet),false);assert.equal(board.deploymentPayment(m,f.spy,f.planet),null);assert.equal(board.atSite(m,f.planet).length,0);
});
test('Location placement keeps systems at the exterior end and preserves ground adjacency',()=>{
 const f=fixture();let m=deployed(f),dune=pull(m,'light','1_130','hand');const placements=board.sitePlacements(m,dune);assert.deepEqual(placements.map(p=>p.index),[1]);
 assert.ok(!rules.actions(m,m.stack.at(-1),'light').some(x=>x.id.startsWith('site:'+dune)));
 assert.equal(board.adjacent(m,f.site,f.planet),false);
});
test('Sunsdown attaches only to a planet and supplies live nighttime, Warrior power and free spy deployment',()=>{
 const f=fixture();assert.ok(!ids(f.m).some(x=>x.startsWith('sunsdown:')));let m=deployed(f);assert.equal(m.cards[f.suns].attachedTo,f.planet);assert.deepEqual(night.nighttimeSites(m),[f.site]);assert.equal(board.power(m,f.warrior),3);assert.deepEqual(board.deploymentPayment(m,f.spy,f.site),{dark:0});assert.deepEqual(board.deploymentPayment(m,f.spy,f.remote),{dark:2});assert.deepEqual(runtime.project(m,rules,'light').rules.nighttime,[f.site]);
 const cost=m.players.dark.force.length;m=step(m,'deploy:'+f.spy+':'+f.site);m=settled(m);assert.equal(m.players.dark.force.length,cost);assert.equal(m.cards[f.spy].zone,'table');
});
test('Converting the system preserves Sunsdown and changes only active printed icons',()=>{
 const f=fixture();let m=deployed(f);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');m=step(m,'site:'+f.convert+':over:'+f.planet);m=settled(m);assert.equal(m.cards[f.suns].attachedTo,f.convert);assert.equal(m.cards[f.planet].coveredBy,f.convert);assert.deepEqual(night.nighttimeSites(m),[f.site]);assert.equal(board.generation(m,'light'),1+1+0+2);
});
test('Sunsdown departure immediately removes derived nighttime and free deployment without stale saved flags',()=>{
 const f=fixture();const m=deployed(f);state.moveCard(m,f.suns,'lost');assert.deepEqual(night.nighttimeSites(m),[]);assert.equal(board.power(m,f.warrior),1);assert.deepEqual(board.deploymentPayment(m,f.spy,f.site),{dark:2});assert.equal(m.data.nighttimeSites,undefined);
});
test('Actual Alter can cancel Sunsdown deployment',()=>{
 const f=fixture();let m=step(f.m,'site:'+f.planet+':at:1');m=priority(settled(m),'dark');const zero=m.players.light.reserve.find(id=>board.printed(m,id,'destiny')===0);assert.ok(zero);state.moveCard(m,zero,'reserve');m=step(m,'sunsdown:deploy:'+f.suns+':'+f.planet);const a=ids(m).find(x=>x.startsWith('cancel:play:')&&x.includes(f.alter));assert.ok(a);m=step(m,a);m=settled(m);assert.equal(m.cards[f.suns].zone,'lost');assert.deepEqual(night.nighttimeSites(m),[]);
});
test('Macroscan responds to an actual nighttime producer, not a synthetic site flag',()=>{
 const f=fixture();let m=deployed(f);m=step(m,'peek:'+f.macro);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:peek');assert.equal(runtime.project(m,rules,'dark').rules.peek.length,3);assert.deepEqual(runtime.project(m,rules,'light').rules.peek,[]);
});
function toPower(f,m=battleStart(f)){return seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1).event.category==='power');}
function toDamage(m){return seek(m,x=>battle.battle(x)?.stage==='damage');}
test('Both mandatory power destinies precede optional battle destiny and never add attrition',()=>{
 const f=fixture();let m=toPower(f),events=[];
 for(let n=0;n<200&&battle.battle(m).stage!=='damage';n++){
  const e=m.stack.at(-1)?.event;if(e?.kind==='destiny-drawn')events.push([e.category,e.side]);
  const p=prompt(m);assert.ok(!ids(m).includes('skip-power-destiny'));m=step(m,ids(m).includes('draw-destiny')?'draw-destiny':ids(m).includes('pass')?'pass':p.choices[0].id);
 }
 const b=battle.battle(m);assert.equal(b.stage,'damage');assert.deepEqual(events.filter((x,i,a)=>i===0||JSON.stringify(x)!==JSON.stringify(a[i-1])).slice(0,2),[['power','dark'],['power','light']]);for(const s of ['dark','light']){assert.equal(b.powerDestinies[s].draws.length,1);assert.equal(b.attrition[s],b.destiny[s==='dark'?'light':'dark']??0);assert.equal(b.power[s],board.totalPower(m,s,f.site,s!=='dark',id=>battle.members(m,s).includes(id))+(b.destiny[s]??0)+b.powerDestinies[s].total);}
});
test('Duplicate Sunsdown copies add only one power destiny per player',()=>{
 const f=fixture();let m=deployed(f),second=pull(m,'dark','1_230','hand');m=step(m,'sunsdown:deploy:'+second+':'+f.planet);m=settled(m);m=toDamage(battleStart(f,m));assert.equal(battle.battle(m).powerDestinies.dark.draws.length,1);assert.equal(battle.battle(m).powerDestinies.light.draws.length,1);
});
test('A side locks its power draw when counted; the other counts after the first finishes',()=>{
 const f=fixture();let m=toPower(f);state.moveCard(m,f.suns,'lost');m=toDamage(m);assert.equal(battle.battle(m).powerDestinies.dark.draws.length,1);assert.equal(battle.battle(m).powerDestinies.light,undefined);
});
test('Empty Reserve produces a failed mandatory power destiny while preserving battle flow',()=>{
 const f=fixture();let m=battleStart(f);for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'used');m=toDamage(m);assert.equal(battle.battle(m).powerDestinies.dark.total,null);assert.equal(battle.battle(m).powerDestinies.dark.draws[0].card,null);
});
test('A completed power destiny remains distinct from Takeel battle destiny records',()=>{
 const f=fixture();const m=toDamage(battleStart(f)),b=battle.battle(m);assert.equal(b.destinyResults?.dark?.draws.length??0,0);assert.equal(b.powerDestinies.dark.draws.length,1);
});
test('System starting-location metadata offers printed icons without opening production admission',()=>{
 const f=fixture();assert.deepEqual(setup.premiereSetup.location(f.m,f.planet),{identity:'Tatooine',group:'Tatooine',icons:{dark:2,light:1},convertible:true});assert.equal(load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.supports('1_230'),false);
});
test('Starting a related planet and site allows both legal row orientations',()=>{
 const f=fixture();for(const ids of [[f.site,f.planet],[f.planet,f.site]]){const p=setup.premiereSetup.placements(f.m,ids);assert.equal(p.choices.length,2);for(const choice of p.choices){const m=clone(f.m);state.moveCard(m,f.planet,'table');m.locations=[...choice.order,f.remote];assert.doesNotThrow(()=>rules.validate(m));}}
});
test('Power destiny recovery rejects invented sides, missing scopes and totals without a draw',()=>{
 const f=fixture(),m=toPower(f);
 for(const change of [b=>b.powerDestinies.other={},b=>b.powerDestinies.dark=null,b=>delete b.powerDestinies.dark.scope,b=>b.powerDestinies.dark.total=2,b=>b.powerDestinies=[]]){const bad=clone(m);change(battle.battle(bad));assert.throws(()=>rules.validate(bad),/power destiny|power destinies/);}
});
test('A new related site becomes nighttime immediately and unrelated sites do not',()=>{
 const f=fixture();let m=deployed(f);const dune=pull(m,'light','1_130','hand');m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');m=step(m,'site:'+dune+':at:1');m=settled(m);assert.deepEqual(night.nighttimeSites(m),[f.site,dune]);assert.equal(night.nighttimeSites(m).includes(f.remote),false);
});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/sunsdown-results.json',import.meta.url)));
for(const row of oracle)test('Executed GEMP Sunsdown comparison: '+row.mode,()=>{
 const f=fixture(),initial=f.m.players.dark.force.length;let m=deployed(f);assert.equal(initial-m.players.dark.force.length,row.deploymentCost);assert.equal(night.nighttimeSites(m).includes(f.site),row.nighttime);assert.equal(board.power(m,f.warrior),row.warriorPower);
 if(row.mode==='duplicate'){const second=pull(m,'dark','1_230','hand');m=step(m,'sunsdown:deploy:'+second+':'+f.planet);m=priority(settled(m),'dark');}
 if(row.mode==='depart'){state.moveCard(m,f.suns,'lost');assert.equal(night.nighttimeSites(m).includes(f.site),row.afterNighttime);assert.equal(board.power(m,f.warrior),row.afterWarriorPower);}
 if(row.mode==='spy'){const before=m.players.dark.force.length;m=step(m,'deploy:'+f.spy+':'+f.site);m=settled(m);assert.equal(before-m.players.dark.force.length,row.spyCost);return;}
 if(row.mode==='conversion'){m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');m=step(m,'site:'+f.convert+':over:'+f.planet);m=settled(m);assert.equal(m.cards[f.suns].attachedTo===f.convert,row.convertedAttachment);assert.equal(night.nighttimeSites(m).includes(f.site),row.afterNighttime);return;}
 m=battleStart(f,m);pull(m,'dark','1_194','reserve');const top=pull(m,'light','1_115','hand'),next=pull(m,'light','1_115','hand');state.moveCard(m,next,'reserve');state.moveCard(m,top,'reserve');
 if(row.mode==='empty')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'used');
 const events=[],seen=new Set();for(let n=0;n<200&&battle.battle(m).stage!=='damage';n++){const w=m.stack.at(-1),e=w?.event;if(['destiny-drawn','battle-destiny-drawn'].includes(e?.kind)&&!seen.has(w.serial)){seen.add(w.serial);events.push((e.category==='power'?'DESTINY_TO_TOTAL_POWER':'BATTLE_DESTINY')+':'+(e.side==='dark'?'Dark':'Light')+' Side Player');}m=step(m,ids(m).includes('draw-destiny')?'draw-destiny':ids(m).includes('pass')?'pass':ids(m)[0]);}
 const b=battle.battle(m);assert.equal(b.stage,'damage');assert.deepEqual(events,row.events);assert.equal(b.power.dark,row.darkPower);assert.equal(b.power.light,row.lightPower);assert.equal(b.attrition.dark,row.darkAttrition);assert.equal(b.attrition.light,row.lightAttrition);
});
test('Sunsdown oracle receipt fingerprints the executed harness and observations',async()=>{const crypto=await import('node:crypto'),r=JSON.parse(fs.readFileSync(new URL('./gemp/sunsdown-provenance.json',import.meta.url)));for(const[file,hash]of Object.entries(r.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(r.observations,oracle.length);assert.equal(r.unchangedProductionFiles,6820)});
test('A canceled power draw contributes nothing and a replacement stays in its power slot',()=>{
 const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));for(const redraw of [false,true]){const f=fixture();let m=seek(toPower(f),x=>x.stack.at(-1)?.event?.kind==='destiny-drawn'&&x.stack.at(-1).event.category==='power');const frame=m.stack.findLast(x=>x.kind==='resolution'&&x.action.handler==='destiny:finish');assert.ok(frame);if(redraw)assert.equal(destiny.redrawDestiny(m,frame),true);else frame.cancelled=true;m=toDamage(m);const p=battle.battle(m).powerDestinies.dark;assert.equal(p.draws.length,1);if(!redraw)assert.equal(p.total,null);else assert.equal(typeof p.total,'number');assert.equal(battle.battle(m).attrition.light,battle.battle(m).destiny.dark??0);}
});
test('Game-text cancellation ends Sunsdown while retaining its physical attachment',()=>{
 const f=fixture(),m=deployed(f),identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));m.data.canceledGameText=[identity.referenceCard(m,f.suns)];assert.deepEqual(night.nighttimeSites(m),[]);assert.equal(m.cards[f.suns].attachedTo,f.planet);assert.equal(board.deploymentPayment(m,f.spy,f.site).dark,2);
});
test('Saved Sunsdown on a site or without its host is rejected',()=>{
 const f=fixture(),m=deployed(f);for(const target of [undefined,f.site]){const bad=clone(m);bad.cards[f.suns].attachedTo=target;assert.throws(()=>rules.validate(bad),/planet system/);}
});
