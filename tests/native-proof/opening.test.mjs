import test from 'node:test';
import fs from 'node:fs';
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/opening-oracle-result.json',import.meta.url)));
function compare(m,name){const expected=oracle.find(x=>x.name===name);assert.ok(expected);assert.equal(m.active,expected.active==='Dark Side Player'?'dark':'light');assert.equal(m.phase.toUpperCase(),expected.phase);for(const side of ['dark','light'])for(const pile of ['force','reserve','hand','used','lost'])assert.equal(m.players[side][pile].length,expected[side+pile[0].toUpperCase()+pile.slice(1)],name+' '+side+' '+pile)}
import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
const copy=m=>JSON.parse(JSON.stringify(m));
const choose=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
function step(m,id){const p=prompt(m),after=applyCommand(copy(m),p.side,{prompt:p.id,choice:id});assertMatch(copy(after));return after}
const fallback=m=>choose(m,'pass')?.id||choose(m,'recirculate')?.id||choose(m,'forfeit:')?.id||prompt(m).choices[0].id;
function until(m,done,select=fallback){for(let n=0;n<240;n++){if(done(m))return m;assert.equal(m.complete,false);m=step(m,select(m))}throw Error('Study did not reach target')}
const start=()=>until(createScenario('first-contact'),m=>!m.setup);
const ready=m=>until(m,x=>x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
const phase=(m,stage,number=m.turn.number)=>until(m,x=>x.turn?.number===number&&x.turn.stage===stage&&(!['deploy','move','battle'].includes(stage)||x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active));
const activate=m=>until(m,x=>x.turn.stage==='control',x=>choose(x,'activate')?.id||fallback(x));
const done=m=>until(m,x=>x.complete);
const bay=m=>m.locations.find(id=>m.cards[id].blueprint==='1_124');
const corridor=m=>m.locations.find(id=>m.cards[id].blueprint==='1_284');
function deploy(m){m=phase(m,'deploy');const c=prompt(m).choices.find(c=>c.id.startsWith('deploy:')&&c.id.endsWith(':'+bay(m)));return ready(step(m,c.id))}
function equip(m){m=ready(m);return ready(step(m,choose(m,'equip:').id))}
const troop=(m,side)=>Object.values(m.cards).find(c=>c.owner===side&&c.zone==='table'&&c.blueprint===(side==='dark'?'1_194':'1_28'));

test('starting choices and public inspections show both Force icon values, including zero',()=>{
 for(const scenario of ['opening-table','first-contact'])for(const side of ['dark','light']){
  const p=project(createScenario(scenario),side);assert.ok(p.setup.candidates.length);for(const c of p.prompt.choices){assert.deepEqual(c.forceIcons,p.setup.candidates.find(x=>x.id===c.card).forceIcons);assert.ok(Number.isInteger(c.forceIcons.dark));assert.ok(Number.isInteger(c.forceIcons.light));}
  if(scenario==='first-contact'){assert.equal(p.prompt.choices.length,1);assert.deepEqual(p.prompt.choices[0].forceIcons,side==='dark'?{dark:1,light:0}:{dark:1,light:1});}
 }
});
test('setup transitions once into Activate with the exact drawn cards and no duplicate start windows',()=>{
 let m=until(createScenario('first-contact'),x=>x.setup?.stage==='start');const before=copy(m.players);assert.equal(m.players.dark.hand.length,8);assert.equal(m.players.light.hand.length,8);m=step(m,'pass');const command={prompt:prompt(m).id,choice:'pass'};m=applyCommand(m,'light',command);
 assert.equal(m.engine,'native-proof-7');assert.equal(m.setup,undefined);assert.equal(m.complete,false);assert.equal(m.turn.stage,'activate');assert.equal(m.turn.number,1);assert.equal(m.cycle.generation,3);assert.equal(m.cycle.activated,0);assert.deepEqual(m.players,before);assert.equal(prompt(m).choices[0].id,'activate');assert.throws(()=>applyCommand(m,'light',command));
 for(const side of ['dark','light']){const b=m.players[side].hand.map(id=>m.cards[id].blueprint);assert.equal(b.filter(x=>x===(side==='dark'?'1_194':'1_28')).length,4);assert.equal(b.filter(x=>x===(side==='dark'?'1_182':'1_12')).length,2);assert.equal(m.players[side].reserve.length,51);}
});
test('passing both turns preserves the eight-card hands and reaches the gated endpoint',()=>{
 let m=start(),before=copy(m.players);compare(m,'opening');m=done(m);compare(m,'pass-both');assert.equal(m.turn.number,3);assert.equal(m.phase,'Activate');assert.equal(m.cycle.activated,0);assert.deepEqual(m.players,before);assert.deepEqual(m.cycle.history.map(t=>[t.side,t.generation,t.activated]),[['dark',3,0],['light',2,0]]);assert.equal(prompt(m),null);
});
test('all activated and drawn cards stay supported and paired hands stay private',()=>{
 let m=activate(start());assert.equal(m.players.dark.force.length,3);m=phase(m,'draw');m=until(m,x=>x.turn.stage==='end',x=>choose(x,'draw')?.id||fallback(x));assert.equal(m.players.dark.hand.length,11);m=activate(phase(m,'activate',2));m=phase(m,'draw');m=until(m,x=>x.turn.stage==='end',x=>choose(x,'draw')?.id||fallback(x));assert.equal(m.players.light.hand.length,10);
 for(const side of ['dark','light']){const own=project(m,side),other=side==='dark'?'light':'dark';assert.deepEqual(own.players[other].hand,[]);assert.equal(own.setup,undefined);assert.equal(JSON.stringify(own).includes('shuffleOrder'),false);for(const id of m.players[other].hand)assert.equal(JSON.stringify(own).includes('"id":"'+id+'"'),false);}
 assert.equal(done(m).complete,true);
});
test('newly armed trooper moves with its weapon; both sides can equip during their own Deploy',()=>{
 let m=equip(deploy(activate(start()))),host=troop(m,'dark'),weapon=Object.values(m.cards).find(c=>c.attachedTo===host.id);assert.equal(m.players.dark.force.length,1);m=phase(m,'move');m=ready(step(m,'move:'+host.id+':'+corridor(m)));assert.equal(m.cards[weapon.id].attachedTo,host.id);assert.equal(m.cards[weapon.id].location,corridor(m));assert.equal(m.players.dark.force.length,0);assert.equal(choose(m,'move:'+host.id),undefined);
 m=equip(deploy(activate(phase(m,'activate',2))));assert.equal(m.players.light.force.length,0);m=done(m);assert.equal(m.players.dark.hand.length,6);assert.equal(m.players.light.hand.length,6);assert.equal(m.players.dark.reserve.length,51);assert.equal(m.players.light.reserve.length,51);compare(m,'armed-movement');
});
test('Imperial Barrier uses retained Force and expires after the Light turn',()=>{
 let m=activate(start());m=activate(phase(m,'activate',2));m=phase(m,'deploy');m=step(m,choose(m,'deploy:').id);m=until(m,x=>!!choose(x,'play:'));assert.equal(prompt(m).side,'dark');assert.equal(prompt(m).automatic,false);m=step(m,choose(m,'play:').id);assert.equal(m.cards[m.stack.find(f=>f.kind==='interrupt').card].zone,'playing');m=ready(m);const target=m.turn.restrictions[0].target;assert.equal(m.players.dark.force.length,2);m=phase(m,'move');assert.equal(choose(m,'move:'+target),undefined);m=done(m);assert.deepEqual(m.turn.restrictions,[]);assert.equal(m.turn.expired.length,1);assert.equal(m.players.dark.reserve.length,50);assert.equal(m.players.light.reserve.length,50);compare(m,'opening-barrier');
});
test('defender can spend carried Force on a Blaster hit and battle resumes the same turn',()=>{
 let m=equip(deploy(activate(start())));m=deploy(activate(phase(m,'activate',2)));m=phase(m,'battle');m=step(m,'battle:'+bay(m));m=until(m,x=>!!choose(x,'fire:'));assert.equal(prompt(m).side,'dark');assert.equal(prompt(m).automatic,false);const target=choose(m,'fire:').weaponPreview.target;m=step(m,choose(m,'fire:').id);assert.equal(m.players.dark.force.length,0);assert.equal(m.battle.shots[0].status,'pending');m=until(m,x=>x.battle.shots[0].status==='drawn');assert.equal(m.battle.shots[0].destiny,3);assert.equal(m.cards[target].hit,undefined);m=until(m,x=>!!choose(x,'forfeit:'));assert.equal(m.cards[target].hit,true);assert.deepEqual(m.battle.power,{light:1,dark:1});assert.deepEqual(m.battle.damage,{light:0,dark:0});assert.deepEqual(m.battle.attrition,{light:0,dark:0});assert.equal(choose(m,'forfeit:'+target).card,target);m=step(m,'forfeit:'+target);m=until(m,x=>!!x.battle.resolved);assert.equal(m.complete,false);assert.equal(m.turn.number,2);assert.equal(m.turn.stage,'battle');m=done(m);assert.equal(m.players.light.lost.length,1);assert.equal(m.players.dark.reserve.length,51);assert.equal(m.players.light.reserve.length,51);compare(m,'defensive-hit');
});
test('passing defensive fire retains Force and weapon, with no destiny consumption',()=>{
 let m=equip(deploy(activate(start())));m=deploy(activate(phase(m,'activate',2)));m=phase(m,'battle');m=step(m,'battle:'+bay(m));m=until(m,x=>!!choose(x,'fire:'));const reserve=[...m.players.dark.reserve];m=until(m,x=>!!x.battle.resolved);assert.equal(m.battle.shots.length,0);assert.equal(m.players.dark.force.length,1);assert.deepEqual(m.players.dark.reserve,reserve);assert.equal(done(m).complete,true);
});
test('closed board and hand guards reject unsupported continuations',()=>{
 const m=start();for(const mutate of [x=>x.engine='native-proof-6',x=>x.locations.pop(),x=>{x.complete=true},x=>{const a=x.players.dark.hand[0],b=x.players.dark.reserve.find(id=>x.cards[id].blueprint==='1_170');x.players.dark.hand[0]=b;x.players.dark.reserve[x.players.dark.reserve.indexOf(b)]=a;x.cards[a].zone='reserve';x.cards[b].zone='hand'}]){const bad=copy(m);mutate(bad);assert.throws(()=>assertMatch(bad));}
 const initial=createScenario('first-contact');assert.throws(()=>step(initial,'select:'+Object.values(initial.cards).find(c=>c.owner==='dark'&&c.blueprint==='1_291').id));
});
test('200 seeded complete routes preserve every physical card and restore each decision',()=>{
 let seed=812061;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};let shots=0,moves=0,barriers=0;
 for(let run=0;run<200;run++){let m=createScenario('first-contact');for(let n=0;!m.complete&&n<240;n++){const p=prompt(m),c=p.choices[Math.floor(rand()*p.choices.length)];shots+=c.id.startsWith('fire:');moves+=c.id.startsWith('move:');barriers+=c.id.startsWith('play:');m=step(m,c.id);for(const side of ['dark','light'])assert.deepEqual(project(m,side),project(copy(m),side));}assert.equal(m.complete,true);assert.equal(m.turn.number,3);assert.equal(Object.keys(m.cards).length,120);assert.equal(m.cycle.history.length,2);assert.equal(m.cycle.activated,0);}
 // Directed tests cover rare shots and Barriers; random runs exercise legal intersections.
 assert.ok(moves>0);console.log('Opening seeded actions:',{shots,moves,barriers});
});
