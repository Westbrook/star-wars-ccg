import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,fire,initiated,boundary,step,seek,priority,ids,pull,state,rules,clone,load} from './starship-weapons-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const shots=m=>m.data.battle.starshipShots,weaponUse=mod('weapon-state');
for(const [bp,cost] of [['1_158',1],['1_159',2],['1_323',3]])test('ship weapon deployment and Force cost '+bp,()=>{
 const f=fixture(bp,'deploy',false),before=f.m.players[f.side].force.length;
 const id='space-weapon:equip:'+f.weapon+':'+f.host;assert.ok(ids(f.m).includes(id));
 const m=seek(step(f.m,id),x=>x.cards[f.weapon].zone==='table');assert.equal(m.cards[f.weapon].attachedTo,f.host);assert.equal(before-m.players[f.side].force.length,cost);
});
for(const [bp,values,capital,total,hit] of [['1_158',[3],false,3,true],['1_158',[1],false,1,false],['1_159',[1],false,2,true],['1_159',[3],false,4,true],['1_159',[5],true,5,false],['1_323',[5,5],false,5,true],['1_323',[3,3],false,1,false],['1_323',[5,5],true,8,true]])test('ship weapon total, defense and hit '+JSON.stringify([bp,values,capital]),()=>{
 const f=fixture(bp,'battle',true,capital),before=f.m.players[f.side].force.length,m=fire(f,values),s=shots(m)[0];assert.equal(s.total,total);assert.equal(s.outcome,hit?'hit':'miss');assert.equal(m.data.battle.hits.includes(f.target),hit);assert.equal(s.draws.length,values.length);assert.equal(before-m.players[f.side].force.length,1+(bp==='1_323'?2:1));assert.equal(mod('board').forfeit(m,f.target),mod('board').forfeit(f.m,f.target));
 const ready=priority(boundary(m,'battle-weapons'),f.side);assert.ok(!ids(ready).some(id=>id.startsWith('space-weapon:fire:'+f.weapon+':')));
});
test('invalid host, opponent host and insufficient Force do not offer deployment',()=>{
 const f=fixture('1_158','deploy',false);state.moveCard(f.m,f.scout,'table');f.m.cards[f.scout].location=f.site;
 assert.deepEqual(ids(f.m).filter(id=>id.startsWith('space-weapon:equip:')),['space-weapon:equip:'+f.weapon+':'+f.host]);
 for(const id of [...f.m.players.light.force])state.moveCard(f.m,id,'used');assert.ok(!ids(f.m).some(id=>id.startsWith('space-weapon:equip:')));
});
test('transfer to another present eligible ship repays the deployment cost',()=>{
 const f=fixture('1_159','deploy'),to=pull(f.m,'light','1_140','table',f.site),before=f.m.players.light.force.length;
 const m=seek(step(f.m,'space-weapon:equip:'+f.weapon+':'+to),x=>x.cards[f.weapon].attachedTo===to);assert.equal(before-m.players.light.force.length,2);
});
test('remote ships are not eligible weapon transfer targets',()=>{
 const f=fixture('1_158','deploy'),to=pull(f.m,'light','1_147','table',f.ground);
 assert.ok(!ids(f.m).includes('space-weapon:equip:'+f.weapon+':'+to));
});
test('unpiloted or landed firing host has no firing action',()=>{
 for(const mode of ['unpiloted','landed']){const f=fixture();let m=boundary(step(f.m,'battle:'+f.site),'battle-weapons');if(mode==='unpiloted')m.data.canceledGameText=[];
 if(mode==='landed'){m.cards[f.host].location=f.ground;m.cards[f.weapon].location=f.ground;}else{m.cards[f.host].blueprint='1_144';}
 assert.ok(!ids(priority(m,f.side)).some(id=>id.startsWith('space-weapon:fire:'+f.weapon+':')));}
});
test('a capital ship can use two different weapons; a starfighter cannot',()=>{
 for(const bp of ['1_158','1_159','1_323']){const f=fixture(bp),second=pull(f.m,f.side,bp,'table',f.site);f.m.cards[second].attachedTo=f.host;weaponUse.useWeapon(f.m,f.weapon);assert.equal(weaponUse.canUseWeapon(f.m,second),bp!=='1_158');weaponUse.assertWeaponUse(f.m);}
});
test('paid canceled firing keeps the attempt limit without drawing',()=>{
 const f=fixture();let m=initiated(f,[5]);m.stack.find(r=>r.action?.handler==='space-weapon:fire').cancelled=true;m=boundary(m,'battle-weapons');assert.equal(shots(m)[0].outcome,'canceled');assert.deepEqual(shots(m)[0].draws,[]);assert.ok(!ids(priority(m,f.side)).some(id=>id.startsWith('space-weapon:fire:'+f.weapon+':')));
});
test('leaving and returning does not inherit the original target hit',()=>{
 const f=fixture();let m=initiated(f,[5]);state.moveCard(m,f.target,'hand');state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;m=boundary(m,'weapon-fired');assert.equal(shots(m)[0].outcome,'invalid');assert.ok(!m.data.battle.hits.includes(f.target));
});
test('weapon leaving after initiation still draws but loses its continuous total bonus',()=>{
 const f=fixture('1_159');let m=initiated(f,[1]);state.moveCard(m,f.weapon,'lost');m=boundary(m,'weapon-fired');assert.equal(shots(m)[0].total,1);assert.equal(shots(m)[0].modifier,0);
});
test('host returning during deployment fails without a refund',()=>{
 const f=fixture('1_158','deploy',false);let m=step(f.m,'space-weapon:equip:'+f.weapon+':'+f.host);const force=m.players.light.force.length;state.moveCard(m,f.host,'hand');state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;m=seek(m,x=>x.cards[f.weapon].zone==='lost');assert.equal(m.players.light.force.length,force);
});
test('two draws survive serialization and respect the physical destiny limit',()=>{
 const f=fixture('1_323');let m=boundary(initiated(f,[5,5]),'about-to-draw-destiny');mod('destiny-limits').setDestinyLimit(m,shots(m)[0].scope,1);m=boundary(clone(m),'weapon-fired');assert.equal(shots(m)[0].total,0);assert.equal(shots(m)[0].draws[1].skipped,'limit');
});
test('all failed destiny draws produce no hit and a null total',()=>{
 const f=fixture('1_323');const m=fire(f,[]);assert.equal(shots(m)[0].total,null);assert.equal(shots(m)[0].outcome,'miss');
});
test('hit ship forfeiture loses crew and weapons with it',()=>{
 const f=fixture('1_323');const pilot=f.lightPilot;state.moveCard(f.m,pilot,'table');Object.assign(f.m.cards[pilot],{attachedTo:f.target,aboardRole:'pilot',location:f.site});const gun=pull(f.m,'light','1_158','table',f.site);f.m.cards[gun].attachedTo=f.target;
 let m=boundary(fire(f,[5,5]),'battle-damage');m=step(priority(m,'light'),'forfeit:'+f.target);m=seek(m,x=>[f.target,pilot,gun].every(c=>x.cards[c].zone==='lost'));for(const c of [pilot,gun])assert.equal(m.cards[c].zone,'lost');
});
test('malformed saved weapon records and continuation indices are rejected',()=>{
 const f=fixture();const m=initiated(f,[5]);for(const edit of [x=>shots(x)[0].targetRef.id=f.host,x=>shots(x)[0].draws={},x=>shots(x)[0].modifier=99,x=>x.stack.find(r=>r.action?.handler==='space-weapon:fire').action.payload.index=99]){const bad=clone(m);edit(bad);assert.throws(()=>rules.validate(bad));}
});

