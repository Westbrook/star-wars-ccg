import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,position,setPosition,move,boundary,pull,state,priority,step,seek,ids,rules,clone,runtime,load} from './mobile-systems-fixture.mjs';
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/mobile-systems-results.json',import.meta.url)));
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
for(const [start,orbit,to,dest] of [[0,null,1,null],[3,null,4,'Yavin 4'],[4,'Yavin 4',4,null],[4,null,4,'Yavin 4'],[4,'Yavin 4',5,null]])test('mobile move '+JSON.stringify([start,orbit,to,dest]),()=>{
 const f=fixture(start,orbit);state.moveCard(f.m,f.gun,'table');f.m.cards[f.gun].attachedTo=f.death;const before=f.m.players.dark.force.length,m=move(f,to,dest);assert.deepEqual(position(m,f.death),{parsec:to,orbit:dest});assert.equal(before-m.players.dark.force.length,1);assert.equal(m.cards[f.scout].location,f.death);assert.equal(m.cards[f.ywing].location,f.death);assert.ok(mod('ground').usage(m).moved.includes(f.death));const ready=priority(seek(m,x=>x.stack.length===1),'dark');assert.ok(!ids(ready).some(id=>id.startsWith('mobile:move:')));const mode=start===0?'forward':start===3?'orbit':to===5?'depart':orbit?'leave':'enter';assert.deepEqual({mode,cost:before-m.players.dark.force.length,parsec:position(m,f.death).parsec,orbit:position(m,f.death).orbit??'deep',darkCarried:m.cards[f.scout].location===f.death,lightCarried:m.cards[f.ywing].location===f.death,gunCarried:m.cards[f.gun].attachedTo===f.death,regularMove:mod('ground').usage(m).moved.includes(f.death)},oracle.find(r=>r.mode===mode));
});
test('starting Death Star causes Light to take the first turn with eight-card hands',()=>{
 const base=mod('premiere-rules').premiereRules;const r={...base,supports:()=>true,starting:{...base.starting,ordinarySetup:()=>true}};
 let m=runtime.createMatch('mobile-setup',60,[{side:'dark',cards:['2_143',...Array(59).fill('1_194')]},{side:'light',cards:['1_135',...Array(59).fill('1_28')]}],r);
 for(const side of ['dark','light']){const p=runtime.prompt(m,r,side);m=runtime.applyCommand(m,r,side,{revision:m.revision,choice:p.choices[0].id},()=>0);}
 while(m.status==='setup'){const p=runtime.prompt(m,r,'dark'),q=runtime.prompt(m,r,p.side);m=runtime.applyCommand(m,r,q.side,{revision:m.revision,choice:q.choices[0].id},()=>0);}
 assert.equal(m.turn.side,'light');assert.equal(m.turn.number,1);for(const side of ['light','dark'])assert.equal(m.players[side].hand.length,8);assert.equal(runtime.prompt(m,r,'light').side,'light');assert.deepEqual(position(m,m.setup.selected.dark),{parsec:0,orbit:null});assert.deepEqual({mode:'setup',first:m.turn.side,parsec:position(m,m.setup.selected.dark).parsec},oracle.find(r=>r.mode==='setup'));
});
test('mobile movement rejects unchanged position, negative or distant parsecs and Light turn',()=>{
 const f=fixture(),choices=ids(f.m);assert.ok(choices.includes('mobile:move:'+f.death+':1:deep'));for(const n of [-1,0,2])assert.ok(!choices.includes('mobile:move:'+f.death+':'+n+':deep'));
 f.m.turn.side='light';f.m.stack[0].priority='light';assert.ok(!ids(f.m).some(id=>id.startsWith('mobile:move:')));
});
test('no Force means no mobile-system move',()=>{const f=fixture();for(const id of [...f.m.players.dark.force])state.moveCard(f.m,id,'used');assert.ok(!ids(f.m).some(id=>id.startsWith('mobile:move:')))});
test('arrival resumes after JSON recovery and carries mounted weapons with both fleets',()=>{
 const f=fixture();state.moveCard(f.m,f.gun,'table');f.m.cards[f.gun].attachedTo=f.death;
 let m=boundary(step(f.m,'mobile:move:'+f.death+':1:deep'),'mobile-moving');assert.equal(position(m,f.death).parsec,0);m=boundary(clone(m),'mobile-moved');assert.equal(position(m,f.death).parsec,1);assert.equal(m.cards[f.gun].attachedTo,f.death);assert.equal(m.cards[f.ywing].location,f.death);
});
for(const fromMobile of [true,false])test('ship without hyperdrive transfers between a mobile system and its orbit '+fromMobile,()=>{
 const f=fixture(4,'Yavin 4');f.scout=pull(f.m,'dark','1_300','table',f.death);state.moveCard(f.m,f.pilot,'table');Object.assign(f.m.cards[f.pilot],{attachedTo:f.scout,location:fromMobile?f.death:f.yavin,aboardRole:'pilot'});f.m.cards[f.scout].location=fromMobile?f.death:f.yavin;const target=fromMobile?f.yavin:f.death,choices=ids(f.m),id='voyage:orbit:'+f.scout+':'+target;assert.ok(choices.includes(id));assert.ok(!choices.some(id=>id.startsWith('voyage:hyperspace:'+f.scout+':')));const before=f.m.players.dark.force.length;const m=boundary(step(f.m,id),'moved');assert.equal(m.cards[f.scout].location,target);assert.equal(before-m.players.dark.force.length,1);const mode=fromMobile?'ship-out':'ship-in';assert.deepEqual({mode,cost:before-m.players.dark.force.length,arrived:m.cards[f.scout].location===target,regularMove:mod('ground').usage(m).moved.includes(f.scout)},oracle.find(r=>r.mode===mode));
});
test('equal parsec deep space does not grant the no-hyperdrive transfer',()=>{const f=fixture(4);f.m.cards[f.scout].location=f.yavin;assert.ok(!ids(f.m).some(id=>id.startsWith('voyage:orbit:')))});
test('ordinary hyperspeed uses current mobile-system position',()=>{
 const f=fixture(3);f.m.turn.side='light';f.m.stack[0].priority='light';assert.ok(ids(f.m).includes('voyage:hyperspace:'+f.ywing+':'+f.yavin));setPosition(f.m,f.death,9);assert.ok(!ids(f.m).includes('voyage:hyperspace:'+f.ywing+':'+f.yavin));
});
test('location-mounted Turbolaser deploys for three Force and does not offer ordinary transfers',()=>{
 const f=fixture();f.m.turn.phase='deploy';const before=f.m.players.dark.force.length;let m=seek(step(f.m,'space-weapon:equip:'+f.gun+':'+f.death),x=>x.stack.length===1);assert.equal(m.cards[f.gun].attachedTo,f.death);assert.equal(m.cards[f.gun].location,undefined);assert.equal(before-m.players.dark.force.length,3);
 const host=pull(m,'dark','1_302','table',f.death);m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('space-weapon:equip:'+f.gun+':')));const second=pull(m,'dark','1_323','table',f.death);m.cards[second].attachedTo=host;assert.ok(!ids(m).includes('space-weapon:equip:'+second+':'+f.death));
});
test('location-mounted weapon fires at ships at its own mobile system, not the orbited planet',()=>{
 const f=fixture(4,'Yavin 4');state.moveCard(f.m,f.gun,'table');f.m.cards[f.gun].attachedTo=f.death;f.m.turn.phase='battle';let m=priority(boundary(step(f.m,'battle:'+f.death),'battle-weapons'),'dark');assert.ok(ids(m).includes('space-weapon:fire:'+f.gun+':'+f.ywing));
 for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');for(let n=0;n<2;n++){const c=Object.values(m.cards).find(c=>c.zone==='hand'&&c.owner==='dark'&&c.blueprint==='1_262');state.moveCard(m,c.id,'reserve');}
 m=boundary(step(m,'space-weapon:fire:'+f.gun+':'+f.ywing),'weapon-fired');assert.equal(m.data.battle.starshipShots[0].total,5);assert.equal(m.data.battle.starshipShots[0].outcome,'hit');
 const other=fixture(4,'Yavin 4');state.moveCard(other.m,other.gun,'table');other.m.cards[other.gun].attachedTo=other.death;other.m.cards[other.scout].location=other.yavin;other.m.cards[other.ywing].location=other.yavin;other.m.turn.phase='battle';const remote=priority(boundary(step(other.m,'battle:'+other.yavin),'battle-weapons'),'dark');assert.ok(!ids(remote).some(id=>id.startsWith('space-weapon:fire:'+other.gun+':')));
});
test('core-shaft control increases ability required only at Death Star sites',()=>{
 const f=fixture(),shaft=pull(f.m,'light','101_1','table');f.m.locations.splice(f.m.locations.indexOf(f.death),0,shaft);state.moveCard(f.m,f.passenger,'table');f.m.cards[f.passenger].location=shaft;state.moveCard(f.m,f.scout,'hand');assert.equal(mod('board').abilityAt(f.m,'light',f.death),1);assert.equal(mod('board').controls(f.m,'light',f.death),true);rules.validate(f.m);
});
test('invalid saved positions and movement targets are rejected',()=>{
 const f=fixture(3),m=step(f.m,'mobile:move:'+f.death+':4:Yavin 4');for(const edit of [x=>x.data.mobileSystems[f.death].parsec=-1,x=>x.data.mobileSystems[f.death].orbit='Tatooine',x=>x.stack.find(r=>r.action?.handler==='mobile:begin').action.payload.to.parsec=99]){const bad=clone(m);edit(bad);assert.throws(()=>rules.validate(bad));}
});

