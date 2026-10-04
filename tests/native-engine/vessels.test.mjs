import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,settled,deploy,runtime,state,rules,clone,pull,prompt,ids,step,seek,phase,priority,load} from './vessels-fixture.mjs';
const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),ability=load(new URL('../../lib/native-engine/ability.ts',import.meta.url)),combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url)),table=load(new URL('../../lib/native-engine/table.ts',import.meta.url));
test('Transport deployment pays its cost and stays powerless until a driver boards',()=>{
 const f=fixture();let m=deploy(f.m,f.crawler,f.site);assert.equal(m.players.dark.force.length,9);assert.equal(board.power(m,f.crawler),0);assert.equal(board.presence(m,'dark',f.site),false);m=deploy(m,f.driver,f.crawler,'driver');assert.equal(m.players.dark.force.length,7);assert.equal(m.cards[f.driver].aboardRole,'driver');assert.equal(board.power(m,f.crawler),3);assert.equal(board.power(m,f.driver),1);assert.equal(board.totalPower(m,'dark',f.site),3);assert.equal(board.presence(m,'dark',f.site),true);assert.deepEqual(board.atSite(m,f.site),[]);
});
test('Enclosed passengers supply presence but do not add power or battle-destiny ability',()=>{
 const f=fixture();let m=deploy(f.m,f.crawler,f.site);m=deploy(m,f.passenger,f.crawler,'passenger');assert.equal(board.presence(m,'dark',f.site),true);assert.equal(board.totalPower(m,'dark',f.site),0);assert.equal(ability.ability(m,f.passenger),1);assert.equal(ability.abilityForBattleDestiny(m,f.passenger),0);
});
test('A permanent pilot and assigned pilot work separately from shared passenger capacity',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');m=deploy(m,f.passenger,f.scout,'passenger');assert.equal(board.totalPower(m,'dark',f.planet),3);assert.equal(board.abilityAt(m,'dark',f.planet),5);assert.equal(ability.abilityForBattleDestiny(m,f.pilot),3);assert.equal(ability.abilityForBattleDestiny(m,f.passenger),0);assert.equal(ability.abilityForBattleDestiny(m,f.scout),1);assert.equal(occ.roleAvailable(m,f.scout,f.driver,'passenger'),false);assert.equal(occ.roleAvailable(m,f.scout,f.pilot,'passenger'),true);m=settled(step(m,'vessel:role:'+f.pilot+':'+f.scout+':passenger'));assert.equal(board.totalPower(m,'dark',f.planet),1);assert.equal(ability.abilityForBattleDestiny(m,f.pilot),0);
});
test('Embark and disembark are free unlimited moves',()=>{
 const f=fixture();let m=deploy(f.m,f.crawler,f.site);state.moveCard(m,f.driver,'table');m.cards[f.driver].location=f.site;m=phase(m,'move');m=priority(m,'dark');const before=m.players.dark.force.length;m=settled(step(m,'vessel:embark:'+f.driver+':'+f.crawler+':driver'));m=priority(m,'dark');m=settled(step(m,'vessel:exit:'+f.driver+':'+f.crawler));m=priority(m,'dark');assert.equal(m.cards[f.driver].attachedTo,undefined);assert.equal(m.cards[f.driver].aboardRole,undefined);assert.equal(m.players.dark.force.length,before);assert.ok(ids(m).includes('vessel:embark:'+f.driver+':'+f.crawler+':driver'));
});
test('Landed starfighters retain permanent presence while personal and vessel battle power remain zero',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.site);m=deploy(m,f.pilot,f.scout,'pilot');assert.equal(board.totalPower(m,'dark',f.site),0);assert.equal(board.presence(m,'dark',f.site),true);assert.equal(ability.abilityForBattleDestiny(m,f.scout),0);assert.equal(ability.abilityForBattleDestiny(m,f.pilot),0);
});
test('Tatooine system control does not add power outside battle',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);state.moveCard(m,f.driver,'table');m.cards[f.driver].location=f.site;assert.equal(board.totalPower(m,'dark',f.site),1);assert.equal(board.controls(m,'dark',f.planet),true);
});
test('Carrier departure loses occupants; their forfeits do not combine with the host',()=>{
 const f=fixture();let m=deploy(f.m,f.crawler,f.site);m=deploy(m,f.driver,f.crawler,'driver');assert.equal(board.forfeit(m,f.crawler),5);table.returnToHand(m,[f.crawler]);assert.equal(m.cards[f.crawler].zone,'hand');assert.equal(m.cards[f.driver].zone,'lost');assert.equal(m.cards[f.driver].aboardRole,undefined);rules.validate(m);
});
test('Forged capacity, non-pilot roles and detached role markers fail recovery',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.passenger,f.scout,'passenger');for(const change of [x=>x.cards[f.passenger].aboardRole='pilot',x=>delete x.cards[f.passenger].attachedTo,x=>x.cards[f.passenger].aboardRole='gunner']){const bad=clone(m);change(bad);assert.throws(()=>rules.validate(bad),/capacity|aboard/);}
});
test('A full space battle includes crews, uses only pilot ability and forfeits a carrier once',async()=>{
 const {fleets}=await import('./vessels-fixture.mjs'),f=fleets();let m=step(f.m,'battle:'+f.planet);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
 assert.deepEqual(combat.members(m,'dark').sort(),[f.scout,f.pilot,f.passenger].sort());assert.deepEqual(combat.members(m,'light').sort(),[f.ywing,f.lightPilot].sort());assert.equal(load(new URL('../../lib/native-engine/battle-effects.ts',import.meta.url)).battleAbility(m,'dark'),4);
 const l=m.players.light.reserve.find(id=>board.printed(m,id,'destiny')===5),d=m.players.dark.reserve.find(id=>board.printed(m,id,'destiny')===1);assert.ok(l&&d);state.moveCard(m,l,'reserve');state.moveCard(m,d,'reserve');
 for(let n=0;n<120&&combat.battle(m).stage!=='damage';n++)m=step(m,ids(m).includes('draw-destiny')?'draw-destiny':ids(m).includes('pass')?'pass':ids(m)[0]);
 const b=combat.battle(m);assert.equal(b.stage,'damage');assert.equal(b.power.dark,4);assert.equal(b.power.light,9);assert.equal(b.damage.dark,5);assert.equal(b.attrition.dark,5);m=priority(m,'dark');m=step(m,'forfeit:'+f.scout);m=seek(m,x=>[f.scout,f.pilot,f.passenger].every(id=>x.cards[id].zone==='lost'));assert.equal(combat.battle(m).damage.dark,2);assert.equal(combat.battle(m).attrition.dark,2);assert.ok([f.pilot,f.passenger].every(id=>!m.cards[id].aboardRole));
 assert.deepEqual({mode:'space-battle',darkPower:b.power.dark,lightPower:b.power.light,darkDamage:b.damage.dark,darkAttrition:b.attrition.dark,afterDamage:combat.battle(m).damage.dark,afterAttrition:combat.battle(m).attrition.dark,crewLost:[f.pilot,f.passenger].every(id=>m.cards[id].zone==='lost')},oracle.find(x=>x.mode==='space-battle'));
 m=seek(m,x=>combat.battle(x).stage==='complete');assert.equal(m.status,'playing');assert.ok(m.turn.number>1);
});
test('Tatooine ship-control power is applied in a ground battle, not while merely standing at a site',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);state.moveCard(m,f.driver,'table');m.cards[f.driver].location=f.site;state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;assert.equal(board.totalPower(m,'dark',f.site),1);m=phase(m,'battle');m=priority(m,'dark');m=step(m,'battle:'+f.site);assert.equal(board.totalPower(m,'dark',f.site),2);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;assert.equal(board.totalPower(m,'dark',f.site),1);
});

