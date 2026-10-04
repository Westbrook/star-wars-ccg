import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deploy,attack,pull,phase,priority,step,seek,load,rules,runtime,location} from './ground-creature-fixture.mjs';
const {ids,prompt,clone}=await import('./noble-fixture.mjs');
const {defenseValue}=load(new URL('../../lib/native-engine/defense.ts',import.meta.url));
const {creatureHabitat,creatureBlocksLandspeed}=load(new URL('../../lib/native-engine/ground-creatures.ts',import.meta.url));
const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const {presence}=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const {transitEligible}=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const {moveCard}=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const finish=m=>seek(m,x=>x.data.creatureAttack?.stage==='complete');
for(const side of ['light','dark'])test(side+' ground creature deploys through payment at a habitat without presence',()=>{
 const f=fixture(side);assert.equal(presence(f.m,side,f.site),false);assert.equal(creatureHabitat(f.m,f.creature,f.site),true);assert.equal(creatureHabitat(f.m,f.creature,f.mobile),false);
 const before=f.m.players[side].force.length;deploy(f);assert.equal(f.m.cards[f.creature].location,f.site);assert.equal(f.m.players[side].force.length,before-(side==='light'?2:3));assert.equal(presence(f.m,side,f.site),false);assert.equal(defenseValue(f.m,f.creature),side==='light'?4:5);
});
for(const side of ['light','dark'])test(side+' creature hunts and eats an opposing non-droid; own characters and droids excluded',()=>{
 const f=deploy(fixture(side));const target=pull(f.m,side==='light'?'dark':'light',side==='light'?'1_194':'1_28','table',f.site);pull(f.m,side,side==='light'?'1_28':'1_194','table',f.site);
 let m=attack(f);assert.deepEqual(m.data.creatureAttack.ships.map(r=>r.id),[target]);m=finish(m);assert.equal(m.cards[target].zone,'lost');assert.equal(m.data.creatureAttack.outcome,'eaten');assert.equal(m.data.creatureAttack.ferocity,side==='light'?3:4);assert.equal(m.data.creatureAttack.ferocityDraws.length,0);
});
test('ground hunt excludes droids and characters aboard open vehicles',()=>{
 const f=deploy(fixture('dark'));const droid=pull(f.m,'light','1_6','table',f.site),pilot=pull(f.m,'light','1_11','table',f.site),vehicle=pull(f.m,'light','1_149','table',f.site);f.m.cards[pilot].attachedTo=vehicle;f.m.cards[pilot].aboardRole='driver';let m=priority(phase(f.m,'battle'),'dark');assert.ok(!ids(m).some(id=>id.startsWith('creature:begin:')));assert.equal(m.cards[droid].zone,'table');
});
test('assault combines present characters, allows own creature and adds defense only to creature defender',()=>{
 const f=deploy(fixture());const luke=pull(f.m,'light','101_2','table',f.site),han=pull(f.m,'light','1_11','table',f.site);let m=attack(f,'assault','light');assert.deepEqual(new Set(m.data.creatureAttack.ships.map(r=>r.id)),new Set([luke,han]));m=seek(m,x=>x.stack.at(-1)?.handler==='creature:destiny');m=step(m,'attack-skip');m=finish(m);assert.equal(m.data.creatureAttack.totals.creature,7);assert.equal(m.data.creatureAttack.outcome,'survived');assert.equal(m.cards[f.creature].zone,'table');
});
test('successful ground assault loses creature and draws only attack destiny',()=>{
 const f=deploy(fixture());pull(f.m,'light','101_2','table',f.site);pull(f.m,'light','1_11','table',f.site);const die=pull(f.m,'light','1_70','hand');moveCard(f.m,die,'reserve');let m=attack(f,'assault','light');m=seek(m,x=>x.stack.at(-1)?.handler==='creature:destiny');m=step(m,'attack-draw');m=finish(m);assert.equal(m.cards[f.creature].zone,'lost');assert.equal(m.data.creatureAttack.outcome,'creature-lost');assert.equal(m.cards[die].zone,'used');assert.equal(m.data.creatureAttack.ferocityDraws.length,0);
});
test('Worrt blocks opposing landspeed but leaves docking-bay transit eligible; cancellation restores movement',()=>{
 const f=deploy(fixture());const target=pull(f.m,'dark','1_194','table',f.site);assert.equal(creatureBlocksLandspeed(f.m,target),true);assert.ok(transitEligible(f.m,'dark',f.site).includes(target));
 f.m.cards[target].location=f.otherSite;let m=seek(f.m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.stack.length===1);m.cards[target].location=f.site;m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('move:'+target+':')));suppressGameText(m,f.site,f.creature);assert.equal(creatureBlocksLandspeed(m,target),false);assert.ok(ids(m).some(id=>id.startsWith('move:'+target+':')));
});
test('Bubo at a generic Tatooine site does not prevent landspeed',()=>{const f=deploy(fixture('dark'));const target=pull(f.m,'light','1_28','table',f.site);assert.equal(creatureBlocksLandspeed(f.m,target),false);});
test('creature regular movement pays one, moves one adjacent site, and cannot repeat',()=>{
 const f=deploy(fixture());let m=priority(phase(f.m,'move'),'light');const before=m.players.light.force.length;assert.ok(ids(m).includes('ground-creature:move:'+f.creature+':'+f.otherSite));m=step(m,'ground-creature:move:'+f.creature+':'+f.otherSite);m=priority(seek(m,x=>x.stack.length===1),'light');assert.equal(m.cards[f.creature].location,f.otherSite);assert.equal(m.players.light.force.length,before-1);assert.ok(!ids(m).some(id=>id.startsWith('ground-creature:move:')));
});
test('canceled text permits hunting own characters while fixed printed ferocity remains',()=>{
 const f=deploy(fixture());const target=pull(f.m,'light','1_28','table',f.site);suppressGameText(f.m,f.site,f.creature);let m=attack(f,'hunt','light');m=finish(m);assert.equal(m.cards[target].zone,'lost');assert.equal(m.data.creatureAttack.ferocity,3);
});
test('ground creature saved deployment and attack references reject corruption',()=>{
 const f=fixture();let m=step(f.m,'ground-creature:deploy:'+f.creature+':'+f.site);const bad=clone(m);const frame=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='ground-creature:deploy');frame.action.source=f.site;assert.throws(()=>rules.validate(bad));f.m=priority(seek(m,x=>x.stack.length===1),'light');pull(f.m,'dark','1_194','table',f.site);m=attack(f);const bad2=clone(m);bad2.data.creatureAttack.slug.id=f.site;assert.throws(()=>rules.validate(bad2));
});
const {armedFixture}=await import('./ground-creature-fixture.mjs');
for(const side of ['light','dark'])for(const rifle of [false,true])test(side+' '+(rifle?'rifle hits':'blaster ties defense')+' its own creature and waits until after power to remove a hit',()=>{
 const f=armedFixture({side,rifle});const die=pull(f.m,side,side==='light'?'1_105':'1_262','hand');moveCard(f.m,die,'reserve');const before=f.m.players[side].force.length;
 let m=step(f.m,ids(f.m).find(id=>id.startsWith('creature-weapon:fire:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='weapon-fired');assert.equal(m.data.creatureShots.at(-1).hit,rifle);assert.equal(m.cards[f.creature].zone,'table');assert.equal(m.players[side].force.length,before-(rifle?2:1));
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');m=priority(m,side);assert.ok(!ids(m).some(id=>id.startsWith('creature-weapon:fire:')));m=finish(m);assert.equal(m.cards[f.creature].zone,rifle?'lost':'table');assert.equal(m.data.creatureAttack.outcome,'survived');assert.equal(m.data.creatureAttack.hitLost??false,rifle);assert.equal(m.cards[f.target].zone,'table');
});
test('hit hunting creature eats its victim before the creature is lost',()=>{
 const f=armedFixture({hunt:true});const die=pull(f.m,'dark','1_249','hand');moveCard(f.m,die,'reserve');let m=step(f.m,ids(f.m).find(id=>id.startsWith('creature-weapon:fire:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='attack-defeated');assert.equal(m.cards[f.creature].zone,'table');assert.equal(m.cards[f.target].zone,'table');assert.equal(m.data.creatureAttack.hit,true);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='card-eaten');assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[f.creature].zone,'table');m=finish(m);assert.equal(m.cards[f.creature].zone,'lost');assert.equal(m.data.creatureAttack.outcome,'eaten');
});
test('excluded characters cannot shoot into a hunt',()=>{
 const f=armedFixture({hunt:true});const other=pull(f.m,'dark','101_5','table',f.site),weapon=pull(f.m,'dark','1_317','table',f.site);f.m.cards[weapon].attachedTo=other;assert.ok(!ids(f.m).some(id=>id.includes(':'+weapon+':')));
});
test('weapon destiny remains bound and completes after the target leaves',()=>{
 const f=armedFixture();let m=step(f.m,ids(f.m).find(id=>id.startsWith('creature-weapon:fire:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');const bad=clone(m);const frame=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw');frame.action.payload.next.payload.target.version++;assert.throws(()=>rules.validate(bad));moveCard(m,f.creature,'hand');m=finish(m);assert.equal(m.data.creatureAttack.outcome,'ended');assert.equal(m.data.creatureShots.at(-1).hit,false);assert.equal(m.cards[f.creature].zone,'hand');assert.ok(m.data.creatureShots.at(-1).draw);
});
const fs=await import('node:fs');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/ground-creature-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP ground creature observation '+JSON.stringify({hunt:row.hunt,fire:row.fire}),()=>{
 const f=armedFixture({hunt:row.hunt});const die=pull(f.m,f.userSide,row.hunt?'1_249':'1_88','hand');moveCard(f.m,die,'reserve');const before=f.m.players[f.userSide].force.length;let m=f.m;
 if(row.fire)m=step(m,ids(m).find(id=>id.startsWith('creature-weapon:fire:')));
 m=finish(m);assert.deepEqual({hunt:row.hunt,fire:row.fire,creatureLost:m.cards[f.creature].zone==='lost',targetLost:m.cards[f.target].zone==='lost',hitDuring:!!m.data.creatureAttack.hit,firingCost:before-m.players[f.userSide].force.length},row);
});
test('about-to-hit is recoverable and a removed target does not acquire hit state',()=>{
 const f=armedFixture();const die=pull(f.m,'light','1_88','hand');moveCard(f.m,die,'reserve');let m=step(f.m,ids(f.m).find(id=>id.startsWith('creature-weapon:fire:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-hit');assert.equal(m.data.creatureAttack.hit,undefined);moveCard(m,f.creature,'hand');m=finish(m);assert.equal(m.data.creatureAttack.outcome,'ended');assert.equal(m.data.creatureShots.at(-1).hit,false);
});
test('Hoth and mobile sites are not Worrt habitats; uniqueness prevents a second play',()=>{
 const f=fixture('light',{light:['3_60','6_48']});const hoth=location(f.m,'light','3_60');assert.equal(creatureHabitat(f.m,f.creature,hoth),false);assert.ok(!ids(f.m).includes('ground-creature:deploy:'+f.creature+':'+hoth));const other=pull(f.m,'light','6_48','hand');deploy(f);assert.ok(!ids(f.m).some(id=>id.startsWith('ground-creature:deploy:'+other+':')));
});
test('fixed creature defense accepts shared modifiers without modifying printed ferocity',()=>{
 const f=deploy(fixture());const {addStatModifier}=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));addStatModifier(f.m,f.site,f.creature,'defense','add',2);assert.equal(defenseValue(f.m,f.creature),6);const target=pull(f.m,'light','1_28','table',f.site);const m=finish(attack(f,'assault','light'));assert.equal(m.data.creatureAttack.ferocity,3);assert.equal(m.data.creatureAttack.totals.creature,9);assert.equal(m.cards[target].zone,'table');
});
