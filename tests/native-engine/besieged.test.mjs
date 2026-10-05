import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deployed,selection,begun,mod,runtime,state,rules,pull,phase,step,ids,seek} from './besieged-fixture.mjs';
import {clone,boundary,priority} from './prisoner-fixture.mjs';
const refresh=m=>{state.assertState(m);rules.validate(m);for(const side of ['dark','light'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));return m;};
test('Besieged deploys on captured ship and restores exact subset selection',()=>{
 const f=fixture();let m=selection(f);refresh(m);assert.equal(m.cards[f.card].zone,'table');assert.ok(ids(m).includes('besieged:add:'+f.escort));assert.ok(ids(m).includes('besieged:add:'+f.second));assert.ok(!ids(m).includes('besieged:begin'));
 m=step(m,'besieged:add:'+f.escort);refresh(m);assert.ok(ids(m).includes('besieged:begin'));assert.ok(!ids(m).includes('besieged:add:'+f.escort));
 const before=m.players.dark.force.length;m=step(m,'besieged:begin');refresh(m);assert.equal(m.players.dark.force.length,before-1);assert.deepEqual(m.data.battle.participants,{dark:[f.escort],light:f.characters});assert.equal(m.cards[f.ship].zone,'inactive');assert.ok(f.characters.every(id=>m.cards[id].zone==='table'));assert.equal(m.cards[f.gun].zone,'table');
 assert.equal(mod('occupancy').characterPresent(m,f.escort),true);assert.ok(f.characters.every(id=>mod('occupancy').characterPresent(m,id)));assert.equal(mod('captured-ship-state').trappedCharacters(m,f.ship).length,2);
 assert.equal(mod('ability').abilityForBattleDestiny(m,f.characters[1]),1);assert.deepEqual(mod('battle').members(m,'dark'),[f.escort]);
});
test('trapped weapon fires in real battle and character powers contribute without vessels',()=>{
 const f=fixture();let m=priority(boundary(begun(f),'battle-weapons'),'light');refresh(m);assert.ok(ids(m).includes('fire:'+f.gun+':'+f.escort));
 assert.equal(mod('board').totalPower(m,'dark',f.site,false,id=>mod('battle').members(m,'dark').includes(id)),mod('board').power(m,f.escort));
 m=step(m,'fire:'+f.gun+':'+f.escort);m=seek(m,x=>x.data.battle.shots[0]?.hit!==null);refresh(m);assert.equal(m.data.battle.shots[0].weapon,f.gun);
});
test('normal completion restores surviving trapped crew and attachments inactive',()=>{
 const f=fixture();let m=begun(f);m=seek(m,x=>x.data.battle?.stage==='complete');refresh(m);assert.ok(f.characters.filter(id=>m.cards[id].attachedTo===f.ship).every(id=>m.cards[id].zone==='inactive'));if(m.cards[f.gun].attachedTo)assert.equal(m.cards[f.gun].zone,'inactive');
 m=phase(m,'dark','battle');assert.ok(!ids(m).some(id=>id.startsWith('besieged:select:')));
});
test('cancelled battle restores crew without normal battle-ended windows',()=>{
 const f=fixture();let m=begun(f);const r=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='battle:begin');r.cancelled=true;m=seek(m,x=>x.data.battle.stage==='complete');refresh(m);assert.equal(m.data.battle.cancelled,true);assert.ok(f.characters.every(id=>m.cards[id].zone==='inactive'));assert.equal(m.cards[f.gun].zone,'inactive');
});
for(const mode of ['launch','escape'])test('released ship '+mode+' keeps or loses Besieged correctly',()=>{
 const f=fixture();let m=deployed(f);mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');refresh(m);m=step(m,mode==='escape'?'captured-ship:escape':'captured-ship:launch:'+f.site);m=seek(m,x=>!x.cards[f.ship].capturedShip);refresh(m);assert.equal(m.cards[f.card].zone,mode==='escape'?'lost':'table');if(mode==='launch')assert.equal(m.cards[f.card].attachedTo,f.ship);
});
test('last trapped character loss steals ship and loses Besieged',()=>{
 const f=fixture({crew:1});let m=deployed(f);mod('table').loseFromTable(m,f.characters);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:steal');refresh(m);m=step(m,'captured-ship:launch:'+f.site);refresh(m);assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[f.card].zone,'lost');
});
test('site battle selects only Dark group and prevents a second battle against outside group',()=>{
 const f=fixture({site:true});let m=selection(f);const outside=pull(m,'light','1_28','table',f.bay);m=step(m,'besieged:add:'+f.escort);m=step(m,'besieged:begin');refresh(m);assert.ok(!m.data.battle.participants.light.includes(outside));m=seek(m,x=>x.data.battle.stage==='complete');m=phase(m,'dark','battle');assert.ok(!ids(m).includes('battle:'+f.bay));
});
test('saved selection, active crew exemption and vessel participation tampering rejected',()=>{
 const f=fixture();let m=selection(f),bad=clone(m);bad.stack.at(-1).payload.selected=[mod('identity').referenceCard(bad,f.host)];assert.throws(()=>rules.validate(bad));
 m=begun(f);bad=clone(m);bad.data.battle.participants.dark.push(f.host);assert.throws(()=>rules.validate(bad));bad=clone(m);bad.cards[f.second].zone='inactive';assert.throws(()=>rules.validate(bad));bad=clone(m);bad.data.battle.besieged.activated.push(mod('identity').referenceCard(bad,f.card));assert.throws(()=>rules.validate(bad));bad=clone(m);delete bad.data.battle.besieged;assert.throws(()=>state.assertState(bad));
});
test('all selected Dark crew participates and Light cannot initiate trapped battle',()=>{
 const f=fixture();let m=begun(f,[f.escort,f.second]);refresh(m);assert.deepEqual(m.data.battle.participants.dark,[f.escort,f.second]);
 const light=phase(deployed(f),'light','battle');assert.ok(!ids(light).some(id=>id.startsWith('besieged:')||id==='battle:'+f.site));
});
test('outside bay battle first prevents Besieged later in same turn',()=>{
 const f=fixture({site:true});let m=deployed(f);pull(m,'light','1_28','table',f.bay);m=phase(m,'dark','battle');assert.ok(ids(m).includes('battle:'+f.bay));m=step(m,'battle:'+f.bay);assert.ok(f.characters.every(id=>m.cards[id].zone==='inactive'));m=seek(m,x=>x.data.battle.stage==='complete');m=phase(m,'dark','battle');assert.ok(!ids(m).some(id=>id.startsWith('besieged:select:')));
});
test('release during battle ends participation and leaves launched crew active on their ship',()=>{
 const f=fixture();let m=boundary(begun(f),'battle-weapons');mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');m=step(m,'captured-ship:launch:'+f.site);m=seek(m,x=>x.data.battle.stage==='complete');refresh(m);assert.equal(m.data.battle.premature,true);assert.ok(f.characters.every(id=>m.cards[id].zone==='table'));assert.equal(m.cards[f.card].zone,'table');
});
test('the retained Effect can besiege a subsequently recaptured ship',()=>{
 const f=fixture();let m=deployed(f);mod('captured-ships').releaseCapturedShip(m,f.ship);m=step(m,'captured-ship:launch:'+f.site);m=phase(m,'dark','battle');mod('captured-ships').captureStarship(m,f.ship,f.host);m=seek(m,x=>ids(x).some(id=>id==='besieged:select:'+f.card+':'+f.ship));refresh(m);assert.equal(m.cards[f.card].zone,'table');assert.ok(ids(m).includes('besieged:select:'+f.card+':'+f.ship));
});
test('losing last trapped character during battle steals ship through mandatory continuation',()=>{
 const f=fixture({crew:1});let m=boundary(begun(f),'battle-weapons');mod('table').loseFromTable(m,f.characters);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:steal');m=step(m,'captured-ship:launch:'+f.site);m=seek(m,x=>x.data.battle.stage==='complete');refresh(m);assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.data.battle.premature,true);
});
test('related Launch Bay uses the local Dark group with ship-held Tractor Beam',()=>{
 const f=fixture({site:'launch'});let m=begun(f,[f.escort,f.second]);refresh(m);assert.equal(m.data.battle.site,f.bay);assert.equal(m.cards[f.ship].capturedShip.host,f.bay);assert.deepEqual(m.data.battle.participants.dark,[f.escort,f.second]);assert.deepEqual(m.data.battle.participants.light,f.characters);
});
