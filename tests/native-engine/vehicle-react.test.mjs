import {fixture as start} from './vehicle-react-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,prepared,step,ids,seek,settled,deploy,priority,phase,state,rules,clone,load,pull} from './open-vehicles-fixture.mjs';
const module=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const ground=module('ground'),react=module('vehicle-react'),board=module('board'),battle=module('battle');

const begin=f=>step(f.m,'vehicle-react:'+f.host+':'+f.camp);
const atCrew=(m,stage)=>seek(m,x=>x.stack.at(-1)?.handler==='vehicle-react:'+stage);
const finish=m=>{for(let n=0;n<200;n++){if(m.stack.length===1)return m;m=step(m,ids(m).includes('continue-react')?'continue-react':ids(m).includes('pass')?'pass':ids(m)[0]);}throw Error('React not finished');};
for(const bp of ['1_149','1_151'])test(bp+' can react across two sites, carry occupants and cancel the Force drain',()=>{
 const f=start({bp});const before=f.m.players.light.force.length;let m=begin(f);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved'&&x.stack.at(-1).event.site===f.dune);assert.equal(m.cards[f.host].location,f.dune);assert.equal(m.cards[f.rider].location,f.dune);
 m=atCrew(clone(m),'exit');assert.ok(m.stack.some(r=>r.kind==='resolution'&&r.action.handler==='ground:drain'&&r.cancelled));m=finish(m);assert.equal(m.players.light.force.length,before);assert.equal(m.cards[f.host].location,f.camp);assert.equal(ground.usage(m).reacted.includes(f.host),true);assert.equal(ground.usage(m).reacted.includes(f.rider),false);assert.equal(ground.usage(m).moved.includes(f.host),true);assert.equal(ground.usage(m).moved.includes(f.rider),false);
});
test('Boarding Luke does not refund the cost; he may disembark after the same react',()=>{
 const f=start({boarding:true}),before=f.m.players.light.force.length;let m=atCrew(begin(f),'board');assert.equal(before-m.players.light.force.length,1);assert.ok(ids(m).includes('board:'+f.rider+':passenger'));assert.ok(!ids(m).includes('exit:'+f.lightPilot));
 m=step(clone(m),'board:'+f.rider+':passenger');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moved');assert.equal(m.cards[f.rider].attachedTo,f.host);m=atCrew(m,'exit');assert.ok(ids(m).includes('exit:'+f.rider));assert.ok(!ids(m).some(x=>x.startsWith('board:')));m=step(clone(m),'exit:'+f.rider);m=finish(m);assert.equal(before-m.players.light.force.length,1);assert.equal(m.cards[f.rider].attachedTo,undefined);assert.equal(m.cards[f.rider].location,f.camp);assert.ok(ground.usage(m).reacted.includes(f.rider));
});
test('Unpiloted, barred, same-site, canceled text and previously reacted vehicles cannot initiate a react',()=>{
 for(const kind of ['driver','barrier','same-site','text','history']){const f=start(),m=f.m;
 if(kind==='driver')state.moveCard(m,f.lightPilot,'hand');if(kind==='barrier')ground.record(m).barriers[f.host]=m.turn.number;if(kind==='same-site')board.moveWithAttachments(m,f.host,f.camp);if(kind==='text')m.data.canceledGameText=[module('identity').referenceCard(m,f.host)];if(kind==='history')ground.registerReact(m,f.host);
 assert.equal(react.vehicleReactActions(m,m.stack.at(-1),'light').length,0,kind);}
});
test('Prior react participants cannot board or disembark another reacting vehicle',()=>{
 const f=start({boarding:true});ground.registerReact(f.m,f.rider);let m=begin(f);assert.ok(!ids(m).includes('board:'+f.rider+':passenger'));m=atCrew(m,'exit');ground.registerReact(m,f.lightPilot);assert.ok(!ids(m).includes('exit:'+f.lightPilot));m=finish(m);rules.validate(m);
});
test('Losing the driver at an intermediate site stops movement without canceling the remote drain',()=>{
 const f=start();let m=seek(begin(f),x=>x.stack.at(-1)?.event?.kind==='moved');state.moveCard(m,f.lightPilot,'lost');m=finish(m);assert.equal(m.cards[f.host].location,f.dune);assert.equal(m.cards[f.rider].location,f.dune);assert.ok(m.players.light.lost.length>1);
});
test('A reacting vehicle and its crew join the initiated battle',()=>{
 const f=start({battleMode:true});let m=begin(f);for(let n=0;n<200&&m.stack.at(-1)?.event?.kind!=='battle-weapons';n++)m=step(m,ids(m).includes('continue-react')?'continue-react':'pass');assert.equal(m.stack.at(-1)?.event?.kind,'battle-weapons');for(const id of [f.host,f.rider,f.lightPilot])assert.ok(battle.battle(m).participants.light.includes(id));rules.validate(m);
});
test('Saved react routes and participant history are validated',()=>{
 const f=start({boarding:true}),m=atCrew(begin(f),'board');for(const mutate of [p=>p.index=2,p=>p.cost=9,p=>p.participants=[],p=>p.cardRef.version=999,p=>p.path[1]=p.path[0]]){const bad=clone(m);mutate(bad.stack.at(-1).payload);assert.throws(()=>rules.validate(bad),/react|reference/);}
});
for(const success of [true,false])test('Sense '+(success?'cancels':'fails to cancel')+' after boarding, retaining the paid cost and original position',()=>{
 const f=start({boarding:true});state.moveCard(f.m,success?f.zero:f.high,'reserve');const before=f.m.players.light.force.length;let m=atCrew(begin(f),'board');
 m=step(m,'board:'+f.rider+':passenger');m=seek(m,x=>x.stack.at(-2)?.action?.handler==='vehicle-react:move'&&x.stack.at(-1)?.kind==='window');m=priority(m,'dark');assert.equal(m.cards[f.rider].attachedTo,f.host);assert.equal(m.cards[f.host].location,f.site);assert.equal(before-m.players.light.force.length,1);
 m=step(clone(m),'cancel:play:'+f.sense+':'+f.host+':'+f.vader);m=seek(m,x=>x.cards[f.sense].zone==='used');
 if(success){assert.equal(m.cards[f.host].location,f.site);assert.equal(m.cards[f.rider].attachedTo,f.host);assert.ok(ground.usage(m).reacted.includes(f.rider));assert.ok(!ground.usage(m).reacted.includes(f.lightPilot));assert.ok(!ground.usage(m).moved.includes(f.host));}
 m=finish(clone(m));assert.equal(m.cards[f.host].location,success?f.site:f.camp);assert.equal(before-m.players.light.force.length,1);
});
test('Pending embark preserves original character and carrier identities through recovery',()=>{
 const f=start({boarding:true});let m=step(atCrew(begin(f),'board'),'board:'+f.rider+':passenger');assert.equal(m.stack.at(-1).event.kind,'embarking');assert.equal(m.cards[f.rider].attachedTo,undefined);
 state.moveCard(m,f.rider,'hand');state.moveCard(m,f.rider,'table');m.cards[f.rider].location=f.site;m=step(clone(m),'pass');m=step(m,'pass');assert.equal(m.cards[f.rider].attachedTo,undefined);m=finish(m);assert.equal(m.cards[f.rider].location,f.site);
});
test('React history clears on the next turn while crew still retain ordinary movement',()=>{
 const f=start({boarding:true});let m=step(atCrew(begin(f),'board'),'board:'+f.rider+':passenger');m=step(atCrew(m,'exit'),'exit:'+f.rider);m=finish(m);assert.ok(ground.usage(m).reacted.includes(f.rider));m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='move'&&x.stack.length===1);m=priority(m,'light');assert.ok(!ground.usage(m).reacted.includes(f.rider));assert.ok(ids(m).includes('move:'+f.rider+':'+f.farm));
});
test('Dark Ubrikkian reacts to a Light drain, pays once and carries enclosed crew',()=>{
 const f=fixture();f.m.turn.side='dark';f.m.stack[0].priority='dark';let m=deploy(deploy(deploy(f.m,f.enemyVehicle,f.site),f.driver,f.enemyVehicle,'driver'),f.passenger,f.enemyVehicle,'passenger');state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.camp;
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'light');m=step(m,'drain:'+f.camp);m=priority(m,'dark');const before=m.players.dark.force.length;m=step(m,'vehicle-react:'+f.enemyVehicle+':'+f.camp);m=atCrew(m,'exit');assert.ok(m.stack.some(r=>r.kind==='resolution'&&r.action.handler==='ground:drain'&&r.cancelled));m=finish(m);assert.equal(m.players.dark.force.length,before-1);assert.equal(m.cards[f.passenger].location,f.camp);assert.equal(m.cards[f.passenger].attachedTo,f.enemyVehicle);
});
test('React only answers an opponent initiation and cannot use docking transit',()=>{
 const f=start();assert.equal(react.vehicleReactActions(f.m,f.m.stack.at(-1),'dark').length,0);board.moveWithAttachments(f.m,f.host,f.echo);assert.equal(react.vehicleReactActions(f.m,f.m.stack.at(-1),'light').length,0);
});
test('Drain cancellation persists if the entire reacting vehicle leaves in arrival responses',()=>{
 const f=start();let m=seek(begin(f),x=>x.stack.at(-1)?.event?.kind==='moved'&&x.stack.at(-1).event.complete);for(const id of [f.rider,f.lightPilot,f.host])state.moveCard(m,id,'lost');const before=m.players.light.lost.length;m=finish(m);assert.equal(m.players.light.lost.length,before);
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/vehicle-react-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP vehicle reaction comparison: '+expected.mode,()=>{
 const {mode}=expected,boarding=['board','board-exit','cancel','sense-fails'].includes(mode),f=start({boarding,bp:mode==='closed'?'1_151':'1_149'}),before=f.m.players.light.force.length,lostBefore=f.m.players.light.lost.length;
 if(mode==='cancel'||mode==='sense-fails')state.moveCard(f.m,mode==='cancel'?f.zero:f.high,'reserve');
 let m=begin(f);if(boarding)m=step(atCrew(m,'board'),'board:'+f.rider+':passenger');
 if(mode==='cancel'||mode==='sense-fails'){
  m=seek(m,x=>x.stack.at(-2)?.action?.handler==='vehicle-react:move'&&x.stack.at(-1)?.kind==='window');m=priority(m,'dark');m=step(m,'cancel:play:'+f.sense+':'+f.host+':'+f.vader);m=seek(m,x=>x.cards[f.sense].zone==='used');
 }
 if(mode!=='cancel'){m=atCrew(m,'exit');if(mode==='disembark'||mode==='board-exit')m=step(m,'exit:'+f.rider);m=finish(m);}
 const actual={mode,cost:before-m.players.light.force.length,aboard:m.cards[f.rider].attachedTo===f.host,hostMoved:ground.usage(m).moved.includes(f.host),lukeMoved:ground.usage(m).moved.includes(f.rider),arrived:m.cards[f.host].location===f.camp};
 if(mode==='cancel')Object.assign(actual,{hostLocked:ground.usage(m).reacted.includes(f.host),boarderLocked:ground.usage(m).reacted.includes(f.rider),driverLocked:ground.usage(m).reacted.includes(f.lightPilot)});else actual.lostToDrain=m.players.light.lost.length-lostBefore;
 assert.deepEqual(actual,expected);rules.validate(m);
});
test('Several crew may board within capacity, then leave independently at arrival',()=>{
 const f=start({boarding:true});state.moveCard(f.m,f.droid,'table');f.m.cards[f.droid].location=f.site;const extra=Object.values(f.m.cards).find(c=>c.owner==='light'&&c.blueprint==='1_28'&&c.zone==='reserve');assert.ok(extra);state.moveCard(f.m,extra.id,'table');f.m.cards[extra.id].location=f.site;
 let m=step(atCrew(begin(f),'board'),'board:'+f.rider+':passenger');m=step(atCrew(m,'board'),'board:'+f.droid+':passenger');m=atCrew(m,'exit');assert.equal(m.cards[extra.id].location,f.site);assert.equal(m.cards[f.droid].location,f.camp);m=step(m,'exit:'+f.rider);m=step(atCrew(m,'exit'),'exit:'+f.droid);m=finish(m);for(const id of [f.rider,f.droid]){assert.equal(m.cards[id].attachedTo,undefined);assert.ok(ground.usage(m).reacted.includes(id));}
});