const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/vessels-results.json',import.meta.url)));
for(const expected of oracle.filter(x=>x.mode!=='space-battle'))test('Executed GEMP vessel observation: '+expected.mode,()=>{
 const f=fixture(),mode=expected.mode,vehicle=mode.startsWith('crawler')||mode==='unpiloted',host=vehicle?f.crawler:f.scout,location=vehicle||mode==='landed'?f.site:f.planet;
 let m=deploy(f.m,host,location);const deploymentCost=12-m.players.dark.force.length;
 if(['scout-pilot','scout-shared','landed'].includes(mode))m=deploy(m,f.pilot,host,'pilot');
 if(['scout-passenger','scout-shared','crawler-passenger'].includes(mode))m=deploy(m,f.passenger,host,'passenger');
 if(mode==='crawler-driver')m=deploy(m,f.driver,host,'driver');
 const r=occ.vesselRule(m,host),crew=occ.occupants(m,host),pilots=crew.filter(c=>c.aboardRole==='pilot').length,passengers=crew.filter(c=>c.aboardRole==='passenger').length;
 assert.deepEqual({mode,deploymentCost,hostPower:board.power(m,host),ability:board.abilityAt(m,'dark',location),presence:board.presence(m,'dark',location),pilot:m.cards[f.pilot].attachedTo===host&&m.cards[f.pilot].aboardRole==='pilot',passenger:m.cards[f.passenger].attachedTo===host&&m.cards[f.passenger].aboardRole==='passenger',freePassengers:r.passengers+r.shared-Math.max(0,pilots-r.pilots)-passengers},expected);
});
test('Pending capacity actions reject malformed recovery and do not follow a departed/redeployed host',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');m=step(m,'vessel:role:'+f.pilot+':'+f.scout+':passenger');
 for(const edit of [r=>r.action.payload.previous='gunner',r=>r.action.id+=':forged']){const bad=clone(m);edit(bad.stack.find(x=>x.kind==='resolution'&&x.action.handler==='vessel:role'));assert.throws(()=>rules.validate(bad),/capacity|identity/);}
 table.returnToHand(m,[f.scout]);state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;m=settled(m);assert.equal(m.cards[f.pilot].zone,'lost');assert.equal(occ.occupants(m,f.scout).length,0);
});
test('Only eligible droids may drive; ordinary non-pilots cannot occupy pilot slots',()=>{
 const f=fixture();assert.equal(occ.canDrive(f.m,f.droid),true);assert.equal(occ.roleAvailable(f.m,f.scout,f.passenger,'pilot'),false);assert.equal(occ.roleAvailable(f.m,f.crawler,f.passenger,'driver'),true);
});
test('CPU uses projected pilot/driver actions without cycling unlimited crew movements',()=>{
 const cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));const f=fixture();let m=deploy(f.m,f.scout,f.planet);let v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(c=>c.id==='pass'||c.id.startsWith('vessel:aboard:'+f.pilot+':'));assert.equal(cpu.chooseComputerAction(v,'dark'),'vessel:aboard:'+f.pilot+':'+f.scout+':pilot');
 m=deploy(m,f.pilot,f.scout,'pilot');v=runtime.project(m,rules,'dark');v.prompt.choices=v.prompt.choices.filter(c=>c.id==='pass'||c.id.startsWith('vessel:role:'));assert.equal(cpu.chooseComputerAction(v,'dark'),'pass');
});
