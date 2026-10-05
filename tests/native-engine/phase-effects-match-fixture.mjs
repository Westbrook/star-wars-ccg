import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch,assertPhaseMatchEvidence} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/phase-effects-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function phaseEffectsMatchFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/phase-effects-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)}),e=assertPhaseMatchEvidence(record,replay.state.cards);assert.equal(replay.state.status,'finished');
 const pairs=e.penalties.map((p,n)=>({id:'penalty-'+(n+1),start:p.indices[0],end:record.trace.findIndex((r,i)=>i>p.indices.at(-1)&&r.state.phase!=='deploy')}));
 pairs.push({id:'qualifying-deployment',start:e.avoided[0].deployIndex,end:e.avoided[0].index},{id:'effect-self-loss',start:e.removals[0].triggerIndex,end:e.removals[0].index});
 return pairs.map(p=>{
  const start=checkpoints.find(c=>c.index===p.start),end=checkpoints.find(c=>c.index>=p.end);assert.ok(start&&end,p.id);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id:p.id,start:start.match,end:end.match,commands};
 });
}
