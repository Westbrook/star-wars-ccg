import test from 'node:test';
import assert from 'node:assert/strict';
import {runObjectiveMatch,resumeObjectiveMatch} from './objective-match-fixture.mjs';
let running;const completed=()=>running??=runObjectiveMatch();

test('ISB and Undercover complete an actual 60-card service match through Life Force victory',async()=>{
 const record=await completed();assert.equal(record.initial.status,'setup');assert.equal(record.state.status,'finished');assert.equal(record.state.result.reason,'life-force');assert.equal(record.commandRows,record.transcript.length+record.initial.revision);
 for(const d of record.decks)assert.equal(d.cards.length,60);
 const chosen=record.transcript.map(e=>e.choice);
 assert.ok(chosen.some(id=>id.startsWith('objective-deploy:')),'Objective must deploy its required Coruscant location through setup');
 assert.ok(chosen.some(id=>id.startsWith('objective:flip:')),'Real four-agent establishment must trigger Objective flip');
 assert.ok(chosen.some(id=>id.startsWith('objective:retrieve:')),'Objective optional retrieval must be used');
 assert.ok(chosen.some(id=>id.startsWith('retrieve:')),'An actual Lost Pile agent must be retrieved');
 assert.ok(chosen.some(id=>id.startsWith('undercover:deploy:')));assert.ok(chosen.some(id=>id.startsWith('undercover:move:')));assert.ok(chosen.some(id=>id.startsWith('undercover:break:')));
 assert.equal(record.policy.agentLost,true,'Agent must enter Lost through real Force loss');
 assert.ok(record.policy.darkUndercover&&record.policy.lightUndercover&&record.policy.lightMoved);
});

test('Objective flip, retrieval and undercover custody resume from exact saved states',async()=>{
 const record=await completed();
 for(const key of ['opening','flip','retrieval','undercover','undercover-move']){
  const snapshot=record.snapshots[key];assert.ok(snapshot,key+' must be reached');const before=JSON.stringify(snapshot);
  assert.deepEqual(resumeObjectiveMatch(record,snapshot),record.state,key+' continuation must reproduce exact final state');assert.equal(JSON.stringify(snapshot),before);
 }
});

test('the complete command and recorded entropy transcript replays from ordinary initial setup',async()=>{
 const record=await completed();assert.deepEqual(resumeObjectiveMatch(record),record.state);
 const altered=structuredClone(record);const command=altered.transcript.find(e=>e.choice.startsWith('undercover:move:'));assert.ok(command);command.choice='undercover:move:missing:missing';assert.throws(()=>resumeObjectiveMatch(altered));
});
