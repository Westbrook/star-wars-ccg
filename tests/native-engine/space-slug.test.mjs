import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './space-slug-fixture.mjs';
import {load,deploy,pull,seek,priority,step,ids,rules,state,clone,force} from './vessels-fixture.mjs';
const slug=load(new URL('../../lib/native-engine/space-slug.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const loss=load(new URL('../../lib/native-engine/table.ts',import.meta.url));
const attack=load(new URL('../../lib/native-engine/creature-attack.ts',import.meta.url));
const settle=m=>seek(m,x=>x.stack.length===1);
function destiny(m,side,bps){const cards=bps.map(bp=>pull(m,side,bp,'hand'));for(const id of cards.reverse())state.moveCard(m,id,'reserve');}

test('Space Slug deploys at Big One without icons, opens its mouth initially and adds no presence',()=>{
 const f=fixture(),m=f.m;assert.equal(m.cards[f.slug].location,f.big);assert.equal(slug.bellySlug(m,f.cave),f.slug);assert.equal(slug.slugState(m,f.slug).closed,false);assert.equal(board.presence(m,'light',f.big),false);
 const other=pull(m,'dark','4_112','hand');const w={kind:'window',serial:1,timing:'phase',priority:'dark',completed:[],passes:0};const next=clone(m);next.turn.side='dark';assert.ok(!slug.slugActions(next,w,'dark').some(a=>a.source===other));rules.validate(m);
});

test('Mouth closure blocks cave landing/takeoff until a later turn and refresh preserves it',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);assert.ok(travel.vesselRoutes(m,f.ywing).some(r=>r.method==='land'));
 m=settle(step(m,'slug:mouth:'+f.slug));assert.equal(slug.caveMouthOpen(m,f.cave),false);assert.ok(!travel.vesselRoutes(clone(m),f.ywing).some(r=>r.method==='land'));assert.ok(!ids(priority(m,'light')).includes('slug:mouth:'+f.slug));
 board.moveWithAttachments(m,f.ywing,f.cave);assert.equal(travel.vesselRoutes(m,f.ywing).length,0);m=seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');assert.ok(ids(m).includes('slug:mouth:'+f.slug));m=settle(step(m,'slug:mouth:'+f.slug));assert.ok(travel.vesselRoutes(m,f.ywing).some(r=>r.method==='takeoff'));rules.validate(m);
});

test('Losing the slug loses both sides of the belly and attachments, then restores the cave',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=deploy(m,f.lightPilot,f.ywing,'pilot');board.moveWithAttachments(m,f.ywing,f.cave);state.moveCard(m,f.passenger,'table');m.cards[f.passenger].location=f.cave;
 const affected=loss.tableLossCards(m,[f.slug]);assert.ok([f.slug,f.ywing,f.lightPilot,f.passenger].every(id=>affected.includes(id)));loss.loseFromTable(m,[f.slug]);m=settle(m);assert.ok([f.slug,f.ywing,f.lightPilot,f.passenger].every(id=>m.cards[id].zone==='lost'));assert.equal(slug.bellySlug(m,f.cave),undefined);assert.equal(slug.caveMouthOpen(m,f.cave),true);rules.validate(clone(m));
});

for(const outcome of ['eat','belly'])test('Mandatory slug attack defeats a starfighter and victim opponent chooses '+outcome,()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');destiny(m,'light',['1_70','1_88']);
 // Pass ordinary opportunities until the required end-of-phase attack appears.
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='phase-end'&&ids(x).some(id=>id.startsWith('creature:begin:')));
 m=step(m,ids(m).find(id=>id.startsWith('creature:begin:')));m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');assert.equal(m.stack.at(-1).side,'dark');assert.equal(attack.creatureAttack(m).defeated,true);
 m=step(clone(m),outcome);m=settle(m);assert.equal(attack.creatureAttack(m).outcome,outcome==='eat'?'eaten':'relocated');assert.equal(m.cards[f.ywing].zone,outcome==='eat'?'lost':'table');if(outcome==='belly')assert.equal(m.cards[f.ywing].location,f.cave);rules.validate(m);
});

