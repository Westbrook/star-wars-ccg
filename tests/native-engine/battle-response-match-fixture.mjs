import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';

/** Capture actual consecutive checkpoints only after the entire game matches. */
export function battleResponseFixtures(){
 const cases=[['stun','ground-battle-responses','stun'],['stun-failed','ground-redraws','stun'],['dice','ground-destiny-switch','dice'],['takeel','ground-destiny-switch','takeel']];
 const output=[];
 for(const name of new Set(cases.map(c=>c[1]))){
  const checkpoints=[],record=readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
  const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
  for(const [id,source,kind]of cases.filter(c=>c[1]===name)){
   const i=checkpoints.findIndex(c=>c.row.semantic.kind===kind),start=checkpoints[i],end=checkpoints[i+1];assert.ok(start&&end);
   const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
   assert.equal(commands.length,end.match.revision-start.match.revision);
   output.push({id,source,kind,start:start.match,end:end.match,commands,card:start.row.semantic.card,target:start.row.semantic.target});
  }
 }
 return output;
}
