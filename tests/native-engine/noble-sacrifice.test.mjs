import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,runtime,state,rules,clone,pull,prompt,ids,step,seek,progress,finish,respondable,nobleChoice,restrictions,stats,persona} from './noble-fixture.mjs';
for(const mode of ['retrieve','decline','attachments','blocked','forfeit-four','tarl','plans','sense','deployed-departs'])test('Noble Sacrifice '+mode+' matches actual GEMP',()=>{
 const f=fixture(mode);let m=f.m,optional=0;assert.ok(nobleChoice(m,f.noble));m=step(m,nobleChoice(m,f.noble));
 assert.equal(m.stack.at(-1).event.kind,'about-to-place-out-of-play');assert.equal(m.cards[f.target].zone,'table');assert.ok(!ids(m).some(id=>id.startsWith('cancel:')));
 m=respondable(m,f.noble);assert.equal(m.cards[f.target].zone,'out');assert.equal(m.players.light.force.length,8);assert.ok(!m.players.light.lost.includes(f.target));
 if(mode==='sense')m=step(m,'cancel:play:'+f.sense+':'+f.noble+':'+f.vader);
 if(mode==='deployed-departs')state.moveCard(m,f.deployed,'hand');
 for(let n=0;n<300&&m.cards[f.noble].zone!=='lost';n++){
  if(m.stack.at(-1)?.handler==='noble:retrieve'){optional++;m=step(m,mode==='decline'?'noble:decline':'noble:retrieve')}else m=progress(m);
 }
 assert.equal(m.cards[f.noble].zone,'lost');assert.equal(m.cards[f.target].zone,'out');
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/noble-sacrifice-results.json',import.meta.url))).find(x=>x.mode===mode);assert.ok(observed);
 assert.deepEqual({retrieved:f.lost.filter(id=>m.cards[id].zone==='used').length,optional,spent:8-m.players.light.force.length,out:true,paidBeforeResponse:true},Object.fromEntries(['retrieved','optional','spent','out','paidBeforeResponse'].map(k=>[k,observed[k]])));
 if(mode==='attachments')assert.ok([f.gun,f.device].every(id=>m.cards[id].zone==='used'));
 for(const side of ['dark','light']){const view=runtime.project(m,rules,side);assert.ok(view.out.some(c=>c.id===f.target));assert.ok(!JSON.stringify(view).includes('notified'));}
});

test('Noble Sacrifice needs an opponent character deployment and equal current power',()=>{
 const f=fixture();assert.ok(nobleChoice(f.m,f.noble));
 for(const mutate of [m=>m.stack.at(-1).event.kind='moved',m=>m.stack.at(-1).event.card=f.target,m=>state.moveCard(m,f.target,'hand'),m=>state.moveCard(m,f.deployed,'hand')]){const m=clone(f.m);mutate(m);assert.ok(!nobleChoice(m,f.noble));}
});
for(const returnToTable of [false,true])test('failed out-of-play cost '+(returnToTable?'cannot reacquire a returned character':'ends the Interrupt')+' before Sense or retrieval',()=>{
 const f=fixture();let m=step(f.m,nobleChoice(f.m,f.noble));state.moveCard(m,f.target,'hand');if(returnToTable){state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;}
 m=finish(m,f.noble);assert.equal(m.cards[f.target].zone,returnToTable?'table':'hand');assert.ok(f.lost.every(id=>m.cards[id].zone==='lost'));assert.equal(m.players.light.force.length,8);
});

test('sacrifice amount and contributor eligibility freeze before cost responses',()=>{
 const f=fixture('forfeit-four');let m=step(f.m,nobleChoice(f.m,f.noble));stats.addStatModifier(m,f.remote,f.target,'forfeit','reset',0);restrictions.preventRetrievalContribution(m,f.remote,f.target);m=finish(m,f.noble);assert.equal(f.lost.filter(id=>m.cards[id].zone==='used').length,4);
});

test('malformed sacrifice snapshots reject atomically, including unpaid response and corrupted references',()=>{
 const f=fixture();let m=step(f.m,nobleChoice(f.m,f.noble));
 for(const mutate of [p=>p.parent=99,p=>p.amount=-1,p=>p.eligible='yes',p=>p.target.version=999,p=>p.deployed.zone='hand',p=>p.window=0]){const bad=clone(m);mutate(bad.stack.at(-2).action.payload);const before=clone(bad);assert.throws(()=>runtime.applyCommand(bad,rules,prompt(m).side,{revision:bad.revision,choice:'pass'}));assert.deepEqual(bad,before);}
 m=respondable(m,f.noble);const bad=clone(m);bad.stack.at(-2).action.payload.paid=false;assert.throws(()=>runtime.prompt(bad,rules,'dark'),/Unpaid/);
});

test('concession during sacrifice cost terminates without applying pending retrieval',()=>{
 const f=fixture();let m=step(f.m,nobleChoice(f.m,f.noble));m=runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'concede'});assert.equal(m.status,'finished');assert.ok(f.lost.every(id=>m.cards[id].zone==='lost'));
});

const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
test('CPU only sacrifices a small exposed unit in a Life Force emergency and accepts retrieval',()=>{
 const f=fixture();assert.equal(chooseComputerAction(runtime.project(f.m,rules,'light'),'light'),'pass');
 for(const id of [...f.m.players.light.reserve,...f.m.players.light.force].slice(0,-4))state.moveCard(f.m,id,'lost');
 assert.equal(chooseComputerAction(runtime.project(f.m,rules,'light'),'light'),nobleChoice(f.m,f.noble));
 let m=step(f.m,nobleChoice(f.m,f.noble));m=seek(m,x=>x.stack.at(-1)?.handler==='noble:retrieve');assert.equal(chooseComputerAction(runtime.project(m,rules,'light'),'light'),'noble:retrieve');
});

test('an out-of-play unique sacrifice bars later copies and remains publicly inspectable',()=>{
 const f=fixture('retrieve',['1_22','1_22']);const owen=pull(f.m,'light','1_22','table',f.site),copy=pull(f.m,'light','1_22','hand');
 const choice=ids(f.m).find(id=>id.startsWith('noble:play:'+f.noble+':'+owen+':'));assert.ok(choice);
 const m=finish(step(f.m,choice),f.noble);assert.equal(m.cards[owen].zone,'out');assert.equal(persona.canEnterTable(m,copy),false);
 for(const side of ['light','dark'])assert.ok(runtime.project(m,rules,side).out.some(c=>c.id===owen));
});