test('Ships can attack the slug, use general destiny and lose neither damage nor attrition',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=deploy(m,f.lightPilot,f.ywing,'pilot');const ship=pull(m,'light','1_140','hand');m=deploy(m,ship,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');destiny(m,'light',['1_70','4_81','4_81']);
 const choice=ids(m).find(id=>id.includes(':assault:'));assert.ok(choice);m=step(m,choice);m=seek(m,x=>x.stack.at(-1)?.handler==='creature:destiny');m=step(m,'attack-draw');m=settle(m);
 assert.equal(attack.creatureAttack(m).outcome,'slug-lost');assert.equal(m.cards[f.slug].zone,'lost');assert.equal(m.cards[f.ywing].zone,'table');assert.equal(m.cards[ship].zone,'table');assert.equal(m.data.battle,undefined);rules.validate(m);
});

test('Serialized slug/attack state rejects corrupt habitat, mouth and target references',()=>{
 const f=fixture();const bad=clone(f.m);bad.data.spaceSlugs[0].closed='yes';assert.throws(()=>rules.validate(bad),/Slug/);const habitat=clone(f.m);habitat.cards[f.slug].location=f.site;assert.throws(()=>rules.validate(habitat),/habitat/);
});

function huntStart(){const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');destiny(m,'light',['1_70','1_88']);m=step(m,ids(m).find(id=>id.includes(':hunt:')));return {...f,m};}

test('Closing the mouth during attack weapons retains a later defeated-ship relocation',()=>{
 const f=huntStart();let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');assert.ok(ids(m).includes('slug:mouth:'+f.slug));m=step(m,'slug:mouth:'+f.slug);m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');assert.equal(slug.caveMouthOpen(m,f.cave),false);m=settle(step(clone(m),'belly'));assert.equal(m.cards[f.ywing].location,f.cave);assert.equal(attack.creatureAttack(m).outcome,'relocated');
});

test('Attack weapons offer general actions but no battle initiation or battle-only effects',()=>{
 const f=huntStart();let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');const maneuver=pull(m,'light','1_70','hand');assert.ok(ids(m).includes('maneuver:'+maneuver+':'+f.ywing));assert.ok(!ids(m).some(id=>id.startsWith('battle:')));m=step(m,'maneuver:'+maneuver+':'+f.ywing);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');assert.equal(m.cards[maneuver].zone,'used');rules.validate(m);
});

test('A hunt cannot be repeated in the same turn after the target survives',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');destiny(m,'light',['4_81','4_81']);m=settle(step(m,ids(m).find(id=>id.includes(':hunt:'))));assert.equal(attack.creatureAttack(m).outcome,'survived');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.includes(':hunt:')));assert.equal(m.cards[f.ywing].zone,'table');
});

test('Attack persistence binds callbacks, actors, totals, usage and nested destiny forwards',()=>{
 const f=huntStart();let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny');rules.validate(clone(m));
 for(const mutate of [
  x=>x.data.creatureAttack.turn=0,
  x=>x.data.creatureAttack.outcome='won',
  x=>x.data.creatureAttack.defeated='yes',
  x=>x.data.creatureAttack.powerDraw={card:'missing',value:9},
  x=>x.data.creatureAttackUses.push(structuredClone(x.data.creatureAttackUses[0])),
  x=>x.stack.find(f=>f.kind==='resolution'&&f.action.handler==='creature:finish').actor='dark',
  x=>x.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw').action.payload.next.payload.site.version++,
  x=>x.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw').action.payload.next.handler='creature:invented',
  x=>x.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw').action.payload.source=f.ywing,
 ]){const bad=clone(m);mutate(bad);assert.throws(()=>rules.validate(bad));}
 m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');const wrongSeat=clone(m);wrongSeat.stack.at(-1).side='light';assert.throws(()=>rules.validate(wrongSeat),/attack decision/);
 const orphan=clone(f.m);delete orphan.data.creatureAttack;assert.throws(()=>rules.validate(orphan),/attack continuation/);
 const usage=clone(fixture().m);usage.data.creatureAttackUses=[{source:{id:f.slug,version:0,zone:'table'},turn:0,side:'light',mode:'hunt'}];assert.throws(()=>rules.validate(usage));
});

