import test from 'node:test';
import assert from 'node:assert/strict';
import {ready,fixture,choice,total,runtime,rules,state,step,seek,priority,prompt} from './preparation-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
const provider=load(new URL('../../lib/native-engine/preparation-destiny.ts',import.meta.url));
const ids=m=>prompt(m).choices.map(c=>c.id),clone=structuredClone,event=m=>m.stack.at(-1)?.event;
for(const side of ['dark','light']){
 test(side+': printed USED function modifies the individual battle draw and survives reload',()=>{
  const f=ready(side);let m=step(f.m,choice(f));assert.equal(m.cards[f.cards[side]].zone,'playing');m=total(JSON.parse(JSON.stringify(m)),side);assert.equal(event(m).total,2);assert.equal(event(m).draws[0].value,2);assert.equal(m.cards[f.cards[side]].zone,'used');assert.equal(m.cards[f.draw].zone,'used');
  assert.equal(ids(m).some(id=>id.startsWith('preparation:')),false);
 });
 test(side+': canceled Interrupt goes Lost without changing the draw',()=>{const f=ready(side);let m=step(f.m,choice(f));m.stack.at(-2).cancelled=true;m=total(m,side);assert.equal(event(m).total,1);assert.equal(m.cards[f.cards[side]].zone,'lost');});
 test(side+': canceled destiny is not revived by the pending modifier',()=>{const f=ready(side);let m=step(f.m,choice(f));m.stack.find(x=>x.action?.handler==='battle:destiny-finish').cancelled=true;m=seek(m,x=>x.cards[f.draw].zone==='used'&&x.data.battle.destiny[side]===null);assert.equal(m.cards[f.cards[side]].zone,'used');});
 test(side+': physical relocation does not cancel the numerical draw',()=>{const f=ready(side);let m=step(f.m,choice(f));state.moveCard(m,f.draw,'hand');m=total(m,side);assert.equal(event(m).total,2);assert.equal(m.cards[f.draw].zone,'hand');});
 test(side+': unique copy cannot be played twice during the turn',()=>{const f=ready(side);let m=step(f.m,choice(f));m=seek(m,x=>x.cards[f.cards[side]].zone==='used');m=priority(m,side);assert.ok(!ids(m).includes('preparation:destiny:'+f.seconds[side]));});
 test(side+': rejects stale/foreign commands and corrupted draw bindings atomically',()=>{
  const f=ready(side),old=clone(f.m);assert.throws(()=>step(f.m,choice(f),side==='dark'?'light':'dark'));assert.throws(()=>runtime.applyCommand(f.m,rules,side,{revision:f.m.revision-1,choice:choice(f)}));assert.deepEqual(f.m,old);
  for(const corrupt of [p=>p.index=-1,p=>p.actionId='forged',p=>p.window++,p=>p.draw.id=f.luke,p=>p.draw.version++,p=>p.card=f.cards[side==='dark'?'light':'dark']]){const m=step(f.m,choice(f));corrupt(m.stack.at(-2).action.payload);assert.throws(()=>prompt(m),/preparation|reference/i);}
 });
 test(side+': action belongs only to its own battle draw, not a weapon or total window',()=>{
  const f=ready(side),w=f.m.stack.at(-1);assert.equal(provider.preparationActions(f.m,w,side==='dark'?'light':'dark').length,0);
  for(const kind of ['weapon-destiny-drawn','destiny-drawn','destiny-total','battle-weapons']){const m=clone(f.m);m.stack.at(-1).event.kind=kind;assert.equal(provider.preparationActions(m,m.stack.at(-1),side).length,0);}
 });
 test(side+': concession while response pending remains final',()=>{const f=ready(side),m=step(step(f.m,choice(f)),'concede',side);assert.equal(m.result.loser,side);assert.equal(runtime.prompt(m,rules,side),null);});
}
test('Smoke Screen substitution cannot be modified by the USED function',()=>{
 const f=fixture();let m=priority(f.m,'light');m=step(m,'smoke:'+f.smoke+':'+f.luke);m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');assert.equal(event(m).substituted,true);assert.ok(!ids(m).includes(choice(f)));m=total(m,'light');assert.equal(event(m).total,3);
});
test('a later Han’s Dice redraw discards the earlier +1 modifier',()=>{
 const f=ready();let m=step(f.m,choice(f));m=seek(m,x=>x.cards[f.cards.light].zone==='used');m=priority(m,'light');assert.equal(m.data.battle.destiny.light,2);m=step(m,'dice:'+f.dice+':'+f.luke);m=total(m,'light');assert.equal(event(m).total,1);assert.equal(m.cards[f.draw].zone,'used');
});

