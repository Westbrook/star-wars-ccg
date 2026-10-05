import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,start,result,step,prompt,clone,duel,finish} from './obsession-failure-fixture.mjs';

for(const side of ['dark','light'])test(`failed ${side} destiny retains its official winner and unresolved amount after recovery`,()=>{
 const f=fixture(side==='dark'?[]:[0,0],side==='light'?[]:[0,0]);
 let m=clone(result(start(f)));
 assert.equal(duel(m).winner,side==='dark'?'light':'dark');
 assert.equal(duel(m).difference,null);
 assert.deepEqual(prompt(m),prompt(clone(m)));
 m=step(m,'pass');const before=clone(m);
 assert.throws(()=>step(m,'pass'),/Unverified rule: Obsession Force difference/);
 assert.deepEqual(m,before,'failed command cannot partially retrieve or lose cards');
});

for(const side of ['dark','light'])for(const amount of [0,1,2,99])test(`saved failed ${side} destiny cannot bypass the guard with amount ${amount}`,()=>{
 const f=fixture(side==='dark'?[]:[0,0],side==='light'?[]:[0,0]);
 const m=clone(result(start(f)));duel(m).difference=amount;
 const before=clone(m);
 assert.throws(()=>prompt(m),/Invalid duel result/);
 assert.throws(()=>step(m,'pass'),/Invalid duel result/);
 assert.deepEqual(m,before);
});

for(const side of ['dark','light'])test(`saved failed ${side} draws cannot become a successful zero total`,()=>{
 const m=result(start(fixture(side==='dark'?[]:[0,0],side==='light'?[]:[0,0])));
 duel(m).destinyTotals[side]=0;duel(m).winner='dark';duel(m).difference=2;
 assert.throws(()=>prompt(clone(m)),/Invalid duel result/);
});

for(const [dark,light] of [[[0,0],[0,0]],[[0],[0,0]],[[],[]]])test(`saved result keeps winner and difference for ${JSON.stringify([dark,light])}`,()=>{
 const m=result(start(fixture(dark,light)));
 for(const mutate of [d=>d.winner=d.winner==='dark'?'light':'dark',d=>d.difference++,d=>delete d.destinyTotals]){
  const bad=clone(m);mutate(duel(bad));assert.throws(()=>prompt(bad),/duel result/);
 }
 const completed=finish(clone(m));assert.equal(duel(completed).stage,'complete');
 const bad=clone(completed);duel(bad).difference++;
 assert.throws(()=>prompt(bad),/Invalid duel result/);
});
