import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {fixture,loss,payment,finish,runtime,rules,state,pull,location,step,seek,priority,prompt,ordinary,resistanceLimit,occupiedBattlegrounds,battleground,lossLedger,lossTotal,lossRemaining,assertLedger} from './resistance-fixture.mjs';
const {suppressGameText}=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
for(const side of ['light','dark'])for(const count of [0,2,3])for(const insert of [false,true])test(`${side} ${count} battlegrounds: ${insert?'insert':'drain'} payment`,()=>{
 const f=fixture({side,count}),before=f.m.players[side].lost.length,m=finish(loss(f,insert?{kind:'effect',insert}:{}));assert.equal(m.players[side].lost.length-before,count===3?2:4);assert.equal(m.cards[f.card].zone,'table');
});
for(const side of ['light','dark'])test(side+' no opposing occupation and contested occupation are distinct from control',()=>{
 let f=fixture({side,count:0,opponent:false});assert.equal(resistanceLimit(f.m,side),2);assert.equal(finish(loss(f)).players[side].lost.length,2);
 f=fixture({side,count:3});state.moveCard(f.m,f.enemy,'hand');state.moveCard(f.m,f.enemy,'table');f.m.cards[f.enemy].location=f.sites[1];assert.equal(occupiedBattlegrounds(f.m,side).length,3);assert.equal(resistanceLimit(f.m,side),2);
});
for(const mode of ['depart','arrive','suppressed'])test('limit source '+mode+' respects cards already paid',()=>{
 const f=fixture({zone:mode==='arrive'?'hand':'table'});if(mode==='suppressed')suppressGameText(f.m,f.sites[0],f.card);
 let m=payment(loss(f));const before=m.players.light.lost.length;m=step(m,'lose:reserve');assert.equal(m.players.light.lost.length,before+1);
 if(mode==='depart')state.moveCard(m,f.card,'hand');if(mode==='arrive')state.moveCard(m,f.card,'table');m=finish(m);assert.equal(m.players.light.lost.length-before,mode==='arrive'?2:4);
});
test('cap is independent of irreducibility, applies after reductions and never caps generic or battle damage',()=>{
 const {m}=fixture();for(const kind of ['drain','effect','battle'])for(const irreducible of [true,false]){const ledger=lossLedger(6,kind,irreducible);ledger.reduction=5;assert.equal(lossTotal(m,'light',ledger),kind==='drain'?irreducible?2:1:irreducible?6:1);}
 const ledger={...lossLedger(6,'effect'),insert:true};ledger.increase=2;ledger.paid=1;assert.equal(lossRemaining(m,'light',ledger),1);ledger.reduction=7;assert.equal(lossRemaining(m,'light',ledger),0);
 for(const bad of [{...ledger,insert:false},{...ledger,insert:'yes'},{...ledger,kind:'battle'}])assert.throws(()=>assertLedger(bad));
});
test('shielded, destroyed and iconless locations never contribute to battleground occupation',()=>{
 const f=fixture({count:0});const generator=location(f.m,'light','3_61'),shield=location(f.m,'light','3_63'),outer=location(f.m,'dark','3_144');assert.equal(battleground(f.m,shield),false);f.m.locations=f.m.locations.filter(id=>id!==generator);state.moveCard(f.m,generator,'hand');assert.equal(battleground(f.m,shield),true);assert.equal(battleground(f.m,outer),true);f.m.cards[shield].blownAway=true;assert.equal(battleground(f.m,shield),false);assert.equal(battleground(f.m,f.m.locations.find(id=>f.m.cards[id].blueprint==='1_284')),false);
});
for(const side of ['dark','light'])test(side+' real deployment is free, unique, CPU-selected and immune to Alter',()=>{
 const f=fixture({side,zone:'hand'});let m=seek(f.m,x=>ordinary(x)&&x.turn.side===side&&x.turn.phase==='deploy');const copy=pull(m,side,side==='light'?'6_58':'6_147','hand');m=priority(m,side);const before=m.players[side].force.length;assert.equal(chooseComputerAction(runtime.project(m,rules,side),side),'resistance:deploy:'+f.card);m=step(m,'resistance:deploy:'+f.card);assert.equal(m.cards[f.card].zone,'playing');const saved=structuredClone(m);assert.deepEqual(runtime.project(saved,rules,side),runtime.project(m,rules,side));m=finish(m);assert.equal(m.cards[f.card].zone,'table');assert.equal(m.players[side].force.length,before);m=priority(m,side);assert.ok(!prompt(m).choices.some(c=>c.id==='resistance:deploy:'+copy));
});

