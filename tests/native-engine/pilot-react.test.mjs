import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,choice,parent,step,seek,priority,state,ids,clone,rules,load,pull} from './pilot-react-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const ground=mod('ground');
const arrival=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed'&&x.stack.at(-1).event.simultaneous);
const respond=m=>priority(seek(m,x=>x.stack.at(-2)?.action?.handler==='pair:deploy'&&!x.stack.at(-2).awaitingResponses),'dark');
test('Required pilot deploys with the reacting ship, pays both costs and cancels the drain on shared arrival',()=>{
 const f=fixture(),before=f.m.players.light.force.length;assert.ok(ids(f.m).includes(choice(f)));let m=step(f.m,choice(f));assert.equal(before-m.players.light.force.length,5);for(const id of [f.ship,f.pilot]){assert.equal(m.cards[id].zone,'playing');assert.ok(ground.usage(m).reacted.includes(id));}
 m=arrival(clone(m));assert.equal(m.cards[f.pilot].attachedTo,f.ship);assert.equal(m.cards[f.pilot].aboardRole,'pilot');assert.ok(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);assert.deepEqual(m.stack.at(-1).event.cards,[f.ship,f.pilot]);rules.validate(m);
});
test('Sense returns both cards without refunding the combined cost',()=>{
 const f=fixture(),before=f.m.players.light.force.length;let m=respond(step(f.m,choice(f)));m=step(m,'cancel:play:'+f.sense+':'+f.ship+':'+f.enemy);m=seek(clone(m),x=>x.cards[f.sense].zone==='used');for(const id of [f.ship,f.pilot])assert.equal(m.cards[id].zone,'hand');assert.equal(before-m.players.light.force.length,5);m=priority(seek(m,parent),'light');assert.ok(!ids(m).includes(choice(f)));assert.ok(!m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);rules.validate(m);
});
test('Both cards must be eligible and their combined cost affordable',()=>{
 for(const reason of ['ship','pilot','cost']){const f=fixture();if(reason==='cost')while(f.m.players.light.force.length>4)state.moveCard(f.m,f.m.players.light.force[0],'used');else ground.registerReact(f.m,f[reason]);assert.ok(!ids(f.m).includes(choice(f)));}
});
for(const mode of ['leave','return'])test('A begun paired react survives grant '+mode,()=>{
 const f=fixture();let m=step(f.m,choice(f));state.moveCard(m,f.grant,'hand');if(mode==='return'){state.moveCard(m,f.grant,'table');Object.assign(m.cards[f.grant],{location:f.planet,attachedTo:f.carrier,aboardRole:'passenger'});}m=arrival(clone(m));assert.equal(m.cards[f.ship].zone,'table');rules.validate(m);
});
test('Barrier applied to either simultaneous arrival also affects the other card',()=>{
 for(const target of ['ship','pilot']){const f=fixture();let m=priority(arrival(step(f.m,choice(f))),'dark');m=step(m,'barrier:'+f.barrier+':'+f[target]);m=seek(m,x=>x.cards[f.barrier].zone==='used');for(const id of [f.ship,f.pilot])assert.ok(ground.barred(m,id));assert.ok(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled);}
});
test('Saved paired reacts reject forged permission and card bindings',()=>{
 const f=fixture(),m=step(f.m,choice(f));for(const change of [p=>p.grant.version=999,p=>p.react=false,p=>delete p.react,p=>p.pilot.id=f.enemy,p=>p.cargo=true]){const bad=clone(m);change(bad.stack.find(x=>x.action?.handler==='pair:deploy').action.payload);assert.throws(()=>rules.validate(bad));}
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/pilot-react-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP paired react comparison: '+expected.mode,()=>{
 const f=fixture(),before=f.m.players.light.force.length;let m=step(f.m,choice(f));
 if(expected.mode.startsWith('source-')){state.moveCard(m,f.grant,'hand');if(expected.mode==='source-return'){state.moveCard(m,f.grant,'table');Object.assign(m.cards[f.grant],{location:f.planet,attachedTo:f.carrier,aboardRole:'passenger'});}}
 if(expected.mode==='cancel'){m=step(respond(m),'cancel:play:'+f.sense+':'+f.ship+':'+f.enemy);m=seek(m,x=>x.cards[f.sense].zone==='used');}
 else{m=arrival(m);if(expected.mode.startsWith('barrier-')){m=priority(m,'dark');m=step(m,'barrier:'+f.barrier+':'+f[expected.mode.slice(8)]);m=seek(m,x=>x.cards[f.barrier].zone==='used');}}
 assert.deepEqual({mode:expected.mode,cost:before-m.players.light.force.length,shipAtSystem:m.cards[f.ship].zone==='table'&&m.cards[f.ship].location===f.planet,shipInHand:m.cards[f.ship].zone==='hand',pilotAboard:m.cards[f.pilot].attachedTo===f.ship,pilotInHand:m.cards[f.pilot].zone==='hand',drainStopped:m.stack.find(x=>x.action?.handler==='ground:drain').cancelled,shipBarred:ground.barred(m,f.ship),pilotBarred:ground.barred(m,f.pilot)},expected);rules.validate(m);
});
test('Required react pairing cannot be used at a docking bay that permits unpiloted deployment',()=>{
 const f=fixture();f.m.stack.find(x=>x.action?.handler==='ground:drain').action.payload.site=f.site;mod('board').moveWithAttachments(f.m,f.carrier,f.site);assert.ok(!ids(f.m).some(id=>id.startsWith('pair-deploy:')));
});
test('Both cards fail when the destination leaves and returns before resolution',()=>{
 const f=fixture();let m=step(f.m,choice(f));for(const id of [f.carrier,f.scout])mod('board').moveWithAttachments(m,id,f.site);const order=[...m.locations];m.locations=m.locations.filter(id=>id!==f.planet);state.moveCard(m,f.planet,'hand');state.moveCard(m,f.planet,'table');m.locations=order;m=seek(clone(m),x=>x.cards[f.ship].zone==='lost'&&x.cards[f.pilot].zone==='lost');assert.equal(m.cards[f.pilot].attachedTo,undefined);assert.equal(m.stack.find(x=>x.action?.handler==='ground:drain').cancelled,false);
});
test('A second unique ship on table prevents initiating its paired react',()=>{
 const f=fixture();pull(f.m,'light','1_144','table',f.site);assert.ok(!ids(f.m).includes(choice(f)));
});

test('Required ship and pilot react joins the battle before weapons',()=>{
 const f=fixture({battle:true});let m=arrival(step(f.m,choice(f)));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');for(const id of [f.ship,f.pilot])assert.ok(mod('participation').battleMembers(m,'light').includes(id));assert.equal(mod('occupancy').operational(m,f.ship),true);
});
