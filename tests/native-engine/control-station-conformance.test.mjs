import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mod,state,pull,step,seek,priority} from './prisoner-fixture.mjs';
import {controlFixture} from './control-station-fixture.mjs';
const rows=JSON.parse(readFileSync(new URL('./gemp/control-station-results.json',import.meta.url)));
for(const row of rows)test('Executed Control Station reference: '+row.mode,()=>{
 const controlled=['controlled','contested','text-canceled','stolen'].includes(row.mode),f=controlFixture({controlled,stolen:row.mode==='stolen'});
 if(row.mode==='contested')pull(f.m,'dark','1_194','table',f.station);
 if(row.mode==='text-canceled')mod('game-text').suppressGameText(f.m,f.rebel,f.station);
 if(row.mode.startsWith('leader')){state.moveCard(f.m,f.leader,'table');f.m.cards[f.leader].location=f.station;if(row.mode==='leader-canceled')mod('game-text').suppressGameText(f.m,f.ship,f.leader);}
 const actions=side=>mod('vessel-travel').vesselTravelActions(f.m,{timing:'phase'},side).filter(a=>a.source===f.ship);
 assert.equal(actions('dark').length>0,row.darkMoves.length>0);assert.equal(mod('occupancy').vesselPower(f.m,f.ship),row.power);assert.equal(f.m.cards[f.ship].owner,row.owner);
 if(row.mode==='stolen'){
  // An explicit, preserved discrepancy: printed Light-side permission wins.
  assert.deepEqual(row.lightMoves,[]);assert.ok(actions('light').length);return;
 }
 assert.equal(actions('light').length>0,row.lightMoves.length>0);
 if(row.mode==='controlled'){const before={dark:f.m.players.dark.force.length,light:f.m.players.light.force.length};let m=step(priority(f.m,'light'),'voyage:hyperspace:'+f.ship+':'+f.to);m=seek(m,x=>x.cards[f.ship].location===f.to);assert.equal(before.light-m.players.light.force.length,row.lightCost);assert.equal(before.dark-m.players.dark.force.length,row.darkCost);assert.equal(mod('ground').usage(m).moved.includes(f.ship),row.regularMove);}
});
test('Control Station receipt binds raw observations and preserves the production gate and discrepancy',async()=>{const {createHash}=await import('node:crypto');const p=JSON.parse(readFileSync(new URL('./gemp/control-station-provenance.json',import.meta.url)));for(const [file,key]of [[p.harness,'harnessSha256'],[p.results,'resultsSha256'],[p.log,'logSha256']])assert.equal(createHash('sha256').update(readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),p[key]);assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.execution.exitCode,0);assert.equal(p.execution.observedCases,rows.length);assert.equal(p.discrepancy.case,'stolen');assert.equal(mod('premiere-rules').premiereRules.supports('4_160'),false);});
