import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {decks,rules,runtime,playing,advance,step,prompt} from './force-starting-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(new URL('./gemp/'+n,import.meta.url)));
for(const row of read('force-starting-results.json'))test('GEMP real setup Force Effects '+JSON.stringify([row.first,row.three,row.immune]),()=>{
 let m=runtime.createMatch('force-start',60,decks(row),rules);const observed=new Set();
 for(let n=0;n<220&&m.status==='setup';n++){
  const p=prompt(m),top=m.stack.at(-1);let choice=p.choices.find(c=>c.id==='pass')??p.choices[0];
  if(top?.handler==='prep-start:choose'){
   const side=p.side,eligible=p.choices.filter(c=>c.id.startsWith('prep-start:deploy:'));observed.add(side);
   assert.equal(eligible.some(c=>m.cards[c.id.slice(18)].blueprint===(side==='light'?'102_1':'102_6')),!row.three);
   const reference=row.trace.find(t=>t.side===side&&t.revealed.eligible);if(reference)assert.deepEqual([...new Set(eligible.map(c=>m.cards[c.id.slice(18)].blueprint))].sort(),[...new Set(reference.revealed.eligible)].sort());else assert.ok(row.three&&row.immune,'Only the sole eligible Effect may be auto-deployed without a chooser; its actual result is compared below.');
   assert.deepEqual(runtime.project(m,rules,side==='light'?'dark':'light').rules.startingSearch.cards,[]);
   const matching=eligible.find(c=>row.table.includes(m.cards[c.id.slice(18)].blueprint));if(matching)choice=matching;
  }
  m=step(JSON.parse(JSON.stringify(m)),choice.id,p.side);
 }
 assert.equal(m.status,'playing');assert.equal(m.turn.side,row.first);assert.equal(observed.size,2);
 assert.deepEqual(Object.values(m.cards).filter(c=>c.zone==='table'&&['102_1','102_6','4_21','4_134'].includes(c.blueprint)).map(c=>c.blueprint).sort(),row.table);
 for(const side of ['light','dark'])assert.deepEqual({reserve:m.players[side].reserve.length,hand:m.players[side].hand.length,lost:m.players[side].lost.map(id=>m.cards[id].blueprint)},row.piles[side]);
});
for(const size of [40,60])test(size+' card setup deploys exactly one unique Force Effect without Force costs',()=>{const m=playing(runtime.createMatch('force-start-size',size,decks({size}),rules));for(const side of ['light','dark']){assert.equal(m.cards[side+'-3'].zone,'table');assert.notEqual(m.cards[side+'-4'].zone,'table');assert.equal(m.players[side].force.length,0);assert.equal(m.players[side].used.length,0);assert.equal(m.players[side].reserve.length,size-11);}});
test('three-Effect starter rejects forged nonimmune deployment and saved selection history',()=>{let m=advance(runtime.createMatch('bad-start',60,decks({three:true,immune:true}),rules),x=>x.stack.at(-1)?.handler==='prep-start:choose');assert.throws(()=>step(m,'prep-start:deploy:dark-3'));m=step(m,'prep-start:deploy:dark-5');const bad=structuredClone(m),r=bad.stack.find(f=>f.action?.handler==='prep-start:after');r.action.payload.chosen=[mod('identity').referenceCard(bad,'dark-3')];assert.throws(()=>rules.validate(bad),/starting Effect history/);});
test('one-Effect starter rejects a forged chooser after its allowance is exhausted',()=>{let m=advance(runtime.createMatch('limit',60,decks(),rules),x=>x.stack.at(-1)?.handler==='prep-start:choose');m=step(m,'prep-start:deploy:dark-3');const r=m.stack.find(f=>f.action?.handler==='prep-start:after');m.stack.push({kind:'decision',side:'dark',handler:'prep-start:choose',payload:structuredClone(r.action.payload)});assert.throws(()=>rules.validate(m),/starting search decision/);});
test('Force starter reference receipt binds observed output and unchanged production sources',()=>{const p=read('force-starting-provenance.json');for(const [name,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))).digest('hex'),hash);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);});

test('mixed starting Interrupts independently admit nonimmune Effects only for the one-Effect player',()=>{const ds=decks();ds[0].cards[1]='9_139';const m=playing(runtime.createMatch('mixed-force-start',60,ds,rules));assert.equal(m.cards['light-3'].zone,'table');assert.notEqual(m.cards['dark-3'].zone,'table');assert.equal(m.players.dark.reserve.length,50);assert.equal(m.players.light.reserve.length,49);});
