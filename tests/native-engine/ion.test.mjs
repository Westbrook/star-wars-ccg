import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,start,fire,step,seek,priority,boundary,pull,state,rules,clone,load,ids,phase} from './ion-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const shot=m=>m.data.battle.starshipShots[0],def=(m,id)=>mod('defense').defenseValue(m,id),hyper=(m,id)=>mod('piloting').vesselHyperspeed(m,id);
for(const bp of ['1_318','2_81'])for(const cap of [false,true])for(const d of [1,3,5])test(`ion outcome ${bp} capital=${cap} destiny=${d}`,()=>{
 const f=fixture(bp,cap),before=def(f.m,f.target),power=mod('occupancy').vesselPower(f.m,f.target),m=fire(f,[d]),s=shot(m),success=d+(bp==='1_318'?2:0)>before;
 assert.equal(s.total,d+(bp==='1_318'?2:0));assert.equal(s.outcome,success?'ionized':'miss');assert.equal(def(m,f.target),success?0:before);assert.equal(hyper(m,f.target),success?0:hyper(f.m,f.target));assert.equal(mod('occupancy').vesselPower(m,f.target),power);assert.ok(!m.data.battle.hits.includes(f.target));assert.equal(m.cards[f.crew].zone,'table');for(const id of f.guns)assert.equal(m.cards[id].zone,success?'lost':'table');
});
for(const [bp,cost] of [['1_318',2],['2_81',1]])test('ion deploy costs '+bp,()=>{const f=fixture(bp,false,false),before=f.m.players[f.side].force.length,m=seek(step(f.m,'space-weapon:equip:'+f.weapon+':'+f.host),x=>x.cards[f.weapon].zone==='table');assert.equal(before-m.players[f.side].force.length,cost);assert.equal(m.cards[f.weapon].attachedTo,f.host);});
test('ion damage persists across turns and source departure, blocking later additions',()=>{
 const f=fixture(),m=fire(f);state.moveCard(m,f.weapon,'lost');m.turn.number++;mod('stat-modifiers').addStatModifier(m,f.crew,f.target,'maneuver','add',9);mod('stat-modifiers').addStatModifier(m,f.crew,f.target,'hyperspeed','add',9);rules.validate(m);assert.equal(def(m,f.target),0);assert.equal(hyper(m,f.target),0);assert.equal(mod('occupancy').occupancyView(m).vessels[f.target].ionized,true);
});
test('repair removes only current ion resets and preserves other modifiers',()=>{
 const f=fixture(),m=fire(f);const stats=mod('stat-modifiers');stats.addStatModifier(m,f.crew,f.target,'maneuver','add',2);stats.addStatModifier(m,f.crew,f.target,'hyperspeed','reset',1,{duration:'target',function:'other'});stats.restoreIonDamage(m,f.target);assert.equal(def(m,f.target),def(f.m,f.target)+2);assert.equal(hyper(m,f.target),1);assert.equal(stats.ionizedShip(m,f.target),false);rules.validate(m);
});
test('ship leaving and returning clears its ion damage',()=>{const f=fixture(),m=fire(f);mod('table').returnToHand(m,[f.target]);state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;assert.equal(def(m,f.target),def(f.m,f.target));assert.equal(hyper(m,f.target),hyper(f.m,f.target));});
test('failed destiny never ionizes even with printed +2',()=>{const f=fixture(),m=fire(f,[]);assert.equal(shot(m).total,null);assert.equal(shot(m).outcome,'miss');});
test('ion weapon losses retain ordering and survive refresh at each boundary',()=>{
 const f=fixture();let m=boundary(start(f),'attributes-reset');assert.equal(def(m,f.target),0);m=boundary(clone(m),'about-to-lose');assert.equal(m.cards[f.guns[0]].zone,'table');m=seek(clone(m),x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[f.guns[0]].zone,'leaving');m=boundary(clone(m),'weapon-fired');assert.deepEqual(new Set(shot(m).lostWeapons),new Set(f.guns));
});
test('returned ship cannot inherit a pending ion shot',()=>{const f=fixture();let m=start(f);mod('table').returnToHand(m,[f.target]);state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;m=boundary(m,'weapon-fired');assert.equal(shot(m).outcome,'invalid');assert.equal(mod('stat-modifiers').ionizedShip(m,f.target),false);});
test('returned weapon cannot inherit a pending loss',()=>{const f=fixture();let m=boundary(start(f),'about-to-lose');const id=f.guns[0];state.moveCard(m,id,'hand');state.moveCard(m,id,'table');Object.assign(m.cards[id],{attachedTo:f.target,location:f.site});m=boundary(m,'weapon-fired');assert.equal(m.cards[id].zone,'table');assert.deepEqual(shot(m).lostWeapons,[f.guns[1]]);});
test('malformed ion records and resets reject transaction state',()=>{const f=fixture(),m=fire(f);for(const edit of [x=>shot(x).ionWeapons[0].id=f.target,x=>shot(x).lostWeapons.push(f.target),x=>x.data.statModifiers[0].duration='forever',x=>x.data.statModifiers[0].amount=-1]){const bad=clone(m);edit(bad);assert.throws(()=>rules.validate(bad));}});
test('only weapons mounted directly on the ship are lost; character weapons stay aboard',()=>{
 const f=fixture(),gun=pull(f.m,'light','1_152','table',f.site);f.m.cards[gun].attachedTo=f.crew;const m=fire(f);assert.equal(m.cards[gun].zone,'table');assert.equal(m.cards[gun].attachedTo,f.crew);
});
test('paid shot retains its printed calculation when the firing weapon leaves',()=>{const f=fixture();let m=start(f,[3]);state.moveCard(m,f.weapon,'lost');m=boundary(m,'weapon-fired');assert.equal(shot(m).total,5);assert.equal(shot(m).outcome,'ionized');});
test('a canceled firing consumes use and Force without ionizing the target',()=>{const f=fixture();let m=start(f);m.stack.find(r=>r.action?.handler==='space-weapon:fire').cancelled=true;m=boundary(m,'battle-weapons');assert.equal(shot(m).outcome,'canceled');assert.equal(mod('stat-modifiers').ionizedShip(m,f.target),false);assert.ok(m.data.battle.fired.includes(f.weapon));assert.ok(!ids(priority(m,f.side)).some(id=>id.startsWith('space-weapon:fire:'+f.weapon+':')));});
test('an actual just-drawn maneuver response changes the ion comparison before reset',()=>{
 const f=fixture();let m=priority(boundary(start(f,[3]),'destiny-drawn'),'light');const card=pull(m,'light','1_70','hand');m=step(m,'maneuver:'+card+':'+f.target);m=boundary(m,'weapon-fired');assert.equal(shot(m).defense,5);assert.equal(shot(m).total,5);assert.equal(shot(m).outcome,'miss');
});

