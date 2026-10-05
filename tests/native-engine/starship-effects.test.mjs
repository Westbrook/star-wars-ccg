import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,action,deployed,values,mod,state,rules,clone,pull,ids,step,seek,phase,priority,settled} from './starship-effects-fixture.mjs';
const cases={han:[7,8,null,9,5],lando:[8,6,null,9,5],'other-pilot':[5,6,null,7,0],landed:[0,0,null,7,0],unpiloted:[0,0,null,7,0],'effect-canceled':[5,6,null,7,5],'pilot-canceled':[5,6,null,9,5],'ship-canceled':[7,8,null,9,0],'other-fighter':[2,5,null,2,0],capital:[5,null,6,8,0]};
for(const [mode,expected]of Object.entries(cases))test('Special Modifications actual normal deployment '+mode,()=>{
 const f=fixture(mode),before=f.m.players.light.force.length;assert.ok(ids(f.m).includes(action(f)));const m=deployed(f),v=values(f,m);
 assert.equal(before-m.players.light.force.length,1);assert.equal(m.cards[f.effect].attachedTo,f.ship);assert.deepEqual([v.power,v.maneuver,v.armor,v.forfeit,v.immunity],expected);assert.equal(v.effectOwner,'light');assert.deepEqual(values(f,clone(m)),v);rules.validate(clone(m));assert.equal(mod('premiere-rules').premiereRules.supports('1_65'),false);
});
test('Special Modifications targets your starship but not opponent ships, vehicles, characters or locations, and requires one Force',()=>{
 const enemy=fixture('opponent');assert.ok(!ids(enemy.m).includes(action(enemy)));
 const f=fixture();for(const target of [f.planet,f.pilot,f.crawler])assert.ok(!ids(f.m).includes('starship-effect:deploy:'+f.effect+':'+target));
 while(f.m.players.light.force.length)state.moveCard(f.m,f.m.players.light.force.at(-1),'used');assert.ok(!ids(f.m).includes(action(f)));
});
test('Special Modifications uniqueness, cost and target survive recovery and reject tampering',()=>{
 const f=fixture(),m=step(f.m,action(f));assert.equal(m.cards[f.effect].zone,'playing');
 for(const edit of [p=>p.target.id=f.pilot,p=>p.target.zone='hand',p=>p.target.version++]){const bad=clone(m);edit(bad.stack.find(r=>r.kind==='resolution'&&r.action.handler==='starship-effect:deploy').action.payload);assert.throws(()=>rules.validate(bad));}
 const bad=clone(m);bad.stack.find(r=>r.kind==='resolution'&&r.action.handler==='starship-effect:deploy').action.payment.light=0;assert.throws(()=>rules.validate(bad));
 const done=settled(m),other=pull(done,'light','1_65','hand');assert.ok(!ids(priority(done,'light')).some(id=>id.startsWith('starship-effect:deploy:'+other+':')));
});
test('canceled Effect deployment and a departed or redeployed target lose the paid Effect',()=>{
 for(const mode of ['cancel','depart','redeploy']){const f=fixture(),before=f.m.players.light.force.length;let m=step(f.m,action(f));
 if(mode==='cancel')m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='starship-effect:deploy').cancelled=true;
 else {mod('table').returnToHand(m,[f.ship]);m=settled(m);if(mode==='redeploy'){state.moveCard(m,f.ship,'table');m.cards[f.ship].location=f.planet;}}
 m=settled(m);assert.equal(m.cards[f.effect].zone,'lost');assert.equal(before-m.players.light.force.length,1);rules.validate(m);}
});
test('Falcon needs acting named pilots; suppression affects each source independently',()=>{
 const f=fixture();let m=deployed(f);m.cards[f.pilot].aboardRole='passenger';assert.deepEqual([values(f,m).power,values(f,m).maneuver,values(f,m).forfeit,values(f,m).immunity],[0,0,7,0]);
 m.cards[f.pilot].aboardRole='pilot';assert.equal(values(f,m).forfeit,9);
 mod('table').returnToHand(m,[f.effect]);assert.equal(values(f,m).maneuver,6);assert.equal(values(f,m).power,5);assert.equal(values(f,m).immunity,5);
});
test('Falcon matching Han grants one draw only when otherwise unable, not an extra draw',()=>{
 const f=fixture();let m=deployed(f);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;m=priority(phase(m,'battle'),'light');m=seek(step(m,'battle:'+f.planet),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
 assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,1);const extra=pull(m,'light','5_5','table',f.planet);Object.assign(m.cards[extra],{attachedTo:f.ship,aboardRole:'pilot'});mod('battle').syncBattle(m);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,1);mod('table').returnToHand(m,[extra]);mod('game-text').suppressGameText(m,f.planet,f.pilot);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,0);
 assert.equal(values(f,m).immunity,5);assert.equal(mod('combat-modifiers').immuneToAttrition(m,f.ship,4),true);assert.equal(mod('combat-modifiers').immuneToAttrition(m,f.ship,5),false);
});
test('Falcon two pilots and two passengers are distinct capacity slots',()=>{
 const f=fixture(),m=deployed(f),second=pull(m,'light','5_5','table',f.planet);Object.assign(m.cards[second],{attachedTo:f.ship,aboardRole:'pilot'});assert.equal(mod('occupancy').roleAvailable(m,f.ship,f.lightPilot,'pilot'),false);assert.equal(mod('occupancy').roleAvailable(m,f.ship,f.luke,'passenger'),true);assert.equal(values(f,m).power,10);rules.validate(m);
});
test('actual Effect deployment retains its original owner through capture and the real steal continuation',async()=>{
 const {fixture:captureFixture,shipDecks}=await import('./captured-ships-fixture.mjs');const p=await import('./prisoner-fixture.mjs');
 const decks=shipDecks();decks[0].cards[30]='1_65';const f=captureFixture(0,{capture:false,decks});let m=f.m;const effect=p.pull(m,'light','1_65','hand');m=p.phase(m,'light','deploy');const before=m.players.light.force.length;
 m=p.step(m,'starship-effect:deploy:'+effect+':'+f.ship);m=p.seek(m,x=>x.stack.length===1);assert.equal(before-m.players.light.force.length,1);assert.equal(mod('piloting').vesselArmor(m,f.ship),6);
 // Controlled capture foundation; theft itself executes the ordinary pending
 // owner choice and response windows, including both-seat round trips.
 m=p.phase(m,'dark','control');mod('captured-ships').captureStarship(m,f.ship,f.host);m=p.seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:steal');m=p.step(m,'captured-ship:launch:'+f.site);m=p.seek(m,x=>x.stack.length===1);
 assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[effect].owner,'light');assert.equal(m.cards[effect].attachedTo,f.ship);assert.equal(mod('piloting').vesselArmor(m,f.ship),6);p.rules.validate(p.clone(m));
 mod('table').loseFromTable(m,[f.ship]);m=p.seek(m,x=>!x.stack.some(r=>r.kind==='decision'&&r.handler==='table:lost-order'));assert.ok(m.players.dark.lost.includes(f.ship));assert.ok(m.players.light.lost.includes(effect));
});

