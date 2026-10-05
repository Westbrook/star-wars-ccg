import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import * as siege from './besieged-fixture.mjs';
import * as tube from './lift-tube-fixture.mjs';
import * as gate from './laser-gate-fixture.mjs';
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
function choose(v,side){const before=clone(v),id=chooseComputerAction(v,side);assert.deepEqual(v,before);assert.equal(chooseComputerAction(clone(v),side),id);assert.ok(v.prompt.choices.some(c=>c.id===id));return id;}
function cpu(m,f,side){return choose(f.runtime.project(m,f.rules,side),side);}
function view(side,choices){return {status:'playing',turn:{side,phase:'control'},table:[],locations:['a','b','c'],players:{[side]:{hand:[],lost:[],destiny:[],counts:{force:5,reserve:20},lifeForce:25}},rules:{},prompt:{side,timing:'phase',mandatory:false,choices:choices.map(id=>({id,label:id}))}};}
const card=(id,blueprint,owner,location='a')=>({id,blueprint,owner,location,zone:'table'});

test('CPU deploys Besieged, includes legal attackers and begins after a serialized selection',()=>{
 const f=siege.fixture();let m=f.m;siege.state.moveCard(m,Object.values(m.cards).find(c=>c.blueprint==='2_142'&&c.zone==='hand').id,'lost');
 assert.equal(cpu(m,siege,'dark'),'besieged:deploy:'+f.card+':'+f.ship);
 m=siege.phase(siege.deployed(f),'dark','battle');assert.equal(cpu(m,siege,'dark'),'besieged:select:'+f.card+':'+f.ship);
 m=siege.step(m,cpu(m,siege,'dark'));const selected=[];
 for(let n=0;n<5;n++){const id=cpu(clone(m),siege,'dark');if(id.startsWith('besieged:add:'))selected.push(id.split(':')[2]);m=siege.step(m,id);if(id.startsWith('besieged:begin'))break;}
 assert.deepEqual(new Set(selected),new Set([f.escort,f.second]));
 m=siege.seek(m,x=>!!x.data.battle?.besieged);assert.equal(m.data.battle.besieged.ship.id,f.ship);assert.deepEqual(new Set(m.data.battle.participants.dark),new Set(selected));
});
test('CPU uses trapped crew strength and does not confuse unrelated ground troops with a boarding party',()=>{
 const v=view('dark',['besieged:select:e:s','pass']);v.rules.capturedShips=[{id:'s',host:'h',crew:['l']}];
 v.table=[card('h','1_302','dark'),card('d','1_194','dark'),card('l','1_19','light'),card('outside','1_168','dark')];v.table[1].attachedTo='h';v.table[2].zone='inactive';
 assert.equal(choose(v,'dark'),'pass');v.table[1].blueprint='1_168';assert.equal(choose(v,'dark'),'besieged:select:e:s');
});
test('CPU prefers a free Besieged start after exhausting offered party additions',()=>{
 const v=view('dark',['besieged:begin','besieged:begin-free','besieged:cancel']);v.prompt.mandatory=true;
 assert.equal(choose(v,'dark'),'besieged:begin-free');
});
test('CPU deploys a real Gate blocking opposing troops and avoids hindering its own stronger local force',()=>{
 const f=gate.fixture();let m=f.m;const id='laser-gate:deploy:'+f.card+':'+f.core+':'+f.corridor;
 assert.equal(cpu(m,gate,'dark'),id);m=gate.deploy(f);assert.ok(m.data.laserGates[f.card]);
 const v=gate.runtime.project(f.m,gate.rules,'dark');v.table.push(card('reinforcement','1_194','dark',f.core),card('reinforcement2','1_194','dark',f.corridor));
 v.prompt.choices=v.prompt.choices.filter(c=>c.id===id||c.id==='pass');assert.equal(choose(v,'dark'),'pass');
});
test('CPU only spends a Gate-removal Interrupt when its visible mobility improves, and takes optional destiny bonus',()=>{
 const v=view('light',['sniping:play:i:w','pass']);v.table=[card('h','1_11','light'),{...card('w','1_152','light'),attachedTo:'h'},card('g','2_113','dark'),card('t','1_28','light')];
 v.rules.laserGates={g:{sites:['a','b'],active:true}};assert.equal(choose(v,'light'),'sniping:play:i:w');
 v.rules.laserGates.g.active=false;assert.equal(choose(v,'light'),'pass');v.rules.laserGates.g.active=true;
 v.table.find(c=>c.id==='t').owner='dark';assert.equal(choose(v,'light'),'pass');
 v.prompt.choices=[{id:'sniping:bonus:i:w:g:4',label:'Add 1'},{id:'pass',label:'Pass'}];assert.equal(choose(v,'light'),'sniping:bonus:i:w:g:4');
});
test('CPU relocates Gate for a visible improvement, keeps ties, and preserves original site order when rearrangement is mandatory',()=>{
 const v=view('dark',['retract:gate:keep','retract:gate:b:c']);v.rules.laserGates={g:{sites:['a','b'],active:true}};v.prompt.choices.forEach(c=>c.card='g');
 assert.equal(choose(v,'dark'),'retract:gate:keep');v.table=[card('t','1_28','light','c')];assert.equal(choose(v,'dark'),'retract:gate:b:c');
 v.rules.laserGates.g.active=false;assert.equal(choose(v,'dark'),'retract:gate:keep');
 v.prompt.choices=['retract:site:c','retract:site:a','retract:site:b'].map(id=>({id,label:id}));v.prompt.mandatory=true;assert.equal(choose(v,'dark'),'retract:site:a');
});
for(const side of ['light','dark'])test('CPU '+side+' Lift Tube react boards and disembarks legal passengers, cancels drain and resumes after refresh',()=>{
 const f=tube.reactFixture({side});let m=f.m;
 assert.equal(cpu(m,tube,side),'vehicle-react:'+f.tube+':'+f.bay);m=tube.step(m,cpu(m,tube,side));
 let boarded=0,exited=0,continued=0;
 for(let n=0;n<240&&m.stack.length>1;n++){
  const p=tube.prompt(m);let id='pass';
  if(p.side===side&&p.choices.some(c=>c.id==='continue-react')){id=cpu(clone(m),tube,side);if(id.startsWith('board:'))boarded++;if(id.startsWith('exit:'))exited++;if(id==='continue-react')continued++;}
  else assert.ok(p.choices.some(c=>c.id==='pass'));
  m=tube.step(clone(m),id);
 }
 assert.equal(m.stack.length,1);assert.equal(boarded,4);assert.equal(exited,4);assert.equal(continued,0);assert.equal(m.cards[f.tube].location,f.bay);assert.ok(f.passengers.slice(0,4).every(id=>!m.cards[id].attachedTo));assert.equal(m.players[side].lost.length,f.m.players[side].lost.length);
});
test('CPU passes an empty Lift Tube react and avoids reinforcing a clearly losing battle',()=>{
 const f=tube.reactFixture();const v=tube.runtime.project(f.m,tube.rules,'light');
 v.table=v.table.filter(c=>!f.passengers.includes(c.id));assert.equal(choose(v,'light'),'pass');
 const b=tube.reactFixture({battle:true,aboard:true});const battle=tube.runtime.project(b.m,tube.rules,'light');battle.rules.values.sites[b.bay].dark.power=100;assert.equal(choose(battle,'light'),'pass');
});
test('CPU carries a surplus garrison through Gate, disembarks and avoids a same-phase boarding loop',()=>{
 const f=tube.movePhase(tube.fixture({deployed:true}));let m=f.m,boarded=0,exited=0,moved=0;
 // An equal-icon unoccupied site adds a drain while one trooper holds Core.
 const startTurn=m.turn.number;
 for(let n=0;n<350&&m.turn.number===startTurn&&m.turn.phase==='move';n++){
  const p=tube.prompt(m);const id=p.side==='light'?cpu(clone(m),tube,'light'):'pass';
  if(id.startsWith('vessel:embark:'))boarded++;
  if(id.startsWith('vessel:exit:'))exited++;
  if(id.startsWith('voyage:landspeed:'+f.tube+':'))moved++;
  m=tube.step(clone(m),id);
 }
 assert.equal(boarded,4);assert.equal(exited,4);assert.equal(moved,1);assert.equal(m.cards[f.tube].location,f.corridor);assert.notEqual(m.turn.phase,'move');
});
test('hidden Reserve order changes neither legal Gate deployment nor CPU choice',()=>{
 const f=gate.fixture(),before=cpu(f.m,gate,'dark'),changed=clone(f.m);changed.players.light.reserve.reverse();changed.players.dark.reserve.reverse();
 assert.equal(cpu(changed,gate,'dark'),before);
});
test('CPU chooses a safer offered captured-ship launch and uses escape to protect its last Life Force',()=>{
 const v=view('light',['captured-ship:launch:a','captured-ship:launch:b','captured-ship:escape']);v.prompt.mandatory=true;
 v.table=[card('a','1_127','light'),card('b','1_128','light')];
 v.rules.values={characters:{},sites:{a:{dark:{power:8}},b:{dark:{power:0}}}};
 assert.equal(choose(v,'light'),'captured-ship:launch:b');v.players.light.lifeForce=2;assert.equal(choose(v,'light'),'captured-ship:escape');
});
test('CPU deploys a Lift Tube beside visible passengers and does not duplicate an existing local transport',()=>{
 const f=tube.fixture(),v=tube.runtime.project(f.m,tube.rules,'light'),id='vessel:deploy:'+f.tube+':'+f.core;
 v.prompt.choices=v.prompt.choices.filter(c=>c.id===id||c.id==='pass');assert.equal(choose(v,'light'),id);
 v.table.push(card('existing','1_148','light',f.core));assert.equal(choose(v,'light'),'pass');
 v.table=v.table.filter(c=>c.id!=='existing'&&!f.passengers.includes(c.id));assert.equal(choose(v,'light'),'pass');
});