for(const side of ['dark','light'])test(side+': CPU plays the legal bonus using only its projection',()=>{const f=ready(side),cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));assert.equal(cpu.chooseComputerAction(runtime.project(f.m,rules,side),side),choice(f));});
for(const side of ['dark','light'])test(side+': actual Sense cancels the USED function through a nested destiny',()=>{
 const f=ready(side),opponent=side==='dark'?'light':'dark';let m=step(f.m,choice(f));m=priority(m,opponent);
 const die=m.players[opponent].reserve.find(id=>m.cards[id].blueprint===(opponent==='dark'?'1_194':'1_28'));state.moveCard(m,die,'hand');state.moveCard(m,die,'reserve');
 const id=ids(m).find(id=>id.startsWith('cancel:play:'+f.senses[opponent]+':'+f.cards[side]+':'));assert.ok(id);m=step(m,id);m=total(m,side);assert.equal(event(m).total,1);assert.equal(m.cards[f.cards[side]].zone,'lost');assert.equal(m.cards[f.senses[opponent]].zone,'used');
});

test('a physical card moved before play retains its original draw identity',()=>{const f=ready();state.moveCard(f.m,f.draw,'hand');let m=step(f.m,choice(f));m=total(m,'light');assert.equal(event(m).total,2);assert.equal(m.cards[f.draw].zone,'hand');});
const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/preparation-destiny-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP individual draw: '+row.side+' '+row.mode,()=>{
 const f=ready(row.side),opponent=row.side==='dark'?'light':'dark';let m=step(f.m,choice(f));
 if(row.mode==='relocated')state.moveCard(m,f.draw,'hand');
 if(row.mode==='canceled'){
  m=priority(m,opponent);const die=m.players[opponent].reserve.find(id=>m.cards[id].blueprint===(opponent==='dark'?'1_194':'1_28'));state.moveCard(m,die,'hand');state.moveCard(m,die,'reserve');
  m=step(m,ids(m).find(id=>id.startsWith('cancel:play:'+f.senses[opponent]+':'+f.cards[row.side]+':')));
 }
 m=seek(m,x=>event(x)?.kind==='destiny-draw-complete'&&event(x).category==='battle'&&event(x).side===row.side);
 const zone={used:'TOP_OF_USED_PILE',lost:'TOP_OF_LOST_PILE',destiny:'TOP_OF_UNRESOLVED_DESTINY_DRAW',hand:'HAND'};
 assert.equal(event(m).value,row.value);assert.equal(zone[m.cards[f.cards[row.side]].zone],row.interruptZone);assert.equal(zone[m.cards[f.draw].zone],row.drawZone);
});
test('executed GEMP receipt binds the exact harness and six observations',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/preparation-destiny-provenance.json',import.meta.url)));
 for(const [file,hash]of [[receipt.harness,receipt.harnessSha256],[receipt.results,receipt.resultsSha256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
 assert.equal(oracle.length,6);assert.equal(receipt.productionFilesCompared,6820);assert.equal(receipt.productionFilesChanged,0);
});
test('preparation Starting provider is registered but full native admission remains closed',()=>{
 const {premiereSetup}=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url)),f=ready();assert.equal(premiereSetup.ordinarySetup(f.m),false);assert.ok(premiereSetup.interrupts);assert.equal(rules.supports('9_139'),true);const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));assert.equal(premiereRules.supports('9_139'),false);
});

for(const side of ['dark','light'])test(side+': bonus changes one draw in a multiple-destiny sequence',()=>{const f=ready(side,1);assert.ok(f.m.stack.at(-2).action.payload.flow);const m=total(step(f.m,choice(f)),side);assert.deepEqual(event(m).draws.map(d=>d.value),[2,1]);assert.equal(event(m).total,3);});
