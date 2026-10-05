import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/bionic-battle-decks.json',import.meta.url)));
export const decks=profile.decks.map(d=>({side:d.side,cards:d.main}));
export const rules={...auditRules,supports:bp=>decks.some(d=>d.cards.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>decks.some(d=>d.side===c.owner&&d.cards.includes(c.blueprint)))}};
export function bionicMatchFixtures(){
 const record=readGempMatch(new URL('./gemp/complete-matches/bionic-battle.json.gz',import.meta.url)),checkpoints=[];
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 return ['rearm','weapon-total','disarmed-again'].map(id=>{
  const start=checkpoints.find(c=>id==='rearm'?c.row.semantic.kind==='bionic-deploy':id==='weapon-total'?c.row.semantic.kind==='weapon-total'&&c.row.weaponTotal.hands.length&&c.row.weaponTotal.draws.length===2:c.row.semantic.kind==='disarm-deploy'&&c.row.disarmOutcome.attachedBefore.some(card=>c.match.cards[card].blueprint==='5_12'));assert.ok(start,id);
  const boundary=id==='rearm'?start.row.bionicOutcome.afterDecision:id==='disarmed-again'?start.row.disarmOutcome.afterDecision:start.index;
  const end=checkpoints.find(c=>c.index>boundary&&c.row.semantic.kind!=='loss-order');assert.ok(end);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);return {id,start:start.match,end:end.match,commands,card:start.row.semantic.card,target:start.row.semantic.target};
 });
}
