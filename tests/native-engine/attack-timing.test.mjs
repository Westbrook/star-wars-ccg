import {start} from './attack-timing-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './space-slug-fixture.mjs';
import {load,deploy,pull,seek,priority,step,ids,rules,state,clone} from './vessels-fixture.mjs';
const attack=load(new URL('../../lib/native-engine/creature-attack.ts',import.meta.url));
const slug=load(new URL('../../lib/native-engine/space-slug.ts',import.meta.url));
const loss=load(new URL('../../lib/native-engine/table.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const top=m=>m.stack.at(-1),event=m=>top(m)?.event?.kind;

test('Target selection and attack initiation have distinct ordered, recoverable response windows',()=>{
 let {m}=start();assert.equal(event(m),'attack-target-selected');assert.equal(top(m).priority,'light');
 m=step(step(clone(m),'pass'),'pass');assert.equal(event(m),'attack-initiated');assert.equal(top(m).priority,'dark');
 m=step(step(clone(m),'pass'),'pass');assert.equal(event(m),'attack-weapons');assert.equal(top(m).priority,'light');rules.validate(m);
});

for(const boundary of ['attack-target-selected','attack-initiated','attack-weapons','about-to-draw-destiny','destiny-drawn','destiny-draw-complete','destiny-total'])test('Departure ends the attack and cleans only its destiny at '+boundary,()=>{
 const f=start();let m=seek(f.m,x=>event(x)===boundary);const reserve=[...m.players.light.reserve],used=[...m.players.light.used],drawn=[...m.players.light.destiny];
 loss.loseFromTable(m,[f.ywing]);m=step(clone(m),'pass');
 assert.equal(attack.creatureAttack(m).stage,'complete');assert.equal(attack.creatureAttack(m).outcome,'ended');assert.equal(event(m),'attack-ended');assert.equal(top(m).event.premature,true);
 assert.deepEqual(m.players.light.reserve,reserve);assert.deepEqual(m.players.light.destiny,[]);assert.deepEqual(m.players.light.used,[...drawn,...used]);assert.equal(m.data.battle,undefined);
 // Finishing the result cannot open another destiny or repeat the end event.
 m=step(step(clone(m),'pass'),'pass');assert.equal(m.stack.length,1);assert.equal(m.turn.phase,'battle');rules.validate(m);
});

test('A nested Interrupt is disposed normally before the enclosing attack retires',()=>{
 const f=start();let m=seek(f.m,x=>event(x)==='attack-weapons');const maneuver=pull(m,'light','1_70','hand');m=step(m,'maneuver:'+maneuver+':'+f.ywing);
 assert.equal(m.cards[maneuver].zone,'playing');loss.loseFromTable(m,[f.ywing]);assert.equal(attack.scheduleAttackEnd(m),false);rules.validate(clone(m));
 m=step(m,'pass');assert.equal(m.cards[maneuver].zone,'playing');m=step(m,'pass');assert.equal(m.cards[maneuver].zone,'used');assert.equal(attack.creatureAttack(m).stage,'complete');assert.equal(event(m),'attack-ended');rules.validate(m);
});

test('Crew Lost ordering completes before attack-destiny choice is retired',()=>{
 const f=start({pilot:true});let m=seek(f.m,x=>top(x)?.handler==='creature:destiny');loss.loseFromTable(m,[f.ywing]);assert.equal(top(m).handler,'table:lost-order');assert.equal(attack.scheduleAttackEnd(m),false);
 m=seek(m,x=>event(x)==='attack-ended');assert.equal(m.cards[f.lightPilot].zone,'lost');assert.equal(m.cards[f.ywing].zone,'lost');assert.equal(attack.creatureAttack(m).stage,'complete');assert.ok(!m.stack.some(f=>f.kind==='decision'&&f.handler==='creature:destiny'));
});

test('Cave reversion emits one durable change after slug loss, preserving surrounding phase',()=>{
 const f=fixture();let m=f.m;const before=m.data.caveForms[0];assert.equal(before.belly,true);loss.loseFromTable(m,[f.slug]);m=step(m,'pass');
 assert.equal(event(m),'cave-form-changed');assert.equal(top(m).event.belly,false);const serial=top(m).serial;assert.equal(m.data.caveForms[0].serial,serial);assert.equal(slug.bellySlug(m,f.cave),undefined);
 m=step(clone(m),'pass');assert.equal(top(m).serial,serial);m=step(m,'pass');assert.equal(m.stack.length,1);assert.equal(m.data.caveForms[0].serial,serial);rules.validate(m);
 for(const change of [x=>x.data.caveForms[0].belly='false',x=>x.data.caveForms[0].serial=x.serial+1,x=>x.data.caveForms[0].cave.zone='hand']){const bad=clone(m);change(bad);assert.throws(()=>rules.validate(bad));}
});

test('A ship returning during the nested action cannot revive the interrupted attack',()=>{
 const f=start();let m=seek(f.m,x=>event(x)==='attack-weapons');const maneuver=pull(m,'light','1_70','hand');m=step(m,'maneuver:'+maneuver+':'+f.ywing);
 const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));board.moveWithAttachments(m,f.ywing,f.cave);m=step(m,'pass');assert.equal(attack.creatureAttack(m).interrupted,true);assert.equal(m.cards[maneuver].zone,'playing');
 board.moveWithAttachments(m,f.ywing,f.big);m=step(clone(m),'pass');assert.equal(event(m),'attack-ended');assert.equal(attack.creatureAttack(m).outcome,'ended');assert.equal(m.cards[f.ywing].zone,'table');assert.equal(m.cards[maneuver].zone,'used');
});

