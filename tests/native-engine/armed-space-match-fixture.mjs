import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
// Checkpoint indices identify real decisions in the immutable complete-game
// receipts. No fixture rewrites card zones, draws, outcomes or pending timing.
export function armedSpaceMatchFixtures(){
 const cases=[['armed-space-ion',[['maneuver',142,145],['ion',160,161],['battery',145,146]]],['armed-space-lasers',[['failed-torpedo',170,171]]]];
 return cases.flatMap(([source,selected])=>{
  const checkpoints=[],record=readGempMatch(new URL('./gemp/complete-matches/'+source+'.json.gz',import.meta.url));
  const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
  return selected.map(([id,from,to])=>{
   const start=checkpoints[from],end=checkpoints[to];assert.ok(start&&end,id);
   assert.equal(start.row.semantic.kind,id==='maneuver'?'maneuver':'fire');
   const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
   assert.equal(commands.length,end.match.revision-start.match.revision);
   return {id,source,start:start.match,end:end.match,commands,card:start.row.semantic.card,decks:record.decks};
  });
 });
}
