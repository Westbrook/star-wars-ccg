import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,deployed,values,pairId,mod,runtime,rules,state,clone,pull,ids,step,seek,phase,priority,settled} from './custom-tie-fixture.mjs';
const modes={matched:[6,6,2,4,true], 'pilot-canceled':[2,3,2,4,true], 'ship-canceled':[6,6,2,0,true],landed:[0,0,0,0,false],unpiloted:[0,0,0,0,false],'pilot-departed':[0,0,0,0,false],'other-pilot':[4,3,2,0,true],'other-ship':[4,4,null,0,true]};
for(const [mode,expected] of Object.entries(modes))test('Custom TIE actual deployment and pilot state '+mode,()=>{
 const f=fixture(mode),before=f.m.players.dark.force.length;assert.ok(ids(f.m).includes(mode==='unpiloted'?'vessel:deploy:'+f.ship+':'+f.target:pairId(f)));
 const m=deployed(f),v=values(f,m);assert.deepEqual([v.power,v.maneuver,v.hyperspeed,v.immunity,v.operational],expected);assert.equal(v.navigation,mode!=='other-ship');
 assert.equal(before-m.players.dark.force.length,mode==='unpiloted'?2:mode==='other-pilot'?6:mode==='other-ship'?7:8);rules.validate(clone(m));assert.deepEqual(values(f,clone(m)),v);
 assert.equal(mod('premiere-rules').premiereRules.supports('1_306'),false);
});
test('Custom TIE has one pilot slot, no passenger or astromech capacity and exact unique identity',()=>{
 const f=fixture(),m=deployed(f),spare=pull(m,'dark','1_167','hand'),duplicate=pull(m,'dark','1_306','hand'),occ=mod('occupancy');
 for(const role of ['pilot','passenger'])assert.equal(occ.roleAvailable(m,f.ship,spare,role),false);
 assert.equal(occ.vesselRule(m,f.ship).astromechs??0,0);assert.equal(mod('persona').canPlayCard(m,duplicate),false);assert.equal(mod('characteristics').isModel(m,f.ship,'TIE_ADVANCED_X1'),true);assert.equal(mod('persona').hasPersona(m,f.ship,'VADERS_CUSTOM_TIE'),true);
 const otsd=pull(m,'dark','106_10','hand');assert.equal(mod('persona').hasPersona(m,otsd,'VADERS_CUSTOM_TIE'),false);assert.equal(mod('characteristics').isModel(m,otsd,'TIE_LN'),true);assert.equal(mod('occupancy').permanentPilot(m,otsd),true);
});
test('Custom TIE requires pilot presence for power and maneuver, and unpiloted hyperspeed is unmodifiable',()=>{
 const f=fixture(),m=deployed(f);mod('table').returnToHand(m,[f.pilot]);mod('stat-modifiers').addStatModifier(m,f.planet,f.ship,'hyperspeed','add',3);
 assert.equal(values(f,m).hyperspeed,0);assert.equal(mod('vessel-travel').vesselRoutes(m,f.ship).length,0);
});
test('Custom TIE lands at a docking bay through an actual free movement action and resumes after refresh',()=>{
 const f=fixture();let m=deployed(f);m=priority(phase(m,'move'),'dark');const to=f.site,action='voyage:land:'+f.ship+':'+to,before=m.players.dark.force.length;
 assert.ok(ids(m).includes(action));m=settled(step(clone(m),action));assert.equal(m.cards[f.ship].location,to);assert.equal(m.cards[f.pilot].location,to);assert.equal(m.players.dark.force.length,before);assert.deepEqual(values(f,m),values(f,clone(m)));
});
test('Custom TIE pair participates in battle, has one ordinary draw and strict attrition threshold',()=>{
 const f=fixture();let m=deployed(f);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;m=priority(phase(m,'battle'),'dark');m=seek(step(m,'battle:'+f.planet),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');
 assert.equal(mod('battle-destiny').battleDrawPolicy(m,'dark').count,1);assert.equal(mod('combat-modifiers').immuneToAttrition(m,f.ship,3),true);assert.equal(mod('combat-modifiers').immuneToAttrition(m,f.ship,4),false);
 mod('ground').record(m).barriers[f.pilot]=m.turn.number;mod('battle').syncBattle(m);assert.deepEqual([values(f,m).power,values(f,m).maneuver,values(f,m).hyperspeed,values(f,m).immunity],[0,0,0,0]);
});
test('a Vader persona passenger on another craft cannot supply Custom TIE matching pilot text',()=>{
 const f=fixture(),m=deployed(f),carrier=pull(m,'dark','1_302','table',f.planet);
 m.cards[f.pilot].attachedTo=carrier;m.cards[f.pilot].aboardRole='passenger';assert.equal(mod('piloting').pilotPowerBonus(m,f.pilot),0);assert.equal(values(f,m).immunity,0);assert.equal(values(f,m).power,0);
});

for(const expected of JSON.parse(fs.readFileSync(new URL('./gemp/custom-tie-results.json',import.meta.url))))test('Executed GEMP Custom TIE observation: '+expected.mode,()=>{
 const f=fixture(expected.mode),before=f.m.players.dark.force.length,m=deployed(f),row={mode:f.mode,cost:before-m.players.dark.force.length,...values(f,m)};
 if(['landed','unpiloted','pilot-departed'].includes(f.mode)){
  // Official AR p90/p92 defines usable hyperspeed zero. The immutable GEMP
  // observation is its raw printed/modified getter, which still returns two.
  assert.equal(expected.hyperspeed,2);assert.equal(row.hyperspeed,0);assert.equal(row.operational,false);
  assert.equal(mod('vessel-travel').vesselRoutes(m,f.ship).some(r=>r.method==='hyperspace'),false);assert.deepEqual(row,{...expected,hyperspeed:0});
 }else assert.deepEqual(row,expected);
});
