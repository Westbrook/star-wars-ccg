import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,pull,state,rules,clone,ids,step,seek,priority,deploy,settled,load} from './vessels-fixture.mjs';
import {fire} from './starship-weapons-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const occ=mod('occupancy'),board=mod('board'),pilots=mod('piloting'),sector=mod('sectors');
const light=['1_28','1_109','1_129','106_4','106_7','106_9','1_140','1_135','1_8','2_81','1_158','1_158','5_85','5_77','1_115','1_115'];
const dark=['1_194','1_194','1_317','1_317','1_302','1_284','106_10','106_13','106_13','106_15','1_313','1_313','1_323','1_323','2_143','1_168','1_299','1_262','1_262'];
function setup(side='light',phase='deploy') {const f=fixture({light,dark});f.m.turn.side=side;f.m.turn.phase=phase;f.m.stack[0].priority=side;return f;}
const table=(f,side,bp,at=f.planet)=>pull(f.m,side,bp,'table',at);
for(const [bp,side,power,ability] of [['106_4','light',4,2],['106_7','light',5,2],['106_9','light',2,1],['106_10','dark',3,2],['106_13','dark',5,2],['106_15','dark',3,2]])test('OTSD actual deployment and permanent pilots '+bp,()=>{
 const f=setup(side),ship=pull(f.m,side,bp,'hand'),before=f.m.players[side].force.length;
 const m=deploy(f.m,ship,f.planet);assert.equal(before-m.players[side].force.length,Number(mod('definitions').definition(bp).stats.deploy));assert.equal(occ.vesselPower(m,ship),power);assert.equal(occ.permanentAbility(m,ship),ability);assert.equal(occ.permanentPilot(m,ship),true);rules.validate(clone(m));
 mod('game-text').suppressGameText(m,ship,ship);assert.equal(occ.permanentAbility(m,ship),0);assert.equal(occ.vesselPower(m,ship),Number(mod('definitions').definition(bp).stats.power));
});
for(const bp of ['106_4','106_7','106_10'])test('OTSD home destination discount is paid by deployment '+bp,()=>{
 const side=bp==='106_10'?'dark':'light',f=setup(side),ship=pull(f.m,side,bp,'hand'),loc=table(f,side,side==='dark'?'2_143':'1_135');f.m.locations.push(loc);const before=f.m.players[side].force.length;
 const m=deploy(f.m,ship,loc);assert.equal(before-m.players[side].force.length,Number(mod('definitions').definition(bp).stats.deploy)-2);
});
test('Dutch discount follows his location aboard and is not cumulative with Yavin',()=>{
 const f=setup(),ship=pull(f.m,'light','106_4','hand'),dutch=table(f,'light','1_8'),carrier=table(f,'light','1_140');Object.assign(f.m.cards[dutch],{attachedTo:carrier,aboardRole:'pilot'});
 assert.equal(mod('otsd-ships').otsdDeployModifier(f.m,ship,f.planet),-2);f.m.cards[dutch].location=f.site;assert.equal(mod('otsd-ships').otsdDeployModifier(f.m,ship,f.planet),0);
});
for(const bp of ['106_9','106_15'])test('nonunique cloud bonuses and Obsidian discount '+bp,()=>{
 const side=bp==='106_9'?'light':'dark',f=setup(side),cloud=table(f,'light','5_85');f.m.locations.splice(1,0,cloud);sector.registerSector(f.m,cloud,'Tatooine');const ship=pull(f.m,side,bp,'hand'),before=f.m.players[side].force.length;
 const m=deploy(f.m,ship,cloud);assert.equal(before-m.players[side].force.length,bp==='106_9'?2:3);assert.equal(occ.vesselPower(m,ship),bp==='106_9'?2:3);assert.equal(pilots.vesselManeuver(m,ship),bp==='106_9'?4:1);
 mod('game-text').suppressGameText(m,cloud,cloud);assert.equal(occ.vesselPower(m,ship),bp==='106_9'?4:5);assert.equal(pilots.vesselManeuver(m,ship),bp==='106_9'?6:3);
 const city=pull(m,'light','5_77','table');m.locations.push(city);m.cards[ship].location=city;assert.equal(occ.vesselPower(m,ship),bp==='106_9'?2:3);assert.equal(pilots.vesselManeuver(m,ship),bp==='106_9'?4:3);
});
test('Dreadnaught supports TIE models, gives one noncumulative present bonus and excludes cargo',()=>{
 const f=setup('dark'),d=table(f,'dark','106_13'),d2=table(f,'dark','106_13'),black=table(f,'dark','106_10');assert.equal(occ.vesselPower(f.m,black),4);assert.equal(occ.roleAvailable(f.m,d,black,'starship'),true);assert.equal(occ.roleAvailable(f.m,d,f.scout,'starship'),true);assert.equal(occ.roleAvailable(f.m,d,f.ywing,'starship'),false);
 Object.assign(f.m.cards[black],{attachedTo:d,aboardRole:'starship'});assert.equal(occ.vesselPower(f.m,black),0);delete f.m.cards[black].attachedTo;delete f.m.cards[black].aboardRole;
 for(const c of [d,d2])mod('game-text').suppressGameText(f.m,c,c);assert.equal(occ.vesselPower(f.m,black),3);
});
test('Gold shared slot versus Red and Black fixed crew capacity',()=>{
 const f=setup(),gold=table(f,'light','106_4'),red=table(f,'light','106_7');assert.equal(occ.roleAvailable(f.m,gold,f.lightPilot,'pilot'),true);assert.equal(occ.roleAvailable(f.m,gold,f.droid,'passenger'),true);assert.equal(occ.roleAvailable(f.m,red,f.lightPilot,'pilot'),false);
 Object.assign(f.m.cards[f.lightPilot],{zone:'table',attachedTo:gold,location:f.planet,aboardRole:'pilot'});assert.equal(occ.roleAvailable(f.m,gold,f.droid,'passenger'),false);
});
test('Z-95 deploys into a vehicle slot, recovers and disembarks through real actions',()=>{
 const f=setup(),carrier=table(f,'light','1_140'),ship=pull(f.m,'light','106_9','hand'),action='transport:deploy:'+ship+':'+carrier+':vehicle';assert.ok(ids(f.m).includes(action));assert.ok(!ids(f.m).includes('transport:deploy:'+f.ywing+':'+carrier+':vehicle'));
 let m=settled(step(f.m,action));rules.validate(clone(m));assert.equal(m.cards[ship].aboardRole,'vehicle');assert.equal(occ.vesselPower(m,ship),0);m.turn.phase='move';m.stack[0].priority='light';m=settled(step(m,'transport:disembark:'+ship+':'+f.planet));assert.equal(m.cards[ship].attachedTo,undefined);assert.equal(occ.vesselPower(m,ship),2);
});
for(const [shipBp,gun,side,deployCost,fireCost,values,total] of [['106_7','1_158','light',0,0,[3],3],['106_4','2_81','light',1,1,[3],4],['106_15','1_313','dark',1,0,[5],6],['106_13','1_323','dark',3,2,[5,5],5]])test('OTSD weapon deployment, paid firing, destiny and refresh '+shipBp,()=>{
 const f=setup(side),host=table(f,side,shipBp),target=side==='light'?f.scout:f.ywing;state.moveCard(f.m,target,'table');f.m.cards[target].location=f.planet;const weapon=pull(f.m,side,gun,'hand'),before=f.m.players[side].force.length;
 let m=settled(step(f.m,'space-weapon:equip:'+weapon+':'+host));assert.equal(before-m.players[side].force.length,deployCost);m.turn.phase='battle';m.stack[0].priority=side;const start=m.players[side].force.length;
 m=fire({...f,m:clone(m),site:f.planet,side,host,target,weapon},values);assert.equal(m.data.battle.starshipShots[0].total,total);assert.equal(start-m.players[side].force.length,1+fireCost);rules.validate(clone(m));
});
test('Gold ion draw bonus disappears if its source text is canceled; Black bonus applies to every weapon',()=>{
 const f=setup(),gold=table(f,'light','106_4'),w=table(f,'light','2_81');f.m.cards[w].attachedTo=gold;assert.equal(board.weaponDrawBonus(f.m,w),1);mod('game-text').suppressGameText(f.m,gold,gold);assert.equal(board.weaponDrawBonus(f.m,w),0);
 const black=table(f,'dark','106_10'),gun=table(f,'dark','1_313');f.m.cards[gun].attachedTo=black;assert.equal(board.weaponDrawBonus(f.m,gun),1);
});
test('free Proton Torpedoes transfer follows destination and suppressed text removes free deployment',()=>{
 const f=setup(),red=table(f,'light','106_7'),gold=table(f,'light','106_4'),w=table(f,'light','1_158');f.m.cards[w].attachedTo=gold;const before=f.m.players.light.force.length;let m=settled(step(f.m,'space-weapon:equip:'+w+':'+red));assert.equal(m.players.light.force.length,before);
 mod('game-text').suppressGameText(m,red,red);assert.equal(mod('otsd-ships').otsdWeaponFree(m,w,red,'deploy'),false);
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/otsd-ships-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP OTSD comparison '+JSON.stringify(row),()=>{
 const bp=row.blueprint;
 if('home' in row){
  const side=Number(bp.split('_')[1])>=10?'dark':'light',f=setup(side),ship=pull(f.m,side,bp,'hand'),loc=row.home?table(f,side,side==='dark'?'2_143':'1_135'):f.planet;if(row.home)f.m.locations.push(loc);const before=f.m.players[side].force.length;
  const m=deploy(f.m,ship,loc);assert.deepEqual({blueprint:bp,home:row.home,deploymentCost:before-m.players[side].force.length,power:occ.vesselPower(m,ship),ability:board.abilityAt(m,side,loc),piloted:occ.operational(m,ship)},row);return;
 }
 const side=bp==='1_158'?'light':'dark',enemy=side==='light'?'dark':'light',f=setup(side),host=table(f,side,bp==='1_158'?'106_7':bp==='1_313'?'106_15':'106_13');
 const target=row.capital?table(f,enemy,enemy==='light'?'1_140':'1_302'):side==='light'?f.scout:f.ywing;state.moveCard(f.m,target,'table');f.m.cards[target].location=f.planet;
 const weapon=pull(f.m,side,bp,'hand'),before=f.m.players[side].force.length;let m=settled(step(f.m,'space-weapon:equip:'+weapon+':'+host));const deploymentCost=before-m.players[side].force.length;
 const second=pull(m,side,bp,'table',f.planet);m.cards[second].attachedTo=host;m.turn.phase='battle';m.stack[0].priority=side;const start=m.players[side].force.length;m=fire({...f,m,site:f.planet,side,host,target,weapon},bp==='1_323'?[row.destiny,row.destiny]:[row.destiny]);
 m=priority(seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons'),side);assert.deepEqual({blueprint:bp,capital:row.capital,destiny:row.destiny,deploymentCost,firingCost:start-m.players[side].force.length-1,hit:m.data.battle.hits.includes(target),forfeit:board.forfeit(m,target),sameWeaponAvailable:ids(m).includes('space-weapon:fire:'+weapon+':'+target),secondWeaponAvailable:ids(m).includes('space-weapon:fire:'+second+':'+target)},row);
});

test('OTSD reference receipt binds executed source and outcomes',async()=>{const {createHash}=await import('node:crypto');const p=JSON.parse(fs.readFileSync(new URL('./gemp/otsd-ships-provenance.json',import.meta.url)));for(const [f,sha] of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+f,import.meta.url))).digest('hex'),sha);assert.equal(oracle.length,p.observations);});
