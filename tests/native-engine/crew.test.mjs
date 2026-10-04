import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,paired,battleStart,battleInitiated,deployedPair,deploy,step,settled,priority,seek,ids,rules,state,load} from './crew-fixture.mjs';
const occ=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url)),pilot=load(new URL('../../lib/native-engine/piloting.ts',import.meta.url)),board=load(new URL('../../lib/native-engine/board.ts',import.meta.url)),draw=load(new URL('../../lib/native-engine/battle-destiny.ts',import.meta.url)),ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url)),identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
for(const side of ['light','dark'])test('Matching pilot supplies power, maneuver and fallback battle destiny: '+side,()=>{
 const f=fixture(side);let m=paired(f);assert.equal(board.power(m,f.ship),4);assert.equal(pilot.vesselManeuver(m,f.ship),4);m=battleStart(f,m);assert.equal(draw.battleDrawPolicy(m,side).ordinary,0);assert.equal(draw.battleDrawPolicy(m,side).count,1);rules.validate(m);
});
test('Matching text stops while landed or occupying a passenger seat',()=>{
 const f=fixture('light');let m=deployedPair(f.m,f.gold,f.dutch,f.site);assert.equal(pilot.matchingPilot(m,f.dutch),false);assert.equal(pilot.vesselManeuver(m,f.gold),0);assert.equal(board.power(m,f.gold),0);
 m=paired(f);m=settled(step(m,'vessel:role:'+f.dutch+':'+f.gold+':passenger'));assert.equal(pilot.matchingPilot(m,f.dutch),false);assert.equal(occ.operational(m,f.gold),false);assert.equal(board.power(m,f.gold),0);assert.equal(pilot.vesselManeuver(m,f.gold),0);
});
test('Dutch grants forfeit to another pilot using Gold 1, not to himself or a passenger',()=>{
 const f=fixture('light');let m=paired(f);m=deploy(m,f.lightPilot,f.gold,'pilot');assert.equal(board.forfeit(m,f.lightPilot),board.printed(m,f.lightPilot,'forfeit')+1);assert.equal(board.forfeit(m,f.dutch),5);assert.equal(board.power(m,f.gold),6);m=battleStart(f,m);assert.equal(draw.battleDrawPolicy(m,'light').ordinary,1);assert.equal(draw.battleDrawPolicy(m,'light').count,1);
 const fresh=fixture('light');m=paired(fresh);m=deploy(m,fresh.lightPilot,fresh.gold,'passenger');assert.equal(board.forfeit(m,fresh.lightPilot),board.printed(m,fresh.lightPilot,'forfeit'));
});
test('A prohibited pilot operates normally outside battle, then loses bonuses and control during battle',()=>{
 const f=fixture();let m=paired(f);m=deploy(m,f.scout,f.planet);ground.record(m).barriers[f.ds]=m.turn.number;assert.equal(board.power(m,f.black),4);assert.equal(occ.operational(m,f.black),true);m=battleStart(f,m);assert.equal(occ.operational(m,f.black),false);assert.equal(board.power(m,f.black),0);assert.equal(pilot.vesselManeuver(m,f.black),0);assert.equal(draw.battleDrawPolicy(m,'dark').count,0);assert.equal(occ.occupants(m,f.black).length,1);
 for(let i=0;i<100&&m.data.battle?.stage!=='complete';i++){const choices=ids(m);m=step(m,choices.includes('battle-lose:force')?'battle-lose:force':choices.includes('skip-destiny')?'skip-destiny':'pass');}assert.equal(m.data.battle.stage,'complete');assert.equal(board.power(m,f.black),4);assert.equal(pilot.vesselManeuver(m,f.black),4);assert.equal(occ.operational(m,f.black),true);
});
test('A permanent pilot keeps a ship operational while an additional pilot is excluded',()=>{
 const f=fixture();let m=deploy(f.m,f.scout,f.planet);m=deploy(m,f.ds,f.scout,'pilot');ground.record(m).barriers[f.ds]=m.turn.number;assert.equal(board.power(m,f.scout),4);m=battleStart(f,m);assert.equal(board.power(m,f.scout),1);assert.equal(occ.operational(m,f.scout),true);
});
test('Canceling pilot text removes bonuses without removing the pilot icon or ability',()=>{
 const f=fixture(),m=paired(f);m.data.canceledGameText=[identity.referenceCard(m,f.ds)];assert.equal(occ.operational(m,f.black),true);assert.equal(board.power(m,f.black),1);assert.equal(pilot.vesselManeuver(m,f.black),3);assert.equal(pilot.matchingPilot(m,f.ds),false);
});
test('A permanent pilot icon operates independently of its text-provided ability',()=>{
 const f=fixture();const m=deploy(f.m,f.scout,f.planet);m.data.canceledGameText=[identity.referenceCard(m,f.scout)];assert.equal(occ.permanentAbility(m,f.scout),0);assert.equal(occ.permanentPilot(m,f.scout),true);assert.equal(occ.operational(m,f.scout),true);assert.equal(board.power(m,f.scout),1);
});
test('Pilot departure removes the ship bonus and leaves an unpiloted vessel',()=>{
 const f=fixture(),m=paired(f);load(new URL('../../lib/native-engine/table.ts',import.meta.url)).returnToHand(m,[f.ds]);assert.equal(board.power(m,f.black),0);assert.equal(pilot.vesselManeuver(m,f.black),0);assert.equal(occ.operational(m,f.black),false);rules.validate(m);
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/crew-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP pilot contribution observation: '+expected.mode,()=>{
 const {mode}=expected,light=mode.startsWith('light')||mode==='gold-squadron',side=light?'light':'dark',landed=mode==='light-landed',f=fixture(side),ship=light?f.gold:['dark-nonmatch','barrier-permanent','ship-text-canceled'].includes(mode)?f.scout:f.black;
 let m=f.m;state.moveCard(m,ship,'table');m.cards[ship].location=landed?f.site:f.planet;if(mode==='barrier-unpiloted'){state.moveCard(m,f.scout,'table');m.cards[f.scout].location=f.planet;}
 if(mode!=='ship-text-canceled'){
  m=step(m,'vessel:aboard:'+f.ace+':'+ship+':'+(mode==='light-passenger'?'passenger':'pilot'));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed');if(mode.startsWith('barrier'))m=step(m,'barrier:'+f.barrier+':'+f.ace);m=priority(settled(m),side);
 }
 if(['gold-squadron','light-passenger'].includes(mode))m=deploy(m,f.lightPilot,ship,'pilot');
 if(mode.endsWith('text-canceled'))m.data.canceledGameText=[identity.referenceCard(m,mode.startsWith('pilot')?f.ace:ship)];
 const result={mode,beforePower:board.power(m,ship),beforeManeuver:pilot.vesselManeuver(m,ship),beforePiloted:occ.operational(m,ship),initiationPower:null,hanForfeit:['gold-squadron','light-passenger'].includes(mode)?board.forfeit(m,f.lightPilot):null,battlePower:null,battleManeuver:null,battlePiloted:null,draws:null};
 if(!landed&&!mode.endsWith('text-canceled')){m=battleInitiated(f,m);result.initiationPower=board.power(m,ship);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');Object.assign(result,{battlePower:board.power(m,ship),battleManeuver:pilot.vesselManeuver(m,ship),battlePiloted:occ.operational(m,ship),draws:draw.battleDrawPolicy(m,side).count});}
 assert.deepEqual(result,expected);
});
test('Excluded Dutch stops granting squadron forfeit until the battle ends',()=>{
 const f=fixture('light');let m=paired(f);m=deploy(m,f.lightPilot,f.gold,'pilot');assert.equal(board.forfeit(m,f.lightPilot),7);ground.record(m).barriers[f.dutch]=m.turn.number;m=battleStart(f,m);assert.equal(board.forfeit(m,f.lightPilot),6);assert.equal(board.power(m,f.gold),4);assert.equal(pilot.vesselManeuver(m,f.gold),3);assert.equal(draw.battleDrawPolicy(m,'light').count,0);
});
test('An actually unpiloted fighter can dock with a piloted capital ship',()=>{
 const f=fixture();let m=paired(f);m=deploy(m,f.carrier,f.planet);load(new URL('../../lib/native-engine/table.ts',import.meta.url)).returnToHand(m,[f.ds]);assert.equal(occ.operational(m,f.black),false);m=seek(m,x=>x.turn.phase==='move'&&x.stack.length===1);m=priority(m,'dark');assert.ok(ids(m).some(id=>id.startsWith('dock:')&&id.includes(f.black)&&id.includes(f.carrier)));
});
for(const side of ['light','dark'])test('Matching-pilot fallback resolves one actual battle draw through recovery: '+side,()=>{
 const f=fixture(side);let m=battleStart(f,paired(f));m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&x.stack.at(-1).side===side);assert.ok(ids(m).includes('draw-destiny'));m=step(m,'draw-destiny');m=seek(m,x=>x.data.battle?.stage==='damage');const b=m.data.battle;assert.equal(b.destinyPlans[side].draws.length,1);assert.equal(typeof b.destiny[side],'number');assert.equal(b.power[side],4+b.destiny[side]);rules.validate(m);
});
