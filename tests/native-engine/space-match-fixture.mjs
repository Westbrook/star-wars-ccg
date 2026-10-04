import assert from 'node:assert/strict';
import {readGempMatch,replayGempMatch,followingTarget,deployedCrewRole} from './gemp-match-replay.mjs';
export function spaceMatchFixtures(name='space-crew'){
 const checkpoints=[],record=readGempMatch(new URL('./gemp/complete-matches/'+name+'.json.gz',import.meta.url));
 const replay=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});assert.equal(replay.state.status,'finished');
 const cases=name==='space-journeys'?[['layout',c=>c.row.semantic.kind==='site'&&c.row.semantic.card==='light-50']]:[
  ['pilot',c=>{if(c.row.semantic.kind!=='deploy')return false;const to=followingTarget(record.trace,c.index,'deploy-target').semantic.card;if(!c.row.state.table.some(v=>v.id===to&&v.vesselStats))return false;return deployedCrewRole(record.trace,c.index,c.row.semantic.card,to)==='pilot';}],
  ['hyperspace',c=>c.row.semantic.kind==='hyperspace'&&c.row.state.table.some(v=>v.attachedTo===c.row.semantic.card&&v.aboardRole==='pilot')],
  ['forfeit',c=>c.row.semantic.kind==='forfeit'&&c.row.state.table.some(v=>v.attachedTo===c.row.semantic.card&&v.aboardRole)],
 ];
 return cases.map(([id,accept])=>{
  const i=checkpoints.findIndex(accept),start=checkpoints[i],end=checkpoints[i+1];assert.ok(start&&end,id);
  const commands=replay.transcript.flatMap((c,index)=>c.revision>=start.match.revision&&c.revision<end.match.revision?[{...c,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id,source:name,start:start.match,end:end.match,commands,card:start.row.semantic.card,decks:record.decks};
 });
}
