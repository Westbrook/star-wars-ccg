import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,board,battle,rules,clone,pull,ids,step,seek,boundary,priority,fixture,pending,offer,destination,finished} from './prisoner-fixture.mjs';
for(const mode of ['escort','escape','prison'])test('We Have A Prisoner forfeiture, restoration and '+mode,()=>{
 const f=fixture(mode==='prison'),normalForfeit=board.forfeit(f.m,f.target),normalPower=board.power(f.m,f.target);battle.battle(f.m).hits.push(f.target);mod('forfeit').resetWeaponForfeit(f.m,f.gun,f.target,2);
 mod('combat-modifiers').addCombatModifier(f.m,f.escort,f.target,'power-add',-2);
 const credit=board.forfeit(f.m,f.target),before=clone(battle.battle(f.m)),force=f.m.players.dark.force.length;
 let m=pending(f);assert.equal(battle.battle(m).damage.light,Math.max(0,before.damage.light-credit));assert.equal(battle.battle(m).attrition.light,Math.max(0,before.attrition.light-credit));
 m=step(m,offer(m,f));m=destination(m);assert.equal(m.players.dark.force.length,force-1);assert.equal(board.forfeit(m,f.target),normalForfeit);assert.equal(board.power(m,f.target),normalPower);assert.ok(!battle.battle(m).hits.includes(f.target));
 assert.equal(m.cards[f.gun].zone,'table');assert.equal(m.cards[f.device].zone,'table');
 m=step(m,'prisoner:'+mode+(mode==='escort'?':'+f.escort:mode==='prison'?':'+f.site:''));m=finished(m);
 assert.equal(m.cards[f.target].zone,mode==='escape'?'used':'captive');assert.equal(m.cards[f.gun].zone,mode==='escape'?'lost':'inactive');assert.equal(m.cards[f.device].zone,mode==='escape'?'lost':'inactive');assert.equal(m.cards[f.card].zone,'lost');
 assert.equal(battle.battle(m).damage.light,Math.max(0,before.damage.light-credit));
});
test('declining We Have A Prisoner preserves the original forfeiture',()=>{const f=fixture();let m=pending(f);m=boundary(step(m,'pass'),'forfeited');assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[f.card].zone,'hand');});
test('actual Sense cancels capture after the 1 Force cost and original forfeiture resumes',()=>{
 const f=fixture();const sense=pull(f.m,'light','1_109','hand');let m=pending(f),force=m.players.dark.force.length;m=step(m,offer(m,f));m=seek(m,x=>ids(x).some(id=>id.startsWith('cancel:')&&id.includes(sense)));
 m=step(m,ids(m).find(id=>id.startsWith('cancel:')&&id.includes(sense)));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='forfeited');assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.players.dark.force.length,force-1);
});
test('release and rally during capture responses cannot revive the replaced forfeiture',()=>{
 const f=fixture();let m=destination(step(pending(f),offer(pending(f),f)));m=step(m,'prisoner:escort:'+f.escort);
 mod('captives').releaseCaptive(m,f.target);m=step(clone(m),'captives:rally');m=finished(m);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.gun].zone,'table');assert.ok(!ids(m).some(id=>id.startsWith('prisoner:')));
 // A later independent forfeiture is still legal and actually loses the card.
 m=priority(boundary(m,'battle-damage'),'light');battle.battle(m).hits.push(f.target);assert.ok(ids(m).includes('forfeit:'+f.target));m=boundary(step(m,'forfeit:'+f.target),'forfeited');assert.equal(m.cards[f.target].zone,'lost');
});
test('capture unavailable outside battle, for Dark characters, or without Force',()=>{
 const f=fixture();let m=pending(f),w=m.stack.at(-1);assert.ok(mod('prisoner').prisonerActions(m,w,'dark').length);
 const noBattle=clone(m);delete noBattle.data.battle;assert.deepEqual(mod('prisoner').prisonerActions(noBattle,w,'dark'),[]);
 const own=clone(m);own.stack.at(-1).event.cardRefs=[mod('identity').referenceCard(own,f.escort)];assert.deepEqual(mod('prisoner').prisonerActions(own,own.stack.at(-1),'dark'),[]);
 for(const id of [...m.players.dark.force])state.moveCard(m,id,'used');assert.ok(!ids(m).some(id=>id.startsWith('prisoner:')));
});
test('invalid saved loss replacement references are rejected',()=>{
 const f=fixture();const m=destination(step(pending(f),offer(pending(f),f)));
 for(const change of [x=>x.window++,x=>x.target.id=f.second,x=>x.target.zone='hand',x=>x.target.version=999]){const bad=clone(m);const r=bad.stack.find(f=>f.preventedLosses);change(r.preventedLosses[0]);assert.throws(()=>runtime.project(bad,rules,'dark'));}
 const bad=clone(m);const r=bad.stack.find(f=>f.preventedLosses);r.preventedLosses.push(clone(r.preventedLosses[0]));assert.throws(()=>runtime.project(bad,rules,'light'));
});
test('restoration preserves continuous attachment modifiers and physical instance',()=>{
 const f=fixture(),normalPower=board.power(f.m,f.target),version=mod('identity').cardVersion(f.m,f.target);mod('combat-modifiers').addCombatModifier(f.m,f.device,f.target,'power-add',2,{duration:'source'});mod('combat-modifiers').addCombatModifier(f.m,f.escort,f.target,'power-add',-1);
 let m=destination(step(pending(f),offer(pending(f),f)));assert.equal(board.power(m,f.target),normalPower+2);assert.equal(mod('identity').cardVersion(m,f.target),version);
});
test('replaced ordinary equipment loss does not lose a rallied character again',()=>{
 const f=fixture();let m=f.m;const cards=mod('table').tableLossCards(m,[f.target]);
 m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:{id:'fixture-loss',handler:'equipment:lose',label:'Weapon loss',payload:{cards:[f.target]}}});runtime.openWindow(m,'response','dark',{kind:'about-to-lose',card:f.target,cards,cardRefs:cards.map(id=>mod('identity').referenceCard(m,id))});
 m=destination(step(m,offer(m,f)));m=step(m,'prisoner:escort:'+f.escort);mod('captives').releaseCaptive(m,f.target);m=step(m,'captives:rally');m=seek(m,x=>!x.stack.some(q=>q.kind==='resolution'&&q.action.id==='fixture-loss'));assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.gun].zone,'table');
});

