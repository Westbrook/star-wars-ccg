import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,begin,finish,runtime,state,rules,clone,prompt,ids,step,seek,priority} from './labria-fixture.mjs';
const reveal=load(new URL('../../lib/native-engine/pile-reveal.ts',import.meta.url)),inserts=load(new URL('../../lib/native-engine/reserve-inserts.ts',import.meta.url)),cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
for(const pile of ['reserve','force','used'])test('Labria publicly reveals and returns to '+pile+' with exact pile order and durable choice',()=>{
 const f=fixture(),before=clone(f.m.players.dark);let m=begin(f);
 for(const side of ['dark','light']){const v=runtime.project(clone(m),rules,side);assert.deepEqual(v.rules.revealedReserve.map(c=>c.id),[f.top]);assert.equal(v.rules.revealedReserve[0].zone,'reserve');assert.equal(JSON.stringify(v).includes(f.m.players.dark.reserve[1]+'"'),false);}
 assert.throws(()=>step(m,'labria:return:force','light'),/Illegal/);assert.deepEqual(ids(m),['labria:return:reserve','labria:return:force','labria:return:used']);
 m=step(m,'labria:return:'+pile);assert.equal(m.players.dark[pile][0],f.top);assert.deepEqual(m.players.dark.reserve,pile==='reserve'?before.reserve:before.reserve.slice(1));if(pile!=='reserve')assert.deepEqual(m.players.dark[pile],[f.top,...before[pile]]);
 assert.equal(m.turn.activated,f.m.turn.activated);assert.equal(state.lifeForce(m,'dark'),state.lifeForce(f.m,'dark'));assert.equal(runtime.project(m,rules,'light').rules.revealedReserve,undefined);m=priority(finish(m),'dark');assert.ok(!ids(m).includes('labria:reveal:'+f.labria));
});
for(const bp of ['1_309','1_304'])test('Labria immediately loses revealed '+bp+' through a specific-card loss window',()=>{
 const f=fixture(bp);let m=begin(f);assert.equal(m.stack.at(-1).event.kind,'about-to-lose');assert.equal(runtime.project(m,rules,'light').rules.revealedReserve[0].id,f.top);assert.ok(!ids(m).some(id=>id.startsWith('labria:return:')));m=finish(m);assert.equal(m.cards[f.top].zone,'lost');assert.equal(state.lifeForce(m,'dark'),state.lifeForce(f.m,'dark')-1);
});
test('Labria eligibility requires own Control, active source and nonempty Reserve',()=>{
 const f=fixture();for(const mutation of [m=>m.turn.phase='deploy',m=>m.turn.side='light',m=>state.moveCard(m,f.labria,'hand'),m=>{for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'used')}]){const m=clone(f.m);mutation(m);assert.ok(!ids(m).includes('labria:reveal:'+f.labria));}
});
for(const mode of ['source-departs','source-returns','cancelled','empty-during-responses'])test('Labria initiated result '+mode,()=>{
 const f=fixture();let m=step(f.m,'labria:reveal:'+f.labria);
 if(mode==='cancelled')m.stack.find(f=>f.action?.handler==='labria:reveal').cancelled=true;
 else if(mode==='empty-during-responses')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'used');
 else{state.moveCard(m,f.labria,'hand');if(mode==='source-returns'){state.moveCard(m,f.labria,'table');m.cards[f.labria].location=f.remote;}}
 m=seek(m,x=>x.stack.at(-1)?.handler==='labria:acknowledge'||x.stack.length===1);
 if(mode.startsWith('source')){assert.equal(m.stack.at(-1).handler,'labria:acknowledge');m=step(m,'labria:acknowledge');m=step(m,'labria:return:force');}else assert.equal(m.stack.length,1);
 m=priority(finish(m),'dark');assert.equal(ids(m).includes('labria:reveal:'+f.labria),mode==='source-returns');
});
for(const mode of ['leave','leave-return','replace','shuffle','insert-shuffle'])test('Manipulating a publicly revealed card ends its reveal: '+mode,()=>{
 const f=fixture();let m=begin(f);const r=m.stack.at(-1).payload.reveal;
 if(mode==='leave'||mode==='leave-return'){state.moveCard(m,f.top,'hand');if(mode==='leave-return')state.moveCard(m,f.top,'reserve');}
 if(mode==='replace')state.moveCard(m,f.top,'reserve');
 if(mode==='shuffle')state.shufflePile(m,'dark','reserve',()=>0);
 if(mode==='insert-shuffle')state.insertCard(m,f.insert,'dark',()=>0);
 assert.equal(reveal.stillRevealed(m,r),false);assert.equal(runtime.project(m,rules,'light').rules.revealedReserve,undefined);assert.deepEqual(ids(m),['labria:finish']);const before=clone(m.players);m=step(m,'labria:finish');assert.deepEqual(m.players,before);
});
test('A changed vehicle is not replaced by another Reserve card as a loss',()=>{
 const f=fixture('1_309');let m=begin(f);state.moveCard(m,f.top,'hand');const before=clone(m.players.dark);m=finish(m);assert.deepEqual(m.players.dark,before);
});
for(const pile of ['reserve','force','used'])test('Labria '+pile+' and the insert immediately below the revealed card',()=>{
 const f=fixture();let m=f.m;state.insertCard(m,f.insert,'dark',()=>0);state.moveCard(m,f.top,'reserve');inserts.insertsIn(m,'dark')[0].position=1;m=begin(f,m);assert.equal(inserts.insertsIn(m,'dark')[0].revealed,false);m=step(m,'labria:return:'+pile);
 if(pile==='reserve'){assert.equal(inserts.insertsIn(m,'dark')[0].position,1);assert.equal(inserts.insertsIn(m,'dark')[0].revealed,false);}else{assert.equal(m.stack.at(-1).event.kind,'insert-revealed');assert.equal(inserts.insertsIn(m,'dark')[0].revealed,true);assert.equal(m.cards[f.top].zone,pile);m=finish(m);assert.equal(m.cards[f.insert].zone,'lost');}
});
test('A short Reserve may return its sole card without loss or activation',()=>{const f=fixture();for(const id of f.m.players.dark.reserve.slice(1))state.moveCard(f.m,id,'used');let m=begin(f);m=step(m,'labria:return:reserve');assert.deepEqual(m.players.dark.reserve,[f.top]);assert.equal(m.status,'playing')});
test('Saved reveal corruption is rejected atomically',()=>{
 const f=fixture(),m=begin(f);for(const mutation of [m=>m.stack.at(-1).payload.reveal.manipulation++,m=>m.stack.at(-1).payload.reveal.card.version++,m=>m.stack.at(-1).payload.ref.zone='hand',m=>m.data.labriaUses.cards=[],m=>m.stack.at(-1).side='light',m=>m.data.revealVersions[f.top]=-1,m=>m.stack.at(-1).handler='labria:unknown']){const bad=clone(m);mutation(bad);const before=clone(bad);assert.throws(()=>prompt(bad));assert.deepEqual(bad,before);}
});
test('CPU chooses usable Force from public Labria choices; concession remains available',()=>{const f=fixture(),m=begin(f);assert.equal(cpu.chooseComputerAction(runtime.project(m,rules,'dark'),'dark'),'labria:return:force');const done=step(m,'concede');assert.equal(done.result.winner,'light');assert.equal(rules.supports('1_184'),true);assert.equal(load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.supports('1_184'),false)});