test('Special Modifications does not override ion armor or maneuver resets',()=>{
 for(const mode of ['han','capital']){const f=fixture(mode),m=deployed(f),stat=mode==='capital'?'armor':'maneuver';mod('stat-modifiers').addStatModifier(m,f.planet,f.ship,stat,'reset',0);assert.equal(values(f,m)[stat],0);}
});

for(const expected of JSON.parse(fs.readFileSync(new URL('./gemp/special-modifications-results.json',import.meta.url))))test('Executed Special Modifications reference '+expected.mode,()=>{
 const f=fixture(expected.mode);
 if(expected.mode==='opponent'){
  // Pinned GEMP still implements old "any starship" text. Current official
  // AR p128 errata requires "your starship"; never rewrite the executed row.
  assert.equal(expected.cost,1);assert.equal(expected.effectOwner,'light');assert.equal(expected.armor,8);
  assert.equal(f.m.cards[f.ship].owner,'dark');assert.ok(!ids(f.m).includes(action(f)));return;
 }
 const before=f.m.players.light.force.length,m=deployed(f);assert.deepEqual({mode:f.mode,cost:before-m.players.light.force.length,...values(f,m)},expected);
});
test('pending deployment rechecks target ownership without revoking already attached Effects after theft',()=>{
 const f=fixture('capital');let m=step(f.m,action(f));m.cards[f.ship].originalOwner='light';m.cards[f.ship].owner='dark';m=settled(m);assert.equal(m.cards[f.effect].zone,'lost');rules.validate(m);
});
test('Falcon and Han deploy together for six Force before the paid Effect',()=>{
 const f=fixture('unpiloted');state.moveCard(f.m,f.ship,'hand');const before=f.m.players.light.force.length;
 let m=settled(step(f.m,'pair-deploy:'+f.ship+':'+f.pilot+':'+f.planet));assert.equal(before-m.players.light.force.length,6);assert.equal(m.cards[f.pilot].aboardRole,'pilot');assert.equal(mod('piloting').vesselHyperspeed(m,f.ship),6);
 m=priority(m,'light');f.m=m;m=deployed(f);assert.equal(before-m.players.light.force.length,7);assert.equal(values(f,m).power,7);assert.equal(values(f,m).immunity,5);rules.validate(clone(m));
});
test('an excluded named pilot supplies neither Falcon nor Effect bonuses',()=>{
 const f=fixture();let m=deployed(f);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;m=priority(phase(m,'battle'),'light');m=seek(step(m,'battle:'+f.planet),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
 mod('ground').record(m).barriers[f.pilot]=m.turn.number;mod('battle').syncBattle(m);assert.equal(values(f,m).power,0);assert.equal(values(f,m).maneuver,0);assert.equal(values(f,m).forfeit,7);assert.equal(values(f,m).immunity,0);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,0);
});