test('Cave change response binds its historical form across later nested changes',()=>{
 const f=fixture();let m=f.m;loss.loseFromTable(m,[f.slug]);m=step(m,'pass');const bad=clone(m);bad.stack.at(-1).event.belly=true;assert.throws(()=>rules.validate(bad),/cave change response/);
 const forged=clone(m);forged.data.caveChanges.at(-1).serial--;assert.throws(()=>rules.validate(forged),/cave/);
});

test('Paid nested inspection retains payment, acknowledgment and disposal before attack end',()=>{
 const f=start({dark:['1_266']});let m=seek(f.m,x=>event(x)==='attack-weapons');m=priority(m,'dark');const scan=pull(m,'dark','1_266','hand'),force=m.players.dark.force.length;m=step(m,'scan:play:'+scan);
 assert.equal(m.cards[scan].zone,'playing');assert.equal(m.players.dark.force.length,force-1);loss.loseFromTable(m,[f.ywing]);assert.equal(attack.scheduleAttackEnd(m),false);
 m=seek(m,x=>top(x)?.handler==='scan:peek');assert.equal(m.cards[scan].zone,'playing');assert.equal(attack.creatureAttack(m).interrupted,true);m=step(clone(m),'scan:continue');m=seek(m,x=>event(x)==='attack-ended');assert.equal(m.cards[scan].zone,'used');assert.equal(m.players.dark.force.length,force-1);rules.validate(m);
});

const fs=await import('node:fs');
const observations=JSON.parse(fs.readFileSync(new URL('./gemp/attack-timing-results.json',import.meta.url)));
for(const expected of observations)test('Executed GEMP timing observation: '+expected.mode,()=>{
 let actual;
 if(expected.mode==='events'){
  let {m}=fixture({settleSlug:false});const deployment=[],attackOrder=[];
  for(let n=0;n<100&&m.stack.length>1;n++){const e=event(m),kind=e==='cave-form-changed'?'cave':e==='deployed'?'deployed':null;if(kind&&!deployment.includes(kind))deployment.push(kind);m=step(m,'pass');}
  ({m}=start());for(let n=0;n<30;n++){const e=event(m),kind=e==='attack-target-selected'?'target':e==='attack-initiated'?'initiated':e==='attack-weapons'?'weapons':null;if(kind&&!attackOrder.includes(kind))attackOrder.push(kind);if(kind==='weapons')break;m=step(m,'pass');}
  actual={mode:'events',deployment,attack:attackOrder};
 }else{
  const boundary={target:'attack-target-selected',initiated:'attack-initiated',weapons:'attack-weapons','before-draw':'about-to-draw-destiny',drawn:'destiny-drawn','draw-complete':'destiny-draw-complete',total:'destiny-total'}[expected.mode];
  const f=start();let m=f.m;const used=m.players.light.used.length,reserve=m.players.light.reserve.length;m=seek(m,x=>event(x)===boundary);loss.returnToHand(m,[f.ywing]);m=step(m,'pass');m=seek(m,x=>x.stack.length===1);actual={mode:expected.mode,ended:attack.creatureAttack(m).stage==='complete',draws:reserve-m.players.light.reserve.length,used:m.players.light.used.length-used,shipHand:m.cards[f.ywing].zone==='hand',error:null};
 }
 if(expected.mode==='target'){
  assert.match(expected.error,/NullPointerException:.*getPermanentCardId/);assert.equal(expected.ended,false);assert.deepEqual(actual,{mode:'target',ended:true,draws:0,used:0,shipHand:true,error:null});
 }else if(['before-draw','drawn','draw-complete'].includes(expected.mode)){
  assert.deepEqual(expected,{mode:expected.mode,ended:true,draws:2,used:2,shipHand:true,error:null});const count=expected.mode==='before-draw'?0:1;assert.deepEqual(actual,{mode:expected.mode,ended:true,draws:count,used:count,shipHand:true,error:null});
 }else assert.deepEqual(actual,expected);
});

test('Cave current forms cannot lose their history binding, but JSON key order is irrelevant',()=>{
 const f=fixture(),m=clone(f.m),form=m.data.caveForms[0];m.data.caveForms[0]={serial:form.serial,belly:form.belly,cave:{zone:form.cave.zone,version:form.cave.version,id:form.cave.id}};rules.validate(m);
 m.data.caveForms=[];assert.throws(()=>rules.validate(m),/cave forms/);
});

test('Early termination preserves the phase-end continuation of a mandatory hunt',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');m=seek(m,x=>event(x)==='phase-end'&&ids(x).some(id=>id.startsWith('creature:begin:')));m=step(m,ids(m).find(id=>id.startsWith('creature:begin:')));
 loss.returnToHand(m,[f.ywing]);m=step(m,'pass');assert.equal(event(m),'attack-ended');m=step(step(m,'pass'),'pass');m=seek(m,x=>x.turn.phase==='move'&&x.stack.length===1);assert.equal(attack.creatureAttack(m).stage,'complete');assert.equal(m.cards[f.ywing].zone,'hand');rules.validate(m);
});

test('An assault continues while another attacking ship remains',()=>{
 const f=fixture();let m=deploy(f.m,f.ywing,f.big);const corvette=pull(m,'light','1_140','hand');m=deploy(m,corvette,f.big);m=priority(seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1),'light');m=step(m,ids(m).find(id=>id.includes(':assault:')));m=seek(m,x=>event(x)==='attack-weapons');loss.returnToHand(m,[f.ywing]);assert.equal(attack.scheduleAttackEnd(m),false);m=seek(m,x=>attack.creatureAttack(x).stage==='complete');assert.equal(attack.creatureAttack(m).interrupted,undefined);assert.ok(attack.creatureAttack(m).totals);assert.equal(m.cards[corvette].zone,'table');rules.validate(m);
});