for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/starship-weapons-results.json',import.meta.url))))test('executed GEMP starship weapon comparison '+JSON.stringify([row.blueprint,row.capital,row.destiny]),()=>{
 const f=fixture(row.blueprint,'deploy',false,row.capital),before=f.m.players[f.side].force.length;
 let m=seek(step(f.m,'space-weapon:equip:'+f.weapon+':'+f.host),x=>x.stack.length===1);
 const deploymentCost=before-m.players[f.side].force.length,second=pull(m,f.side,row.blueprint,'table',f.site);m.cards[second].attachedTo=f.host;
 m.turn.phase='battle';m.stack[0].priority=f.side;m.stack[0].passes=0;f.m=m;const force=m.players[f.side].force.length;
 m=fire(f,row.blueprint==='1_323'?[row.destiny,row.destiny]:[row.destiny]);m=priority(boundary(m,'battle-weapons'),f.side);
 assert.deepEqual({blueprint:row.blueprint,capital:row.capital,destiny:row.destiny,deploymentCost,firingCost:force-m.players[f.side].force.length-1,hit:m.data.battle.hits.includes(f.target),forfeit:mod('board').forfeit(m,f.target),sameWeaponAvailable:ids(m).includes('space-weapon:fire:'+f.weapon+':'+f.target),secondWeaponAvailable:ids(m).includes('space-weapon:fire:'+second+':'+f.target)},row);
});
for(const cancel of [false,true])test('CZ-3 grants aboard starship weapon react; canceled '+cancel,()=>{
 const f=fixture('1_158','battle',false),cz=pull(f.m,'light','1_6','table',f.site);Object.assign(f.m.cards[cz],{attachedTo:f.host,aboardRole:'passenger'});f.m.turn.side='dark';f.m.stack[0].priority='dark';
 let m=seek(step(f.m,'battle:'+f.site),x=>x.stack.at(-2)?.action?.handler==='battle:begin'&&!x.stack.at(-2).awaitingResponses&&x.stack.at(-1)?.event===undefined);m=priority(m,'light');
 const id='space-weapon:equip:'+f.weapon+':'+f.host+':react';assert.ok(ids(m).includes(id));const force=m.players.light.force.length;m=step(m,id);if(cancel)m.stack.find(r=>r.action?.handler==='space-weapon:equip').cancelled=true;
 m=seek(m,x=>x.cards[f.weapon].zone===(cancel?'hand':'table'));assert.equal(m.players.light.force.length,force-1);assert.ok(mod('ground').usage(m).reacted.includes(f.weapon));assert.equal(m.cards[f.weapon].attachedTo,cancel?undefined:f.host);
});
