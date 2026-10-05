import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,clone,pull,ids,step,seek,phase} from './prisoner-fixture.mjs';
const ships=mod('captured-ships');
import {fixture} from './captured-ships-fixture.mjs';
const refresh=m=>{state.assertState(m);rules.validate(m);for(const s of ['dark','light'])assert.deepEqual(runtime.project(m,rules,s),runtime.project(clone(m),rules,s));return m;};
const promptAt=(m,handler)=>seek(m,x=>x.stack.at(-1)?.handler===handler);
const offered=(f)=>seek(f.m,m=>ids(m).some(id=>id.startsWith('prisoner:ship-play:')));
const play=(f)=>{const m=offered(f);return step(m,ids(m).find(id=>id.startsWith('prisoner:ship-play:')));};

test('captured ship and trapped crew are inactive, not captives or cargo capacity',()=>{
 const f=fixture();refresh(f.m);assert.equal(f.m.cards[f.ship].zone,'inactive');assert.equal(f.m.cards[f.ship].aboardRole,undefined);assert.deepEqual(mod('captives').captives(f.m),[]);
 assert.ok(f.characters.every(id=>f.m.cards[id].zone==='inactive'));assert.equal(mod('occupancy').operational(f.m,f.ship),false);assert.equal(mod('occupancy').roleAvailable(f.m,f.ship,f.escort,'pilot'),false);
 assert.ok(!mod('occupancy').occupants(f.m,f.host).some(c=>c.id===f.ship));assert.equal(mod('captured-ship-state').trappedCharacters(f.m,f.ship).length,2);
});
for(const reverse of [false,true])test('real Interrupt captures crew in chosen order and steals ship after last capture '+reverse,()=>{
 const f=fixture(),before=f.m.players.dark.force.length;let m=promptAt(play(f),'prisoner:ship-order');assert.equal(m.players.dark.force.length,before-4);
 const order=reverse?[...f.characters].reverse():f.characters;
 for(const [i,id] of order.entries()){
  refresh(m);assert.equal(m.cards[f.ship].owner,'light');m=step(m,'prisoner:ship-character:'+id);m=promptAt(m,'prisoner:ship-destination');
  m=step(m,i===0?'prisoner:escort:'+f.escort:'prisoner:escape');
  if(i===0)m=promptAt(m,'prisoner:ship-order');
 }
 m=promptAt(m,'captured-ship:steal');refresh(m);m=step(m,'captured-ship:launch:'+f.site);
 m=seek(m,x=>x.cards[f.card].zone==='lost');refresh(m);
 assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[f.ship].originalOwner,'light');assert.equal(m.cards[f.ship].zone,'table');assert.equal(m.cards[f.ship].capturedShip,undefined);assert.equal(m.cards[f.ship].attachedTo,undefined);
 assert.equal(m.cards[order[0]].zone,'captive');assert.equal(m.cards[order[1]].zone,'used');
});
test('permanent pilots do not prevent stealing an empty captured ship',()=>{
 const f=fixture(0);let m=step(f.m,'pass');m=promptAt(m,'captured-ship:steal');m=step(m,'captured-ship:launch:'+f.site);refresh(m);assert.equal(m.cards[f.ship].owner,'dark');assert.ok(mod('occupancy').permanentPilot(m,f.ship));
});
for(const method of ['launch','escape'])test('beam loss releases ship; '+method+' preserves cards and refresh',()=>{
 const f=fixture();mod('table').loseFromTable(f.m,[f.beam]);let m=step(f.m,'pass');m=promptAt(m,'captured-ship:release');refresh(m);
 m=step(m,'captured-ship:'+method+(method==='launch'?':'+f.site:''));
 if(method==='escape')m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));
 refresh(m);const group=[f.ship,...f.characters,f.gun];assert.ok(group.every(id=>m.cards[id].zone===(method==='launch'?'table':'used')));assert.ok(group.every(id=>m.cards[id].owner==='light'));
 if(method==='launch'){assert.equal(m.cards[f.characters[0]].aboardRole,'pilot');assert.equal(m.cards[f.gun].attachedTo,f.characters[0]);}
});
test('a second beam holds the captured ship when the first is lost',()=>{
 const f=fixture();const extra=pull(f.m,'dark','1_194');f.m.cards[extra].blueprint='2_115';f.m.cards[extra].attachedTo=f.host;f.m.cards[extra].location=f.site;mod('table').loseFromTable(f.m,[f.beam]);assert.equal(ships.scheduleCapturedShips(f.m),false);refresh(f.m);
});
test('whole carrier loss removes held ship, inactive crew, and weapons together',()=>{
 const f=fixture();const lost=mod('table').loseFromTable(f.m,[f.host]);for(const id of [f.ship,...f.characters,f.gun,f.beam,f.escort,f.host])assert.ok(lost.includes(id));
 let m=seek(f.m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order'));refresh(m);for(const id of lost)assert.equal(m.cards[id].zone,'lost');assert.equal(ships.scheduleCapturedShips(m),false);
});
test('stolen ship goes to new owner Lost/Used/Reserve without changing physical deck conservation',()=>{
 const f=fixture(0);let m=promptAt(step(f.m,'pass'),'captured-ship:steal');m=step(m,'captured-ship:launch:'+f.site);mod('table').loseFromTable(m,[f.ship]);refresh(m);assert.ok(m.players.dark.lost.includes(f.ship));assert.ok(!m.players.light.lost.includes(f.ship));
 for(const zone of ['used','reserve','force','hand']){state.moveCard(m,f.ship,zone);refresh(m);assert.ok(m.players.dark[zone].includes(f.ship));}
});
test('insufficient Force does not offer captured crew Interrupt',()=>{
 const f=fixture();for(const id of [...f.m.players.dark.force].slice(0,-3))state.moveCard(f.m,id,'used');let m=seek(f.m,x=>x.stack.length===1&&x.stack.at(-1).timing==='phase');assert.ok(!ids(m).some(id=>id.startsWith('prisoner:ship-play:')));
});
test('saved custody, crew role and decision tampering is rejected',()=>{
 const f=fixture();for(const change of [m=>m.cards[f.ship].capturedShip.host=f.ship,m=>m.cards[f.characters[0]].zone='table',m=>m.cards[f.characters[0]].aboardRole='driver',m=>m.cards[f.ship].capturedShip.pending='release',m=>m.cards[f.ship].originalOwner='dark']){const bad=clone(f.m);change(bad);assert.throws(()=>runtime.project(bad,rules,'dark'));}
 let m=promptAt(play(f),'prisoner:ship-order');const bad=clone(m);bad.stack.at(-1).payload.remaining.push(bad.stack.at(-1).payload.remaining[0]);assert.throws(()=>runtime.project(bad,rules,'dark'));
});

test('Sense cancels captured-crew mode after paying its full cost',()=>{
 const f=fixture();const sense=pull(f.m,'light','1_109','hand'),force=f.m.players.dark.force.length;let m=play(f);
 // Sense needs an active character. Leia is a passenger on a separate ship.
 const hero=pull(m,'light','1_13','table',f.site),ally=pull(m,'light','1_147','table',f.site);m.cards[hero].attachedTo=ally;m.cards[hero].aboardRole='passenger';
 const top=m.players.light.reserve.find(id=>m.cards[id].blueprint==='1_28');m.players.light.reserve.splice(m.players.light.reserve.indexOf(top),1);m.players.light.reserve.unshift(top);
 m=seek(m,x=>ids(x).some(id=>id.startsWith('cancel:')&&id.includes(sense)));m=step(m,ids(m).find(id=>id.startsWith('cancel:')&&id.includes(sense)));
 m=seek(m,x=>x.cards[f.card].zone==='lost');refresh(m);assert.equal(m.players.dark.force.length,force-4);assert.ok(f.characters.every(id=>m.cards[id].zone==='inactive'));assert.equal(m.cards[f.ship].owner,'light');
});
test('computer selects legal crew capture and launch using only a refreshed private projection',()=>{
 const f=fixture();let m=offered(f);const offerView=runtime.project(m,rules,'dark');offerView.prompt.choices=offerView.prompt.choices.filter(c=>c.id==='pass'||c.id.startsWith('prisoner:ship-play:'));assert.ok(mod('computer').chooseComputerAction(offerView,'dark').startsWith('prisoner:ship-play:'));
 m=promptAt(play(f),'prisoner:ship-order');const view=runtime.project(m,rules,'dark'),c=mod('computer').chooseComputerAction(view,'dark');assert.ok(ids(m).includes(c));assert.equal(c,mod('computer').chooseComputerAction(clone(view),'dark'));
});

// Executed reference outcomes, not hand-authored expected rule summaries.
const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observed=JSON.parse(fs.readFileSync(new URL('./gemp/captured-ship-results.json',import.meta.url)));
for(const row of observed.filter(row=>!row.name.startsWith('tractor-')))test('matches pinned captured-ship outcome: '+row.name,()=>{
 const f=fixture(row.name==='empty'?0:2);let m=f.m,result;
 if(row.name==='crew'){
  const before=m.players.dark.force.length;m=promptAt(play(f),'prisoner:ship-order');
  for(const [i,id]of f.characters.entries()){m=step(m,'prisoner:ship-character:'+id);m=promptAt(m,'prisoner:ship-destination');m=step(m,i?'prisoner:escape':'prisoner:escort:'+f.escort);m=promptAt(m,i?'captured-ship:steal':'prisoner:ship-order');}
  m=step(m,'captured-ship:launch:'+f.site);m=seek(m,x=>x.cards[f.card].zone==='lost');
  result={name:'crew',cost:before-m.players.dark.force.length,pilotCaptive:m.cards[f.characters[0]].zone==='captive',passengerUsed:m.cards[f.characters[1]].zone==='used',gunAttached:m.cards[f.gun].attachedTo===f.characters[0],stolen:m.cards[f.ship].owner==='dark',captured:!!m.cards[f.ship].capturedShip};
 }else if(row.name==='empty'){
  m=promptAt(step(m,'pass'),'captured-ship:steal');m=step(m,'captured-ship:launch:'+f.site);result={name:'empty',captured:!!m.cards[f.ship].capturedShip,stolen:m.cards[f.ship].owner==='dark',detached:!m.cards[f.ship].attachedTo};
 }else{
  mod('table').loseFromTable(m,[f.beam]);m=promptAt(step(m,'pass'),'captured-ship:release');m=step(m,'captured-ship:'+row.name+(row.name==='launch'?':'+f.site:''));m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:used-order'));
  result={name:row.name,shipUsed:m.cards[f.ship].zone==='used',pilotUsed:m.cards[f.characters[0]].zone==='used',passengerUsed:m.cards[f.characters[1]].zone==='used',gunUsed:m.cards[f.gun].zone==='used',gunAttached:m.cards[f.gun].attachedTo===f.characters[0],pilotAttached:m.cards[f.characters[0]].attachedTo===f.ship,captured:!!m.cards[f.ship].capturedShip};
 }
 assert.deepEqual(result,row);
});
test('captured-ship reference receipt binds the unchanged engine and exact outputs',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/captured-ship-provenance.json',import.meta.url)));assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesChanged,0);assert.equal(p.productionFilesCompared,6820);assert.equal(observed.length,6);
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
});
