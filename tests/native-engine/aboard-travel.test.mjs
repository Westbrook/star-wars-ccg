import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,escapeChoice,step,seek,ids,clone,state,ground,rules,load} from './aboard-travel-fixture.mjs';
const travel=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
// The original landed permanent-pilot result disagrees with AR p71 example 3.
// Preserve that receipt; verify its documented correction separately below.
const modes=['run-ground','run-open','run-closed','escape-open','escape-open-only','escape-landed-only','escape-closed-only','escape-closed','escape-no-force'];
const choices=m=>m.stack.at(-1)?.handler==='travel:escape';
const response=m=>m.stack.at(-2)?.action?.handler==='travel:escape-move'&&!m.stack.at(-2).awaitingResponses;
function initiate(f){const id=escapeChoice(f.m,f.interrupt);assert.ok(id);return seek(step(f.m,id),m=>choices(m)||m.cards[f.interrupt].zone==='used');}
for(const mode of modes)test('aboard movement Interrupt matches GEMP: '+mode,()=>{
 const f=fixture(mode),run=mode.startsWith('run');let m=f.m;
 const id=run?ids(m).find(id=>id.startsWith('run-luke:')):escapeChoice(m,f.interrupt),available=!!id,before=m.players.light.force.length;
 if(available){m=step(m,id);if(!run&&mode!=='escape-no-force'){m=seek(m,choices);assert.ok(!ids(m).some(id=>id.startsWith('away:'+f.host+':')),'landed vessels cannot move using landspeed');m=step(m,'away:'+f.luke+':'+f.dune);}m=seek(clone(m),m=>m.cards[f.interrupt].zone===(run?'lost':'used'));}
 const row={mode,available,cost:before-m.players.light.force.length,lukeMoved:m.cards[f.luke].location===(run?f.site:f.dune),aboard:m.cards[f.luke].attachedTo===f.host,gunCarried:m.cards[f.gun].attachedTo===f.luke,regularMove:ground.usage(m).moved.includes(f.luke),interruptDone:m.cards[f.interrupt].zone===(run?'lost':'used')};
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/aboard-travel-results.json',import.meta.url)));assert.deepEqual(row,oracle.find(r=>r.mode===mode));rules.validate(m);
 if(row.lukeMoved){assert.equal(m.cards[f.luke].aboardRole,undefined);assert.equal(m.cards[f.gun].location,m.cards[f.luke].location);assert.equal(m.cards[f.host].location,run?f.dune:f.site);}
});
test('Narrow Escape rejects the landed permanent-pilot case explicitly forbidden by AR p71',()=>{
 const f=fixture('escape-landed'),before=clone(f.m);
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/aboard-travel-results.json',import.meta.url)));
 assert.equal(oracle.find(r=>r.mode==='escape-landed').available,true,'retain the actual GEMP discrepancy');
 assert.equal(escapeChoice(f.m,f.interrupt),undefined);
 assert.throws(()=>step(f.m,'escape:'+f.interrupt),/choice|legal/i);
 assert.deepEqual(f.m,before);assert.equal(f.m.cards[f.interrupt].zone,'hand');
 assert.equal(escapeChoice(clone(f.m),f.interrupt),undefined,'refresh cannot enable an illegal play');
});
test('a landed ship without current ability does not prevent its passengers escaping',()=>{
 const f=fixture('escape-landed');
 const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
 // Controlled continuous-effect fixture; not a claim that this deck can blank the ship.
 suppressGameText(f.m,f.lightPilot,f.host);
 let m=initiate(f);assert.ok(ids(m).includes('away:'+f.luke+':'+f.dune));
 m=seek(step(m,'away:'+f.luke+':'+f.dune),x=>x.cards[f.interrupt].zone==='used');
 assert.equal(m.cards[f.host].location,f.site);assert.equal(m.cards[f.luke].location,f.dune);
 assert.equal(m.cards[f.luke].attachedTo,undefined);assert.equal(m.players.light.force.length,0);rules.validate(m);
});
test('a permanent-pilot ship at another location does not prevent Narrow Escape',()=>{
 const f=fixture('escape-closed');state.moveCard(f.m,f.ywing,'table');f.m.cards[f.ywing].location=f.dune;
 assert.ok(escapeChoice(f.m,f.interrupt));
});
test('having landspeed is distinct from being allowed to perform this movement',()=>{
 const f=fixture('escape-closed');
 // The guard is an original participant with landspeed, despite its immobility.
 f.m.cards[f.rebel].blueprint='1_26';
 const m=initiate(f);
 assert.ok(!ids(m).some(id=>id.startsWith('away:'+f.rebel+':')));
 assert.ok(ids(m).includes('away:'+f.luke+':'+f.dune));
});
test('later restoration of permanent ability does not retroactively cancel an initiated Escape',()=>{
 const f=fixture('escape-landed');
 const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
 suppressGameText(f.m,f.lightPilot,f.host);
 let m=step(f.m,escapeChoice(f.m,f.interrupt));
 m.data.gameTextSuppressions=[]; // Controlled response-time change, not a new card permission.
 m=seek(clone(m),choices);assert.ok(ids(m).includes('away:'+f.luke+':'+f.dune));
 m=seek(step(m,'away:'+f.luke+':'+f.dune),x=>x.cards[f.interrupt].zone==='used');
 assert.equal(m.cards[f.luke].location,f.dune);assert.equal(m.cards[f.host].location,f.site);
});
for(const effect of ['cancel','barrier','host-return','host-moved','new-host','target-return'])test('move-away retains paid cost and does not disembark after '+effect,()=>{
 const f=fixture();let m=initiate(f);m=seek(step(m,'away:'+f.luke+':'+f.dune),response);assert.equal(m.cards[f.luke].attachedTo,f.host);assert.equal(m.players.light.force.length,0);
 if(effect==='cancel')m.stack.at(-2).cancelled=true;
 if(effect==='barrier')ground.record(m).barriers[f.luke]=m.turn.number;
 if(effect==='host-return'){delete m.cards[f.luke].attachedTo;delete m.cards[f.luke].aboardRole;state.moveCard(m,f.host,'hand');state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;m.cards[f.luke].attachedTo=f.host;m.cards[f.luke].aboardRole='passenger';}
 if(effect==='host-moved'){for(const id of [f.host,f.luke,f.gun])m.cards[id].location=f.dune;}
 if(effect==='new-host'){state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.site;m.cards[f.luke].attachedTo=f.ywing;}
 if(effect==='target-return'){delete m.cards[f.gun].attachedTo;state.moveCard(m,f.luke,'hand');state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;m.cards[f.luke].attachedTo=f.host;m.cards[f.luke].aboardRole='passenger';m.cards[f.gun].attachedTo=f.luke;}
 m=seek(clone(m),x=>x.cards[f.interrupt].zone==='used');assert.equal(m.cards[f.luke].attachedTo,effect==='new-host'?f.ywing:f.host);assert.equal(m.cards[f.luke].aboardRole,'passenger');assert.ok(!ground.usage(m).moved.includes(f.luke));assert.equal(m.players.light.force.length,0);
});
test('enclosed crew can escape but neither prior movement nor Barrier is bypassed',()=>{
 for(const restriction of ['moved','barrier']){const f=fixture();if(restriction==='moved')ground.record(f.m).moved.push(f.luke);else ground.record(f.m).barriers[f.luke]=f.m.turn.number;const m=initiate(f);assert.ok(!ids(m).some(id=>id.startsWith('away:'+f.luke+':')));assert.ok(ids(m).some(id=>id.startsWith('away:'+f.lightPilot+':')));}
});
test('saved movement route references reject malformed snapshots and restore legacy pending moves',()=>{
 const f=fixture();let m=seek(step(initiate(f),'away:'+f.luke+':'+f.dune),response);
 for(const key of ['originRef','fromRef','toRef']){const corrupt=clone(m);corrupt.stack.at(-2).action.payload[key].version=999;assert.throws(()=>travel.assertTravel(corrupt),/reference/);}
 // Older snapshots have no route fields. Preserve those already-initiated commands.
 for(const key of ['originRef','fromRef','toRef'])delete m.stack.at(-2).action.payload[key];m=seek(clone(m),x=>x.cards[f.interrupt].zone==='used');assert.equal(m.cards[f.luke].location,f.dune);
});
