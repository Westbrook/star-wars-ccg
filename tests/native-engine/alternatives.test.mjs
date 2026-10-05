import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,releaseReady,battleReady,deployEffect,besiegedReady,releaseId,done,mod,state,rules,phase,step,ids,seek,priority,pull,clone} from './alternatives-fixture.mjs';
const atf=mod('alternatives'),battle=mod('battle'),ground=mod('ground');
test('Alternatives cancels a just-initiated system battle for3Force, preserving costs and battle history',()=>{
 const f=fixture({capture:false});let m=battleReady(f),before=m.players.light.force.length;
 m=done(step(m,'alternatives:'+f.alt+':battle:'+f.site));m=seek(m,x=>battle.battle(x)?.stage==='complete');
 assert.equal(m.players.light.force.length,before-3);assert.equal(m.cards[f.alt].zone,'lost');assert.equal(battle.battle(m).cancelled,true);assert.equal(battle.battle(m).premature,true);assert.ok(battle.battleHistory(m).participants.includes(f.ship));rules.validate(m);
});
test('Battle cancellation is unavailable outside initiation, when unaffordable, and for Besieged site battle',()=>{
 const f=fixture({capture:false});let m=battleReady(f);while(m.players.light.force.length>2)state.moveCard(m,m.players.light.force.at(-1),'used');assert.equal(ids(m).includes('alternatives:'+f.alt+':battle:'+f.site),false);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');m=priority(m,'light');assert.equal(ids(m).some(x=>x.includes(f.alt+':battle:')),false);
 const g=fixture();const b=besiegedReady(g);assert.equal(ids(b).some(x=>x.includes(g.alt+':battle:')),false);
});
test('Canceling Besieged deployment retires the actual pending action and places both cards Lost',()=>{
 const f=fixture();let m=phase(f.m,'dark','deploy');m=step(m,'besieged:deploy:'+f.effect+':'+f.ship);m=seek(m,x=>ids(x).includes('alternatives:'+f.alt+':deployment:'+f.effect));
 m=done(step(m,'alternatives:'+f.alt+':deployment:'+f.effect));m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.effect].zone,'lost');assert.equal(m.cards[f.alt].zone,'lost');assert.equal(m.cards[f.ship].zone,'inactive');rules.validate(m);
});
test('Canceling on-table Besieged exposes a durable cancellation window and does not release trapped crew',()=>{
 const f=fixture();let m=priority(seek(deployEffect(f),x=>x.stack.length===1),'light');m=step(m,'alternatives:'+f.alt+':effect:'+f.effect);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-be-canceled-on-table');assert.equal(m.cards[f.effect].zone,'table');rules.validate(clone(m));m=done(clone(m));
 assert.equal(m.cards[f.effect].zone,'lost');assert.equal(m.cards[f.ship].zone,'inactive');for(const id of f.characters)assert.equal(m.cards[id].zone,'inactive');
});
test('Crew releases simultaneously to a remote docking bay with personal attachments for free without regular movement use',()=>{
 const f=fixture();let m=releaseReady(f),force=m.players.light.force.length;m=step(m,releaseId(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='relocating');rules.validate(clone(m));
 for(const id of f.characters)assert.equal(m.cards[id].zone,'inactive');m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='relocated');
 for(const id of f.characters){assert.equal(m.cards[id].zone,'table');assert.equal(m.cards[id].location,f.bay);assert.equal(m.cards[id].attachedTo,undefined);assert.equal(m.cards[id].aboardRole,undefined);assert.equal(ground.usage(m).moved.includes(id),false);}
 assert.equal(m.cards[f.gun].zone,'table');assert.equal(m.cards[f.gun].attachedTo,f.characters[0]);assert.equal(m.cards[f.gun].location,f.bay);assert.equal(m.players.light.force.length,force);rules.validate(clone(m));
 m=done(m);assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[f.ship].zone,'table');assert.equal(m.cards[f.alt].zone,'lost');
});
test('Crew may release at the same occupied Docking Bay327, bypassing normal disembark restrictions',()=>{
 const f=fixture({site:true});let m=releaseReady(f);state.moveCard(m,f.escort,'hand');state.moveCard(m,f.escort,'table');m.cards[f.escort].location=f.captureHost;
 m=seek(step(m,releaseId(f,f.captureHost)),x=>x.stack.at(-1)?.event?.kind==='relocated');for(const id of f.characters){assert.equal(m.cards[id].zone,'table');assert.equal(m.cards[id].location,f.captureHost);assert.equal(m.cards[id].attachedTo,undefined);}rules.validate(m);
});
test('Destinations use docking-bay identity, never Launch Bay or unrelated ordinary sites',()=>{
 const f=fixture();let m=releaseReady(f);assert.ok(ids(m).includes(releaseId(f)));assert.equal(ids(m).includes(releaseId(f,f.site)),false);
});
test('Canceled Alternatives loses its card, preserves paid Force, and leaves battle active',()=>{
 const f=fixture({capture:false});let m=step(battleReady(f),'alternatives:'+f.alt+':battle:'+f.site),force=m.players.light.force.length;
 const frame=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='alternatives:play');frame.cancelled=true;m=done(m);assert.equal(m.cards[f.alt].zone,'lost');assert.equal(m.players.light.force.length,force);assert.equal(battle.battle(m).cancelled,undefined);
});
test('A released-and-returned captured hull cannot revive original crew-release targets',()=>{
 const f=fixture();let m=step(releaseReady(f),releaseId(f));const frame=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='alternatives:play');
 // Advance the bound instance through genuine leave/re-enter primitives after
 // resolving its dependent relationships, then capture that new visit.
 for(const id of [f.gun,...f.characters]){if(id===f.gun){delete m.cards[id].attachedTo;state.moveCard(m,id,'hand');}else{delete m.cards[id].attachedTo;delete m.cards[id].aboardRole;state.moveCard(m,id,'hand');}}
 delete m.cards[f.ship].capturedShip;delete m.cards[f.ship].attachedTo;state.moveCard(m,f.ship,'hand');state.moveCard(m,f.ship,'table');m.cards[f.ship].location=f.site;
 state.moveCard(m,f.characters[0],'table');Object.assign(m.cards[f.characters[0]],{attachedTo:f.ship,aboardRole:'pilot',location:f.site});mod('captured-ships').captureStarship(m,f.ship,f.host);
 m=done(m);assert.equal(m.cards[f.characters[0]].zone,'inactive');assert.equal(m.cards[f.alt].zone,'lost');
});
test('Release during Besieged leaves battle participants with legal departure evidence and keeps released equipment active',()=>{
 const f=fixture();let m=besiegedReady(f);m=seek(step(m,releaseId(f)),x=>x.stack.at(-1)?.event?.kind==='relocated');
 for(const id of f.characters)assert.ok(battle.battle(m).departed.includes(id));assert.equal(battle.battle(m).departed.includes(f.gun),false);rules.validate(clone(m));
 m=done(m);assert.equal(m.cards[f.gun].zone,'table');for(const id of f.characters){assert.equal(m.cards[id].zone,'table');assert.equal(m.cards[id].location,f.bay);}
});
test('Canceling an already-deployed Besieged does not cancel its current battle',()=>{
 const f=fixture();let m=besiegedReady(f);m=done(step(m,'alternatives:'+f.alt+':effect:'+f.effect));assert.equal(m.cards[f.effect].zone,'lost');assert.notEqual(battle.battle(m).stage,'complete');assert.equal(battle.battle(m).cancelled,undefined);rules.validate(m);
});
test('Saved Alternatives rejects forged target classes, group duplicates, payment and wrong response serial',()=>{
 const f=fixture();const m=step(releaseReady(f),releaseId(f));for(const edit of [p=>p.characters.push(p.characters[0]),p=>p.bay=p.target,p=>p.characters[0]=p.target,p=>p.target=p.bay,p=>p.mode='bogus']){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='alternatives:play').action.payload);assert.throws(()=>rules.validate(bad));}
 const g=fixture({capture:false}),pending=step(battleReady(g),'alternatives:'+g.alt+':battle:'+g.site);for(const edit of [f=>f.action.payment.light=2,f=>f.action.payload.window=999]){const bad=clone(pending);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='alternatives:play'));assert.throws(()=>rules.validate(bad));}
});

