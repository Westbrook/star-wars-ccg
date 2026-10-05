import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/search-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function searchFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/search-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 return checkpoints.filter(c=>c.row.semantic.kind==='mentor-search').map((start,n)=>{
  const end=checkpoints.find(c=>c.index>start.row.searchOutcome.afterDecision);assert.ok(end,'Missing post-search checkpoint');
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);return {id:(start.row.selection?'found':'failed')+'-'+n,start:start.match,end:end.match,commands,card:start.row.semantic.card,selected:start.row.selection?.card};
 });
}
