import fs from 'node:fs';
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/captured-ship-results.json',import.meta.url)));
import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,clone,pull,ids,step,seek,phase} from './prisoner-fixture.mjs';
import {fixture,ending} from './captured-ships-fixture.mjs';
for(const success of [true,false])test('real deploy, battle loss payment and Tractor Beam destiny '+success,()=>{
 const f=fixture(2,{capture:false,beamInHand:true});let m=phase(f.m,'dark','deploy'),before=m.players.dark.force.length;
 assert.ok(ids(m).includes('tractor:deploy:'+f.beam+':'+f.host));m=step(m,'tractor:deploy:'+f.beam+':'+f.host);m=seek(m,x=>x.cards[f.beam].zone==='table');const deployCost=before-m.players.dark.force.length;assert.equal(deployCost,2);assert.equal(m.cards[f.beam].attachedTo,f.host);
 f.m=m;m=ending(f);const use='tractor:use:'+f.beam+':'+f.host;assert.ok(ids(m).includes(use));assert.equal(mod('battle').battle(m).stage,'end');
 const bp=success?'1_241':'1_194',destiny=m.players.dark.reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(destiny);m.players.dark.reserve.splice(m.players.dark.reserve.indexOf(destiny),1);m.players.dark.reserve.unshift(destiny);before=m.players.dark.force.length;
 const depth=m.stack.length;m=step(m,use);m=seek(m,x=>!!x.cards[f.ship].capturedShip||x.stack.length===depth);assert.equal(m.players.dark.force.length,before-2);assert.equal(!!m.cards[f.ship].capturedShip,success);assert.deepEqual({name:'tractor-'+(success?6:1),deployCost,useCost:before-m.players.dark.force.length,captured:!!m.cards[f.ship].capturedShip},reference.find(r=>r.name==='tractor-'+(success?6:1)));assert.ok(m.players.dark.used.includes(destiny));
 assert.ok(!mod('tractor-beam').tractorBeamActions(m,{kind:'window',serial:m.data.tractorBeamUses[0].window,timing:'response',priority:'dark',passes:0,completed:[],event:{kind:'battle-ending'}},'dark').some(a=>a.id===use));
 for(const side of ['dark','light'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));
});
test('Tractor Beam cannot target before battle ending or a returning target instance',()=>{
 const f=fixture(2,{capture:false});assert.ok(!ids(f.m).some(id=>id.startsWith('tractor:use:')));let m=ending(f),before=m.players.dark.force.length,use='tractor:use:'+f.beam+':'+f.host;
 const depth=m.stack.length;m=step(m,use);const ref=mod('identity').referenceCard(m,f.ship);mod('table').returnToHand(m,[f.ship]);state.moveCard(m,f.ship,'table');m.cards[f.ship].location=f.site;
 assert.notEqual(mod('identity').cardVersion(m,f.ship),ref.version);m=seek(m,x=>x.stack.length===depth);assert.equal(m.cards[f.ship].capturedShip,undefined);
});

test('multiple tractor targets require a saved choice before payment',()=>{
 const f=fixture(2,{capture:false});pull(f.m,'light','1_147','table',f.site);let m=ending(f),before=m.players.dark.force.length;
 m=step(m,'tractor:use:'+f.beam+':'+f.host);assert.equal(m.stack.at(-1).handler,'tractor:target');assert.equal(m.players.dark.force.length,before);assert.equal(ids(m).length,2);
 assert.ok(mod('computer').chooseComputerAction(runtime.project(m,rules,'dark'),'dark').startsWith('tractor:target:'));
 const bad=clone(m);bad.stack.at(-1).payload.window++;assert.throws(()=>runtime.project(bad,rules,'dark'));
 m=step(m,'tractor:target:'+f.ship);assert.equal(m.players.dark.force.length,before-2);
});
