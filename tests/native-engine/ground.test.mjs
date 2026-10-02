import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,engine as proof} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const decks=()=>manifest.decks.map(d=>({side:d.side,cards:d.main}));
const clone=x=>JSON.parse(JSON.stringify(x));
// Component tests intentionally bypass full-deck admission; no production UI
// imports this adapter and no unimplemented card effects are claimed here.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
function fresh(){return runtime.createMatch('ground-test',60,decks(),rules)}
function pull(m,side,blueprint,zone='table',site){const card=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===blueprint&&c.zone==='reserve');assert.ok(card,'missing fixture card '+blueprint);state.moveCard(m,card.id,zone);if(site)m.cards[card.id].location=site;return card.id}
function location(m,side,blueprint){const id=pull(m,side,blueprint);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveTop(m,side,'reserve','force')}
function step(m,choice,seat){const p=runtime.prompt(m,rules,'dark');seat??=p.side;const before=clone(m);const n=runtime.applyCommand(m,rules,seat,{revision:m.revision,choice});assert.deepEqual(m,before);state.assertState(n);assert.deepEqual(runtime.project(n,rules,seat),runtime.project(clone(n),rules,seat));return n}
const choices=(m,side)=>runtime.prompt(m,rules,side).choices.map(c=>c.id);
function pass(m,n=1){for(let i=0;i<n;i++)m=step(m,'pass');return m}
function seek(m,predicate){for(let n=0;n<500;n++){if(predicate(m))return m;const p=runtime.prompt(m,rules,'dark'),actual=runtime.prompt(m,rules,p.side);m=step(m,actual.choices.some(c=>c.id==='pass')?'pass':actual.choices[0].id)}throw Error('Boundary not reached')}
function phase(m,p,side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.at(-1)?.timing==='phase')}
function settle(m){return seek(m,x=>x.status==='finished'||x.stack.at(-1)?.kind==='decision'||x.stack.length===1)}

test('production admission remains closed until complete reachable card behavior exists',()=>{assert.throws(()=>runtime.createMatch('no-partial-deck',60,decks(),premiereRules),/Unimplemented/)});

test('real deployment pays first, reveals its card and exposes Barrier only after it arrives',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),trooper=pull(m,'dark','1_194','hand'),barrier=pull(m,'light','1_105','hand');force(m,'dark',2);force(m,'light',1);m=phase(m,'deploy');
 m=step(m,'deploy:'+trooper+':'+bay);assert.equal(m.cards[trooper].zone,'playing');assert.equal(m.players.dark.used.length,1);assert.equal(choices(m,'light').some(c=>c.startsWith('barrier:')),false);
 m=pass(m,2);assert.equal(m.cards[trooper].zone,'table');assert.ok(choices(m,'light').includes('barrier:'+barrier+':'+trooper));m=step(m,'barrier:'+barrier+':'+trooper,'light');m=settle(m);
 assert.equal(ground.barred(m,trooper),true);assert.equal(m.cards[barrier].zone,'used');assert.equal(board.presence(m,'dark',bay),true);
 m=seek(m,x=>x.turn.number===2);assert.equal(ground.barred(m,trooper),false);assert.equal(ground.usage(m).barriers[trooper],undefined);
});

test('free troopers use actual Rebel/Imperial ability, and Luke has Farm and world restrictions',()=>{
 let m=fresh();const farm=location(m,'light','1_132'),bay=location(m,'dark','1_285'),luke=pull(m,'light','101_2','hand'),vader=pull(m,'dark','101_5','table',bay),rebel=pull(m,'light','1_28','hand'),storm=pull(m,'dark','1_194','hand');
 assert.deepEqual(board.deploymentPayment(m,luke,farm),{light:3});assert.equal(board.deploymentPayment(m,luke,bay),null);assert.deepEqual(board.deploymentPayment(m,storm,bay),{dark:0});
 state.moveCard(m,luke,'table');m.cards[luke].location=farm;assert.deepEqual(board.deploymentPayment(m,rebel,farm),{light:0});const another=pull(m,'light','101_2','hand');assert.equal(board.deploymentPayment(m,another,farm),null);
 state.moveCard(m,vader,'lost');assert.deepEqual(board.deploymentPayment(m,storm,bay),{dark:1});
});