test('Opponent must acknowledge the public reveal, including after refresh',()=>{const f=fixture();let m=step(f.m,'labria:reveal:'+f.labria);m=seek(m,x=>x.stack.at(-1)?.handler==='labria:acknowledge');assert.equal(prompt(m).side,'light');assert.deepEqual(ids(m),['labria:acknowledge']);for(const side of ['light','dark'])assert.equal(runtime.project(clone(m),rules,side).rules.revealedReserve[0].id,f.top);assert.throws(()=>step(m,'labria:acknowledge','dark'),/Illegal/);m=step(m,'labria:acknowledge');assert.equal(prompt(m).side,'dark')});
test('Returning a peeked card ends an existing public reveal even without a zone change',()=>{const f=fixture(),m=begin(f),p=m.stack.at(-1).payload.reveal,peek=load(new URL('../../lib/native-engine/reserve-peek.ts',import.meta.url));peek.returnReservePeek(m,peek.peekReserve(m,'dark',1));assert.equal(reveal.stillRevealed(m,p),false);assert.deepEqual(ids(m),['labria:finish'])});
test('Pile placement/loss responses finish before the reveal-completed response',()=>{for(const bp of ['1_194','1_304']){const f=fixture(bp);let m=begin(f);if(bp==='1_194')m=step(m,'labria:return:force');else m=seek(m,x=>x.stack.at(-1)?.event?.kind==='cards-lost');assert.notEqual(m.stack.at(-1).event.kind,'reserve-revealed');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='reserve-revealed');assert.equal(m.stack.at(-1).event.source,f.labria);assert.equal(runtime.project(m,rules,'light').rules.revealedReserve,undefined)}});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/labria-results.json',import.meta.url)));
for(const row of oracle)test('Executed GEMP Labria comparison: '+row.mode,()=>{
 const f=fixture(row.blueprint);let m=f.m;
 if(row.mode==='short')for(const id of m.players.dark.reserve.slice(1))state.moveCard(m,id,'used');
 if(row.mode.startsWith('insert')){state.insertCard(m,f.insert,'dark',()=>0);state.moveCard(m,f.top,'reserve');inserts.insertsIn(m,'dark')[0].position=1;}
 m=step(m,'labria:reveal:'+f.labria);if(row.mode==='source-departs')state.moveCard(m,f.labria,'hand');m=seek(m,x=>x.stack.at(-1)?.handler==='labria:acknowledge');
 for(const side of ['dark','light'])assert.equal(runtime.project(m,rules,side).rules.revealedReserve.some(c=>c.id===f.top),row.bothSeeReveal);
 m=step(m,'labria:acknowledge');const pile={RESERVE_DECK:'reserve',FORCE_PILE:'force',USED_PILE:'used',LOST_PILE:'lost'}[row.destination];
 if(pile!=='lost')m=step(m,'labria:return:'+pile);else m=seek(m,x=>x.cards[f.top].zone==='lost');
 assert.equal(m.players.dark[pile][0],f.top);if(row.mode.startsWith('insert')){assert.equal(inserts.insertsIn(m,'dark')[0].revealed,row.insertRevealed);assert.equal(m.cards[f.insert].zone==='lost',row.insertLost);}
 m=priority(finish(m),'dark');assert.equal(ids(m).includes('labria:reveal:'+f.labria),row.repeat);
});
test('Labria oracle receipt fingerprints the executed harness and observations',async()=>{const crypto=await import('node:crypto'),r=JSON.parse(fs.readFileSync(new URL('./gemp/labria-provenance.json',import.meta.url)));for(const[file,hash]of Object.entries(r.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(r.observations,oracle.length);assert.equal(r.unchangedProductionFiles,6820)});
