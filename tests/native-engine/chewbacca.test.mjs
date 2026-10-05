import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ground,damage,deployChewie,settle,mod,runtime,state,rules,clone,pull,prompt,ids,step,seek,boundary,priority,phase} from './chewbacca-fixture.mjs';
const stat=(m,id)=>({power:mod('board').power(m,id),maneuver:mod('piloting').vesselManeuver(m,id),immunity:mod('combat-modifiers').attritionImmunity(m,id)});
const repair=m=>ids(m).find(id=>id.startsWith('chewbacca:repair:'));
for(const mode of ['ground','pilot','passenger','landed'])test('Chewbacca actual deployment and Falcon pilot text '+mode,()=>{
 const f=fixture(mode),before=f.m.players.light.force.length;let m=deployChewie(f,mode==='ground'?f.site:f.ship,mode==='ground'?undefined:mode==='passenger'?'passenger':'pilot');
 assert.equal(before-m.players.light.force.length,4);assert.equal(mod('characteristics').isSpecies(m,f.chewie,'WOOKIEE'),true);assert.equal(mod('characteristics').hasCharacteristic(m,f.chewie,'SMUGGLER'),true);
 assert.equal(mod('persona').hasPersona(m,f.chewie,'CHEWIE'),true);assert.equal(mod('premiere-rules').premiereRules.supports('2_3'),false);
 if(mode==='pilot'){assert.equal(stat(m,f.ship).power,5);assert.equal(stat(m,f.ship).maneuver,5);assert.equal(stat(m,f.ship).immunity,5);}else assert.deepEqual([stat(m,f.ship).power,stat(m,f.ship).maneuver,stat(m,f.ship).immunity],[0,0,0]);
 rules.validate(clone(m));
});
test('Chewie gets power from Han at same location, including aboard a different vessel, but not another site',()=>{
 const f=fixture();let m=ground(f);assert.equal(mod('board').power(m,f.chewie),6);state.moveCard(m,f.han,'table');m.cards[f.han].location=f.site;assert.equal(mod('board').power(m,f.chewie),7);
 const vehicle=pull(m,'light','1_150','table',f.site);Object.assign(m.cards[f.han],{attachedTo:vehicle,aboardRole:'passenger'});assert.equal(mod('board').power(m,f.chewie),7);
 mod('game-text').suppressGameText(m,f.planet,f.han);assert.equal(mod('board').power(m,f.chewie),7);m.cards[f.han].location=f.adj;assert.equal(mod('board').power(m,f.chewie),6);m.cards[f.han].location=f.site;mod('game-text').suppressGameText(m,f.planet,f.chewie);assert.equal(mod('board').power(m,f.chewie),6);
});
test('Chewie matching Falcon does not grant Han’s if-unable destiny',()=>{
 const f=fixture();let m=deployChewie(f,f.ship,'pilot'),enemy=pull(m,'dark','1_305','table',f.planet);m=phase(m,'light','battle');m=boundary(step(m,'battle:'+f.planet),'battle-weapons');assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,0);
 mod('game-text').suppressGameText(m,f.planet,f.chewie);assert.deepEqual([stat(m,f.ship).power,stat(m,f.ship).maneuver,stat(m,f.ship).immunity],[3,4,5]);
});
for(const bp of ['1_5','1_149'])test('Chewbacca mandatory hit forfeiture to Used '+bp,()=>{
 const f=damage(fixture(),bp);let m=f.m;mod('battle').battle(m).hits.push(f.target);const before=mod('battle').battle(m).damage.light,value=mod('board').forfeit(m,f.target);
 m=boundary(step(m,'forfeit:'+f.target),'about-to-forfeit');assert.equal(prompt(m).mandatory,true);assert.ok(repair(m));assert.ok(!ids(m).includes('pass'));m=step(m,repair(m));m=boundary(clone(m),'forfeited-to-used');
 assert.equal(m.cards[f.target].zone,'used');assert.equal(before-mod('battle').battle(m).damage.light,Math.min(before,value));rules.validate(m);
});
for(const kind of ['unhit','suppressed','elsewhere','non-droid','opponent','space'])test('Chewbacca replacement is absent for '+kind,()=>{
 const f=damage(fixture(),kind==='non-droid'?'1_28':'1_5');let m=f.m;if(kind!=='unhit')mod('battle').battle(m).hits.push(f.target);
 if(kind==='suppressed')mod('game-text').suppressGameText(m,f.planet,f.chewie);if(kind==='elsewhere')m.cards[f.chewie].location=f.adj;if(kind==='opponent'){m.cards[f.chewie].originalOwner='light';m.cards[f.chewie].owner='dark';}if(kind==='space'){m.cards[f.chewie].location=f.planet;m.cards[f.target].location=f.planet;}
 const w={kind:'window',serial:999,timing:'response',event:{kind:'about-to-lose',cards:[f.target],cardRefs:[mod('identity').referenceCard(m,f.target)]},priority:'light',passes:0,completed:[]};m.stack.push({kind:'resolution',actor:'light',cancelled:false,action:{id:'test-loss',handler:'test:lose',label:'fixture',payload:{}}},w);assert.deepEqual(mod('chewbacca').chewbaccaAutomatic(m,w),[]);
});
for(const bp of ['1_5','1_149','1_147'])test('hit card outside battle is replaced into Used at Chewie’s site '+bp,()=>{
 const f=damage(fixture(),bp);let m=f.m;mod('battle').battle(m).hits.push(f.target);mod('ground').record(m).barriers[f.target]=m.turn.number;
 assert.equal(mod('hit-departure').scheduleHitDeparture(m),true);m=seek(m,x=>!!repair(x));assert.equal(prompt(m).mandatory,true);m=step(m,repair(m));m=seek(clone(m),x=>x.cards[f.target].zone==='used');assert.equal(m.players.light.used.filter(id=>id===f.target).length,1);assert.ok(!m.players.light.lost.includes(f.target));rules.validate(m);
});
test('initiated Chewbacca repair survives source departure and rejects another target instance',()=>{
 for(const leave of ['source','target']){const f=damage(fixture());let m=f.m;mod('battle').battle(m).hits.push(f.target);m=boundary(step(m,'forfeit:'+f.target),'about-to-forfeit');m=step(m,repair(m));state.moveCard(m,leave==='source'?f.chewie:f.target,'hand');if(leave==='target'){state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;}
 m=seek(m,x=>!x.stack.some(r=>r.kind==='resolution'&&(r.action.handler.startsWith('chewbacca:')||r.action.handler.startsWith('forfeiture:'))));assert.equal(m.cards[f.target].zone,leave==='source'?'used':'table');rules.validate(m);}
});
test('actual blaster hit continues through mandatory Chewbacca forfeiture replacement',async()=>{
 const {shotFixture}=await import('./chewbacca-fixture.mjs');const f=shotFixture();let m=boundary(step(f.m,'fire:'+f.gun+':'+f.target),'weapon-fired');assert.ok(mod('battle').battle(m).hits.includes(f.target));m=priority(boundary(m,'battle-damage'),'light');m=boundary(step(m,'forfeit:'+f.target),'about-to-forfeit');assert.equal(prompt(m).mandatory,true);m=step(m,repair(m));m=boundary(clone(m),'forfeited-to-used');assert.equal(m.cards[f.target].zone,'used');
});