test('both Jawa versions pay both players normally and their own camp changes that cost',()=>{
 let m=fresh();const lightCamp=location(m,'light','1_131'),darkCamp=location(m,'dark','1_292'),dune=location(m,'light','1_130'),light=pull(m,'light','1_12','hand'),dark=pull(m,'dark','1_182','hand');
 assert.deepEqual(board.deploymentPayment(m,light,lightCamp),{light:1});assert.deepEqual(board.deploymentPayment(m,dark,darkCamp),{dark:1});assert.deepEqual(board.deploymentPayment(m,light,darkCamp),{dark:1,light:1});assert.deepEqual(board.deploymentPayment(m,dark,dune),{dark:1,light:1});
 m.locations=m.locations.filter(id=>id!==lightCamp);state.moveCard(m,lightCamp,'lost');
 force(m,'dark',1);m=phase(m,'deploy');assert.equal(choices(m,'dark').includes('deploy:'+dark+':'+dune),false);force(m,'light',1);m=step(m,'deploy:'+dark+':'+dune);assert.equal(m.players.dark.force.length,0);assert.equal(m.players.light.force.length,0);m=settle(m);assert.equal(m.cards[dark].location,dune);
});

test('Droids provide no presence; an icon-free deployment site needs a character with ability',()=>{
 const m=fresh(),corridor=location(m,'dark','1_284'),cz=pull(m,'light','1_6','table',corridor),rebel=pull(m,'light','1_28','hand');
 assert.equal(board.abilityAt(m,'light',corridor),0);assert.equal(board.deploymentPayment(m,rebel,corridor),null);assert.equal(board.controls(m,'light',corridor),false);
 pull(m,'light','1_28','table',corridor);assert.deepEqual(board.deploymentPayment(m,rebel,corridor),{light:1});assert.equal(board.printed(m,cz,'ability'),0);
});

test('Core Shaft changes control threshold without removing presence',()=>{
 const m=fresh(),core=location(m,'light','101_1'),bay=location(m,'dark','1_285');const imperial=pull(m,'dark','1_194','table',core);pull(m,'light','1_28','table',bay);
 assert.equal(board.controls(m,'dark',core),true);assert.equal(board.presence(m,'light',bay),true);assert.equal(board.controls(m,'light',bay),false);
 const second=pull(m,'light','1_28','table',bay);assert.equal(board.controls(m,'light',bay),true);state.moveCard(m,second,'lost');state.moveCard(m,imperial,'lost');assert.equal(board.controls(m,'light',bay),true);
});

test('Core Shaft power erratum applies to Luke on another world and ends when control is contested',()=>{
 const m=fresh(),core=location(m,'light','101_1'),farm=location(m,'light','1_132'),luke=pull(m,'light','101_2','table',farm);
 const base=board.printed(m,luke,'power');assert.equal(board.power(m,luke),base);
 pull(m,'light','1_28','table',core);assert.equal(board.power(m,luke),base+2);
 const opponent=pull(m,'dark','1_194','table',core);assert.equal(board.power(m,luke),base);
 state.moveCard(m,opponent,'lost');assert.equal(board.power(m,luke),base+2);
});

test('regular movement is once per turn, costs one Force, carries equipment and stays in its system',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284'),farm=location(m,'light','1_132'),trooper=pull(m,'dark','1_194','table',bay),guard=pull(m,'dark','1_181','table',bay),weapon=pull(m,'dark','1_317','table',bay);m.cards[weapon].attachedTo=trooper;force(m,'dark',3);m=phase(m,'move');
 assert.ok(!choices(m,'dark').some(c=>c.startsWith('move:'+guard)));assert.ok(!choices(m,'dark').includes('move:'+trooper+':'+farm));m=settle(step(m,'move:'+trooper+':'+corridor));assert.equal(m.cards[weapon].location,corridor);assert.equal(m.cards[weapon].attachedTo,trooper);assert.equal(m.players.dark.force.length,2);m=pass(m);assert.ok(!choices(m,'dark').some(c=>c.startsWith('move:'+trooper)));
 m=seek(m,x=>x.turn.number===3&&x.turn.phase==='move'&&x.stack.length===1);assert.ok(choices(m,'dark').includes('move:'+trooper+':'+bay));
});

