import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
import {fixture,modes,event,board,play,result,finish,clone,state,step,seek,ids,rules,runtime} from './assault-presence-fixture.mjs';
for(const owner of ['light','dark'])for(const mode of modes.filter(m=>owner==='light'||m!=='open'))test(`${owner} ${mode}: Assault counts presence independently of power and resumes saved resolution`,()=>{
 const f=fixture(owner,mode),expected=mode==='open'?3:['unpiloted','landed'].includes(mode)?2:1;
 let m=result(play(f));const e=event(m);assert.equal(e.count,expected);assert.equal(e.destiny,3*expected);assert.equal(e.power,board.totalPower(f.m,owner,f.site));
 assert.equal(e.amount,Math.abs(e.destiny-e.power));assert.equal(m.data.battle,undefined);
 const before=clone(m.players);m=finish(clone(m),f.card);assert.equal(m.cards[f.card].zone,'lost');assert.ok(!ids(m).includes('drain:'+f.site));
 for(const side of ['light','dark'])assert.equal(m.players[side].lost.length-before[side].lost.length,(side===f.side?1:0)+(e.loser===side?e.amount:0));
});
for(const owner of ['light','dark'])test(`${owner}: leaving ship and crew after count freezes does not rewrite Assault`,()=>{
 const f=fixture(owner);let m=seek(play(f),x=>event(x)?.kind==='force-drain-cancelled');
 const power=board.totalPower(m,owner,f.site);for(const id of [f.pilot,f.passenger,f.host])state.moveCard(m,id,'hand');
 m=result(clone(m));assert.equal(event(m).count,1);assert.equal(event(m).power,power);assert.equal(event(m).destiny,3);m=finish(m,f.card);assert.equal(m.cards[f.card].zone,'lost');
});
for(const owner of ['light','dark'])test(`${owner}: changing exposed occupants during play responses changes the initial count`,()=>{
 const f=fixture(owner,'enclosed');let m=play(f);delete m.cards[f.passenger].attachedTo;delete m.cards[f.passenger].aboardRole;m=result(clone(m));assert.equal(event(m).count,2);assert.equal(event(m).destiny,6);
});
test('production admission remains closed for both Assault mirrors',()=>{
 for(const bp of ['1_113','1_238'])assert.equal(premiereRules.supports(bp),false);
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/assault-presence-results.json',import.meta.url)));
for(const o of oracle)test('executed GEMP Assault presence: '+o.owner+' '+o.mode,()=>{
 const f=fixture(o.owner,o.mode);let m=result(play(f));const e=event(m),before=clone(m.players);m=finish(m,f.card);
 assert.deepEqual({owner:o.owner,mode:o.mode,power:e.power,draws:Array(e.count).fill(3),total:e.destiny,darkForceLost:m.players.dark.lost.length-before.dark.lost.length-(f.side==='dark'?1:0),lightForceLost:m.players.light.lost.length-before.light.lost.length-(f.side==='light'?1:0),interruptLost:m.cards[f.card].zone==='lost'},o);
});

test('conformance source and observation fingerprints match the executed evidence',async()=>{
 const {createHash}=await import('node:crypto');const p=JSON.parse(fs.readFileSync(new URL('./gemp/assault-presence-provenance.json',import.meta.url)));
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
 assert.equal(p.exactAgreements,oracle.length);assert.equal(p.unchangedProductionFiles,6820);
});