for(const expected of JSON.parse(fs.readFileSync(new URL('./gemp/chewbacca-pilot-results.json',import.meta.url))))test('executed Chewie pilot reference '+expected.mode,()=>{
 const mode=expected.mode,f=fixture(mode);let m=f.m;if(mode==='other-ship')f.ship=pull(m,'light','1_147','table',f.planet);
 if(['han','han-canceled'].includes(mode)){state.moveCard(m,f.han,'table');Object.assign(m.cards[f.han],{attachedTo:f.ship,aboardRole:'passenger',location:f.planet});}
 if(['ground','other-site'].includes(mode)){state.moveCard(m,f.han,'table');m.cards[f.han].location=mode==='ground'?f.site:f.adj;}
 if(mode==='effect'){const effect=pull(m,'light','1_65','table',f.planet);m.cards[effect].attachedTo=f.ship;}
 const before=m.players.light.force.length;m=deployChewie(f,['ground','other-site'].includes(mode)?f.site:f.ship,['ground','other-site'].includes(mode)?undefined:mode==='passenger'?'passenger':'pilot');
 if(mode.endsWith('canceled'))mod('game-text').suppressGameText(m,f.planet,mode==='han-canceled'?f.han:f.chewie);
 assert.deepEqual({mode,cost:before-m.players.light.force.length,chewiePower:mod('board').power(m,f.chewie),shipPower:stat(m,f.ship).power,maneuver:stat(m,f.ship).maneuver,forfeit:mod('board').forfeit(m,f.ship),immunity:stat(m,f.ship).immunity},expected);
});
for(const expected of JSON.parse(fs.readFileSync(new URL('./gemp/chewbacca-loss-results.json',import.meta.url))))test('executed Chewie loss reference '+expected.kind+'/'+expected.mode+'/'+expected.chewieCanceled,()=>{
 const f=damage(fixture(),expected.kind==='droid'?'1_5':'1_149');let m=f.m;mod('battle').battle(m).hits.push(f.target);if(expected.chewieCanceled)mod('game-text').suppressGameText(m,f.planet,f.chewie);
 if(expected.mode==='forfeit')m=step(m,'forfeit:'+f.target);else {mod('ground').record(m).barriers[f.target]=m.turn.number;assert.equal(mod('hit-departure').scheduleHitDeparture(m),true);}
 m=seek(m,x=>['used','lost'].includes(x.cards[f.target].zone));const observed={kind:expected.kind,mode:expected.mode,chewieCanceled:expected.chewieCanceled,used:m.cards[f.target].zone==='used',lost:m.cards[f.target].zone==='lost',zone:m.cards[f.target].zone==='used'?'TOP_OF_USED_PILE':'TOP_OF_LOST_PILE',hitAfter:mod('battle').battle(m).hits.includes(f.target)};
 if(expected.mode==='exclude'&&!expected.chewieCanceled){
  // Pinned GEMP constructs this required action but never returns it. Official
  // AR p106 explicitly replaces any such about-to-be-lost hit, not just forfeits.
  assert.equal(expected.lost,true);assert.equal(expected.used,false);assert.deepEqual(observed,{...expected,lost:false,used:true,zone:'TOP_OF_USED_PILE'});
 }else assert.deepEqual(observed,expected);
});
test('Chewie saves a hit vehicle itself while crew and their attachments are lost in owner order',()=>{
 const f=damage(fixture(),'1_149');let m=f.m;state.moveCard(m,f.han,'table');Object.assign(m.cards[f.han],{attachedTo:f.target,aboardRole:'passenger',location:f.site});const gun=pull(m,'light','1_152','table',f.site);m.cards[gun].attachedTo=f.han;
 mod('battle').battle(m).hits.push(f.target);mod('ground').record(m).barriers[f.target]=m.turn.number;mod('hit-departure').scheduleHitDeparture(m);m=seek(m,x=>!!repair(x));m=step(m,repair(m));m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[f.target].zone,'leaving');assert.ok(!ids(m).includes('place-lost:'+f.target));
 m=step(clone(m),'place-lost:'+gun);m=seek(m,x=>x.cards[f.target].zone==='used');assert.equal(m.cards[f.han].zone,'lost');assert.equal(m.cards[gun].zone,'lost');m=seek(m,x=>!x.stack.some(r=>r.kind==='resolution'&&r.action.handler.startsWith('hit-departure:')));rules.validate(m);
});
test('Chewie replacement rejects forged target, source, window and payment across refresh',()=>{
 const f=damage(fixture());let m=f.m;mod('battle').battle(m).hits.push(f.target);m=boundary(step(m,'forfeit:'+f.target),'about-to-forfeit');m=step(m,repair(m));
 for(const edit of [r=>r.action.payload.target.id=f.chewie,r=>r.action.payload.source.id=f.han,r=>r.action.payload.window++,r=>r.action.payment={light:1}]){const bad=clone(m);edit(bad.stack.find(r=>r.kind==='resolution'&&r.action.handler==='chewbacca:repair'));assert.throws(()=>rules.validate(bad));}
 for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));
});
