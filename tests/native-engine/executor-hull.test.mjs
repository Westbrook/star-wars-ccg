import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,pull,force,deploy,settled,priority,ids,step,seek,clone,rules,load} from './vessels-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
function setup(){const f=fixture({light:[],dark:['4_167','1_284','1_179','1_179','1_179','1_179','1_179','1_179','1_179','1_179','1_179','1_179']});f.ship=pull(f.m,'dark','4_167','hand');force(f.m,'dark',12);return f;}
test('Executor deploys for fifteen Force with three permanent ability and hyperspeed two',()=>{
 const f=setup(),before=f.m.players.dark.force.length,m=deploy(f.m,f.ship,f.planet),occ=mod('occupancy');
 assert.equal(before-m.players.dark.force.length,15);assert.equal(occ.permanentAbility(m,f.ship),3);assert.equal(occ.permanentPilot(m,f.ship),true);assert.equal(occ.operational(m,f.ship),true);assert.equal(occ.vesselPower(m,f.ship),12);assert.equal(mod('piloting').vesselArmor(m,f.ship),12);assert.equal(mod('piloting').vesselHyperspeed(m,f.ship),2);assert.equal(mod('piloting').hasNavigation(m,f.ship),true);rules.validate(clone(m));
 const v=occ.occupancyView(m).vessels[f.ship];assert.equal(v.capacity.unlimited,true);assert.doesNotThrow(()=>JSON.stringify(v));
});
test('Executor unlimited capacity retains type/role checks without a numeric sentinel',()=>{
 const f=setup(),m=deploy(f.m,f.ship,f.planet),occ=mod('occupancy');
 const pilots=Object.values(m.cards).filter(c=>c.owner==='dark'&&c.blueprint==='1_179').map(c=>({id:c.id,role:'pilot'}));assert.ok(pilots.length>6);
 assert.equal(occ.capacityFits(m,f.ship,pilots),true);assert.equal(occ.capacityFits(m,f.ship,pilots.map(c=>({...c,role:'passenger'}))),true);
 assert.equal(occ.capacityFits(m,f.ship,[...pilots,{id:f.scout,role:'starship'},{id:f.crawler,role:'vehicle'}]),true);
 assert.equal(occ.capacityFits(m,f.ship,[{id:f.passenger,role:'pilot'}]),false);
 assert.equal(occ.capacityFits(m,f.ship,[{id:f.pilot,role:'driver'}]),false);
 assert.equal(occ.capacityFits(m,f.ship,[{id:f.ship,role:'starship'}]),false);
 assert.equal(occ.capacityFits(m,f.ship,[pilots[0],pilots[0]]),false);
});
test('Executor attrition immunity is strictly below twelve and disabled with canceled text',()=>{
 const f=setup(),m=deploy(f.m,f.ship,f.planet),combat=mod('combat-modifiers');
 assert.equal(combat.immuneToAttrition(m,f.ship,11),true);assert.equal(combat.immuneToAttrition(m,f.ship,12),false);
 mod('game-text').suppressGameText(m,f.ship,f.ship);assert.equal(combat.immuneToAttrition(m,f.ship,1),false);assert.equal(mod('occupancy').permanentAbility(m,f.ship),0);
});
test('Executor deploys crew and transfers them during paid ship docking through saved decisions',()=>{
 const f=setup();let m=deploy(f.m,f.ship,f.planet);m=deploy(m,f.pilot,f.ship,'pilot');m=deploy(m,f.scout,f.planet);
 m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='move'&&x.stack.length===1);m=priority(m,'dark');
 const dock=ids(m).find(id=>id.startsWith('dock:')&&id.includes(f.ship)&&id.includes(f.scout));assert.ok(dock);const before=m.players.dark.force.length;m=step(m,dock);m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');
 m=step(clone(m),'transfer:'+f.pilot+':'+f.scout+':pilot');m=seek(m,x=>x.stack.at(-1)?.handler==='docking:transfer');assert.equal(m.cards[f.pilot].attachedTo,f.scout);m=settled(step(clone(m),'undock'));assert.equal(m.players.dark.force.length,before-1);rules.validate(clone(m));
});
