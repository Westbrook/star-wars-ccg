import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertStartingSetupEvidence} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/preparation-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
test('ordinary complete match binds simultaneous Interrupt choices and all six real starting deployments',()=>{
 const r=record(),p=assertStartingSetupEvidence(r,cards(r));for(const side of ['dark','light'])assert.equal(p.effects[side].length,3);assert.ok(r.trace.some(x=>x.semantic?.kind==='battle'&&x.free));assert.ok(r.trace.some(x=>x.semantic?.kind==='battle'&&!x.free));assert.ok(r.trace.some(x=>x.semantic?.kind==='drain'&&x.initiationCost===3));
});
for(const mode of ['answer','printed-blueprint','physical-mapping','mapping-length','owner','not-in-reserve','not-selectable','not-an-effect','missing-outcome','missing-interrupt','repeat-interrupt','lost-placement','opening-hand','opening-reserve'])test('starting setup evidence rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind==='setup-effect'),row=r.trace[i],id=row.semantic.card,side=row.side,j=r.trace.findIndex(x=>x.state.phase==='activate');
 if(mode==='answer')row.answer='absent';if(mode==='printed-blueprint')row.parameters.blueprintId[0]='1_28';if(mode==='physical-mapping')row.setupOffered[0]=side+'-8';if(mode==='mapping-length')row.setupOffered.pop();if(mode==='owner')map[id].owner=side==='light'?'dark':'light';if(mode==='not-in-reserve')row.state.players[side].reserve=row.state.players[side].reserve.filter(c=>c!==id);if(mode==='not-selectable')row.parameters.selectable[0]='false';if(mode==='not-an-effect'){map[id].blueprint='1_28';row.parameters.blueprintId[0]='1_28';}
 if(mode==='missing-outcome'){const next=r.trace.findIndex((x,n)=>n>i&&x.semantic?.kind==='setup-effect');for(let n=i+1;n<=next;n++)r.trace[n].state.table=r.trace[n].state.table.filter(c=>c.id!==id);}
 if(mode==='missing-interrupt')delete r.trace.find(x=>x.semantic?.kind==='setup-interrupt').semantic;
 if(mode==='repeat-interrupt'){const n=r.trace.findIndex(x=>x.semantic?.kind==='setup-interrupt');r.trace.splice(n+1,0,structuredClone(r.trace[n]));}
 if(mode==='lost-placement'){r.setup.players.dark.lost=[];r.trace[j].state=structuredClone(r.setup);}if(mode==='opening-hand'){r.setup.players.light.hand.pop();r.trace[j].state=structuredClone(r.setup);}if(mode==='opening-reserve'){r.setup.players.dark.reserve.pop();r.trace[j].state=structuredClone(r.setup);}
 assert.throws(()=>assertStartingSetupEvidence(r,map));
});
test('full native replay matches opening piles, all207 checkpoints and Life Force victory',()=>{
 const r=replayGempMatch(record());assert.equal(r.commands,2378);assert.equal(r.checkpoints,207);assert.equal(r.state.turn.number,34);assert.deepEqual(r.state.result,{winner:'light',loser:'dark',reason:'life-force'});assert.equal(r.transcript.filter(c=>c.choice.startsWith('prep-start:deploy:')).length,6);assert.ok(r.transcript.some(c=>c.choice.startsWith('battle-free:')));assert.ok(r.transcript.some(c=>c.choice.startsWith('battle:')));
});
for(const mode of ['drain-cost','free-cost','free-label','free-choice','setup-table'])test('complete replay rejects fabricated '+mode,()=>{
 const r=record();if(mode==='drain-cost')r.trace.find(x=>x.semantic?.kind==='drain').initiationCost=0;
 if(mode==='free-cost')r.trace.find(x=>x.semantic?.kind==='battle'&&x.free).initiationCost=1;
 if(mode==='free-label'){const row=r.trace.find(x=>x.semantic?.kind==='battle'&&x.free);row.parameters.actionText[row.parameters.actionId.indexOf(row.answer)]='Initiate battle';}
 if(mode==='free-choice')r.trace.find(x=>x.semantic?.kind==='battle'&&x.free).free=false;
 if(mode==='setup-table'){r.setup.table[0].location='dark-1';r.trace.find(x=>x.state.phase==='activate').state=structuredClone(r.setup);}
 assert.throws(()=>replayGempMatch(r));
});
test('complete-match receipt binds source, profile, result and unchanged reference production',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/preparation-match-provenance.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');for(const [name,sha] of Object.entries(p.files))assert.equal(hash(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))),sha);const bytes=fs.readFileSync(new URL('./gemp/complete-matches/preparation-battle.json.gz',import.meta.url));assert.equal(hash(gunzipSync(bytes)),p.jsonSha256);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.referenceDecisions,record().trace.length);assert.equal(p.nativeCommands,2378);assert.equal(p.comparedCheckpoints,207);
});
