import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch,followingTarget} from './gemp-match-replay.mjs';
export function vehicleMatchFixtures(name='ground-vehicles'){
 const checkpoints=[],record=readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 const bp=id=>record.decks[id.split('-')[0]][Number(id.split('-')[1])-1];
 const cases=name==='ground-vehicle-reacts'?[['react',c=>c.row.semantic.kind==='vehicle-react']]:[
  ['move',c=>c.row.semantic.kind==='move'&&bp(c.row.semantic.card)==='3_69'],
  ['passenger',c=>c.row.semantic.kind==='deploy'&&['3_69','3_155'].includes(bp(followingTarget(record.trace,c.index,'deploy-target').semantic.card))],
 ];
 return cases.map(([id,accept])=>{
  const i=checkpoints.findIndex(accept),start=checkpoints[i],end=checkpoints[i+1];assert.ok(start&&end);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id,source:name,start:start.match,end:end.match,commands,card:start.row.semantic.card,decks:record.decks};
 });
}