test('Actual Sense cancels the paid battle mode through a saved nested destiny response',()=>{
 const f=fixture({capture:false}),sense=pull(f.m,'dark','1_267','hand');let m=battleReady(f),before=m.players.light.force.length;
 const top=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_194');m.players.dark.reserve.splice(m.players.dark.reserve.indexOf(top),1);m.players.dark.reserve.unshift(top);
 m=step(m,'alternatives:'+f.alt+':battle:'+f.site);m=seek(m,x=>ids(x).some(id=>id.startsWith('cancel:')&&id.includes(sense)));m=step(m,ids(m).find(id=>id.startsWith('cancel:')&&id.includes(sense)));
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');rules.validate(clone(m));m=seek(clone(m),x=>x.cards[sense].zone==='used');
 assert.equal(m.cards[f.alt].zone,'lost');assert.equal(m.cards[sense].zone,'used');assert.equal(m.players.light.force.length,before-3);assert.equal(battle.battle(m).cancelled,undefined);assert.notEqual(battle.battle(m).stage,'complete');
});
test('Alternatives cancels an asteroid-sector battle through the same paid response',()=>{
 const f=fixture({capture:false}),sector=pull(f.m,'light','4_81');f.m.locations.unshift(sector);mod('sectors').registerSector(f.m,sector,mod('board').system(f.m,f.site));
 for(const id of [f.ship,f.host])mod('board').moveWithAttachments(f.m,id,sector);f.site=sector;
 let m=battleReady(f);m=done(step(m,'alternatives:'+f.alt+':battle:'+sector));m=seek(m,x=>battle.battle(x)?.stage==='complete');assert.equal(battle.battle(m).cancelled,true);
});
test('A movement-restricted trapped character stays aboard while eligible crew can release',()=>{
 const f=fixture();ground.record(f.m).barriers[f.characters[0]]=f.m.turn.number;let m=releaseReady(f),a=atf.alternativesActions(m,m.stack.at(-1),'light').find(a=>a.id===releaseId(f));assert.deepEqual(a.payload.characters.map(r=>r.id),[f.characters[1]]);
 m=done(step(m,releaseId(f)));assert.equal(m.cards[f.characters[0]].zone,'inactive');assert.equal(m.cards[f.characters[1]].location,f.bay);assert.equal(m.cards[f.ship].owner,'light');assert.ok(m.cards[f.ship].capturedShip);
});

