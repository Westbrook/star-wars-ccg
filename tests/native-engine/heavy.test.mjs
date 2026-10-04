import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ready,destiny,fire,done,pull,phase,priority,step,seek,load,rules,runtime,board,state,ids,prompt,clone} from './heavy-fixture.mjs';
const artillery=load(new URL('../../lib/native-engine/artillery.ts',import.meta.url)),weaponState=load(new URL('../../lib/native-engine/weapon-state.ts',import.meta.url));
for(const target of ['character','vehicle','fighter'])for(const remote of [false,true])test('AT-AT Cannon targets '+target+(remote?' at adjacent battle':' at same site'),()=>{
 const f=destiny(ready(fixture({target,remote}))),force=f.m.players.dark.force.length;const m=done(clone(fire(f))),s=m.data.heavyShots.at(-1);assert.equal(s.total,target==='character'?6:target==='vehicle'?7:5);assert.equal(s.defense,target==='fighter'?3:load(new URL('../../lib/native-engine/defense.ts',import.meta.url)).defenseValue(m,f.victim));assert.equal(s.outcome,'hit');assert.equal(m.cards[f.victim].zone,'table');assert.ok(m.data.battle.hits.includes(f.victim));assert.equal(force-m.players.dark.force.length,2);assert.equal(m.data.battle.participants.dark.includes(f.walker),!remote);assert.ok(!ids(priority(m,'dark')).some(id=>id.startsWith('heavy:fire:'+f.gun+':')));
});
for(const source of ['generator','droid','fusion'])test('Golan fires using '+source+' power and consumes its warrior weapon allowance',()=>{
 const f=destiny(ready(fixture({artillery:true,source})));assert.ok(artillery.artilleryPowerSources(f.m,f.gun).length);const m=done(clone(fire(f)));assert.equal(m.data.heavyShots.at(-1).total,7);assert.equal(m.data.heavyShots.at(-1).outcome,'hit');assert.equal(weaponState.canUseWeapon(m,f.rifle),false);assert.ok(m.data.battle.participants.light.includes(f.gun));
});
test('adjacent artillery fires without contributing battle power or participating',()=>{
 const f=destiny(ready(fixture({artillery:true,remote:true,source:'droid'})));assert.ok(!f.m.data.battle.participants.light.includes(f.gun));assert.ok(!f.m.data.battle.participants.light.includes(f.warrior));const m=done(fire(f));assert.equal(m.data.heavyShots.at(-1).total,8);assert.equal(m.data.heavyShots.at(-1).outcome,'hit');
});
test('artillery without a present power source cannot fire',()=>{
 const f=ready(fixture({artillery:true,source:'none'}));assert.equal(artillery.artilleryPowerSources(f.m,f.gun).length,0);assert.ok(!ids(f.m).some(id=>id.startsWith('heavy:fire:'+f.gun)));
});
test('Golan deploys to an exterior planet site for three Force',()=>{
 const f=fixture({artillery:true});state.moveCard(f.m,f.gun,'hand');f.m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);f.m=priority(f.m,'light');const before=f.m.players.light.force.length;let m=step(f.m,'heavy:deploy:'+f.gun+'::'+f.gen);m=seek(clone(m),x=>x.stack.length===1);assert.equal(m.cards[f.gun].attachedTo,f.gen);assert.equal(before-m.players.light.force.length,3);
});
const textRules=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const stats=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));
for(const artilleryShot of [false,true])for(const remote of [false,true])test((artilleryShot?'artillery':'cannon')+' fires into creature assault '+(remote?'remotely':'locally')+' and restores its pending draw',()=>{
 const f=fixture({artillery:artilleryShot,remote,source:artilleryShot&&remote?'droid':'generator'});const creature=pull(f.m,'dark','3_93','table',f.site);f.victim=creature;
 f.m=phase(f.m,'battle');if(f.side==='light')f.m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);f.m=priority(f.m,f.side);f.m=step(f.m,'creature:begin:'+creature+':'+f.site+':assault:'+f.side);f.m=priority(seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons'),f.side);destiny(f);
 let m=seek(fire(f),x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');rules.validate(clone(m));m=seek(clone(m),x=>x.data.heavyShots.at(-1).stage==='complete');assert.equal(m.data.heavyShots.at(-1).outcome,'hit');assert.equal(m.cards[creature].zone,'table');assert.equal(m.data.creatureAttack.hit,true);m=seek(m,x=>x.data.creatureAttack.stage==='complete');assert.equal(m.cards[creature].zone,'lost');
});
test('adjacent artillery cannot intervene when the creature initiates a hunt',()=>{
 const f=fixture({artillery:true,remote:true,source:'droid'}),creature=pull(f.m,'dark','3_93','table',f.site);f.m=priority(phase(f.m,'battle'),'dark');f.m=step(f.m,'creature:begin:'+creature+':'+f.site+':hunt:light');f.m=priority(seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons'),'light');assert.ok(!ids(f.m).some(id=>id.startsWith('heavy:fire:')));
});
test('artillery can forfeit its printed value toward battle losses',()=>{
 const f=ready(fixture({artillery:true}));let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');m=priority(m,'light');assert.ok(ids(m).includes('forfeit:'+f.gun));const before=m.data.battle.damage.light;m=step(m,'forfeit:'+f.gun);m=seek(clone(m),x=>x.cards[f.gun].zone==='lost');assert.equal(m.data.battle.damage.light,Math.max(0,before-3));
});
test('artillery needs its own present power source, even when printed source text is canceled',()=>{
 const f=ready(fixture({artillery:true,source:'droid'}));textRules.suppressGameText(f.m,f.perimeter,f.powerSource);assert.deepEqual(artillery.artilleryPowerSources(f.m,f.gun),[f.powerSource]);board.moveWithAttachments(f.m,f.powerSource,f.trench);assert.deepEqual(artillery.artilleryPowerSources(f.m,f.gun),[]);pull(f.m,'dark','1_175','table',f.site);assert.deepEqual(artillery.artilleryPowerSources(f.m,f.gun),[]);
});
test('canceling Main Power Generators text removes artillery power',()=>{
 const f=ready(fixture({artillery:true}));textRules.suppressGameText(f.m,f.perimeter,f.gen);assert.deepEqual(artillery.artilleryPowerSources(f.m,f.gun),[]);assert.ok(!ids(f.m).some(id=>id.startsWith('heavy:fire:')));
});
for(const change of ['source-leaves','target-returns','equal','cancel-draw','cancel-shot'])test('heavy firing handles '+change+' after refresh',()=>{
 const f=destiny(ready(fixture({target:'fighter'})));let m=fire(f);
 if(change==='cancel-shot')m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='heavy:fire').cancelled=true;
 else {
  m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');
  if(change==='source-leaves')state.moveCard(m,f.gun,'lost');
  if(change==='target-returns'){state.moveCard(m,f.victim,'hand');state.moveCard(m,f.victim,'table');m.cards[f.victim].location=f.site;}
  if(change==='equal')m.stack.at(-2).action.payload.draw.value=3;
  if(change==='cancel-draw')load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url)).cancelPendingDestiny(m,m.stack.at(-2));
 }
 m=done(clone(m));assert.equal(m.data.heavyShots.at(-1).outcome,change==='cancel-shot'?'canceled':change==='target-returns'?'invalid':change==='source-leaves'?'hit':'miss');
});
test('a cannon target-type total modifier expires when its original weapon leaves',()=>{
 const f=destiny(ready(fixture()));let m=seek(fire(f),x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');state.moveCard(m,f.gun,'lost');m=done(clone(m));assert.equal(m.data.heavyShots.at(-1).modifier,0);assert.equal(m.data.heavyShots.at(-1).total,5);
});
for(const field of ['index','card','target','user'])test('pending heavy destiny rejects a corrupted '+field+' binding',()=>{
 const f=destiny(ready(fixture()));const m=seek(fire(f),x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');const p=m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='destiny:draw').action.payload.next.payload;p[field]=field==='index'?99:f.gen;assert.throws(()=>rules.validate(m),/heavy weapon/);
});
const fs=await import('node:fs');const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/heavy-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP heavy weapons observation '+row.case,()=>{
 if(row.case==='power'){
  const f=fixture({artillery:true});const powered=()=>artillery.artilleryPowerSources(f.m,f.gun).length>0;const generator=powered();f.m.cards[f.gun].location=f.trench;f.m.cards[f.gun].attachedTo=f.trench;const adjacentGenerator=powered();const droid=pull(f.m,'light','3_8','table',f.trench);const presentDroid=powered();board.moveWithAttachments(f.m,droid,f.gen);assert.deepEqual({case:'power',generator,adjacentGenerator,presentDroid,adjacentDroid:powered()},row);return;
 }
 const [kind,target,range]=row.case.split('-'),f=destiny(ready(fixture({artillery:kind==='golan',target,remote:range==='adjacent',source:kind==='golan'&&range==='adjacent'?'droid':'generator'})));const before=f.m.players[f.side].force.length,user=f.artillery?f.warrior:f.walker;let other=f.rifle;if(!f.artillery){other=pull(f.m,'dark','3_158','table',f.origin);f.m.cards[other].attachedTo=f.walker;}
 const baseDefense=load(new URL('../../lib/native-engine/defense.ts',import.meta.url)).defenseValue(f.m,f.victim),userParticipating=f.m.data.battle.participants[f.side].includes(user);const m=priority(done(fire(f)),f.side);assert.deepEqual({case:row.case,hit:m.data.heavyShots.at(-1).outcome==='hit',forceSpent:before-m.players[f.side].force.length,userParticipating,baseDefense,repeatAvailable:ids(m).some(id=>id.startsWith('heavy:fire:'+f.gun+':')),otherWeaponUsable:weaponState.canUseWeapon(m,other,user)},row);
});
test('artillery cannot deploy using the former exterior icon of a blown-away site',()=>{
 const f=fixture({artillery:true});state.moveCard(f.m,f.gun,'hand');f.m.cards[f.gen].blownAway=true;f.m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');assert.ok(!ids(f.m).includes('heavy:deploy:'+f.gun+'::'+f.gen));
});
test('a same-site cannon user excluded from an assault cannot fire',()=>{
 const f=fixture(),creature=pull(f.m,'dark','3_93','table',f.site);f.m=priority(phase(f.m,'battle'),'dark');f.m.data.ground={turn:f.m.turn.number,moved:[],reacted:[],drained:[],barriers:{[f.walker]:f.m.turn.number}};f.m=step(f.m,'creature:begin:'+creature+':'+f.site+':assault:dark');f.m=priority(seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons'),'dark');assert.ok(!f.m.data.creatureAttack.ships.some(r=>r.id===f.walker));assert.ok(!ids(f.m).some(id=>id.startsWith('heavy:fire:'+f.gun)));
});
test('heavy conformance receipt fingerprints the executed harness and observations',async()=>{
 const crypto=await import('node:crypto'),p=JSON.parse(fs.readFileSync(new URL('./gemp/heavy-provenance.json',import.meta.url)));for(const [file,hash]of Object.entries(p.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.supports('3_75'),false);
});
