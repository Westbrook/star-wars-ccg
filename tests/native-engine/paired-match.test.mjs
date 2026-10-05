import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {assertInterruptTargets,assertInterruptTarget,assertReferenceAction,readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const cards={luke:{blueprint:'101_2'},leia:{blueprint:'1_17'}};
function targetRows(explicit=false){return [{semantic:{kind:'battle-add',side:'light',card:'sky',targets:['luke','leia']},state:{table:[{id:'luke'},{id:'leia'}]},targetObservations:[{card:'luke',blueprint:'101_2',group:1,referenceCardId:'10',afterDecision:explicit?1:0},{card:'leia',blueprint:'1_17',group:2,referenceCardId:'11',afterDecision:explicit?1:0}]},...(explicit?[{type:'CARD_SELECTION',semantic:{kind:'interrupt-target',side:'light',card:'luke'},answer:'10',parameters:{cardId:['10','12'],blueprintId:['101_2','101_2'],selectable:['true','false']}}]:[])];}
test('two actual primary groups can be filled by one explicit choice and one immediate shortcut',()=>{assert.deepEqual(assertInterruptTargets(targetRows(true),0,cards),['luke','leia']);assert.deepEqual(assertInterruptTargets(targetRows(),0,cards),['luke','leia']);});
for(const change of ['duplicate-card','duplicate-group','missing-observation','blueprint','off-table','boundary','answer','selectable','side','borrowed-action'])test('paired target evidence rejects '+change,()=>{
 const rows=targetRows(true),r=rows[0],o=r.targetObservations;
 if(change==='duplicate-card')r.semantic.targets[1]='luke';if(change==='duplicate-group')o[1].group=1;if(change==='missing-observation')o.pop();if(change==='blueprint')o[1].blueprint='1_11';if(change==='off-table')r.state.table.pop();if(change==='boundary')o[1].afterDecision=50;if(change==='answer')rows[1].answer='12';if(change==='selectable')rows[1].parameters.selectable[0]='false';if(change==='side')rows[1].semantic.side='dark';if(change==='borrowed-action'){rows.splice(1,0,{semantic:{kind:'draw'}});o.forEach(x=>x.afterDecision=2);}
 assert.throws(()=>assertInterruptTargets(rows,0,cards));
});
const record=()=>readGempMatch(new URL('./gemp/complete-matches/paired-battle.json.gz',import.meta.url));
const cardMap=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([side,list])=>list.map((blueprint,i)=>[side+'-'+(i+1),{blueprint}])));
test('complete reference match records all three paired Interrupts and four bound cancellations',()=>{
 const r=record(),cards=cardMap(r),kinds=new Set();let pairs=0,cancels=0;
 for(let i=0;i<r.trace.length;i++){const row=r.trace[i];if(row.semantic?.kind==='battle-add'){assertReferenceAction(row);assertInterruptTargets(r.trace,i,cards);kinds.add(cards[row.semantic.card].blueprint);pairs++;}if(row.semantic?.kind==='named-cancel'){assertReferenceAction(row);assertInterruptTarget(r.trace,i,cards,{playing:true});cancels++;}}
 assert.deepEqual([...kinds].sort(),['1_110','1_116','1_76']);assert.equal(pairs,10);assert.equal(cancels,4);
});
test('full-game duplicate additions are noncumulative and cancellation removes only its own addition',()=>{
 const r=record(),after=i=>r.trace.slice(i+1).find(x=>x.semantic?.kind==='forfeit'&&x.state.battleDestinies).state;
 // First battle: Cocky is canceled; Strong is played twice and Skywalkers once.
 const initial=r.trace.findIndex(x=>x.semantic?.kind==='battle-add'),end=r.trace.findIndex((x,i)=>i>initial&&x.semantic?.kind==='forfeit'),plays=r.trace.slice(initial,end).filter(x=>x.semantic?.kind==='battle-add'),cards=cardMap(r);
 assert.deepEqual(plays.map(x=>cards[x.semantic.card].blueprint),['1_76','1_116','1_110','1_116']);assert.equal(after(initial).battleDestinies.light.cards.length,4);
 const canceledSky=r.trace.findIndex(x=>x.semantic?.kind==='named-cancel'&&cards[x.semantic.target].blueprint==='1_110');assert.equal(after(canceledSky).battleDestinies.light.cards.length,1);
 const lastCocky=r.trace.findLastIndex(x=>x.semantic?.kind==='battle-add'&&cards[x.semantic.card].blueprint==='1_76');assert.equal(after(lastCocky).battleDestinies.light.cards.length,3);
});
for(const kind of ['battle-add','named-cancel'])test('recorded '+kind+' rejects a false action label',()=>{const row=record().trace.find(r=>r.semantic?.kind===kind);row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Draw card';assert.throws(()=>assertReferenceAction(row),/does not match/);});
test('a cancellation cannot borrow a resolved or different pending Interrupt',()=>{const r=record(),cards=cardMap(r),i=r.trace.findIndex(x=>x.semantic?.kind==='named-cancel'),row=r.trace[i];assertInterruptTarget(r.trace,i,cards,{playing:true});row.state.players.light.lost.push(row.semantic.target);assert.throws(()=>assertInterruptTarget(r.trace,i,cards,{playing:true}),/not being played/);row.state.players.light.lost.pop();r.trace[i-1].semantic.card='another-card';assert.throws(()=>assertInterruptTarget(r.trace,i,cards,{playing:true}),/differs from pending/);});
test('cancellation label must name the observed card in the active response',()=>{const r=record(),row=r.trace.find(r=>r.semantic?.kind==='named-cancel'),i=row.parameters.actionId.indexOf(row.answer),label=row.parameters.actionText[i];row.parameters.actionText[i]='Cancel Skywalkers';assert.throws(()=>assertReferenceAction(row),/label differs/);row.parameters.actionText[i]=label;row.text='Choose Battle action or Pass';assert.throws(()=>assertReferenceAction(row),/not responding/);});
test('ordinary setup through final victory matches physical destinies, losses and every checkpoint',()=>{const r=record(),result=replayGempMatch(r);assert.equal(result.commands,2627);assert.equal(result.checkpoints,280);assert.equal(result.state.turn.number,30);assert.deepEqual(result.state.result,{winner:'dark',loser:'light',reason:'life-force'});});
for(const field of ['target','destiny','attrition'])test('complete replay rejects altered '+field+' evidence',()=>{const r=record();if(field==='target'){const row=r.trace.find(r=>r.semantic?.kind==='battle-add');row.targetObservations[1].card=row.targetObservations[0].card;}else{const row=r.trace.find(r=>r.semantic?.kind==='forfeit'&&r.state.battleDestinies);if(field==='destiny')row.state.battleDestinies.light.values[0]+=1;else row.state.battleLosses.light.attrition+=1;}assert.throws(()=>replayGempMatch(r));});
test('complete-match provenance binds the exact executed harness, decks and bytes',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/paired-match-provenance.json',import.meta.url))),bytes=f=>fs.readFileSync(new URL('../../'+f,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),r=record();
 assert.equal(hash(bytes(p.fixture)),p.sha256);assert.equal(hash(gunzipSync(bytes(p.fixture))),p.jsonSha256);assert.equal(hash(bytes(p.harness)),p.harnessSha256);assert.equal(hash(bytes(p.profile)),p.profileSha256);assert.equal(hash(fs.readFileSync(new URL('./gemp/NativeEnginePairedBattleMatchOracleTests.java',import.meta.url))),p.harnessSha256);assert.equal(p.referenceDecisions,r.trace.length);assert.equal(p.unchangedProductionFiles,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.junitTests,1);assert.equal(r.finished,true);
});
