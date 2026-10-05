import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/mentor-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function mentorFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/mentor-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 const bp=id=>record.decks[id.split('-')[0]][Number(id.split('-')[1])-1];
 return ['obi-use','obi-move','obi-lose','mentor','canceled-mentor'].map(id=>{
  const i=checkpoints.findIndex((c,index)=>id==='obi-use'?c.row.semantic.kind==='obi-use':id.startsWith('obi-')?c.row.semantic.kind==='obi-choice'&&c.row.answer===(id==='obi-move'?'0':'1'):c.row.semantic.kind==='battle-add'&&bp(c.row.semantic.card)==='1_82'&&(checkpoints[index+1]?.row.semantic.kind==='named-cancel')===(id==='canceled-mentor')),start=checkpoints[i];assert.ok(start,id);
  const end=id.startsWith('obi-')?checkpoints[i+1]:checkpoints.slice(i+1).find(c=>c.row.state.battleDestinies);assert.ok(end,'Missing completed checkpoint');
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);return {id,start:start.match,end:end.match,commands,card:start.row.semantic.card};
 });
}