for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/ion-results.json',import.meta.url))))test('executed GEMP ion comparison '+JSON.stringify([row.blueprint,row.capital,row.destiny]),()=>{
 const f=fixture(row.blueprint,row.capital,false),before=f.m.players[f.side].force.length;
 let m=seek(step(f.m,'space-weapon:equip:'+f.weapon+':'+f.host),x=>x.stack.length===1);const deploymentCost=before-m.players[f.side].force.length;
 const second=pull(m,f.side,row.blueprint,'table',f.site);m.cards[second].attachedTo=f.host;
 m=priority(phase(m,'battle'),f.side);const force=m.players[f.side].force.length;m=priority(boundary(fire({...f,m},[row.destiny]),'battle-weapons'),f.side);
 const observed={blueprint:row.blueprint,capital:row.capital,destiny:row.destiny,deploymentCost,firingCost:force-m.players[f.side].force.length-1,hit:m.data.battle.hits.includes(f.target),forfeit:mod('board').forfeit(m,f.target),sameWeaponAvailable:ids(m).some(id=>id.startsWith('space-weapon:fire:'+f.weapon+':')),secondWeaponAvailable:ids(m).some(id=>id.startsWith('space-weapon:fire:'+second+':')),defense:def(m,f.target),hyperspeed:hyper(m,f.target),power:mod('occupancy').vesselPower(m,f.target),weaponsLost:f.guns.every(id=>m.cards[id].zone==='lost'),crewAboard:m.cards[f.crew].attachedTo===f.target};
 assert.deepEqual(observed,row);
});
test('a second weapon uses ion-reduced defense in the same battle',()=>{
 const f=fixture(),gun=pull(f.m,'dark','1_323','table',f.site);f.m.cards[gun].attachedTo=f.host;let m=fire(f);const ready=priority(boundary(m,'battle-weapons'),'dark');
 // Two distinct printed threes give 6 - 5 against the starfighter's new zero defense.
 const cards=Object.values(ready.cards).filter(c=>c.owner==='dark'&&c.zone==='hand'&&Number(mod('definitions').definition(c.blueprint).stats.destiny)===3).slice(0,2);assert.equal(cards.length,2);for(const c of cards)state.moveCard(ready,c.id,'reserve');
 m=boundary(step(ready,'space-weapon:fire:'+gun+':'+f.target),'weapon-fired');assert.equal(m.data.battle.starshipShots[1].defense,0);assert.equal(m.data.battle.starshipShots[1].outcome,'hit');assert.ok(m.data.battle.hits.includes(f.target));
});
test('ion damage disables hyperspace routes and repair restores eligibility',()=>{
 const f=fixture('1_318',true),to=pull(f.m,'dark','1_296','table');f.m.locations.push(to);const routes=()=>mod('vessel-travel').vesselRoutes(f.m,f.target).filter(x=>x.method==='hyperspace');assert.ok(routes().length);f.m=fire(f,[5]);assert.equal(routes().length,0);mod('stat-modifiers').restoreIonDamage(f.m,f.target);assert.ok(routes().length);
});
