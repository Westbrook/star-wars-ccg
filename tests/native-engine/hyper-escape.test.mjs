import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,start,choosing,away,finish,mod,runtime,state,rules,clone,pull,ids,step,seek,priority} from './hyper-escape-fixture.mjs';
for(const mode of ['single','two-ships','one-force','no-force','out-of-range','no-destination','own-battle','weapon-and-crew'])test('Integrated Hyper Escape: '+mode,()=>{
 const f=fixture(mode),before=f.m.players.light.force.length;let m=f.m;
 assert.equal(ids(m).includes('hyper-escape:'+f.escape),mode!=='no-destination');if(mode==='no-destination')return;
 m=start(f);
 if(!['no-force','out-of-range'].includes(mode)){m=away(choosing(m),f.ywing,f.destination);if(mode==='two-ships')m=away(choosing(m),f.second,f.destination);}
 m=finish(m,f.escape);assert.equal(m.cards[f.escape].zone,'used');assert.equal(m.cards[f.ywing].location,['no-force','out-of-range'].includes(mode)?f.planet:f.destination);assert.equal(before-m.players.light.force.length,mode==='two-ships'?2:['no-force','out-of-range'].includes(mode)?0:1);
 if(mode==='one-force')assert.equal(m.cards[f.second].location,f.planet);
 if(mode==='weapon-and-crew')for(const id of [f.crew,f.weapon]){assert.equal(m.cards[id].location,f.destination);assert.equal(m.cards[id].attachedTo,f.ywing);}
 rules.validate(m);
});
test('Last ship escaping ends battle without damage or attrition after Interrupt finishes',()=>{
 const f=fixture();let m=finish(away(choosing(start(f)),f.ywing,f.destination),f.escape);m=seek(m,x=>x.data.battle?.stage==='complete');assert.equal(m.data.battle.premature,true);assert.deepEqual(m.data.battle.damage,{dark:0,light:0});assert.deepEqual(m.data.battle.attrition,{dark:0,light:0});assert.equal(m.cards[f.escape].zone,'used');
});
test('Limited Force leaves the second ship in an ongoing battle',()=>{
 const f=fixture('one-force');let m=finish(away(choosing(start(f)),f.ywing,f.destination),f.escape);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.equal(m.data.battle.premature,false);assert.deepEqual(mod('battle').members(m,'light'),[f.second]);
});
test('Owner chooses ship order; refresh retains both choices and paid movement',()=>{
 const f=fixture('two-ships');let m=clone(choosing(start(f)));assert.equal(ids(m).length,2);m=clone(away(m,f.second,f.destination));m=clone(choosing(m));assert.equal(m.cards[f.second].location,f.destination);assert.equal(m.cards[f.ywing].location,f.planet);assert.equal(ids(m).length,1);assert.ok(!ids(m).includes('cancel'));m=finish(away(m,f.ywing,f.destination),f.escape);assert.equal(m.cards[f.ywing].location,f.destination);
});
test('Interrupt cancellation loses Hyper Escape without paying movement',()=>{
 const f=fixture();let m=start(f);const before=m.players.light.force.length;m.stack.find(r=>r.action?.handler==='hyper-escape:play').cancelled=true;m=finish(m,f.escape);assert.equal(m.cards[f.escape].zone,'lost');assert.equal(m.cards[f.ywing].location,f.planet);assert.equal(m.players.light.force.length,before);
});
test('Canceled individual movement keeps its cost and continues to the next ship',()=>{
 const f=fixture('two-ships');let m=away(choosing(start(f)),f.ywing,f.destination);m.stack.find(r=>r.action?.handler==='voyage:begin').cancelled=true;m=away(choosing(m),f.second,f.destination);m=finish(m,f.escape);assert.equal(m.cards[f.ywing].location,f.planet);assert.equal(m.cards[f.second].location,f.destination);assert.equal(m.players.light.force.length,f.m.players.light.force.length-2);
});
test('Returned ship is a new instance and cannot receive the old escape',()=>{
 const f=fixture();let m=start(f);mod('table').returnToHand(m,[f.ywing]);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;m=finish(m,f.escape);assert.equal(m.cards[f.ywing].location,f.planet);assert.equal(m.players.light.force.length,f.m.players.light.force.length);
});
test('No new arrivals are added to an initiated escape group',()=>{
 const f=fixture();let m=start(f);state.moveCard(m,f.second,'table');m.cards[f.second].location=f.planet;m=finish(away(choosing(m),f.ywing,f.destination),f.escape);assert.equal(m.cards[f.second].location,f.planet);
});
test('Already moved ship can be targeted but cannot move again',()=>{
 const f=fixture();mod('ground').record(f.m).moved.push(f.ywing);assert.ok(ids(f.m).includes('hyper-escape:'+f.escape));const m=finish(start(f),f.escape);assert.equal(m.cards[f.ywing].location,f.planet);
});
test('Landing is not offered as an escape route',()=>{
 const f=fixture();const m=choosing(start(f));assert.ok(ids(m).every(id=>!id.includes(':land:')));assert.ok(!ids(m).some(id=>id.endsWith(':'+f.site)));
});
test('Escape is absent in subsequent battle windows',()=>{
 const f=fixture();const m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('hyper-escape:')));
});
test('Saved escape group rejects malformed references and mismatched source',()=>{
 const f=fixture(),m=start(f);for(const edit of [p=>p.ships[0].version=999,p=>p.ships[0].zone='hand',p=>p.remaining.push(f.enemy),p=>p.window=-1,p=>p.origin.id=f.ywing,p=>p.ships.push(p.ships[0])]){const bad=clone(m);edit(bad.stack.find(r=>r.action?.handler==='hyper-escape:play').action.payload);assert.throws(()=>rules.validate(bad));}
});
test('Actual Sense cancels Hyper Escape and leaves the battle intact',()=>{
 const f=fixture(),sense=pull(f.m,'dark','1_267','hand');state.moveCard(f.m,f.pilot,'table');Object.assign(f.m.cards[f.pilot],{attachedTo:f.enemy,aboardRole:'pilot',location:f.planet});mod('battle').syncBattle(f.m);let m=start(f);const one=pull(m,'dark','1_194','hand');state.moveCard(m,one,'reserve');m=priority(m,'dark');assert.ok(ids(m).includes('cancel:play:'+sense+':'+f.escape+':'+f.pilot));m=step(m,'cancel:play:'+sense+':'+f.escape+':'+f.pilot);m=seek(m,x=>x.cards[sense].zone==='used');assert.equal(m.cards[f.escape].zone,'lost');assert.equal(m.cards[sense].zone,'used');assert.equal(m.cards[f.ywing].location,f.planet);
});
test('Destination and ship restrictions are checked again when movement resolves',()=>{
 for(const change of ['barrier','range']){const f=fixture();let m=start(f);if(change==='barrier')mod('ground').record(m).barriers[f.ywing]=m.turn.number;else mod('stat-modifiers').addStatModifier(m,f.enemy,f.ywing,'hyperspeed','reset',0);m=finish(m,f.escape);assert.equal(m.cards[f.ywing].location,f.planet);assert.equal(m.players.light.force.length,f.m.players.light.force.length);}
});
test('An unpiloted ship remains behind while the other ship escapes',()=>{
 const f=fixture();const x=pull(f.m,'light','1_144','table',f.planet);mod('battle').syncBattle(f.m);let m=start(f);assert.ok(m.stack.find(r=>r.action?.handler==='hyper-escape:play').action.payload.ships.some(r=>r.id===x));
 m=finish(away(choosing(m),f.ywing,f.destination),f.escape);assert.equal(m.cards[x].location,f.planet);
});
test('Death Star orbit transfer is an eligible move away without using hyperspeed',()=>{
 const f=fixture('out-of-range'),m=f.m;const ref=mod('identity').referenceCard(m,f.destination);m.data.mobileSystems={[f.destination]:{card:ref,parsec:7,orbit:'Tatooine'}};mod('stat-modifiers').addStatModifier(m,f.enemy,f.ywing,'hyperspeed','reset',0);const next=choosing(start(f));assert.ok(ids(next).includes('escape-away:'+f.ywing+':orbit:'+f.destination));const done=finish(away(next,f.ywing,f.destination,'orbit'),f.escape);assert.equal(done.cards[f.ywing].location,f.destination);
});

