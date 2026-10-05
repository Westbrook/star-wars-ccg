import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,prepared,occ,pilot,board,identity,load,state,rules,step,seek,phase,priority,ids,deploy,settled,pull,clone,runtime} from './navigation-fixture.mjs';
const gameText=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url)),combat=load(new URL('../../lib/native-engine/combat-modifiers.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),table=load(new URL('../../lib/native-engine/table.ts',import.meta.url));
const values=(m,id)=>({power:board.power(m,id),maneuver:pilot.vesselManeuver(m,id),hyperspeed:pilot.vesselHyperspeed(m,id),navigation:pilot.hasNavigation(m,id)});
test('Dedicated astromech capacity accepts droids without consuming a pilot or ordinary passenger slot',()=>{
 const f=fixture();assert.ok(ids(f.m).includes('vessel:aboard:'+f.r2+':'+f.ship+':passenger'));assert.ok(!ids(f.m).includes('vessel:aboard:'+f.lightPilot+':'+f.ship+':passenger'));
 const m=prepared(f);assert.equal(occ.occupants(m,f.ship).length,2);assert.ok(!ids(m).includes('vessel:aboard:'+f.x1+':'+f.ship+':passenger'));assert.deepEqual(values(m,f.ship),{power:8,maneuver:6,hyperspeed:7,navigation:true});rules.validate(m);
});
test('Gold 5 shares ordinary pilot/passenger slots while reserving astromech space',()=>{
 const f=fixture('gold5-r2');let m=prepared(f);m=deploy(m,f.lightPilot,f.ship,'passenger');assert.equal(occ.occupants(m,f.ship).length,3);assert.equal(occ.roleAvailable(m,f.ship,f.x1,'passenger'),false);assert.equal(occ.roleAvailable(m,f.ship,f.droid,'passenger'),false);rules.validate(m);
});
test('Different astromech titles add, but repeated noncumulative R2-X2 text does not',()=>{
 const mixed=fixture('gold5-mixed'),dupes=fixture('gold5-duplicates');assert.deepEqual(values(prepared(mixed),mixed.ship),{power:8,maneuver:6,hyperspeed:7,navigation:true});assert.deepEqual(values(prepared(dupes),dupes.ship),{power:6,maneuver:4,hyperspeed:5,navigation:true});
});
test('Red 5 combines Luke maneuver, Artoo matching bonuses and conditional attrition immunity',()=>{
 const f=fixture('red5-r2'),m=prepared(f);assert.deepEqual(values(m,f.ship),{power:9,maneuver:9,hyperspeed:8,navigation:true});assert.equal(combat.immuneToAttrition(m,f.ship,3),true);assert.equal(combat.immuneToAttrition(m,f.ship,4),false);m.data.canceledGameText=[identity.referenceCard(m,f.ship)];assert.equal(combat.immuneToAttrition(m,f.ship,3),false);assert.equal(pilot.vesselManeuver(m,f.ship),9);
});
test('Canceling Artoo text removes bonuses, and canceling Luke text removes only Luke bonuses',()=>{
 const f=fixture('red5-r2'),m=prepared(f);m.data.canceledGameText=[identity.referenceCard(m,f.r2)];assert.deepEqual(values(m,f.ship),{power:6,maneuver:6,hyperspeed:5,navigation:true});m.data.canceledGameText=[identity.referenceCard(m,f.lukePilot)];assert.deepEqual(values(m,f.ship),{power:6,maneuver:7,hyperspeed:8,navigation:true});assert.equal(combat.immuneToAttrition(m,f.ship,3),true);
});
for(const mode of ['unpiloted','landed'])test('Official AR unpiloted or landed ships have hyperspeed zero: '+mode,()=>{const f=fixture(mode),m=prepared(f);assert.deepEqual(values(m,f.ship),{power:0,maneuver:0,hyperspeed:0,navigation:true});assert.ok(!travel.vesselRoutes(m,f.ship).some(r=>r.method==='hyperspace'));});
test('Extended-range movement pays once and restores before and after arrival with crew attached',()=>{
 const f=fixture(),initial=prepared(f);let m=priority(phase(initial,'move'),'light');const before=m.players.light.force.length;m=step(m,'voyage:hyperspace:'+f.ship+':'+f.death);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='vessel-moving');assert.equal(m.cards[f.ship].location,f.planet);assert.equal(m.players.light.force.length,before-1);m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='moved');for(const id of [f.ship,f.r2,f.lukePilot])assert.equal(m.cards[id].location,f.death);assert.equal(m.players.light.force.length,before-1);assert.ok(ground.usage(m).moved.includes(f.ship));rules.validate(m);
});
test('Removing a bonus after hyperspace initiation does not retroactively revoke the route',()=>{
 const f=fixture();let m=priority(phase(prepared(f),'move'),'light');const before=m.players.light.force.length;m=seek(step(m,'voyage:hyperspace:'+f.ship+':'+f.death),x=>x.stack.at(-1)?.event?.kind==='vessel-moving');table.returnToHand(m,[f.r2]);m=settled(m);assert.equal(m.cards[f.ship].location,f.death);assert.equal(m.players.light.force.length,before-1);assert.ok(ground.usage(m).moved.includes(f.ship));
});
test('Excluded astromechs lose bonuses during battle and regain them afterward',()=>{
 const f=fixture();let m=prepared(f);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;ground.record(m).barriers[f.r2]=m.turn.number;m=priority(phase(m,'battle'),'light');m=seek(step(m,'battle:'+f.planet),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.deepEqual(values(m,f.ship),{power:6,maneuver:4,hyperspeed:5,navigation:true});m.data.battle.stage='complete';assert.equal(pilot.vesselManeuver(m,f.ship),6);
});
const evidence=new URL('./gemp/navigation-results.json',import.meta.url);
for(const expected of JSON.parse(fs.readFileSync(evidence)))test('Executed GEMP navigation outcome: '+expected.mode,()=>{
 const f=fixture(expected.mode);const before=f.m.players.light.force.length;let m=prepared(f);const cost=before-m.players.light.force.length;
 if(f.mode.endsWith('text-canceled'))gameText.suppressGameText(m,f.planet,f.mode.startsWith('r2')?f.astromech:f.ship);
 const row={mode:f.mode,deploy:cost,...values(m,f.ship),scomp:f.mode!=='no-droid',astromechCapacity:occ.vesselRule(m,f.ship).astromechs??0,immunity:combat.attritionImmunity(m,f.ship),droidNavigation:pilot.hasAstromechNavigation(m,f.ship)};m=priority(phase(m,'move'),'light');const choice='voyage:hyperspace:'+f.ship+':'+f.death;row.canMove=ids(m).includes(choice);const force=m.players.light.force.length;if(row.canMove){m=seek(step(m,choice),x=>x.stack.at(-1)?.event?.kind==='vessel-moving');if(f.mode==='departure')table.returnToHand(m,[f.astromech]);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');}row.arrived=m.cards[f.ship].location===f.death;row.moveCost=force-m.players.light.force.length;row.afterHyperspeed=pilot.vesselHyperspeed(m,f.ship);if(['unpiloted','landed'].includes(f.mode)){
 // Preserve the executed GEMP raw getter observation. Official AR p90/p92
 // instead defines an unpiloted ship's usable hyperspeed as unmodifiable zero.
 assert.equal(expected.hyperspeed,7);assert.equal(expected.afterHyperspeed,7);
 assert.equal(row.hyperspeed,0);assert.equal(row.afterHyperspeed,0);assert.equal(row.canMove,false);
 assert.deepEqual(row,{...expected,hyperspeed:0,afterHyperspeed:0});
 }else assert.deepEqual(row,expected);
});

for(const duration of ['turn','source'])test('Text suppression survives recovery and expires by '+duration,()=>{
 const f=fixture();let m=prepared(f);gameText.suppressGameText(m,f.lukePilot,f.r2,duration);m=priority(settled(step(m,'pass')),'light');assert.equal(pilot.vesselHyperspeed(m,f.ship),5);
 table.returnToHand(m,[f.lukePilot]);assert.equal(pilot.vesselHyperspeed(m,f.ship),0);state.moveCard(m,f.lukePilot,'table');Object.assign(m.cards[f.lukePilot],{attachedTo:f.ship,aboardRole:'pilot',location:f.planet});assert.equal(pilot.vesselHyperspeed(m,f.ship),duration==='turn'?5:7);if(duration==='turn'){m.turn.number++;assert.equal(pilot.vesselHyperspeed(m,f.ship),7);}rules.validate(m);
});
test('A returned target never inherits its previous text suppression',()=>{
 const f=fixture(),m=prepared(f);gameText.suppressGameText(m,f.ship,f.r2);table.returnToHand(m,[f.r2]);state.moveCard(m,f.r2,'table');Object.assign(m.cards[f.r2],{attachedTo:f.ship,aboardRole:'passenger',location:f.planet});assert.equal(pilot.vesselHyperspeed(m,f.ship),7);rules.validate(m);
});
for(const mutate of [p=>p.target.version++,p=>p.source.zone='hand',p=>p.turn=-1,p=>p.duration='forever'])test('Corrupt saved suppression fails validation: '+mutate,()=>{
 const f=fixture(),m=prepared(f);gameText.suppressGameText(m,f.ship,f.r2);mutate(m.data.gameTextSuppressions[0]);assert.throws(()=>rules.validate(m));
});
