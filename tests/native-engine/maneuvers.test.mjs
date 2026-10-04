import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,play,shot,boundary,values,mod,pull,state,rules,step,seek,phase,priority,ids,clone,settled} from './maneuvers-fixture.mjs';
test('Both Used Interrupts alter real ship values and expire with the turn',()=>{
 const f=fixture();let m=play(f.m,f.few,f.ywing);assert.deepEqual(values(m,f.ywing),{power:2,maneuver:5,hyperspeed:6});assert.equal(m.cards[f.few].zone,'used');m=play(settled(m),f.dark,f.ywing);
 assert.deepEqual(values(m,f.ywing),{power:3,maneuver:7,hyperspeed:8});m.turn.number++;assert.deepEqual(values(m,f.ywing),{power:2,maneuver:3,hyperspeed:4});rules.validate(m);
});
test('Repeated copies are noncumulative; different titles combine on an opponent ship',()=>{
 const f=fixture();let m=play(f.m,f.few,f.scout);m=play(settled(m),f.few2,f.scout);assert.deepEqual(values(m,f.scout),{power:1,maneuver:3,hyperspeed:7});m=play(settled(m),f.dark,f.scout);m=play(settled(m),f.dark2,f.scout);assert.deepEqual(values(m,f.scout),{power:2,maneuver:5,hyperspeed:9});
});
test('A Few Maneuvers requires hyperdrive; Dark Maneuvers does not manufacture one',()=>{
 const f=fixture();assert.ok(!ids(f.m).includes('maneuver:'+f.few+':'+f.tie));let m=play(f.m,f.dark,f.tie);assert.equal(values(m,f.tie).hyperspeed,null);assert.equal(values(m,f.tie).maneuver,5);assert.equal(values(m,f.tie).power,4);
});
test('Capital, unpiloted, landed and ground cards are ineligible',()=>{
 const f=fixture();const xwing=pull(f.m,'light','1_144','table',f.planet);for(const target of [f.capital,xwing,f.crawler,f.lightPilot])assert.ok(!ids(f.m).includes('maneuver:'+f.few+':'+target));f.m.cards[f.ywing].location=f.site;f.m.cards[f.torpedo].location=f.site;assert.ok(!ids(f.m).includes('maneuver:'+f.few+':'+f.ywing));
});
test('Just-drawn response selects only the actual targeted ship and changes the pending shot',()=>{
 const f=fixture();let m=shot(f);assert.deepEqual(ids(priority(m,'light')).filter(x=>x.startsWith('maneuver:')).sort(),['maneuver:'+f.few+':'+f.ywing,'maneuver:'+f.few2+':'+f.ywing].sort());m=play(clone(m),f.few,f.ywing);m=boundary(m,'weapon-fired');assert.equal(m.data.battle.starshipShots[0].total,5);assert.equal(m.data.battle.starshipShots[0].defense,5);assert.equal(m.data.battle.starshipShots[0].outcome,'miss');assert.ok(!m.data.battle.hits.includes(f.ywing));
});
test('Dark response modifies the targeted Scout but cannot stop an overpowering shot',()=>{
 const f=fixture();let m=play(shot(f,true),f.dark,f.scout);m=boundary(m,'weapon-fired');assert.equal(m.data.battle.starshipShots[0].defense,3);assert.equal(m.data.battle.starshipShots[0].outcome,'hit');assert.equal(values(m,f.scout).power,2);
});
test('Response is absent before the draw, at total completion and after firing',()=>{
 const f=fixture();let m=shot(f);for(const kind of ['destiny-total','weapon-fired']){m=boundary(m,kind);assert.ok(!ids(priority(m,'light')).some(x=>x.startsWith('maneuver:')));}
});
test('Original target leaving and returning loses the modifier and pending response',()=>{
 const f=fixture();let m=shot(f);mod('table').returnToHand(m,[f.ywing]);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;assert.ok(!ids(priority(m,'light')).some(x=>x.startsWith('maneuver:')));
});
test('Leaving target during Interrupt resolution gets no effect; normal Used disposition remains',()=>{
 const f=fixture();let m=step(f.m,'maneuver:'+f.few+':'+f.ywing);mod('table').returnToHand(m,[f.ywing]);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;m=seek(m,x=>x.cards[f.few].zone==='used');assert.equal(values(m,f.ywing).maneuver,3);
});
test('Successful modifier survives source recycling but cannot survive target recycling',()=>{
 const f=fixture();let m=play(f.m,f.few,f.ywing);state.moveCard(m,f.few,'reserve');assert.equal(values(m,f.ywing).maneuver,5);mod('table').returnToHand(m,[f.ywing]);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;assert.equal(values(m,f.ywing).maneuver,3);
});
test('Canceled maneuver Interrupt goes Lost and leaves the ship unchanged',()=>{
 const f=fixture();let m=step(f.m,'maneuver:'+f.few+':'+f.ywing);m.stack.find(r=>r.action?.handler==='maneuver:play').cancelled=true;m=seek(m,x=>x.cards[f.few].zone==='lost');assert.equal(values(m,f.ywing).maneuver,3);
});
test('Saved target references and handler names are validated',()=>{
 const f=fixture(),m=step(f.m,'maneuver:'+f.few+':'+f.ywing);for(const edit of [p=>p.targetRef.id=f.scout,p=>p.targetRef.zone='hand',p=>p.targetRef.version=999]){const bad=clone(m);edit(bad.stack.find(r=>r.action?.handler==='maneuver:play').action.payload);assert.throws(()=>rules.validate(bad));}
});

