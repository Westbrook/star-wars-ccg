import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,endControl,repair,finish,state,step,seek,priority,prompt,ids,rules,clone,load} from './repair-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const ion=(m,id)=>mod('stat-modifiers').ionizedShip(m,id),power=(m,id)=>mod('occupancy').vesselPower(m,id),maneuver=(m,id)=>mod('piloting').vesselManeuver(m,id),hyper=(m,id)=>mod('piloting').vesselHyperspeed(m,id);
for(const side of ['light','dark'])for(const mode of ['fighter','capital','landed'])test('required R5 repair timing '+side+' '+mode,()=>{
 const f=fixture(side,mode);assert.ok(ion(f.m,f.ship));assert.ok(!ids(f.m).some(id=>id.startsWith('ion-repair:')));let m=endControl(f.m);assert.ok(prompt(m).mandatory);assert.ok(!ids(m).includes('pass'));m=finish(repair(clone(m)));assert.equal(ion(m,f.ship),false);assert.ok(hyper(m,f.ship)>0);assert.equal(m.cards[f.droid].attachedTo,f.ship);
});
for(const side of ['light','dark'])for(const mode of ['fighter','capital'])test('R5 aboard bonuses and noncumulative copies '+side+' '+mode,()=>{
 const f=fixture(side,mode,1,false),p=power(f.m,f.ship),h=hyper(f.m,f.ship),man=maneuver(f.m,f.ship);state.moveCard(f.m,f.droid,'hand');assert.equal(power(f.m,f.ship),p-1);if(man!==null)assert.equal(maneuver(f.m,f.ship),man-1);assert.equal(hyper(f.m,f.ship),h);
 const g=fixture(side,'capital',2,false),one=power(g.m,g.ship);state.moveCard(g.m,g.droids[0],'hand');assert.equal(power(g.m,g.ship),one);
});
test('R5 deploys into passenger capacity for two Force and provides navigation',()=>{
 const f=fixture('light','fighter',1,false);state.moveCard(f.m,f.droid,'hand');f.m.turn.phase='deploy';const before=f.m.players.light.force.length;let m=step(f.m,'vessel:aboard:'+f.droid+':'+f.ship+':passenger');m=seek(m,x=>x.cards[f.droid].zone==='table');assert.equal(before-m.players.light.force.length,2);assert.equal(m.cards[f.droid].aboardRole,'passenger');assert.equal(mod('piloting').hasNavigation(m,f.ship),true);
});
for(const mode of ['off-ship','suppressed','undamaged','opponent-control'])test('repair is not offered '+mode,()=>{
 const f=fixture();if(mode==='off-ship'){state.moveCard(f.m,f.droid,'hand');state.moveCard(f.m,f.droid,'table');f.m.cards[f.droid].location=f.site;}if(mode==='suppressed')mod('game-text').suppressGameText(f.m,f.ship,f.droid);if(mode==='undamaged')mod('stat-modifiers').restoreIonDamage(f.m,f.ship);if(mode==='opponent-control'){f.m.turn.side='dark';f.m.stack[0].priority='dark';}
 const m=seek(f.m,x=>x.turn.phase==='deploy');assert.ok(!ids(m).some(id=>id.startsWith('ion-repair:')));assert.equal(ion(m,f.ship),mode!=='undamaged');
});
test('initiated repair survives droid departure',()=>{const f=fixture();let m=repair(endControl(f.m));state.moveCard(m,f.droid,'hand');m=finish(m);assert.equal(ion(m,f.ship),false);});
test('returned target does not receive an older pending repair',()=>{const f=fixture();let m=repair(endControl(f.m));mod('table').returnToHand(m,[f.ship]);state.moveCard(m,f.ship,'table');m.cards[f.ship].location=f.planet;mod('stat-modifiers').ionizeShip(m,f.weapon,f.ship);m=seek(m,x=>x.turn.phase==='deploy');assert.equal(ion(m,f.ship),true);});
test('repair preserves a separate reset and additional maneuver bonus',()=>{const f=fixture();mod('stat-modifiers').addStatModifier(f.m,f.droid,f.ship,'hyperspeed','reset',1,{duration:'target',function:'unrelated'});mod('stat-modifiers').addStatModifier(f.m,f.droid,f.ship,'maneuver','add',2);const m=finish(repair(endControl(f.m)));assert.equal(hyper(m,f.ship),1);assert.equal(maneuver(m,f.ship),6);});
test('canceled required repair cannot repeat in its phase boundary',()=>{const f=fixture();let m=repair(endControl(f.m));m.stack.find(r=>r.action?.handler==='ion-repair:restore').cancelled=true;m=seek(m,x=>x.turn.phase==='deploy');assert.equal(ion(m,f.ship),true);});
test('malformed repair source target and phase bindings are rejected',()=>{const f=fixture(),m=repair(endControl(f.m));for(const edit of [p=>p.target.id=f.droid,p=>p.window++,p=>p.turn++,p=>p.source.version++]){const bad=clone(m);edit(bad.stack.find(r=>r.action?.handler==='ion-repair:restore').action.payload);assert.throws(()=>rules.validate(bad));}});
test('two damaged ships have separately ordered required repairs',()=>{
 const f=fixture(),ship=mod('definitions').definition('1_140');assert.equal(ship.type,'Starship');const second=Object.values(f.m.cards).find(c=>c.blueprint==='1_140'&&c.zone==='reserve').id,droid=Object.values(f.m.cards).find(c=>c.blueprint==='2_15'&&c.zone==='reserve').id;state.moveCard(f.m,second,'table');f.m.cards[second].location=f.planet;state.moveCard(f.m,droid,'table');Object.assign(f.m.cards[droid],{attachedTo:second,aboardRole:'passenger',location:f.planet});mod('stat-modifiers').ionizeShip(f.m,f.weapon,second);
 let m=endControl(f.m);assert.equal(ids(m).filter(id=>id.startsWith('ion-repair:')).length,2);m=finish(step(m,ids(m).find(id=>id.includes(':'+droid+':'))));assert.equal(ion(m,second),false);assert.equal(ion(m,f.ship),true);m=seek(clone(m),x=>ids(x).some(id=>id.startsWith('ion-repair:')));m=finish(repair(m));assert.equal(ion(m,f.ship),false);
});
test('multiple R5 copies on one ship do not repeat its completed repair',()=>{const f=fixture('dark','capital',2);let m=endControl(f.m);assert.equal(ids(m).filter(id=>id.startsWith('ion-repair:')).length,2);m=finish(repair(m));m=seek(m,x=>x.turn.phase==='deploy');assert.equal(ion(m,f.ship),false);assert.ok(!ids(m).some(id=>id.startsWith('ion-repair:')));});
for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/repair-results.json',import.meta.url))))test('executed GEMP R5 comparison '+row.side+' '+row.mode,()=>{
 const f=fixture(row.side,['capital','duplicate'].includes(row.mode)?'capital':row.mode==='landed'?'landed':'fighter',row.mode==='duplicate'?2:1,false);let m=f.m;for(const id of f.droids)state.moveCard(m,id,'hand');m.turn.phase='deploy';const force=m.players[f.side].force.length;
 for(const id of f.droids)m=seek(step(priority(m,f.side),'vessel:aboard:'+id+':'+f.ship+':passenger'),x=>x.stack.length===1);
 const deploymentCost=force-m.players[f.side].force.length;m.turn.phase='control';m.stack[0].priority=f.side;m.stack[0].passes=0;
 if(row.mode!=='undamaged')mod('stat-modifiers').ionizeShip(m,f.weapon,f.ship);
 if(row.mode==='off-ship'){state.moveCard(m,f.droid,'hand');state.moveCard(m,f.droid,'table');m.cards[f.droid].location=f.site;}
 if(row.mode==='suppressed')mod('game-text').suppressGameText(m,f.planet,f.droid);
 if(row.mode==='weapon-leaves')state.moveCard(m,f.weapon,'lost');
 const values=(m,prefix)=>({[prefix+'Power']:power(m,f.ship),[prefix+'Maneuver']:maneuver(m,f.ship)??0,[prefix+'Hyperspeed']:hyper(m,f.ship),[prefix+'Defense']:mod('defense').defenseValue(m,f.ship)});
 const before=values(m,'before');m=seek(m,x=>x.turn.phase==='deploy');const observed={side:row.side,mode:row.mode,deploymentCost,...before,...values(m,'after'),aboard:m.cards[f.droid].attachedTo===f.ship,droidNavigation:mod('piloting').hasAstromechNavigation(m,f.ship)};assert.deepEqual(observed,row);
});