test('A hit character released during Besieged is immediately lost with equipment through a saved loss response',()=>{
 const f=fixture();let m=besiegedReady(f,'dark');const blaster=pull(m,'dark','1_317','table',f.site);m.cards[blaster].attachedTo=f.escort;
 const high=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_241');m.players.dark.reserve.splice(m.players.dark.reserve.indexOf(high),1);m.players.dark.reserve.unshift(high);
 m=priority(m,'dark');m=step(m,'fire:'+blaster+':'+f.characters[0]);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons'&&battle.battle(x).hits.includes(f.characters[0]));m=priority(m,'light');
 m=step(m,releaseId(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-lose'&&x.stack.at(-1).event.cause==='hit-outside-battle');
 assert.equal(m.cards[f.characters[0]].zone,'table');assert.equal(m.cards[f.characters[0]].location,f.bay);rules.validate(clone(m));m=done(clone(m));
 assert.equal(m.cards[f.characters[0]].zone,'lost');assert.equal(m.cards[f.gun].zone,'lost');assert.equal(m.cards[f.characters[1]].zone,'table');assert.equal(m.cards[f.characters[1]].location,f.bay);
});
const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observations=JSON.parse(fs.readFileSync(new URL('./gemp/alternatives-results.json',import.meta.url)));
for(const row of observations)test('Executed Alternatives reference outcome: '+row.mode,()=>{
 const f=fixture({capture:row.mode!=='battle',site:row.mode==='same-bay-observation'});let m,before;
 if(row.mode==='battle'){
  m=battleReady(f);before=m.players.light.force.length;m=done(step(m,'alternatives:'+f.alt+':battle:'+f.site));m=seek(m,x=>battle.battle(x)?.stage==='complete');
  assert.deepEqual({mode:row.mode,cost:before-m.players.light.force.length,cardLost:m.cards[f.alt].zone==='lost',battleEnded:battle.battle(m).stage==='complete'},row);return;
 }
 const bay=row.mode==='remote'?f.bay:f.captureHost;m=releaseReady(f);before=m.players.light.force.length;m=done(step(m,releaseId(f,bay)));
 const common={mode:row.mode,cost:before-m.players.light.force.length,cardLost:m.cards[f.alt].zone==='lost',shipStolen:m.cards[f.ship].owner==='dark',gunAttached:m.cards[f.gun].attachedTo===f.characters[0]};
 if(row.mode==='remote')assert.deepEqual({...common,crewReleased:f.characters.every(id=>m.cards[id].zone==='table'&&m.cards[id].location===bay&&!m.cards[id].attachedTo),regularMoveUsed:ground.usage(m).moved.includes(f.characters[0])},row);
 else {
  // Preserve the actual failing reference observation. Native follows the
  // characters-only text, keeping the weapon with its released bearer.
  assert.equal(row.gunAttached,false);assert.equal(row.gunZone,'AT_LOCATION');
  assert.deepEqual({...common,pilotReleased:m.cards[f.characters[0]].location===bay&&!m.cards[f.characters[0]].attachedTo,passengerReleased:m.cards[f.characters[1]].location===bay&&!m.cards[f.characters[1]].attachedTo,gunZone:m.cards[f.gun].zone==='table'&&m.cards[f.gun].attachedTo?'ATTACHED':'OTHER'},{...row,gunAttached:true,gunZone:'ATTACHED'});
 }
});
test('Alternatives reference receipt binds raw success and discrepancy evidence without treating its failing run as green',()=>{
 const root=new URL('./gemp/',import.meta.url),receipt=JSON.parse(fs.readFileSync(new URL('alternatives-provenance.json',root)));
 for(const [file,key]of [[receipt.harness,'harnessSha256'],[receipt.results,'resultsSha256'],[receipt.log,'logSha256']])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),receipt[key]);
 assert.equal(receipt.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(receipt.productionFilesCompared,6820);assert.equal(receipt.productionFilesChanged,0);assert.equal(receipt.execution.exitCode,1);assert.deepEqual(receipt.execution.completedPositiveCases,['remote','battle']);assert.equal(receipt.execution.failedAssertion,'same-bay weaponAttached');
});
