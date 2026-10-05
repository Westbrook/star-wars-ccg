import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/force-effects-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function forceEffectsMatchFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/force-effects-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 return ['counter-assault','sense-exclusion','for-luck','dark-forces'].map(id=>{
  const start=checkpoints.find(c=>id==='counter-assault'?c.row.semantic.kind==='assault'&&c.row.side==='dark':id==='sense-exclusion'?c.row.semantic.kind==='sense':c.row.semantic.kind==='force-boost'&&c.row.side===(id==='for-luck'?'light':'dark'));assert.ok(start,id);
  const assault=id==='counter-assault'?start.row.semantic.card:id==='sense-exclusion'?start.row.targetEvidence.find(t=>['1_113','1_238'].includes(t.blueprint)).card:start.row.assault;
  const owner=start.match.cards[assault].owner,end=checkpoints.find(c=>c.index>start.index&&c.match.players[owner].lost.includes(assault));assert.ok(end);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id,start:start.match,end:end.match,commands};
 });
}