test('Disarmed persists through restoration, captivity and release without corrupting saves',()=>{
 const f=fixture();mod('disarmed-state').setDisarmed(f.m,f.target,true);
 let m=destination(step(pending(f),offer(pending(f),f)));assert.equal(mod('disarmed-state').isDisarmed(m,f.target),true);
 m=step(m,'prisoner:escort:'+f.escort);rules.validate(m);assert.equal(mod('disarmed-state').isDisarmed(m,f.target),false);
 mod('captives').releaseCaptive(m,f.target);m=step(clone(m),'captives:rally');m=finished(m);assert.equal(mod('disarmed-state').isDisarmed(m,f.target),true);
});

test('one prevented card does not protect another casualty or a subsequent action',()=>{
 const f=fixture(),ref=mod('identity').referenceCard(f.m,f.target),r={kind:'resolution',actor:'dark',cancelled:false,action:{id:'loss',handler:'test',payload:null},preventedLosses:[{window:1,target:ref}]};
 let lost;mod('loss-prevention').resolveWithLossPrevention(f.m,r,()=>{lost=mod('table').loseFromTable(f.m,[f.target,f.second]);});
 assert.deepEqual(lost,[f.second]);assert.equal(f.m.cards[f.target].zone,'table');assert.equal(f.m.cards[f.gun].zone,'table');
 assert.throws(()=>mod('loss-prevention').resolveWithLossPrevention(f.m,r,()=>{throw Error('handler failure');}));
 assert.equal(mod('loss-prevention').lossPrevented(f.m,f.target),false);
 lost=mod('table').loseFromTable(f.m,[f.target]);assert.ok(lost.includes(f.target));assert.ok(lost.includes(f.gun));
});
test('an explicit dependent-only loss window cannot accidentally target its host',()=>{
 const f=fixture();const a={kind:'resolution',actor:'dark',cancelled:false,action:{id:'fixture',handler:'equipment:lose',payload:{cards:[f.gun]}}};f.m.stack.push(a);runtime.openWindow(f.m,'response','dark',{kind:'about-to-lose',card:f.target,cards:[f.gun]});
 assert.deepEqual(mod('loss-prevention').lossTargets(f.m.stack.at(-1)).map(r=>r.id),[f.gun]);assert.equal(mod('prisoner').prisonerActions(f.m,f.m.stack.at(-1),'dark').length,0);
});
test('target departing and reentering during responses cannot be captured as its earlier instance',()=>{
 const f=fixture();let m=step(pending(f),offer(pending(f),f));
 mod('table').returnToHand(m,[f.target]);state.moveCard(m,f.target,'table');m.cards[f.target].location=f.site;
 m=finished(m);assert.equal(m.cards[f.target].zone,'table');assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.target].captivity,undefined);
});

