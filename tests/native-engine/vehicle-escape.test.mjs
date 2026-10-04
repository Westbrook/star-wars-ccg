import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,escapeChoice,step,seek,ids,clone,state,ground,rules,load,pull,force,priority,location} from './vehicle-escape-fixture.mjs';
const {ability}=load(new URL('../../lib/native-engine/ability.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));
const choices=m=>m.stack.at(-1)?.handler==='travel:escape';
const initiate=f=>seek(step(f.m,escapeChoice(f.m,f.interrupt)),m=>choices(m)||m.cards[f.interrupt].zone==='used');
const checked=(m,choice)=>{const before=clone(m),next=step(clone(m),choice);assert.deepEqual(m,before);rules.validate(clone(next));return next;};
const finish=(m,id)=>{for(let n=0;n<150&&m.cards[id].zone!=='used';n++){assert.ok(ids(m).includes('pass'));m=checked(m,'pass');}assert.equal(m.cards[id].zone,'used');return m;};
for(const mode of ['escape-vehicle','escape-passenger','escape-long','escape-no-force'])test('official vehicle move-away and retained GEMP discrepancy: '+mode,()=>{
 const f=fixture(mode),before=f.m.players.light.force.length;let m=initiate(f);
 if(mode==='escape-passenger')m=seek(checked(m,'away:'+f.luke+':'+f.dune),choices);
 if(mode!=='escape-no-force'){assert.ok(ids(m).includes('away:'+f.host+':'+f.to));m=checked(m,'away:'+f.host+':'+f.to);}
 m=finish(m,f.interrupt);
 const row={mode,available:true,cost:before-m.players.light.force.length,vehicleAt:m.cards[m.cards[f.host].location].blueprint,lukeAt:m.cards[m.cards[f.luke].location].blueprint,aboard:m.cards[f.luke].attachedTo===f.host,gunCarried:m.cards[f.gun].attachedTo===f.luke,vehicleRegularMove:ground.usage(m).moved.includes(f.host),lukeRegularMove:ground.usage(m).moved.includes(f.luke),interruptDone:m.cards[f.interrupt].zone==='used'};
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/vehicle-escape-results.json',import.meta.url)));const ref=oracle.find(r=>r.mode===mode);const {filterHasAbility,abilityIncludingPilot,moveAwayAvailable,...observed}=ref;
 assert.equal(filterHasAbility,false);assert.equal(abilityIncludingPilot,true);assert.equal(moveAwayAvailable,mode!=='escape-no-force');
 if(mode==='escape-no-force')assert.deepEqual(row,observed);
 else {
  assert.equal(observed.vehicleAt,'1_129');assert.equal(observed.vehicleRegularMove,false);
  // AR p71 explicitly includes permanent-pilot cards in Narrow Escape's targets.
  // The pinned card filters them out; preserve that receipt, do not call it parity.
  assert.deepEqual(row,{...observed,vehicleAt:mode==='escape-long'?'1_132':'1_130',lukeAt:mode==='escape-long'?'1_132':'1_130',vehicleRegularMove:true});
 }
 assert.equal(m.cards[f.gun].location,m.cards[f.luke].location);assert.equal(m.cards[f.lightPilot].location,f.site);
});
for(const effect of ['cancel','barrier','vehicle-return','location-return'])test('vehicle Escape retains payment after '+effect,()=>{
 const f=fixture();let m=seek(checked(initiate(f),'away:'+f.host+':'+f.dune),x=>x.stack.at(-2)?.action?.handler==='voyage:begin'&&!x.stack.at(-2).awaitingResponses);
 assert.equal(m.players.light.force.length,0);
 if(effect==='cancel')m.stack.at(-2).cancelled=true;
 if(effect==='barrier')ground.record(m).barriers[f.host]=m.turn.number;
 if(effect==='vehicle-return'){delete m.cards[f.luke].attachedTo;delete m.cards[f.luke].aboardRole;state.moveCard(m,f.host,'hand');state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;m.cards[f.luke].attachedTo=f.host;m.cards[f.luke].aboardRole='passenger';}
 if(effect==='location-return'){const order=[...m.locations];m.locations=m.locations.filter(id=>id!==f.dune);state.moveCard(m,f.dune,'hand');state.moveCard(m,f.dune,'table');m.locations=order;}
 m=finish(clone(m),f.interrupt);assert.equal(m.cards[f.host].location,f.site);assert.equal(m.cards[f.luke].location,f.site);assert.equal(m.players.light.force.length,0);assert.ok(!ground.usage(m).moved.includes(f.host));
});
test('a carried passenger cannot make a second escape, and intermediate arrivals survive restore',()=>{
 const f=fixture('escape-long');let m=checked(initiate(f),'away:'+f.host+':'+f.to),arrivals=[];
 for(let i=0;i<120&&m.cards[f.interrupt].zone!=='used';i++){
  const e=m.stack.at(-1)?.event;if(e?.kind==='moved'&&e.card===f.host&&!arrivals.includes(e.site)){arrivals.push(e.site);assert.equal(m.cards[f.luke].location,e.site);assert.equal(m.cards[f.gun].location,e.site);}
  assert.ok(!ids(m).some(id=>id.startsWith('away:'+f.luke+':')));m=checked(m,'pass');
 }
 assert.deepEqual(arrivals,[f.dune,f.camp,f.farm]);assert.equal(m.cards[f.interrupt].zone,'used');
});
test('Snowspeeder shared capacity and permanent ability remain distinct from its passenger',()=>{
 const f=fixture();assert.equal(ability(f.m,f.host),1);assert.equal(board.power(f.m,f.host),3);
 const {roleAvailable}=load(new URL('../../lib/native-engine/occupancy.ts',import.meta.url));assert.equal(roleAvailable(f.m,f.host,f.lightPilot,'pilot'),false);
 text.suppressGameText(f.m,f.site,f.host);assert.equal(ability(f.m,f.host),0);assert.equal(load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url)).premiereRules.supports('3_69'),false);
});
const {reactionFixture}=await import('./vehicle-escape-fixture.mjs');
for(const hoth of [true,false])test('Snowspeeder reaction matches GEMP: '+(hoth?'Hoth':'Tatooine'),()=>{
 const f=reactionFixture(hoth),mode=hoth?'react-hoth':'react-tatooine',before=f.m.players.light.force.length,lost=f.m.players.light.lost.length;
 const choice='vehicle-react:'+f.host+':'+f.to,available=ids(f.m).includes(choice);let m=f.m;
 if(available){
  m=checked(m,choice);assert.ok(ids(m).includes('board:'+f.lightPilot+':pilot'));assert.ok(ids(m).includes('board:'+f.lightPilot+':passenger'));assert.ok(!ids(m).includes('board:'+f.lightPilot+':driver'));
  m=checked(m,'board:'+f.lightPilot+':pilot');
  for(let n=0;n<160&&m.stack.length>1;n++)m=checked(m,ids(m).includes('continue-react')?'continue-react':'pass');assert.equal(m.stack.length,1);
 }
 const row={mode,available,cost:before-m.players.light.force.length,arrived:m.cards[f.host].location===f.to,pilotAboard:m.cards[f.lightPilot].attachedTo===f.host,power:board.power(m,f.host),lostToDrain:m.players.light.lost.length-lost};
 assert.deepEqual(row,JSON.parse(fs.readFileSync(new URL('./gemp/vehicle-escape-results.json',import.meta.url))).find(x=>x.mode===mode));
});
for(const restriction of ['used-move','barrier','text','force'])test('Snowspeeder react enforces '+restriction,()=>{
 const f=reactionFixture(),m=f.m;
 if(restriction==='used-move')ground.record(m).moved.push(f.host);
 if(restriction==='barrier')ground.record(m).barriers[f.host]=m.turn.number;
 if(restriction==='text')text.suppressGameText(m,f.from,f.host);
 if(restriction==='force')for(const id of [...m.players.light.force])state.moveCard(m,id,'reserve');
 assert.ok(!ids(m).some(id=>id.startsWith('vehicle-react:'+f.host+':')));
});
test('Narrow Escape vehicle obeys prior movement and Barrier',()=>{
 for(const kind of ['moved','barrier']){
  const f=fixture('escape-long');
  if(kind==='moved')ground.record(f.m).moved.push(f.host);
  if(kind==='barrier')ground.record(f.m).barriers[f.host]=f.m.turn.number;
  const m=initiate(f);assert.ok(!ids(m).some(id=>id.startsWith('away:'+f.host+':')));
 }
});
for(const long of [false,true])test('ordinary Snowspeeder journey matches GEMP: '+(long?'long':'near'),()=>{
 const f=fixture(),m=f.m;
 // Controlled initial board: clear the battle frames before normal Move phase.
 delete m.data.battle;m.stack=[{...m.stack[0],priority:'light',passes:0}];m.turn.side='light';m.turn.phase='move';
 const to=long?f.farm:f.dune,before=m.players.light.force.length;
 let next=checked(m,'voyage:landspeed:'+f.host+':'+to);next=seek(next,x=>x.stack.length===1);
 const row={mode:long?'ordinary-long':'ordinary-near',cost:before-next.players.light.force.length,vehicleAt:next.cards[next.cards[f.host].location].blueprint,lukeAt:next.cards[next.cards[f.luke].location].blueprint,aboard:next.cards[f.luke].attachedTo===f.host,gunCarried:next.cards[f.gun].attachedTo===f.luke,vehicleRegularMove:ground.usage(next).moved.includes(f.host),lukeRegularMove:ground.usage(next).moved.includes(f.luke)};
 assert.deepEqual(row,JSON.parse(fs.readFileSync(new URL('./gemp/vehicle-escape-results.json',import.meta.url))).find(x=>x.mode===row.mode));
});
test('vehicle reference source and raw observations remain bound to their receipt',async()=>{
 const {createHash}=await import('node:crypto'),base=new URL('./gemp/',import.meta.url),p=JSON.parse(fs.readFileSync(new URL('vehicle-escape-provenance.json',base)));
 for(const [name,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(name,base))).digest('hex'),hash);
 const rows=JSON.parse(fs.readFileSync(new URL('vehicle-escape-results.json',base)));assert.equal(rows.length,p.observations);assert.equal(p.matchingObservations.length,5);assert.equal(p.officialRuleCorrection.observations.length,3);
});
