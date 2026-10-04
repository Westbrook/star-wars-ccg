import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';

/** Resume an actual complete-match checkpoint, with no arranged board or piles. */
export function battleReductionFixture(){
 const record=readGempMatch(new URL('./gemp/complete-matches/ground-recovery.json.gz',import.meta.url));
 let result;
 const replay=replayGempMatch(record,{onCheckpoint({index,row,match}){
  if(row.semantic.kind==='reduce'&&row.state.battleLosses?.dark.totalAttrition>0&&row.state.battleLosses?.light.totalAttrition>0){
   const amount=record.trace[index+1].count;
   const losses=record.trace.slice(index+1).filter(r=>r.semantic?.kind==='forfeit');
   result={m:match,card:row.semantic.card,amount,light:losses[0].semantic.card,dark:losses[1].semantic.card};
  }
 }});
 assert.ok(result);assert.equal(result.m.turn.number,14);assert.equal(replay.state.status,'finished');
 return result;
}