test('both sites can drain in either order and attempts persist through serialization',()=>{
 for(const reverse of [false,true]){let m=fresh();const bay=location(m,'light','1_124'),farm=location(m,'light','1_132');pull(m,'dark','1_194','table',bay);pull(m,'dark','1_194','table',farm);m=phase(m,'control');const life=state.lifeForce(m,'light');
  for(const site of reverse?[farm,bay]:[bay,farm]){m=step(m,'drain:'+site);m=seek(m,x=>x.stack.at(-1)?.kind==='decision');while(m.stack.at(-1)?.kind==='decision'){m=step(m,'lose:reserve','light');m=settle(m)}m=clone(m);if(runtime.prompt(m,rules,'dark').side==='light')m=pass(m)}
  assert.equal(state.lifeForce(m,'light'),life-3);assert.deepEqual([...ground.usage(m).drained].sort(),[bay,farm].sort());assert.equal(choices(m,'dark').some(c=>c.startsWith('drain:')),false);
 }
});

test('a zero-value drain still allows Wolfman react; arrival cancels further reacts',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284');pull(m,'dark','1_194','table',corridor);const wolf=pull(m,'light','1_30','table',bay);pull(m,'light','1_30','table',bay);force(m,'light',2);m=phase(m,'control');const life=state.lifeForce(m,'light');m=step(m,'drain:'+corridor);
 assert.ok(choices(m,'light').includes('react-move:'+wolf+':'+corridor));m=step(m,'react-move:'+wolf+':'+corridor,'light');m=settle(m);assert.equal(m.cards[wolf].location,corridor);assert.equal(state.lifeForce(m,'light'),life);assert.deepEqual(ground.usage(m).reacted,[wolf]);assert.equal(m.players.light.force.length,1);assert.equal(m.stack.length,1);
});

test('CZ-3 deploy react obeys ordinary costs; Barrier does not erase arriving presence',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284');pull(m,'dark','1_194','table',bay);pull(m,'light','1_6','table',corridor);const rebel=pull(m,'light','1_28','hand'),barrier=pull(m,'dark','1_249','hand');force(m,'light',1);force(m,'dark',1);m=phase(m,'control');const before=state.lifeForce(m,'light');m=step(m,'drain:'+bay);assert.ok(choices(m,'light').includes('react-deploy:'+rebel+':'+bay));m=step(m,'react-deploy:'+rebel+':'+bay,'light');m=pass(m,2);
 assert.ok(choices(m,'dark').includes('barrier:'+barrier+':'+rebel));m=step(m,'barrier:'+barrier+':'+rebel,'dark');m=settle(m);assert.equal(ground.barred(m,rebel),true);assert.equal(state.lifeForce(m,'light'),before);assert.equal(board.presence(m,'light',bay),true);
});

test('It Could Be Worse may spend more than the loss and repeated copies are noncumulative',()=>{
 for(const duplicate of [false,true]){let m=fresh();const farm=location(m,'light','1_132');pull(m,'dark','1_194','table',farm);const first=pull(m,'light','1_90','hand'),second=pull(m,'light','1_90','hand');force(m,'light',3);m=phase(m,'control');m=step(m,'drain:'+farm);m=pass(m,2);assert.equal(m.stack.at(-2).action.handler,'ground:force-loss');m=step(m,'reduce:'+first+':'+(duplicate?1:3),'light');m=pass(m,2);
  if(duplicate){m=pass(m);m=step(m,'reduce:'+second+':1','light');m=pass(m,2);const loss=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='ground:force-loss');assert.equal(loss.action.payload.remaining,1);m=settle(m);assert.equal(m.stack.at(-1).kind,'decision')}else {m=settle(m);assert.equal(m.stack.length,1);assert.equal(m.players.light.force.length,0)}
 }
});

test('final Life Force loss wins immediately, while a hand loss preserves the final Force',()=>{
 for(const fromHand of [true,false]){let m=fresh();const bay=location(m,'light','1_124');pull(m,'dark','1_194','table',bay);const hand=pull(m,'light','1_28','hand');for(const id of [...m.players.light.reserve].slice(1))state.moveCard(m,id,'lost');m=phase(m,'control');m=step(m,'drain:'+bay);m=seek(m,x=>x.stack.at(-1)?.kind==='decision');m=step(m,fromHand?'lose-hand:'+hand:'lose:reserve','light');assert.equal(m.status,fromHand?'playing':'finished');if(!fromHand){assert.equal(m.result.winner,'dark');assert.throws(()=>step(m,'pass','dark'),/cannot act/)}else assert.equal(state.lifeForce(m,'light'),1)}
});

