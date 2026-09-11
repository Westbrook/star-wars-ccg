import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engine} from './load-engine.mjs';
const {createScenario,prompt,applyCommand,assertMatch,project}=engine;
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/turn-oracle-result.json',import.meta.url),'utf8'));
const branch=name=>oracle.branches.find(b=>b.name===name);
const copy=m=>JSON.parse(JSON.stringify(m)),other=s=>s==='dark'?'light':'dark';
function step(m,id){const p=prompt(m);const n=copy(applyCommand(copy(m),p.side,{prompt:p.id,choice:id}));assertMatch(n);for(const side of ['dark','light'])assert.deepEqual(project(n,side),project(copy(n),side));return n}
const choice=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
const defaultChoice=m=>choice(m,'recirculate')?.id||choice(m,'pass')?.id||choice(m,'lose:reserve')?.id||prompt(m).choices[0].id;
function until(m,done,select=defaultChoice){for(let i=0;i<350;i++){if(done(m))return m;assert.equal(m.complete,false,'scenario ended before target');m=step(m,select(m))}throw Error('Continuation exceeded bound')}
const phase=(m,stage,number=m.turn.number)=>until(m,x=>x.turn.number===number&&x.turn.stage===stage);
const ready=m=>until(m,x=>x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
function activate(m){return until(m,x=>x.turn.stage==='control',x=>choice(x,'activate')?.id||defaultChoice(x))}
function deploy(m,site,play=false){m=ready(phase(m,'deploy'));const id=choice(m,'deploy:').card;m=step(m,'deploy:'+id+':'+site);if(play){assert.equal(prompt(m).automatic,false);m=step(m,choice(m,'play:').id);assert.equal(m.turn.restrictions.length,0);m=step(step(m,'pass'),'pass');assert.equal(m.turn.restrictions.length,1)}else m=step(m,'pass');return ready(m)}
function battle(m,site){m=ready(phase(m,'battle'));m=step(m,'battle:'+site);return until(m,x=>!!x.battle.resolved)}
function move(m,id,site){m=ready(phase(m,'move'));m=step(m,'move:'+id+':'+site);m=ready(m);assert.equal(choice(m,'move:'+id+':'),undefined);return m}
const finish=m=>until(m,x=>x.complete);
const tableTrooper=(m,side)=>Object.values(m.cards).find(c=>c.owner===side&&c.zone==='table'&&c.location);

test('two complete six-phase turns reach Dark Activate without changing untouched piles',()=>{
 let m=createScenario('next-turn'),before=copy(m.players),phases=[];
 assert.equal(m.engine,'native-proof-5');assert.equal(Object.keys(m.cards).length,120);assert.equal(m.cycle.generation,0);
 while(!m.complete){const key=m.turn.number+':'+m.phase;if(phases.at(-1)!==key)phases.push(key);m=step(m,defaultChoice(m))}
 phases.push('3:Activate');
 const expected=[];for(const n of [1,2])for(const phase of ['Start of turn','Activate','Control','Deploy','Battle','Move','Draw','End of turn'])expected.push(n+':'+phase);expected.push('3:Start of turn','3:Activate');
 assert.deepEqual(phases,expected);assert.deepEqual(m.players,before);assert.equal(m.active,'dark');assert.equal(m.cycle.activated,0);assert.equal(m.cycle.generation,oracle.generation.dark);
 assert.deepEqual(m.cycle.history.map(h=>[h.number,h.side,h.generation,h.activated]),[[1,'dark',3,0],[2,'light',2,0]]);assert.equal(prompt(m),null);
});

test('activation locks generation, preserves card order and resets at the incoming turn',()=>{
 let m=phase(createScenario('next-turn'),'activate');const top=m.players.dark.reserve.slice(0,3),oldForce=[...m.players.dark.force];m=activate(m);
 assert.deepEqual(m.players.dark.force,[...top].reverse().concat(oldForce));assert.equal(m.cycle.activated,oracle.generation.dark);assert.equal(m.players.dark.force.length,4);assert.equal(choice(m,'activate'),undefined);
 m=phase(m,'activate',2);assert.equal(m.active,'light');assert.equal(m.cycle.activated,0);assert.equal(m.cycle.generation,oracle.generation.light);m=activate(m);assert.equal(m.players.light.force.length,3);
 m=finish(m);assert.deepEqual(m.cycle.history.map(h=>h.activated),[3,2]);assert.equal(m.cycle.activated,0);assert.equal(m.players.dark.force.length,4);
});

for(const lossSource of ['reserve','force','hand'])test('Force drain '+lossSource+' losses resume Control and preserve one-drain limits',()=>{
 let m=activate(createScenario('next-turn'));const bay=m.locations[0],corridor=m.locations[1];const force=m.players.dark.force.length;
 assert.match(choice(m,'drain:'+bay).label,/1 Force/);m=step(m,'drain:'+bay);m=until(m,x=>prompt(x).title==='Choose Force to lose');
 assert.equal(prompt(m).side,'light');m=step(m,choice(m,'lose:'+lossSource).id);m=ready(m);assert.equal(m.players.light.lost.length,1);assert.equal(m.players.dark.force.length,force);assert.equal(choice(m,'drain:'+bay),undefined);
 m=activate(phase(m,'activate',2));assert.deepEqual(m.drained,[]);assert.match(choice(m,'drain:'+corridor).label,/2 Force/);m=step(m,'drain:'+corridor);
 m=until(m,x=>x.stack.at(-1)?.kind==='turn',x=>choice(x,'lose:reserve')?.id||defaultChoice(x));m=ready(m);assert.equal(m.players.dark.lost.length,2);assert.equal(choice(m,'drain:'+corridor),undefined);
 if(lossSource==='reserve'){const b=branch('exact-force-drains');assert.equal(m.players.dark.force.length,b.darkForce);assert.equal(m.players.light.force.length,b.lightForce);assert.equal(m.players.dark.lost.length,b.darkLost);assert.equal(m.players.light.lost.length,b.lightLost)}
 m=finish(m);assert.deepEqual(m.drained,[]);
});

function boundary(m,target,compare){
 m=phase(m,'end');const outgoing=m.active,number=m.turn.number,before=copy(m.players),moved=[...m.turn.moved],battled=[...m.turn.battled];
 assert.equal(m.turn.restrictions.some(r=>r.target===target),true);m=step(m,'recirculate');assert.equal(m.active,outgoing);assert.equal(m.turn.restrictions.some(r=>r.target===target),true);
 assert.deepEqual(m.players[outgoing].reserve,[...before[outgoing].reserve,...before[outgoing].used]);
 m=step(m,'recirculate');assert.equal(m.active,outgoing);assert.equal(m.turn.number,number);assert.equal(m.turn.restrictions.length,0);assert.deepEqual(m.turn.moved,moved);assert.deepEqual(m.turn.battled,battled);
 for(const side of ['dark','light']){assert.deepEqual(m.players[side].reserve,[...before[side].reserve,...before[side].used]);assert.deepEqual(m.players[side].force,before[side].force)}
 const event=compare.find(x=>x.event==='EndOfTurnResult');assert.equal(m.players.dark.force.length,event.darkForce);assert.equal(m.players.light.force.length,event.lightForce);assert.equal(m.turn.battled.includes(m.locations[1]),event.corridorBattled);
 assert.match(prompt(m).title,/end of turn/);assert.equal(prompt(m).side,outgoing);assert.deepEqual(prompt(m).choices.map(c=>c.id),['pass']);m=step(m,'pass');assert.equal(m.active,outgoing);m=step(m,'pass');
 assert.equal(m.active,other(outgoing));assert.equal(m.turn.number,number+1);assert.equal(m.turn.stage,'start');assert.equal(m.cycle.generation,0);assert.deepEqual(m.turn.moved,[]);assert.deepEqual(m.turn.battled,[]);assert.deepEqual(m.drained,[]);assert.equal(m.battle,null);return m;
}

test('both Barriers, recirculation and outgoing/incoming boundaries match executed GEMP',()=>{
 const b=branch('exact-two-turns-both-barriers');let m=activate(createScenario('next-turn'));const bay=m.locations[0],corridor=m.locations[1],darkOriginal=tableTrooper(m,'dark').id;
 m=deploy(m,bay,true);const darkTarget=m.turn.restrictions[0].target;m=move(m,darkOriginal,corridor);assert.equal(choice(m,'move:'+darkTarget),undefined);m=boundary(m,darkTarget,b.darkBoundary);
 m=activate(m);m=deploy(m,corridor,true);const lightTarget=m.turn.restrictions[0].target;m=battle(m,corridor);assert.deepEqual(m.battle.power,{dark:1,light:1});m=boundary(m,lightTarget,b.lightBoundary);m=finish(m);
 assert.equal(m.players.dark.force.length,b.darkForceAtTurn3);assert.equal(m.players.light.force.length,b.lightForceAtTurn3);assert.deepEqual(m.cycle.history.map(h=>h.expired),[1,1]);assert.equal(m.turn.expired.length,2);
});

test('a Barriered Dark trooper can defend the next Light turn after expiry',()=>{
 let m=activate(createScenario('next-turn'));const corridor=m.locations[1],original=tableTrooper(m,'dark').id;m=deploy(m,corridor,true);const target=m.turn.restrictions[0].target;m=move(m,original,corridor);
 m=activate(phase(m,'activate',2));m=ready(phase(m,'battle'));m=step(m,'battle:'+corridor);assert.equal(m.battle.participants.dark.includes(target),true);assert.equal(m.battle.participants.dark.length,2);
 m=until(m,x=>!!project(x,'light').losses);assert.deepEqual(m.battle.damage,{dark:0,light:1});assert.deepEqual(m.battle.attrition,{dark:0,light:0});m=finish(m);assert.equal(m.complete,true);
});

test('same-site battles on opposing turns match GEMP and losses last through end responses',()=>{
 const b=branch('same-corridor-battle-on-both-turns');let m=activate(createScenario('next-turn'));const bay=m.locations[0],corridor=m.locations[1],dark=tableTrooper(m,'dark').id,light=tableTrooper(m,'light').id;
 m=deploy(m,corridor);m=battle(m,corridor);assert.equal(m.battle.participants.dark.length,b.firstBattleParticipantsEach);m=ready(m);assert.equal(!!choice(m,'battle:'+corridor),b.repeatBattleSameTurn);m=move(m,dark,corridor);
 m=phase(m,'end');assert.ok(project(m,'dark').losses);m=phase(m,'activate',2);assert.equal(project(m,'dark').losses,null);assert.deepEqual(m.turn.battled,[]);
 m=activate(m);m=deploy(m,corridor);m=battle(m,corridor);assert.equal(m.battle.participants.light.length,b.secondBattleParticipantsEach);assert.deepEqual(m.battle.power,{light:2,dark:2});m=move(m,light,bay);m=finish(m);
 assert.equal(m.players.dark.force.length,b.darkRetainedForceTurn3);assert.equal(m.players.light.force.length,b.lightRetainedForceTurn3);assert.deepEqual(m.turn.moved,[]);assert.deepEqual(m.turn.battled,[]);
});

test('controlled zero-drain diagnostic is legal, free and recorded once, matching GEMP',()=>{
 const b=branch('controlled-zero-drain');let m=createScenario('next-turn');const bay=m.locations[0],corridor=m.locations[1];tableTrooper(m,'dark').location=corridor;tableTrooper(m,'light').location=bay;m=activate(m);
 assert.equal(!!choice(m,'drain:'+corridor),b.offered);assert.match(choice(m,'drain:'+corridor).label,/0 Force/);m=step(m,'drain:'+corridor);m=ready(m);
 assert.equal(m.players.light.lost.length,b.lightLost);assert.equal(m.players.dark.force.length,b.darkForce);assert.equal(!!choice(m,'drain:'+corridor),b.repeatOffered);
});

test('drawing is optional and exact Force identities become the owner hand without leaking',()=>{
 let m=activate(createScenario('next-turn'));m=ready(phase(m,'draw'));const card=m.players.dark.force[0],before=m.players.dark.force.length;m=step(m,'draw');assert.equal(m.players.dark.hand[0],card);assert.equal(m.players.dark.force.length,before-1);assert.equal(JSON.stringify(project(m,'light')).includes(card),false);m=phase(m,'activate',2);assert.equal(m.players.dark.force.length,before-1);m=finish(m);assert.equal(m.cards[card].zone,'hand');
});

test('timed boundary windows reject normal actions and corrupt snapshots fail closed',()=>{
 let m=createScenario('next-turn');assert.equal(prompt(m).automatic,true);assert.throws(()=>step(m,'activate'),/not legal/);assert.deepEqual(project(m,'light').prompt.choices,[]);
 const wrong=copy(m);delete wrong.cycle;assert.throws(()=>assertMatch(wrong),/cycle/);
 m=phase(m,'activate');const stale=prompt(m);m=step(m,'activate');assert.throws(()=>applyCommand(m,stale.side,{prompt:stale.id,choice:'activate'}),/stale|seat/);
 const bad=copy(m);bad.cycle.generation=99;assert.throws(()=>assertMatch(bad),/generation/);
 const card=bad.players.dark.reserve.find(id=>bad.cards[id].blueprint==='101_5');bad.cycle.generation=3;bad.players.dark.reserve.splice(bad.players.dark.reserve.indexOf(card),1);bad.players.dark.hand.push(card);bad.cards[card].zone='hand';assert.throws(()=>assertMatch(bad),/Unsupported card/);
});

test('seeded legal branches keep every drawable card supported through both turns',()=>{
 let random=91873;const next=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);let actions=0;
 for(let run=0;run<80;run++){
  let m=createScenario('next-turn');
  for(let n=0;!m.complete&&n<350;n++){
   const p=prompt(m),available=p.choices.filter(c=>c.id!=='pass'),picked=available.length&&next()<.75?available[Math.floor(next()*available.length)]:p.choices[Math.floor(next()*p.choices.length)];m=step(m,picked.id);actions++;
   for(const side of ['dark','light'])for(const id of [...m.players[side].hand,...m.players[side].force])assert.ok((side==='dark'?['1_194','1_249','1_182']:['1_28','1_105','1_12']).includes(m.cards[id].blueprint));
   assert.equal(prompt(m)?.choices.some(c=>c.id==='draw-destiny')||false,false);
  }
  assert.equal(m.complete,true);assert.equal(m.turn.number,3);assert.equal(m.cycle.history.length,2);
 }
 assert.ok(actions>4000);
});