const setup=await import('./resistance-setup-fixture.mjs');
for(const first of ['dark','light'])for(const stop of [true,false])for(const reverse of [true,false])test(`two actual starting Effects: ${first}, stop=${stop}, reverse=${reverse}`,()=>{
 let m=setup.ready({first}),selections=0;for(let n=0;n<150&&m.status==='setup';n++){
  const p=setup.prompt(m),d=m.stack.at(-1);let c=p.choices.find(c=>c.id==='pass')??p.choices[0];
  if(d?.handler==='prep-start:choose'){
   if(stop&&d.payload.count)c=p.choices.find(c=>c.id==='prep-start:done');
   else {const offered=p.choices.filter(c=>c.id.startsWith('prep-start:deploy:'));c=reverse?offered.at(-1):offered[0];selections++;}
  }
  m=setup.step(structuredClone(m),c.id,p.side);
 }
 assert.equal(m.status,'playing');assert.equal(selections,stop?2:4);for(const side of ['dark','light']){const effects=Object.values(m.cards).filter(c=>c.owner===side&&c.zone==='table'&&['4_21','4_134','6_58','6_147'].includes(c.blueprint));assert.equal(effects.length,stop?1:2);assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].reserve.length,stop?49:48);}
});
test('actual revealed Anger loss is classified as insert and capped by Resistance',()=>{
 const f=fixture({side:'dark',count:3});let m=f.m;const card=pull(m,'light','4_16','hand');state.insertCard(m,card,'dark',()=>0);
 const inserts=load(new URL('../../lib/native-engine/reserve-inserts.ts',import.meta.url));inserts.insertsIn(m,'dark')[0].position=1;runtime.activateForce(m,'dark',f.troops[0],1);runtime.openWindow(m,'response','light');m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(m.stack.at(-1).payload.ledger.insert,true);assert.equal(m.stack.at(-1).payload.remaining,2);assert.equal(m.cards[card].zone,'lost');const before=m.players.dark.lost.length;m=finish(m);assert.equal(m.players.dark.lost.length-before,2);
});
test('Force loss view reports current cap and preserves total paid after refresh',()=>{
 const f=fixture();let m=payment(loss(f)),v=runtime.project(m,rules,'light').rules.forceLoss;assert.deepEqual(v,{side:'light',kind:'drain',remaining:2,paid:0,base:4,limit:2});m=step(m,'lose:reserve');v=runtime.project(structuredClone(m),rules,'dark').rules.forceLoss;assert.equal(v.remaining,1);assert.equal(v.paid,1);state.moveCard(m,f.card,'hand');v=runtime.project(m,rules,'light').rules.forceLoss;assert.equal(v.limit,null);assert.equal(v.remaining,3);
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/resistance-results.json',import.meta.url)));
for(const row of reference.filter(r=>r.kind!=='deployment'))test('actual GEMP loss '+JSON.stringify(row),()=>{
 const f=fixture({side:row.side,count:row.count,opponent:row.opponent,zone:row.mode==='arrive'?'hand':'table'});if(row.mode==='suppressed')suppressGameText(f.m,f.sites[0],f.card);const before=f.m.players[row.side].lost.length;let m=loss(f,row.kind==='insert'?{kind:'effect',insert:true}:{});
 if(['depart','arrive'].includes(row.mode)){m=payment(m);m=step(m,'lose:reserve');state.moveCard(m,f.card,row.mode==='depart'?'hand':'table');}m=finish(m);assert.equal(m.players[row.side].lost.length-before,row.lost);
});
const startingReference=JSON.parse(fs.readFileSync(new URL('./gemp/resistance-starting-results.json',import.meta.url)));
for(const row of startingReference)test('actual GEMP two-Effect setup '+JSON.stringify([row.first,row.stop,row.reverse]),()=>{
 const selected={light:[],dark:[]};for(const t of row.trace.filter(t=>t.text.toLowerCase().includes('deploy from reserve'))){const bp=t.answer?t.parameters.blueprintId[t.parameters.cardId.indexOf(t.answer)]:null;assert.ok(!t.answer||bp);selected[t.side].push(bp);}const indices={light:0,dark:0};
 let m=setup.ready({first:row.first});for(let n=0;n<150&&m.status==='setup';n++){const p=setup.prompt(m),d=m.stack.at(-1);let c=p.choices.find(c=>c.id==='pass')??p.choices[0];if(d?.handler==='prep-start:choose'){const bp=selected[p.side][indices[p.side]++];assert.notEqual(bp,undefined);c=bp?p.choices.find(c=>c.id.startsWith('prep-start:deploy:')&&m.cards[c.id.slice('prep-start:deploy:'.length)].blueprint===bp):p.choices.find(c=>c.id==='prep-start:done');assert.ok(c);}m=setup.step(m,c.id,p.side);}
 for(const side of ['light','dark'])assert.equal(indices[side],selected[side].length);

 assert.equal(m.status,'playing');assert.deepEqual(m.data.preparationStarts.map(id=>m.cards[id].owner),row.lostOrder);assert.deepEqual(Object.values(m.cards).filter(c=>c.zone==='table'&&['4_21','4_134','6_58','6_147'].includes(c.blueprint)).map(c=>c.blueprint).sort(),row.table);
 for(const side of ['light','dark'])assert.deepEqual({reserve:m.players[side].reserve.length,hand:m.players[side].hand.length,lost:m.players[side].lost.map(id=>m.cards[id].blueprint)},row.piles[side]);
});
test('Resistance receipt binds both executed GEMP harnesses and unchanged production code',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/resistance-provenance.json',import.meta.url)));for(const [f,sha] of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+f,import.meta.url))).digest('hex'),sha);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(p.lossAndDeploymentBranches,reference.length);assert.equal(p.setupBranches,startingReference.length);
});
const {seeded}=await import('./match-runner.mjs');
for(const size of [40,60])test('CPU completes '+size+' cards from actual two-Effect starting setup through victory',t=>{
 let m=setup.runtime.createMatch('resistance-full-'+size,size,setup.decks({size}),setup.rules),opened=false;const entropy=seeded(8);
 for(let n=0;n<16000&&m.status!=='finished';n++){let side='dark',v=setup.runtime.project(m,setup.rules,side);if(!v.prompt?.choices.length){side='light';v=setup.runtime.project(m,setup.rules,side);}const choice=chooseComputerAction(v,side);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');m=setup.runtime.applyCommand(structuredClone(m),setup.rules,side,{revision:m.revision,choice},entropy);if(!opened&&m.status==='playing'){opened=true;for(const s of ['dark','light']){assert.equal(m.cards[s+'-3'].zone,'table');assert.equal(m.cards[s+'-5'].zone,'table');assert.equal(m.players[s].hand.length,8);}}}
 assert.ok(opened);assert.equal(m.result?.reason,'life-force');t.diagnostic('Completed turn '+m.turn.number+'; '+m.revision+' commands');
});
for(const side of ['light','dark'])test(side+' Alter has a legal comparison target but cannot select the new Effect',()=>{
 const f=fixture({side}),opponent=side==='light'?'dark':'light',alter=pull(f.m,opponent,opponent==='light'?'1_71':'1_234','hand'),other=pull(f.m,side,side==='light'?'102_1':'102_6','table');for(let n=0;n<3;n++)state.moveCard(f.m,f.m.players[opponent].reserve.at(-1),'force');let m=priority(f.m,opponent);const ids=prompt(m).choices.map(c=>c.id);assert.ok(ids.some(id=>id.startsWith('cancel:play:'+alter+':'+other+':')));assert.ok(!ids.some(id=>id.startsWith('cancel:play:'+alter+':'+f.card+':')));
});
