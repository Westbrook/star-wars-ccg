import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deployChoice,parent,step,seek,priority,state,ids,clone,rules,load,pull} from './deploy-react-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const ground=mod('ground'),occupancy=mod('occupancy'),board=mod('board');
const arrival=(m,card)=>seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed'&&x.stack.at(-1).event.card===card);
const reopen=(m,side)=>priority(seek(m,parent),side);
for(const side of ['light','dark'])test(side+' granted vehicle and crew are separate paid reacts; presence cancels the drain',()=>{
 const f=fixture({side}),before=f.m.players[side].force.length;let m=arrival(step(f.m,deployChoice(f)),f.vehicle);assert.equal(occupancy.operational(m,f.vehicle),false);assert.ok(!m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);
 m=reopen(clone(m),side);assert.ok(ids(m).includes(deployChoice(f,f.crew,f.vehicle,'driver')));assert.ok(!ids(m).some(id=>id.startsWith('vessel:embark:')||id.startsWith('pair-deploy:')));
 m=arrival(step(m,deployChoice(f,f.crew,f.vehicle,'driver')),f.crew);assert.equal(occupancy.operational(m,f.vehicle),true);assert.equal(m.cards[f.crew].attachedTo,f.vehicle);assert.ok(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);assert.equal(before-m.players[side].force.length,side==='light'?5:3);assert.ok(ground.usage(m).reacted.includes(f.vehicle)&&ground.usage(m).reacted.includes(f.crew));
 m=reopen(m,side);assert.ok(!ids(m).some(id=>id.includes(':react:')));rules.validate(m);
});
for(const target of ['vehicle','crew'])test('Sense cancels only the '+target+' deployment, preserving earlier arrivals and paid Force',()=>{
 const f=fixture({bp:'1_151'});state.moveCard(f.m,f.zero,'reserve');let m=f.m;if(target==='crew')m=reopen(arrival(step(m,deployChoice(f)),f.vehicle),'light');
 const card=target==='vehicle'?f.vehicle:f.crew,choice=target==='vehicle'?deployChoice(f):deployChoice(f,f.crew,f.vehicle,'driver'),before=m.players.light.force.length;m=step(m,choice);m=seek(m,x=>x.stack.at(-2)?.action?.handler==='vessel:'+(target==='vehicle'?'deploy':'aboard')&&!x.stack.at(-2).awaitingResponses);m=priority(m,'dark');
 m=step(clone(m),'cancel:play:'+f.sense+':'+card+':'+f.enemy);m=seek(m,x=>x.cards[f.sense].zone==='used');assert.equal(m.cards[card].zone,'hand');assert.equal(before-m.players.light.force.length,target==='vehicle'?2:3);assert.ok(ground.usage(m).reacted.includes(card));if(target==='crew')assert.equal(m.cards[f.vehicle].zone,'table');m=reopen(m,'light');assert.ok(!ids(m).includes(choice));
});
for(const change of ['leave','return','move'])test('A begun deployment survives permission-source '+change,()=>{
 const f=fixture();let m=step(f.m,deployChoice(f));if(change==='move')board.moveWithAttachments(m,f.grant,f.echo);else{state.moveCard(m,f.grant,'hand');if(change==='return'){state.moveCard(m,f.grant,'table');m.cards[f.grant].location=f.dune;}}
 m=arrival(clone(m),f.vehicle);assert.equal(m.cards[f.vehicle].location,f.camp);rules.validate(m);
});
test('Canceled source text does not grant new deployment reacts (controlled modifier query)',()=>{
 const f=fixture();f.m.data.canceledGameText=[mod('identity').referenceCard(f.m,f.grant)];assert.ok(!rules.actions(f.m,f.m.stack.at(-1),'light').some(a=>a.payload?.react));
});
test('A moved or returned target vehicle cannot carry a pending crew react to another location',()=>{
 for(const change of ['move','return']){const f=fixture();let m=reopen(arrival(step(f.m,deployChoice(f)),f.vehicle),'light');m=step(m,deployChoice(f,f.crew,f.vehicle,'driver'));
 if(change==='move')board.moveWithAttachments(m,f.vehicle,f.site);else{state.moveCard(m,f.vehicle,'hand');state.moveCard(m,f.vehicle,'table');m.cards[f.vehicle].location=f.camp;}
 m=seek(clone(m),x=>x.cards[f.crew].zone!=='playing');assert.equal(m.cards[f.crew].zone,'lost');assert.equal(m.cards[f.crew].attachedTo,undefined);
 }
});
test('Vehicle and separately deployed driver join a battle before the weapons segment',()=>{
 const f=fixture({battleMode:true});let m=reopen(arrival(step(f.m,deployChoice(f)),f.vehicle),'light');m=arrival(step(m,deployChoice(f,f.crew,f.vehicle,'driver')),f.crew);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');for(const id of [f.vehicle,f.crew])assert.ok(mod('battle').battle(m).participants.light.includes(id));
});
test('Saved permission and destination references reject forged deployment reacts',()=>{
 const f=fixture(),m=step(f.m,deployChoice(f));for(const change of [p=>p.grant.version=999,p=>p.grant.zone='hand',p=>p.reactSite.id=f.crew,p=>p.react=false]){const bad=clone(m),r=bad.stack.find(x=>x.action?.handler==='vessel:deploy');change(r.action.payload);assert.throws(()=>rules.validate(bad),/react|reference/);}
});
test('Canceled non-unique vehicle locks its other copies for this turn',()=>{
 const f=fixture({bp:'1_151'}),copy=pull(f.m,'light','1_151','hand');state.moveCard(f.m,f.zero,'reserve');let m=step(f.m,deployChoice(f));m=seek(m,x=>x.stack.at(-2)?.action?.handler==='vessel:deploy'&&!x.stack.at(-2).awaitingResponses);m=priority(m,'dark');m=step(m,'cancel:play:'+f.sense+':'+f.vehicle+':'+f.enemy);m=seek(m,x=>x.cards[f.sense].zone==='used');m=reopen(m,'light');assert.equal(ground.canDeployAsReact(m,copy),false);assert.ok(!ids(m).includes(deployChoice(f,copy)));
});
test('A full driver seat cannot receive another driver react but allows a passenger while battle continues',()=>{
 const f=fixture({battleMode:true});let m=reopen(arrival(step(f.m,deployChoice(f)),f.vehicle),'light');m=reopen(arrival(step(m,deployChoice(f,f.crew,f.vehicle,'driver')),f.crew),'light');assert.ok(!ids(m).includes(deployChoice(f,f.droid,f.vehicle,'driver')));assert.ok(ids(m).includes(deployChoice(f,f.droid,f.vehicle,'passenger')));
});
test('Printed move-react permission alone does not allow a vehicle to deploy as a react',()=>{
 const f=fixture();state.moveCard(f.m,f.grant,'hand');assert.ok(!ids(f.m).includes(deployChoice(f)));assert.ok(!ids(f.m).some(id=>id.startsWith('vessel:deploy:')));
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/deploy-react-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP deployment react comparison: '+expected.mode,()=>{
 const {mode}=expected,side=mode==='comlink'?'dark':'light',f=fixture({side,bp:mode==='cancel-vehicle'?'1_151':'1_149'}),before=f.m.players[side].force.length;if(mode!=='comlink')state.moveCard(f.m,f.zero,'reserve');
 function play(m,card,target,role,cancel){m=step(m,deployChoice(f,card,target,role));
  if(mode.startsWith('source-')){state.moveCard(m,f.grant,'hand');if(mode==='source-return'){state.moveCard(m,f.grant,'table');m.cards[f.grant].location=f.dune;}}
  if(cancel){m=seek(m,x=>x.stack.at(-2)?.action?.handler===(role?'vessel:aboard':'vessel:deploy')&&!x.stack.at(-2).awaitingResponses);m=priority(m,'dark');m=step(m,'cancel:play:'+f.sense+':'+card+':'+f.enemy);return seek(m,x=>x.cards[f.sense].zone==='used');}return arrival(m,card);
 }
 let m=play(f.m,f.vehicle,f.camp,undefined,mode==='cancel-vehicle');const drainStoppedAfterVehicle=m.stack.find(x=>x.action?.handler==='ground:drain').cancelled;
 if(mode==='crew'||mode==='cancel-crew'||mode==='comlink')m=play(reopen(m,side),f.crew,f.vehicle,'driver',mode==='cancel-crew');
 assert.deepEqual({mode,cost:before-m.players[side].force.length,vehicleAtSite:m.cards[f.vehicle].zone==='table'&&m.cards[f.vehicle].location===f.camp,vehicleInHand:m.cards[f.vehicle].zone==='hand',crewAboard:m.cards[f.crew].attachedTo===f.vehicle,crewInHand:m.cards[f.crew].zone==='hand',drainStoppedAfterVehicle,drainStopped:m.stack.find(x=>x.action?.handler==='ground:drain').cancelled},expected);rules.validate(m);
});
test('Barrier can exclude a newly deployed reacting driver without removing its seat',()=>{
 const f=fixture({battleMode:true}),barrier=pull(f.m,'dark','1_249','hand');let m=reopen(arrival(step(f.m,deployChoice(f)),f.vehicle),'light');m=arrival(step(m,deployChoice(f,f.crew,f.vehicle,'driver')),f.crew);m=priority(m,'dark');assert.ok(ids(m).includes('barrier:'+barrier+':'+f.crew));m=step(m,'barrier:'+barrier+':'+f.crew);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.ok(!mod('participation').battleMembers(m,'light').includes(f.crew));assert.equal(m.cards[f.crew].attachedTo,f.vehicle);assert.equal(occupancy.operational(m,f.vehicle),false);
});
