import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGempMatch,replayGempMatch,assertSearchEvidence,assertStartingSetupEvidence} from './gemp-match-replay.mjs';
const record=()=>readGempMatch(new URL('./gemp/complete-matches/effect-search-battle.json.gz',import.meta.url));
const cards=r=>Object.fromEntries(Object.entries(r.decks).flatMap(([owner,list])=>list.map((blueprint,i)=>[owner+'-'+(i+1),{blueprint,owner}])));
test('complete game binds two one-Effect starts and four paid searches by both players',()=>{
 const r=record(),map=cards(r),setup=assertStartingSetupEvidence(r,map);for(const side of ['dark','light'])assert.equal(setup.effects[side].length,1);
 const searches=r.trace.flatMap((x,i)=>x.semantic?.kind==='effect-search'?[assertSearchEvidence(r.trace,i,map,r.final)]:[]);assert.equal(searches.length,4);assert.equal(searches.filter(s=>s.selected).length,3);assert.equal(searches.filter(s=>!s.selected).length,1);assert.deepEqual([...new Set(searches.map(s=>s.side))].sort(),['dark','light']);
 for(const s of searches.filter(s=>s.selected))assert.ok(r.trace.some((x,i)=>i>s.afterDecision&&x.semantic?.kind==='table-effect'&&x.semantic.card===s.selected),'Searched Effect must subsequently deploy');
});
for(const mode of ['cost','payment-order','used-cleanup','source','owner','non-effect','physical-mapping','mapping-length','borrowed-choice','selection-answer','shuffle-membership','shuffle-outcome'])test('full-game search evidence rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind==='effect-search'&&x.selection),row=r.trace[i],side=row.side,o=row.searchOutcome,c=r.trace[row.selection.atDecision],after=r.trace[o.afterDecision+1].state.players[side];
 if(mode==='cost')after.force.unshift(row.state.players[side].force[0]);if(mode==='payment-order')[after.used[1],after.used[2]]=[after.used[2],after.used[1]];if(mode==='used-cleanup')after.used.shift();if(mode==='source')o.source='dark-60';if(mode==='owner')map[row.semantic.card].owner=side==='dark'?'light':'dark';
 if(mode==='non-effect')map[row.selection.card].blueprint=side==='dark'?'1_194':'1_28';if(mode==='physical-mapping')c.searchOffered[c.parameters.cardId.indexOf(c.answer)]='dark-60';if(mode==='mapping-length')c.searchOffered.pop();if(mode==='borrowed-choice')c.semantic.initiation=i-1;if(mode==='selection-answer')c.answer='invalid';if(mode==='shuffle-membership')o.reserve[0]=row.selection.card;if(mode==='shuffle-outcome')after.reserve.reverse();
 assert.throws(()=>assertSearchEvidence(r.trace,i,map,r.final));
});
for(const mode of ['eligible-card','missing-verification','wrong-seat','wrong-source','nonempty-answer'])test('failed full-game search rejects '+mode,()=>{
 const r=record(),map=cards(r),i=r.trace.findIndex(x=>x.semantic?.kind==='effect-search'&&!x.selection),row=r.trace[i],j=r.trace.findIndex(x=>x.semantic?.kind==='search-verify'&&x.semantic.initiation===i),c=r.trace[j];
 if(mode==='eligible-card')map[row.state.players[row.side].reserve[0]].blueprint=row.side==='dark'?'4_134':'4_21';if(mode==='missing-verification')delete c.semantic;if(mode==='wrong-seat')c.semantic.side=r.trace.find((x,n)=>n!==j&&x.semantic?.kind==='search-verify'&&x.semantic.initiation===i).semantic.side;if(mode==='wrong-source')c.semantic.card='dark-60';if(mode==='nonempty-answer')c.answer='0';assert.throws(()=>assertSearchEvidence(r.trace,i,map,r.final));
});
test('native replay matches all197 checkpoints and final Life Force victory',()=>{const r=replayGempMatch(record());assert.equal(r.commands,2293);assert.equal(r.checkpoints,197);assert.equal(r.state.turn.number,29);assert.deepEqual(r.state.result,{winner:'dark',loser:'light',reason:'life-force'});assert.equal(r.transcript.filter(c=>c.choice.startsWith('effect-search:play:')).length,4);assert.equal(r.transcript.filter(c=>c.choice.startsWith('prep-start:deploy:')).length,2);assert.equal(r.transcript.filter(c=>c.choice==='effect-search:verified').length,1);});
test('complete-match evidence retains exact source and unchanged GEMP production',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/effect-search-match-provenance.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');for(const [name,sha]of Object.entries(p.files))assert.equal(hash(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))),sha);assert.equal(hash(gunzipSync(fs.readFileSync(new URL('./gemp/complete-matches/effect-search-battle.json.gz',import.meta.url)))),p.jsonSha256);assert.equal(p.referenceDecisions,1589);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.nativeCommands,2293);assert.equal(p.comparedCheckpoints,197);});