const reference=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/hyper-escape-results.json',import.meta.url)));
for(const expected of reference)test('Executed GEMP escape evidence: '+expected.mode,()=>{
 const f=fixture(expected.mode);let m=f.m;const offered=ids(m).includes('hyper-escape:'+f.escape),before=m.players.light.force.length;
 if(offered){m=start(f);if(!['no-force','out-of-range'].includes(expected.mode)){m=away(choosing(m),f.ywing,f.destination);if(expected.mode==='two-ships')m=away(choosing(m),f.second,f.destination);}m=finish(m,f.escape);}
 const actual={mode:expected.mode,offered,shipMoved:m.cards[f.ywing].location===f.destination,secondMoved:m.cards[f.second].location===f.destination,movementCost:before-m.players.light.force.length,used:m.cards[f.escape].zone==='used'};
 if(expected.mode==='weapon-and-crew')Object.assign(actual,{crewAboard:m.cards[f.crew].attachedTo===f.ywing,weaponAttached:m.cards[f.weapon].attachedTo===f.ywing,shipRegularMove:mod('ground').usage(m).moved.includes(f.ywing),crewRegularMove:mod('ground').usage(m).moved.includes(f.crew)});
 if(['no-force','out-of-range'].includes(expected.mode)){
  // Explicit known divergence: official AR70–71 permits initiation without
  // affordable/in-range movement. Pinned GEMP rejects it. Neither moves a ship.
  assert.deepEqual(actual,{...expected,offered:true,used:true});assert.equal(expected.offered,false);assert.equal(expected.used,false);
 }else assert.deepEqual(actual,expected);
});
