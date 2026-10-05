import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,play,finish,success,loss,runtime,rules,state,pull,step,seek,priority,prompt,ids,ordinary} from './try-effects-fixture.mjs';
const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
for(const side of ['dark','light'])for(const mode of ['sense','alter'])for(const effects of [['dark'],['light'],['dark','light']])test(side+' '+mode+' under '+effects.join('+'),()=>{
 const f=fixture({side,mode,effects}),before=state.lifeForce(f.m,side);let m=success(play(f));assert.equal(prompt(m).mandatory,true);assert.equal(prompt(m).choices.length,effects.length);m=finish(m);
 assert.equal(state.lifeForce(m,side),before-2*effects.length);assert.equal(m.cards[f[mode==='sense'?'senses':'alters'][side]].zone,'lost');assert.equal(m.cards[f.die].zone,'used');
});
for(const side of ['dark','light'])for(const mode of ['sense','alter'])test(side+' failed '+mode+' still goes Lost without a penalty',()=>{const f=fixture({side,mode,failure:true}),before=state.lifeForce(f.m,side),m=finish(play(f));assert.equal(state.lifeForce(m,side),before);assert.equal(m.cards[f[mode==='sense'?'senses':'alters'][side]].zone,'lost');});
for(const effectSide of ['dark','light'])test(effectSide+' Effect deploys free, stays unique and is immune to Alter before and after arrival',()=>{
 const f=fixture({effects:[effectSide],zone:'hand'}),copy=pull(f.m,effectSide,effectSide==='light'?'4_21':'4_134','hand');let m=seek(f.m,x=>ordinary(x,'deploy',effectSide));const before=m.players[effectSide].force.length;m=step(m,'try-effect:deploy:'+f.cards[effectSide]);assert.ok(!ids(m).some(id=>id.includes(f.alters[effectSide==='dark'?'light':'dark']+':'+f.cards[effectSide]+':')));m=seek(m,x=>ordinary(x,'deploy',effectSide));assert.equal(m.cards[f.cards[effectSide]].zone,'table');assert.equal(m.players[effectSide].force.length,before);assert.ok(!ids(m).includes('try-effect:deploy:'+copy));m=priority(m,effectSide==='dark'?'light':'dark');assert.ok(!ids(m).some(id=>id.includes(':'+f.cards[effectSide]+':')));
});
test('a direct Alter counter changes disposition but causes no successful-destiny penalty',()=>{
 const f=fixture({side:'dark',effects:['light']}),before=state.lifeForce(f.m,'light');let m=play(f);m=priority(m,'light');m=step(m,'cancel:play:'+f.alters.light+':'+f.senses.dark+':direct');m=finish(m);assert.equal(m.cards[f.senses.dark].zone,'lost');assert.equal(m.cards[f.alters.light].zone,'lost');assert.equal(state.lifeForce(m,'light'),before+1);
});
test('initiated subtype remains Lost when the Effect leaves before the result',()=>{const f=fixture(),before=state.lifeForce(f.m,'dark');let m=play(f);state.moveCard(m,f.cards.light,'hand');m=finish(m);assert.equal(m.cards[f.senses.dark].zone,'lost');assert.equal(state.lifeForce(m,'dark'),before);});
test('an Effect arriving during responses triggers the loss but cannot rewrite the initiated subtype',()=>{const f=fixture({effects:[]}),before=state.lifeForce(f.m,'dark');let m=play(f);state.moveCard(m,f.cards.light,'table');m=finish(m);assert.equal(m.cards[f.senses.dark].zone,'used');assert.equal(state.lifeForce(m,'dark'),before-1);});
test('suppressed text supplies neither the subtype modifier nor the penalty',()=>{const f=fixture();text.suppressGameText(f.m,f.site,f.cards.light);const before=state.lifeForce(f.m,'dark'),m=finish(play(f));assert.equal(m.cards[f.senses.dark].zone,'used');assert.equal(state.lifeForce(m,'dark'),before+1);});
test('an initiated mandatory loss survives its source leaving and refresh',()=>{const f=fixture();let m=success(play(f));m=step(m,ids(m)[0]);state.moveCard(m,f.cards.light,'hand');m=loss(JSON.parse(JSON.stringify(m)));assert.equal(m.stack.at(-1).payload.remaining,2);const before=state.lifeForce(m,'dark');m=finish(m);assert.equal(state.lifeForce(m,'dark'),before-2);});
test('both penalties resolve independently in either mandatory order',()=>{for(const reverse of [false,true]){const f=fixture({effects:['dark','light']});let m=success(play(f)),choices=ids(m);m=step(m,choices[reverse?1:0]);m=finish(m);assert.equal(m.players.dark.lost.length,5);}});
test('the ordinary reduction Interrupt can reduce the consequence',()=>{const f=fixture({side:'light'}),reduce=pull(f.m,'light','1_90','hand'),before=state.lifeForce(f.m,'light');let m=success(play(f));m=step(m,ids(m)[0]);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-loss');m=priority(m,'light');const id=ids(m).find(id=>id.includes(reduce));assert.ok(id);m=step(m,id);m=finish(m);assert.equal(state.lifeForce(m,'light'),before);assert.equal(m.cards[reduce].zone,'used');});
test('stale, foreign and corrupt consequence commands reject atomically',()=>{const f=fixture();let m=success(play(f)),old=structuredClone(m);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:ids(m)[0]}));assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision-1,choice:ids(m)[0]}));assert.deepEqual(m,old);m=step(m,ids(m)[0]);for(const patch of [{side:'light'},{window:-1},{interrupt:f.characters.dark}]){const bad=structuredClone(m);Object.assign(bad.stack.at(-2).action.payload,patch);assert.throws(()=>prompt(bad),/Sense\/Alter/);}});
test('losing the last Life Force ends the game before the cancellation completes',()=>{
 const f=fixture();let m=loss(play(f));for(const side of ['dark']){const keep=m.players[side].reserve.slice(0,1);for(const pile of ['reserve','force','used'])for(const id of [...m.players[side][pile]])if(!keep.includes(id))state.moveCard(m,id,'hand');}m=step(m,'lose:reserve');assert.equal(m.status,'finished');assert.equal(m.result.winner,'light');assert.equal(m.cards[f.shuffles.light].zone,'playing');
});
for(const side of ['dark','light'])test(side+': CPU evaluates the shared penalty using only its visible hand',()=>{
 const cpu=load(new URL('../../lib/native-engine/computer.ts',import.meta.url)),f=fixture({side,effects:[side],zone:'hand'});let m=seek(f.m,x=>ordinary(x,'deploy',side));
 const id='try-effect:deploy:'+f.cards[side],project=()=>{const v=runtime.project(m,rules,side);v.prompt.choices=v.prompt.choices.filter(c=>c.id===id||c.id==='pass');return v;};
 assert.equal(cpu.chooseComputerAction(project(),side),'pass');for(const card of [f.senses[side],f.alters[side]])state.moveCard(m,card,'reserve');assert.equal(cpu.chooseComputerAction(project(),side),id);
});
test('a canceled Effect deployment and malformed Lost disposition remain safe',()=>{
 const f=fixture({effects:['dark'],zone:'hand'});let m=seek(f.m,x=>ordinary(x,'deploy','dark'));m=step(m,'try-effect:deploy:'+f.cards.dark);m.stack.at(-2).cancelled=true;m=seek(m,x=>ordinary(x,'deploy','dark'));assert.equal(m.cards[f.cards.dark].zone,'lost');
 const pending=play(fixture());pending.stack.at(-2).action.payload.disposition='hand';assert.throws(()=>prompt(pending),/disposition/);
});
const fs=await import('node:fs'),{createHash}=await import('node:crypto'),oracle=JSON.parse(fs.readFileSync(new URL('./gemp/try-effects-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP: '+[row.side,row.kind,row.effects,row.failure,row.mode].join(' '),()=>{
 const effects=row.effects==='both'?['dark','light']:[row.effects??row.side];
 if(row.kind==='deployment'){
  const f=fixture({side:row.side,effects:[row.side],zone:'hand'});let m=seek(f.m,x=>ordinary(x,'deploy',row.side)),before=m.players[row.side].force.length;m=step(m,'try-effect:deploy:'+f.cards[row.side]);assert.equal(ids(m).some(id=>id.startsWith('cancel:play:')&&id.includes(':'+f.cards[row.side]+':')),row.alterOffered);m=seek(m,x=>ordinary(x,'deploy',row.side));assert.equal(before-m.players[row.side].force.length,row.cost);assert.equal(m.cards[f.cards[row.side]].zone,'table');return;
 }
 const f=fixture({side:row.side,mode:row.kind==='lifetime'?'alter':row.kind,effects:row.kind==='lifetime'?(row.mode==='arrive'?[]:['light']):effects,failure:row.failure});
 if(row.mode==='suppressed')text.suppressGameText(f.m,f.site,f.cards.light);
 let m=play(f);if(row.mode==='depart')state.moveCard(m,f.cards.light,'hand');if(row.mode==='arrive')state.moveCard(m,f.cards.light,'table');m=finish(m);assert.equal(m.players[row.side].lost.length,row.lost);assert.equal(m.cards[f[row.kind==='sense'?'senses':'alters'][row.side]].zone,row.interruptZone);
});
test('GEMP receipt binds all thirty-two actual observations and unchanged production sources',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('./gemp/try-effects-provenance.json',import.meta.url)));for(const [file,hash]of [[r.harness,r.harnessSha256],[r.results,r.resultsSha256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(oracle.length,r.branches);assert.equal(r.branches,32);assert.equal(r.productionFilesCompared,6820);assert.equal(r.productionFilesChanged,0);
});
