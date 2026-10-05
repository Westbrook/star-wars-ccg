import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules} from './match-runner.mjs';
import {readGempMatch,replayGempMatch} from './gemp-match-replay.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const captureRecord=()=>readGempMatch(new URL('./gemp/complete-matches/capture-space.json.gz',import.meta.url));
export function captureRules(){
 const profile=JSON.parse(fs.readFileSync(new URL('./gemp/complete-matches/capture-space-decks.json',import.meta.url)));
 return {...auditRules,supports:bp=>profile.decks.some(d=>d.main.includes(bp)),starting:{...auditRules.starting,ordinarySetup:m=>Object.values(m.cards).every(c=>profile.decks.some(d=>d.side===c.owner&&d.main.includes(c.blueprint)))}};
}
/** Continue exact recorded commands from a persisted legal boundary. No driver
 * decisions, new entropy, board corrections or setup shortcuts occur here. */
export function resumeCaptureMatch(match,transcript){
 let state=structuredClone(match);const rules=captureRules();
 for(const [index,entry] of transcript.entries()){
  if(entry.revision<match.revision)continue;
  let used=0;const entropy=entry.entropy??[];
  const command={revision:entry.revision,choice:entry.choice};
  state=runtime.applyCommand(JSON.parse(JSON.stringify(state)),rules,entry.side,command,()=>{assert.ok(used<entropy.length,'Unrecorded resumed entropy');return entropy[used++];},1800000000000+index);
  assert.equal(used,entropy.length,'Unused resumed entropy');
 }
 return state;
}
export function captureMatchFixtures(){
 const checkpoints=[],record=captureRecord(),result=replayGempMatch(record,{onCheckpoint:c=>checkpoints.push(c)});
 return {record,result,checkpoints};
}

/** Browser starts are copied only from the continuous legal replay. Each slice
 * carries both seats' exact command/entropy stream and a settled end state. */
export function captureBrowserFixtures(){
 const {record,result,checkpoints}=captureMatchFixtures();
 return [['occupied-capture',751,778],['empty-capture-theft',817,850],['crew-seizure-theft',936,976]].map(([id,from,to])=>{
  const start=checkpoints.find(c=>c.index===from),end=checkpoints.find(c=>c.index===to);assert.ok(start&&end,id);
  const commands=result.transcript.flatMap((entry,index)=>entry.revision>=start.match.revision&&entry.revision<end.match.revision?[{...entry,time:1800000000000+index}]:[]);
  assert.equal(commands.length,end.match.revision-start.match.revision);
  return {id,source:'capture-space',start:start.match,end:end.match,commands,decks:record.decks};
 });
}