test('Actual Sense cancellation restores the underlying weapon draw without the maneuver bonus',()=>{
 const f=fixture(),sense=pull(f.m,'dark','1_267','hand');let m=shot(f);m=step(priority(m,'light'),'maneuver:'+f.few+':'+f.ywing);
 const one=pull(m,'dark','1_194','hand');state.moveCard(m,one,'reserve');m=priority(m,'dark');assert.ok(ids(m).includes('cancel:play:'+sense+':'+f.few+':'+f.pilot));m=step(m,'cancel:play:'+sense+':'+f.few+':'+f.pilot);m=boundary(m,'weapon-fired');assert.equal(m.cards[f.few].zone,'lost');assert.equal(m.cards[sense].zone,'used');assert.equal(m.data.battle.starshipShots[0].outcome,'hit');assert.equal(m.data.battle.starshipShots[0].defense,3);
});
test('A lost pilot during initiation suppresses maneuver and power until the ship is piloted again',()=>{
 const f=fixture();let m=step(priority(f.m,'dark'),'maneuver:'+f.dark+':'+f.tie);mod('table').returnToHand(m,[f.pilot]);m=seek(m,x=>x.cards[f.dark].zone==='used');assert.deepEqual(values(m,f.tie),{power:0,maneuver:0,hyperspeed:null});state.moveCard(m,f.pilot,'table');Object.assign(m.cards[f.pilot],{attachedTo:f.tie,aboardRole:'pilot',location:f.planet});assert.deepEqual(values(m,f.tie),{power:4,maneuver:5,hyperspeed:null});
});
test('Combined hyperspeed additions enable a real longer route and persist through arrival',()=>{
 const f=fixture(),death=pull(f.m,'dark','2_143','table');f.m.locations.push(death);let m=play(f.m,f.few,f.ywing);m=priority(phase(settled(m),'move'),'light');assert.ok(!ids(m).includes('voyage:hyperspace:'+f.ywing+':'+death));m=play(m,f.dark,f.ywing);m=priority(settled(m),'light');assert.ok(ids(m).includes('voyage:hyperspace:'+f.ywing+':'+death));const force=m.players.light.force.length;m=boundary(step(m,'voyage:hyperspace:'+f.ywing+':'+death),'moved');assert.equal(m.cards[f.ywing].location,death);assert.equal(m.players.light.force.length,force-1);assert.equal(values(m,f.ywing).hyperspeed,8);
});
test('A canceled draw and a forged response event cannot offer maneuver actions',()=>{
 const f=fixture();let m=shot(f);const w=m.stack.at(-1),pending=m.stack.at(-2);pending.cancelled=true;assert.deepEqual(mod('maneuvers').maneuverActions(m,w,'light'),[]);pending.cancelled=false;pending.action.payload.next.payload.index=999;assert.deepEqual(mod('maneuvers').maneuverActions(m,w,'light'),[]);
});

for(const expected of JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/maneuvers-results.json',import.meta.url))))test('Executed GEMP maneuver comparison: '+expected.mode,()=>{
 const f=fixture(),mode=expected.mode;let m=f.m,target=mode==='no-hyperdrive'?f.tie:mode==='shot-dark'?f.scout:f.ywing;
 if(mode==='unpiloted')target=pull(m,'light','1_144','table',f.planet);
 if(mode==='capital')target=pull(m,'light','1_140','table',f.planet);
 if(mode==='landed'){m.cards[target].location=f.site;m.cards[f.torpedo].location=f.site;}
 if(mode.startsWith('shot')){m=play(shot(f,mode==='shot-dark'),mode==='shot-dark'?f.dark:f.few,target);if(mode==='shot-double')m=play(m,f.few2,target);m=boundary(m,'weapon-fired');}
 else if(!['unpiloted','landed','capital'].includes(mode)){
  if(!['dark','no-hyperdrive'].includes(mode))m=play(m,f.few,target);
  if(mode==='duplicates')m=play(settled(m),f.few2,target);
  if(['combined','dark','no-hyperdrive'].includes(mode))m=play(settled(m),f.dark,target);
 }
 const v=values(m,target);assert.deepEqual({mode,...v,maneuver:v.maneuver??0,hit:m.data.battle?.hits.includes(target)??false,fewUsed:m.cards[f.few].zone==='used',darkUsed:m.cards[f.dark].zone==='used'},expected);
});