test('location conversion preserves characters, attachments, drain history and current activation count',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284'),darkBay=pull(m,'dark','1_285','hand'),trooper=pull(m,'dark','1_194','table',bay);m=phase(m,'deploy');const gen=m.turn.generation;m.data.ground={turn:1,moved:[],reacted:[],drained:[bay],barriers:{}};
 m=settle(step(m,'site:'+darkBay+':over:'+bay));assert.equal(m.cards[trooper].location,darkBay);assert.equal(m.cards[bay].coveredBy,darkBay);assert.deepEqual(m.locations,[darkBay,corridor]);assert.deepEqual(ground.usage(m).drained,[darkBay]);assert.equal(m.turn.generation,gen);
});

test('character and location modifiers follow the current board, not scenario labels',()=>{
 const m=fresh(),farm=location(m,'light','1_132'),dune=location(m,'light','1_130'),corridor=location(m,'dark','1_284');const luke=pull(m,'light','101_2','table',farm),rebel=pull(m,'light','1_28','table',dune),guard=pull(m,'light','1_26','table',dune),imperial=pull(m,'dark','1_170','table',farm);
 assert.equal(board.forfeit(m,luke),5);assert.equal(board.forfeit(m,rebel),3);assert.equal(board.forfeit(m,guard),1);assert.equal(board.power(m,guard,true),4);assert.equal(board.power(m,imperial),1);m.cards[imperial].location=corridor;assert.equal(board.power(m,imperial),2);
 for(let i=0;i<4;i++)pull(m,'dark','1_196','table',dune);assert.equal(board.totalPower(m,'dark',dune),10);assert.equal(board.battleDestinyRequirement(m,'dark',dune),6);assert.equal(board.battleDestinyRequirement(m,'light',dune),4);
 state.moveCard(m,luke,'lost');assert.equal(board.forfeit(m,rebel),2);
});

test('restricted-three characters cannot deploy a fourth copy',()=>{
 const m=fresh(),bay=location(m,'light','1_124');for(let i=0;i<3;i++)pull(m,'light','1_30','table',bay);
 // Make a fourth physical copy in this component fixture; all actual deck cards
 // remain conserved. Production deck admission is still disabled.
 const id=pull(m,'light','1_28','hand');m.cards[id].blueprint='1_30';assert.equal(board.deploymentPayment(m,id,bay),null);
});

test('ported base modifiers agree with the previously conformed closed boards',()=>{
 const oldCharacters=load(new URL('../../lib/native-proof/character-rules.ts',import.meta.url));
 const oldDesert=load(new URL('../../lib/native-proof/desert-rules.ts',import.meta.url));
 for(const scenario of ['guard-post','rebel-post','luke-arrives','luke-support','tusken-band','jawa-bargain','dune-sea','desert-patrol']){const old=proof.createScenario(scenario);const m={...fresh(),cards:clone(old.cards),players:clone(old.players),locations:[...old.locations]};
  for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&board.cardDefinition(m,c.id).type==='Character')){assert.equal(board.power(m,c.id),oldCharacters.characterPower(old,c.id));if(['luke-arrives','luke-support','tusken-band'].includes(scenario))assert.equal(board.forfeit(m,c.id),oldDesert.characterForfeit(old,c.id))}
 }
});

test('nested Force loss may lose unresolved destiny and validates its seat without a usage record',()=>{
 let m=fresh();m=phase(m,'control');const card=m.players.light.reserve[0];state.moveCard(m,card,'destiny');for(const pile of ['reserve','force','used'])for(const id of [...m.players.light[pile]])state.moveCard(m,id,'lost');
 ground.queueForceLoss(m,{side:'light',remaining:1,source:'test-effect',site:null,reductionUsed:false});assert.equal(m.data.ground,undefined);m=seek(m,x=>x.stack.at(-1)?.kind==='decision');assert.ok(choices(m,'light').includes('lose:destiny'));const corrupt=clone(m);corrupt.stack.at(-1).side='dark';assert.throws(()=>rules.validate(corrupt),/pending Force loss/);m=step(m,'lose:destiny','light');assert.equal(m.result.winner,'dark');assert.equal(m.cards[card].zone,'lost');
});