const observed=JSON.parse(fs.readFileSync(new URL('./gemp/prisoner-results.json',import.meta.url)));
for(const row of observed)test('matches pinned GEMP We Have A Prisoner outcome: '+row.name,()=>{
 const f=fixture(row.name==='imprisonment',row.name==='loss'?'battle-weapons':'battle-damage');battle.battle(f.m).hits.push(f.target);
 mod('stat-modifiers').addStatModifier(f.m,f.site,f.target,'forfeit','reset',2);mod('combat-modifiers').addCombatModifier(f.m,f.site,f.target,'power-add',-2);
 const damage=battle.battle(f.m).damage.light,force=f.m.players.dark.force.length;
 let m=f.m;
 if(row.name==='loss'){
  const cards=mod('table').tableLossCards(m,[f.target]);m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:{id:'reference-loss',handler:'equipment:lose',label:'Controlled battle loss',payload:{cards:[f.target]}}});runtime.openWindow(m,'response','dark',{kind:'about-to-lose',cards,card:f.target});
 }else m=pending(f);
 let sense;if(row.name==='cancel')sense=pull(m,'light','1_109','hand');
 m=step(m,offer(m,f));
 if(row.name==='cancel'){
  m=seek(m,x=>ids(x).some(id=>id.startsWith('cancel:')&&id.includes(sense)));m=step(m,ids(m).find(id=>id.startsWith('cancel:')&&id.includes(sense)));m=boundary(m,'forfeited');
  assert.deepEqual({name:'cancel',paid:damage-battle.battle(m).damage.light,cost:force-m.players.dark.force.length,lost:m.cards[f.target].zone==='lost',interruptLost:m.cards[f.card].zone==='lost',weaponLost:m.cards[f.gun].zone==='lost',deviceLost:m.cards[f.device].zone==='lost'},row);return;
 }
 m=destination(m);const restoredForfeit=board.forfeit(m,f.target),restoredPower=board.power(m,f.target),mode=row.name==='imprisonment'?'prison':row.name==='escape'?'escape':'escort';
 m=step(m,'prisoner:'+mode+(mode==='prison'?':'+f.site:mode==='escort'?':'+f.escort:''));m=finished(m);
 assert.deepEqual({name:row.name,paid:damage-battle.battle(m).damage.light,cost:force-m.players.dark.force.length,restoredForfeit,restoredPower,hit:battle.battle(m).hits.includes(f.target),captive:m.cards[f.target].zone==='captive',imprisoned:!!m.cards[f.target].captivity?.prison,used:m.cards[f.target].zone==='used',weaponLost:m.cards[f.gun].zone==='lost',deviceLost:m.cards[f.device].zone==='lost',weaponAttached:m.cards[f.gun].attachedTo===f.target,deviceAttached:m.cards[f.device].attachedTo===f.target},row);
});
test('capture reference receipt binds the harness and unchanged result records',()=>{
 const provenance=JSON.parse(fs.readFileSync(new URL('./gemp/prisoner-provenance.json',import.meta.url)));assert.equal(provenance.productionFilesChanged,0);assert.equal(provenance.productionFilesCompared,6820);
 for(const [file,hash] of Object.entries(provenance.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
 assert.equal(provenance.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(observed.length,5);
});

test('computer plays capture from its projection and chooses custody instead of escape',()=>{
 for(const prison of [false,true]){const f=fixture(prison);let m=pending(f),view=runtime.project(m,rules,'dark');const choice=mod('computer').chooseComputerAction(view,'dark');assert.equal(choice,offer(m,f));m=destination(step(m,choice));view=runtime.project(m,rules,'dark');const destinationChoice=mod('computer').chooseComputerAction(view,'dark');assert.ok(destinationChoice.startsWith(prison?'prisoner:prison:':'prisoner:escort:'));assert.equal(destinationChoice,mod('computer').chooseComputerAction(clone(view),'dark'));m=finished(step(m,destinationChoice));assert.equal(m.cards[f.target].zone,'captive');}
});
test('computer avoids taking a prisoner merely to deliver it again and rallies a released ally',()=>{
 const f=fixture(true);let m=destination(step(pending(f),offer(pending(f),f)));m=finished(step(m,'prisoner:prison:'+f.site));mod('captives').releaseCaptive(m,f.target);const view=runtime.project(m,rules,'light');assert.equal(mod('computer').chooseComputerAction(view,'light'),'captives:rally');
 const p=clone(view);p.prompt={...p.prompt,side:'dark',mandatory:false,choices:[{id:'pass',label:'Pass'},{id:'captives:take:'+f.target+':'+f.escort,label:'Take custody'}]};assert.equal(mod('computer').chooseComputerAction(p,'dark'),'pass');
});