test('complete GEMP mobile weapon deployment, firing and second-weapon comparison',()=>{
 const f=fixture();f.m.turn.phase='deploy';const force=f.m.players.dark.force.length;let m=seek(step(f.m,'space-weapon:equip:'+f.gun+':'+f.death),x=>x.stack.length===1);const deploy=force-m.players.dark.force.length,second=pull(m,'dark','1_323','table');m.cards[second].attachedTo=f.death;m.turn.phase='battle';m.stack[0].priority='dark';m.stack[0].passes=0;
 m=priority(boundary(step(m,'battle:'+f.death),'battle-weapons'),'dark');for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');for(let i=0;i<2;i++){const c=Object.values(m.cards).find(c=>c.zone==='hand'&&c.owner==='dark'&&c.blueprint==='1_262');state.moveCard(m,c.id,'reserve');}const before=m.players.dark.force.length;
 m=boundary(step(m,'space-weapon:fire:'+f.gun+':'+f.ywing),'weapon-fired');m=priority(boundary(m,'battle-weapons'),'dark');assert.deepEqual({mode:'weapon',deploy,fire:before-m.players.dark.force.length,hit:m.data.battle.hits.includes(f.ywing),secondWeapon:ids(m).includes('space-weapon:fire:'+second+':'+f.ywing)},oracle.find(r=>r.mode==='weapon'));
});
test('a later hand deployment starts at parsec zero without changing the active player',()=>{
 const f=fixture();f.m.locations=f.m.locations.filter(id=>id!==f.death);for(const id of [f.scout,f.ywing])f.m.cards[id].location=f.planet;state.moveCard(f.m,f.death,'hand');f.m.turn.phase='deploy';const choice=ids(f.m).find(id=>id.startsWith('site:'+f.death+':'));assert.ok(choice);const m=seek(step(f.m,choice),x=>x.cards[f.death].zone==='table');assert.deepEqual(position(m,f.death),{parsec:0,orbit:null});assert.equal(m.turn.side,'dark');
});
test('a stopped mobile arrival retains its paid cost and used regular move',()=>{
 const f=fixture();let m=boundary(step(f.m,'mobile:move:'+f.death+':1:deep'),'mobile-moving');m.stack.find(r=>r.action?.handler==='mobile:arrive').cancelled=true;m=seek(m,x=>x.stack.length===1);assert.deepEqual(position(m,f.death),{parsec:0,orbit:null});assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);assert.ok(mod('ground').usage(m).moved.includes(f.death));
});
test('parsec bounds include 99 and exclude 100',()=>{const f=fixture(99);assert.ok(ids(f.m).includes('mobile:move:'+f.death+':98:deep'));assert.ok(!ids(f.m).some(id=>id.includes(':100:')))});
