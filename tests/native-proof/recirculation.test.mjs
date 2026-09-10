import test from 'node:test';
import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
const {createScenario,applyCommand,prompt,project,assertMatch}=engine;
const restore=m=>JSON.parse(JSON.stringify(m));
const next=m=>{const p=prompt(m);return restore(applyCommand(m,p.side,{prompt:p.id,choice:'recirculate'}))};

test('study evidence compares the fixed start with actual saved piles through both decisions',()=>{
 const initial=createScenario('recirculation');let m=restore(initial);
 for(let revision=0;revision<=2;revision++){
  const projection=project(m,'dark',true),study=projection.recirculationStudy;
  assert.deepEqual(project(restore(m),'dark',true),projection);
  for(const side of ['dark','light']){
   const p=study.players[side],resolved=revision>=(side==='dark'?1:2);
   assert.equal(p.resolved,resolved);
   assert.equal(p.orderPreserved,resolved?true:null);
   assert.equal(p.reserveUnchanged,true);assert.equal(p.forceUnchanged,true);
   for(const zone of ['reserve','used','force']){
    assert.deepEqual(p.before[zone],initial.players[side][zone]);
    assert.deepEqual(p.current[zone],m.players[side][zone]);
   }
   for(const id of p.before.used)assert.equal(study.cards[id].id,id);
   if(resolved)assert.deepEqual(p.current.reserve.slice(-2),p.before.used);
  }
  if(revision<2)m=next(m);
 }
});

test('inspection detects reversed Used cards, reordered original Reserve, and displaced Force',()=>{
 const complete=next(next(createScenario('recirculation')));
 for(const side of ['dark','light']){
  const reversed=restore(complete),r=reversed.players[side].reserve;
  r.splice(-2,2,...r.slice(-2).reverse());assertMatch(reversed);
  let p=project(reversed,side,true).recirculationStudy.players[side];
  assert.equal(p.orderPreserved,false);assert.equal(p.reserveUnchanged,true);
  assert.deepEqual(p.current.reserve.slice(-2),[...p.before.used].reverse());
  const reordered=restore(complete),r2=reordered.players[side].reserve;
  [r2[0],r2[1]]=[r2[1],r2[0]];assertMatch(reordered);
  p=project(reordered,side,true).recirculationStudy.players[side];
  assert.equal(p.orderPreserved,false);assert.equal(p.reserveUnchanged,false);
  const displaced=restore(complete),player=displaced.players[side];
  const force=player.force[0],reserve=player.reserve[0];
  player.force[0]=reserve;player.reserve[0]=force;
  displaced.cards[force].zone='reserve';displaced.cards[reserve].zone='force';assertMatch(displaced);
  assert.equal(project(displaced,side,true).recirculationStudy.players[side].forceUnchanged,false);
 }
});

test('hidden study piles are absent by default and outside this exact scenario',()=>{
 for(const scenario of ['activation','drain','battle','recirculation']){
  let m=createScenario(scenario);
  for(const side of ['dark','light']){
   assert.equal('recirculationStudy' in project(m,side),false);
   assert.equal('recirculationStudy' in project(m,side,false),false);
   if(scenario!=='recirculation')assert.equal('recirculationStudy' in project(m,side,true),false);
  }
 }
});
