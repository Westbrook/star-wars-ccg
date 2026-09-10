import assert from 'node:assert/strict';
import test from 'node:test';
import {engine} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,project}=engine;
function step(m,choice){const p=prompt(m);return JSON.parse(JSON.stringify(applyCommand(m,p.side,{prompt:p.id,choice:choice||p.choices[0].id})))}
function damageCheckpoint(){let m=createScenario('battle');let steps=0;while(prompt(m)?.title!=='Satisfy battle losses'){assert.ok(++steps<50);m=step(m)}return m}

test('loss totals stay unavailable until calculation, even after both destiny choices',()=>{
 let m=createScenario('battle'),sawCompletedDraws=false;
 while(!project(m,'dark').losses){
  if(m.battle.drawn.light&&m.battle.drawn.dark)sawCompletedDraws=true;
  assert.equal(project(m,'light').losses,null);m=step(m);
 }
 assert.ok(sawCompletedDraws);assert.deepEqual(project(m,'dark').losses.dark,{attrition:3,damage:2,initialAttrition:3,initialDamage:2});assert.equal(project(m,'light').losses.light.attrition,1);
 assert.equal(project(step(createScenario('battle'),'stop'),'dark').losses,null);
 for(const id of ['activation','drain','recirculation'])assert.equal(project(createScenario(id),'dark').losses,null);
});
test('one forfeit covers damage while attrition remains; Force alone leaves attrition unchanged',()=>{
 const m=damageCheckpoint(),p=prompt(m),forfeit=p.choices.find(c=>c.id.startsWith('forfeit:')),force=p.choices.find(c=>c.id==='lose:reserve');
 assert.deepEqual(forfeit.lossPreview,{kind:'forfeit',value:2,attrition:1,damage:0});assert.deepEqual(force.lossPreview,{kind:'force',value:1,attrition:3,damage:1});
 const after=step(m,forfeit.id),shown=project(after,'dark').losses.dark;assert.deepEqual(shown,{attrition:1,damage:0,initialAttrition:3,initialDamage:2});
 assert.equal(project(after,'light').losses.light.attrition,1);assert.equal(project(m,'light').prompt.choices.length,0);
});
test('every displayed loss preview agrees with the authoritative next state across all eight battle paths',()=>{
 let previews=0;
 for(const drawLight of [true,false])for(const drawDark of [true,false])for(const forceFirst of [true,false]){
  let m=createScenario('battle');let steps=0;
  while(!m.complete){assert.ok(++steps<100);const p=prompt(m),view=project(m,p.side);
   for(const c of view.prompt.choices.filter(c=>c.lossPreview)){
    const after=step(m,c.id);assert.equal(c.lossPreview.attrition,after.battle.attrition[p.side]);assert.equal(c.lossPreview.damage,after.battle.damage[p.side]);previews++;
   }
   let choice=p.choices[0].id;
   if(p.title==='Battle destiny')choice=(p.side==='light'?drawLight:drawDark)?'draw-destiny':'skip-destiny';
   else if(forceFirst&&p.choices.some(c=>c.id==='lose:reserve'))choice='lose:reserve';
   m=step(m,choice);
  }
  // Existing schema-1 saves need no new persisted fields to restore the panel.
  const reloaded=JSON.parse(JSON.stringify(m));for(const s of ['light','dark']){const shown=project(reloaded,s).losses[s];assert.equal(shown.attrition,0);assert.equal(shown.damage,0)}
 }
 assert.ok(previews>50);
});
