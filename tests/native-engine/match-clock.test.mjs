import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const {createClock,assertClock,projectClock,moveClock,expiredClock}=load(new URL('../../lib/native-engine/match-clock.ts',import.meta.url));
test('clock snapshots round-trip, do not tick while stopped, and never refund time on a backwards timestamp',()=>{
 let c=createClock(15,1000);assert.equal(projectClock(c,9000000).remainingMs.dark,900000);
 c=moveClock(c,'dark',9000000);const before=JSON.stringify(c);assert.equal(projectClock(c,9001000).remainingMs.dark,899000);assert.equal(JSON.stringify(c),before);
 c=moveClock(JSON.parse(before),'light',9001000);assert.equal(c.remaining.dark,899000);c=moveClock(c,'dark',9000500);assert.equal(c.since,9001000);assert.equal(c.remaining.light,900000);
 assert.equal(expiredClock(c,9900000),'dark');assert.equal(expiredClock(c,9899999),null);
});
test('invalid budgets, remaining values, timestamps and clock owners fail closed',()=>{
 for(const n of [0,1,Infinity,NaN,-1,15.5,'15'])assert.throws(()=>createClock(n,0));
 for(const n of [-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]){assert.throws(()=>createClock(15,n));assert.throws(()=>projectClock(createClock(15,0),n));}
 const c=createClock(15,0);for(const patch of [{remaining:{dark:-1,light:0}},{remaining:{dark:900001,light:0}},{remaining:{}},{running:'spectator'},{since:-1},{minutes:10}])assert.throws(()=>assertClock({...c,...patch}));
 assert.throws(()=>moveClock(c,'spectator',0));
});
