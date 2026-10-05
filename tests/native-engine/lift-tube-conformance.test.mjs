import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fixture,deployTube,movePhase,reactFixture,mod,clone,ids,step,seek,settled,priority} from './lift-tube-fixture.mjs';
const results=JSON.parse(fs.readFileSync(new URL('./gemp/lift-tube-results.json',import.meta.url)));
for(const expected of results)test('executed GEMP Lift Tube outcome: '+expected.mode,()=>{
 const side=expected.mode.startsWith('dark')?'dark':'light';
 if(expected.mode.endsWith('deploy-move')){
  const f=fixture({side}),before=f.m.players[side].force.length;
  const interiorAvailable=ids(f.m).includes('vessel:deploy:'+f.tube+':'+f.core),planetAvailable=ids(f.m).includes('vessel:deploy:'+f.tube+':'+f.planet),outsideAvailable=ids(f.m).includes('vessel:deploy:'+f.tube+':'+f.outside);
  let {m}=deployTube(f);const deployCost=before-m.players[side].force.length;
  for(const id of f.passengers)mod('state').moveCard(m,id,'hand');
  const passengerCapacity=mod('occupancy').vesselRule(m,f.tube).passengers,power=mod('board').power(m,f.tube),presence=mod('board').presence(m,side,f.core);
  m=movePhase({...f,m}).m;const emptyMoveAvailable=ids(m).includes('voyage:landspeed:'+f.tube+':'+f.corridor),beforeMove=m.players[side].force.length;
  m=settled(step(m,'voyage:landspeed:'+f.tube+':'+f.corridor));
  assert.deepEqual({mode:expected.mode,interiorAvailable,planetAvailable,outsideAvailable,deployCost,passengerCapacity,power,presence,emptyMoveAvailable,moveCost:beforeMove-m.players[side].force.length,regularMoveUsed:mod('ground').usage(m).moved.includes(f.tube)},expected);
 }else{
  const mode=expected.mode,f=reactFixture({battle:mode==='carried-battle',aboard:mode==='carried-battle'}),before=f.m.players.light.force.length,lost=f.m.players.light.lost.length;
  let m=step(f.m,'vehicle-react:'+f.tube+':'+f.bay),boarded=false,exited=false;
  for(let n=0;n<150;n++){
   if(m.stack.length===1||mode==='carried-battle'&&m.stack.at(-1)?.event?.kind==='battle-weapons')break;
   const stage=m.stack.at(-1)?.handler;
   if(stage==='vehicle-react:board'){if(mode==='board-drain'&&!boarded){m=step(clone(m),'board:'+f.passengers[0]+':passenger');boarded=true;}else m=step(m,'continue-react');}
   else if(stage==='vehicle-react:exit'){if(mode!=='empty-drain'&&!exited){m=step(clone(m),'exit:'+f.passengers[0]);exited=true;}else m=step(m,'continue-react');}
   else m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);
  }
  assert.deepEqual({mode,cost:before-m.players.light.force.length,arrived:m.cards[f.tube].location===f.bay,boarded,exited,aboard:m.cards[f.passengers[0]].attachedTo===f.tube,lostToDrain:m.players.light.lost.length-lost,regularMoveUsed:mod('ground').usage(m).moved.includes(f.tube)},expected);
 }
});
test('Lift Tube oracle receipt identifies five real outcomes and pinned unchanged production',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/lift-tube-review.json',import.meta.url)));
 assert.equal(results.length,5);assert.equal(receipt.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(receipt.productionVerification.verifiedFiles,6820);assert.equal(receipt.productionVerification.allUnchanged,true);
 for(const [path,hash]of Object.entries(receipt.fingerprints))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url))).digest('hex'),hash,path);
});
