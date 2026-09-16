import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createScenario,prompt,project,applyCommand,assertMatch,step,until,fallback,runPath,observe} from './integration-paths.mjs';
import {control,paths,runControlPath} from './signal-control-paths.mjs';
const old=JSON.parse(fs.readFileSync(new URL('./fixtures/signal-v13.json',import.meta.url)));
test('previous saved Signal runs retain exact results and single-drain endpoint',()=>{
 for(const {path,match} of old.results)assert.deepEqual(runPath(path,old.initial).m,match);
});
test('both drain orders complete and keep independent outcomes, piles and react use',()=>{
 for(const path of paths){const m=runControlPath(path),r=m.reactStudy;assert.equal(m.complete,true);assert.equal(m.drained.length,2);assert.deepEqual(r.drains.map(d=>d.site),m.drained);const bay=r.drains.find(d=>d.site===m.locations[0]),corridor=r.drains.find(d=>d.site===m.locations[1]);assert.equal(bay.amount,1);assert.equal(bay.cancelled,!path.endsWith('pass'));assert.deepEqual(corridor,{site:m.locations[1],amount:0,cancelled:false});assert.equal(m.players.light.lost.length,path.endsWith('pass')?1:0);assert.equal(m.players.light.force.length,path.endsWith('pass')?4:path.endsWith('wolfman')?1:3);assert.equal(r.used.length,path.endsWith('pass')?0:1);}
});
test('finish Control is optional before either drain and after just one',()=>{
 for(const index of [-1,0,1]){let m=createScenario('react-drain-deploy');if(index>=0){m=step(m,'drain:'+m.locations[index]);m=until(m,control);}m=step(m,'pass');m=until(m,x=>x.complete,x=>'pass');assert.equal(m.drained.length,index<0?0:1);assert.equal(m.players.light.lost.length,index===0?1:0);}
});
test('a canceled first drain cannot repeat and used Wolfman cannot react again',()=>{
 let m=createScenario('react-drain-deploy');const bay=m.locations[0],corridor=m.locations[1];m=step(m,'drain:'+bay);const wolf=prompt(m).choices.find(c=>c.card&&m.cards[c.card].blueprint==='1_30');m=step(m,wolf.id);m=until(m,control);
 assert.deepEqual(prompt(m).choices.map(c=>c.id),['drain:'+corridor,'pass']);assert.throws(()=>step(m,'drain:'+bay));m=step(m,'drain:'+corridor);assert.equal(m.reactStudy.cancelled,false);assert.equal(m.reactStudy.drains[0].cancelled,true);assert.ok(!prompt(m).choices.some(c=>c.reactPreview));assert.throws(()=>step(m,'react:move:'+wolf.card));
});
test('no stale or other-seat actions; every decision round trips through JSON with private projections',()=>{
 let count=0;observe((before,choice,after)=>{const p=prompt(before);assert.throws(()=>applyCommand(before,p.side==='dark'?'light':'dark',{prompt:p.id,choice}));assert.throws(()=>applyCommand(after,p.side,{prompt:p.id,choice}));assertMatch(JSON.parse(JSON.stringify(after)));for(const side of ['light','dark'])assert.deepEqual(project(after,side).players[side==='light'?'dark':'light'].hand,[]);count++;});try{for(const path of paths)runControlPath(path);}finally{observe(undefined);}assert.ok(count>50);
});
test('invalid history and cross-version Control frames fail closed',()=>{
 for(const mutate of [m=>delete m.reactStudy.drains,m=>m.engine='native-proof-13',m=>m.stack[0].priority='invalid',m=>m.drained.push(m.locations[0]),m=>m.reactStudy.drains.push({site:m.locations[0],amount:1,cancelled:false})]){const m=createScenario('react-drain-deploy');mutate(m);assert.throws(()=>assertMatch(m));}
});
test('six legal two-site paths match GEMP ordered piles and hands',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/signal-control-oracle-result.json',import.meta.url)));assert.deepEqual(oracle.map(r=>r.path),paths);
 for(const expected of oracle){const m=runControlPath(expected.path);for(const side of ['dark','light']){const actual={};for(const pile of ['reserve','force','used','lost','hand']){actual[pile]=m.players[side][pile].map(id=>m.cards[id].blueprint);if(pile==='hand')actual[pile].sort();}assert.deepEqual(actual,expected[side],expected.path+' '+side);}}
});
