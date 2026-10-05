import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/effect-search-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function effectSearchMatchFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/effect-search-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 return ['dark-search','light-search','failed-search','deployment'].map(id=>{
  const start=checkpoints.find(c=>id==='deployment'?c.row.semantic.kind==='table-effect':c.row.semantic.kind==='effect-search'&&(id==='failed-search'?!c.row.selection:!!c.row.selection&&c.row.side===id.split('-')[0]));assert.ok(start,id);
  const after=start.row.searchOutcome?.afterDecision??start.index,end=checkpoints.find(c=>c.index>after);assert.ok(end);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id,start:start.match,end:end.match,commands,cost:id==='deployment'?0:3};
 });
}