test('Dark-side slug uses Dark destiny and the Light victim’s opponent chooses the outcome',()=>{
 const f=fixture();let m=f.m;loss.loseFromTable(m,[f.slug]);m=settle(m);m=priority(m,'light');m=deploy(m,f.ywing,f.big);m=priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='deploy'&&x.stack.length===1),'dark');const dark=pull(m,'dark','4_112','hand');m=settle(step(m,'slug:deploy:'+dark+':'+f.big));m=priority(seek(m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1),'dark');
 const dice=[...m.players.dark.reserve].sort((a,b)=>board.printed(m,b,'destiny')-board.printed(m,a,'destiny')).slice(0,2);assert.ok(dice.reduce((n,id)=>n+board.printed(m,id,'destiny'),0)>2);for(const id of dice.reverse())state.moveCard(m,id,'reserve');m=step(m,ids(m).find(id=>id.includes(':hunt:')));m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');assert.equal(m.stack.at(-1).side,'dark');assert.ok(attack.creatureAttack(m).ferocityDraws.every(d=>m.cards[d.card].owner==='dark'));m=settle(step(clone(m),'belly'));assert.equal(m.cards[f.ywing].location,f.cave);rules.validate(m);
});

// Compare full observed rows; cave restoration is an explicit discrepancy, not normalized input.
const fs=await import('node:fs');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/space-slug-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP Space Slug observation: '+expected.mode,()=>{
 const f=fixture({withCave:expected.mode!=='assault'});let m=f.m,actual;
 if(expected.mode==='mouth'){
  m=settle(step(m,'slug:mouth:'+f.slug));actual={mode:'mouth',closed:slug.slugState(m,f.slug).closed,belly:!!slug.bellySlug(m,f.cave)};
 }else{
  m=deploy(m,f.ywing,f.big);
  if(expected.mode.startsWith('assault')){m=deploy(m,f.lightPilot,f.ywing,'pilot');const corvette=pull(m,'light','1_140','hand');m=deploy(m,corvette,f.big);}
  m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');
  destiny(m,'light',expected.mode.startsWith('assault')?['1_70','4_81','4_81']:['1_70','1_88']);
  m=step(m,ids(m).find(id=>id.includes(expected.mode.startsWith('assault')?':assault:':':hunt:')));
  if(expected.mode==='closed-relocate'){m=seek(m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');m=step(m,'slug:mouth:'+f.slug);}
  if(expected.mode.startsWith('assault')){
   m=seek(m,x=>x.stack.at(-1)?.handler==='creature:destiny');m=settle(step(m,'attack-draw'));actual={mode:expected.mode,slugLost:m.cards[f.slug].zone==='lost',shipLost:m.cards[f.ywing].zone==='lost',belly:!!slug.bellySlug(m,f.cave),loop:false};
  }else{
   m=seek(m,x=>x.stack.at(-1)?.handler==='creature:outcome');m=settle(step(m,expected.mode==='eat'?'eat':'belly'));actual={mode:expected.mode,shipLost:m.cards[f.ywing].zone==='lost',inBelly:m.cards[f.ywing].location===f.cave};
  }
 }
 rules.validate(clone(m));
 if(expected.mode==='assault-cave'){
  assert.deepEqual(expected,{mode:'assault-cave',slugLost:true,shipLost:false,belly:true,loop:true});
  assert.deepEqual(actual,{mode:'assault-cave',slugLost:true,shipLost:false,belly:false,loop:false});
 }else assert.deepEqual(actual,expected);
});
