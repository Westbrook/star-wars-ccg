import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,prepared,moving,step,ids,seek,settled,deploy,priority,phase,state,rules,clone,load} from './open-vehicles-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),occupancy=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),ability=load(new URL('../../lib/native-engine/ability.ts',import.meta.url)),travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url)),costs=load(new URL('../../lib/native-engine/movement-costs.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url)),combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const battleStart=(f,m)=>{state.moveCard(m,f.passenger,'table');m.cards[f.passenger].location=f.site;return seek(step(priority(phase(m,'battle'),'light'),'battle:'+f.site),x=>x.stack.at(-1)?.event?.kind==='battle-weapons')};
for(const bp of ['1_149','1_151'])test(bp+' crew presence, personal power and battle ability follow open/enclosed attributes',()=>{
 const f=fixture(bp),m=prepared(f),open=bp==='1_149';
 assert.equal(occupancy.characterPresent(m,f.rider),open);assert.equal(board.totalPower(m,'light',f.site),open?6:0);assert.equal(board.abilityAt(m,'light',f.site),6);
 assert.equal(ability.abilityForBattleDestiny(m,f.rider),open?3:0);assert.equal(ability.abilityForBattleDestiny(m,f.lightPilot),3);rules.validate(m);
});
test('Open passengers must disembark before walking; carrying does not spend their regular move',()=>{
 const f=fixture();let m=moving(prepared(f));assert.ok(!ids(m).includes('move:'+f.rider+':'+f.dune));const before=m.players.light.force.length;
 m=step(m,'voyage:landspeed:'+f.host+':'+f.camp);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved'&&x.stack.at(-1).event.site===f.dune);assert.equal(m.cards[f.rider].location,f.dune);
 m=priority(settled(clone(m)),'light');assert.equal(m.players.light.force.length,before);assert.equal(m.cards[f.rider].location,f.camp);assert.equal(ground.usage(m).moved.includes(f.rider),false);
 m=priority(settled(step(m,'vessel:exit:'+f.rider+':'+f.host)),'light');assert.ok(ids(m).includes('move:'+f.rider+':'+f.farm));m=settled(step(m,'move:'+f.rider+':'+f.farm));assert.equal(m.cards[f.rider].attachedTo,undefined);assert.equal(m.cards[f.host].location,f.camp);
});
for(const [bp,person,free] of [['1_149','101_2',true],['1_149','1_2',false],['1_151','101_2',true],['1_151','1_2',true],['1_151','1_22',true]])test(bp+' printed movement cost with '+person,()=>{
 const f=fixture(bp,person),m=moving(prepared(f));assert.equal(costs.movesFree(m,f.host),free);const before=m.players.light.force.length;const after=settled(step(m,'voyage:landspeed:'+f.host+':'+f.camp));assert.equal(before-after.players.light.force.length,free?0:1);
});
test('Crew text cancellation does not remove identity; vehicle text cancellation removes free movement',()=>{
 const f=fixture();let m=moving(prepared(f));m.data.canceledGameText=[identity.referenceCard(m,f.rider)];assert.equal(costs.movesFree(m,f.host),true);m.data.canceledGameText.push(identity.referenceCard(m,f.host));assert.equal(travel.vesselRoutes(m,f.host)[0].cost,1);rules.validate(m);
});
test('Losing the driver at an intermediate site stops the open vehicle; the passenger still supplies presence and power',()=>{
 const f=fixture();let m=step(moving(prepared(f)),'voyage:landspeed:'+f.host+':'+f.camp);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');state.moveCard(m,f.lightPilot,'lost');m=settled(m);assert.equal(m.cards[f.host].location,f.dune);assert.equal(board.power(m,f.host),0);assert.equal(board.totalPower(m,'light',f.dune),2);assert.equal(board.presence(m,'light',f.dune),true);
});
test('Free transit is offered at zero Force; an additional paying mover changes the party cost',()=>{
 const f=fixture();let m=moving(prepared(f));state.moveCard(m,f.droid,'table');m.cards[f.droid].location=f.site;while(m.players.light.force.length)state.moveCard(m,m.players.light.force[0],'used');assert.ok(ids(m).includes('transit:'+f.site+':'+f.echo));
 m=step(m,'transit:'+f.site+':'+f.echo);m=step(m,'toggle:'+f.host);assert.ok(ids(m).includes('confirm'));m=step(m,'toggle:'+f.droid);assert.ok(!ids(m).includes('confirm'));m=step(m,'toggle:'+f.droid);m=settled(step(m,'confirm'));assert.equal(m.cards[f.host].location,f.echo);assert.equal(m.cards[f.rider].location,f.echo);assert.equal(m.players.light.force.length,0);
});
test('A mixed docking party pays once at the highest applicable cost',()=>{
 const f=fixture();let m=moving(prepared(f));state.moveCard(m,f.droid,'table');m.cards[f.droid].location=f.site;const before=m.players.light.force.length;
 m=step(m,'transit:'+f.site+':'+f.echo);m=step(m,'toggle:'+f.host);m=step(m,'toggle:'+f.droid);m=settled(step(m,'confirm'));assert.equal(before-m.players.light.force.length,1);assert.equal(m.cards[f.droid].location,f.echo);
});
for(const bp of ['1_149','1_151'])test(bp+' passenger can fire and be targeted only when exposed',()=>{
 const f=fixture(bp);let m=prepared(f);m=priority(settled(step(m,'equip:'+f.gun+':'+f.rider)),'light');state.moveCard(m,f.enemyGun,'table');m.cards[f.enemyGun].attachedTo=f.passenger;m.cards[f.enemyGun].location=f.site;m=battleStart(f,m);
 m=priority(m,'light');assert.equal(ids(m).includes('fire:'+f.gun+':'+f.passenger),bp==='1_149');m=priority(m,'dark');assert.equal(ids(m).includes('fire:'+f.enemyGun+':'+f.rider),bp==='1_149');assert.equal(ids(m).includes('fire:'+f.enemyGun+':'+f.host),true);
});
test('An unpiloted vehicle may transit but loses its free-movement text',()=>{
 const f=fixture();let m=moving(prepared(f));state.moveCard(m,f.lightPilot,'lost');assert.equal(travel.vesselRoutes(m,f.host).length,0);assert.equal(costs.movesFree(m,f.host),false);assert.ok(ids(m).includes('transit:'+f.site+':'+f.echo));
 const before=m.players.light.force.length;m=step(m,'transit:'+f.site+':'+f.echo);m=step(m,'toggle:'+f.host);m=settled(step(m,'confirm'));assert.equal(before-m.players.light.force.length,1);assert.equal(m.cards[f.rider].location,f.echo);
});
test('Ubrikkian printed capacity and enclosure survive real deployment',()=>{
 const f=fixture();f.m.turn.side='dark';f.m.stack[0].priority='dark';let m=deploy(f.m,f.enemyVehicle,f.site);m=deploy(m,f.driver,f.enemyVehicle,'driver');m=deploy(m,f.passenger,f.enemyVehicle,'passenger');
 assert.equal(board.totalPower(m,'dark',f.site),2);assert.equal(occupancy.characterPresent(m,f.passenger),false);assert.equal(occupancy.vesselRule(m,f.enemyVehicle).passengers,2);assert.equal(load(new URL('../../lib/native-engine/defense.ts',import.meta.url)).defenseValue(m,f.enemyVehicle),6);rules.validate(m);
});
test('Unpiloted armored vehicles use armor 2; open maneuver vehicles use zero',()=>{
 const f=fixture(),defense=load(new URL('../../lib/native-engine/defense.ts',import.meta.url));let m=deploy(f.m,f.host,f.site);assert.equal(defense.defenseValue(m,f.host),0);state.moveCard(m,f.crawler,'table');m.cards[f.crawler].location=f.site;assert.equal(defense.defenseValue(m,f.crawler),2);rules.validate(m);
});
test('An open vehicle in a cargo hold does not expose its occupants at the outer location',()=>{
 const f=fixture('1_149','101_2',['1_140']);let m=prepared(f);const carrier=Object.values(m.cards).find(c=>c.blueprint==='1_140').id;state.moveCard(m,carrier,'table');m.cards[carrier].location=f.planet;board.moveWithAttachments(m,f.host,f.planet);m.cards[f.host].attachedTo=carrier;m.cards[f.host].aboardRole='vehicle';
 assert.equal(occupancy.characterPresent(m,f.rider),false);assert.equal(occupancy.occupancyView(m).vessels[f.host].exposed,false);assert.ok(!board.atSite(m,f.planet).some(c=>c.id===f.rider));rules.validate(m);
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/open-vehicles-results.json',import.meta.url)));
const draws=load(new URL('../../lib/native-engine/battle-destiny.ts',import.meta.url));
function drawnDamage(m){for(let n=0;n<200;n++){if(m.stack.at(-1)?.event?.kind==='battle-damage')return m;const options=ids(m);m=step(m,options.includes('draw-destiny')?'draw-destiny':options.includes('pass')?'pass':options[0]);}throw Error('Damage boundary not reached')}
for(const expected of oracle)test('Executed GEMP open/enclosed vehicle observation: '+expected.mode,()=>{
 const {mode}=expected,person=mode.endsWith('beru')?'1_2':mode.endsWith('owen')?'1_22':'101_2',f=fixture(mode.startsWith('closed')?'1_151':'1_149',person);let m=prepared(f);
 if(!mode.endsWith('fire')&&mode!=='open-miss'&&!mode.startsWith('forfeit')){
  m=moving(m);
  if(mode==='unpiloted-transit')state.moveCard(m,f.lightPilot,'hand');
  if(mode.endsWith('canceled')){
   // Controlled GEMP cancellation modifier: compare projected movement cost.
   // No claim of native persistence for an absent cancellation-card provider.
   m.data.canceledGameText=[identity.referenceCard(m,mode.startsWith('host')?f.host:f.rider)];assert.equal(travel.vesselRoutes(m,f.host).find(r=>r.path.at(-1)===f.camp).cost,expected.cost);return;
  }
  const before=m.players.light.force.length;
  if(mode.endsWith('transit')){if(mode==='mixed-transit'){state.moveCard(m,f.droid,'table');m.cards[f.droid].location=f.site;}m=step(m,'transit:'+f.site+':'+f.echo);m=step(m,'toggle:'+f.host);if(mode==='mixed-transit')m=step(m,'toggle:'+f.droid);m=settled(step(m,'confirm'));}
  else m=settled(step(m,'voyage:landspeed:'+f.host+':'+f.camp));
  assert.deepEqual({mode,cost:before-m.players.light.force.length,hostMoved:ground.usage(m).moved.includes(f.host),crewMoved:ground.usage(m).moved.includes(f.rider),aboard:m.cards[f.rider].attachedTo===f.host},expected);return;
 }
 state.moveCard(m,f.vader,'table');m.cards[f.vader].location=f.site;state.moveCard(m,f.gun,'table');m.cards[f.gun].attachedTo=f.rider;m.cards[f.gun].location=f.site;state.moveCard(m,f.enemyGun,'table');m.cards[f.enemyGun].attachedTo=f.passenger;m.cards[f.enemyGun].location=f.site;state.moveCard(m,f.zero,'reserve');state.moveCard(m,f.high,'reserve');
 m=priority(battleStart(f,m),'light');const result={mode,defense:load(new URL('../../lib/native-engine/defense.ts',import.meta.url)).defenseValue(m,f.host),power:board.totalPower(m,'light',f.site),draws:draws.battleDrawPolicy(m,'light').count,canFire:ids(m).includes('fire:'+f.gun+':'+f.passenger)};
 if(mode==='open-fire'){
  state.moveCard(m,f.lightHigh,'reserve');m=step(m,'fire:'+f.gun+':'+f.passenger);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');result.enemyHit=combat.battle(m).hits.includes(f.passenger);m=priority(m,'dark');result.riderTarget=ids(m).includes('fire:'+f.enemyGun+':'+f.rider);m=step(m,'fire:'+f.enemyGun+':'+f.rider);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');result.riderHit=combat.battle(m).hits.includes(f.rider);
 }else if(mode==='closed-fire'||mode==='open-miss'){
  if(mode==='open-miss'){const five=Object.values(m.cards).find(c=>c.owner==='dark'&&c.blueprint==='1_262');assert.ok(five);state.moveCard(m,five.id,'reserve');}
  m=priority(m,'dark');result.enemyCanFire=ids(m).some(id=>id.startsWith('fire:'+f.enemyGun));result.riderTarget=ids(m).includes('fire:'+f.enemyGun+':'+f.rider);result.vehicleTarget=ids(m).includes('fire:'+f.enemyGun+':'+f.host);m=step(m,'fire:'+f.enemyGun+':'+f.host);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');result.vehicleHit=combat.battle(m).hits.includes(f.host);
 }else{
  m=priority(drawnDamage(m),'light');result.damage=combat.battle(m).damage.light;result.attrition=combat.battle(m).attrition.light;
  const victim=mode==='forfeit-carrier'?f.host:f.rider;m=step(m,'forfeit:'+victim);m=seek(m,x=>x.cards[victim].zone==='lost'&&(mode!=='forfeit-carrier'||[f.rider,f.lightPilot].every(id=>x.cards[id].zone==='lost')));
  Object.assign(result,{afterDamage:combat.battle(m).damage.light,afterAttrition:combat.battle(m).attrition.light,hostLost:m.cards[f.host].zone==='lost',riderLost:m.cards[f.rider].zone==='lost',driverLost:m.cards[f.lightPilot].zone==='lost'});
 }
 assert.deepEqual(result,expected);rules.validate(m);
});
