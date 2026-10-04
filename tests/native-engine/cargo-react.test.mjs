import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,choice,step,seek,priority,state,ids,clone,rules,load,pull} from './cargo-react-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url)),ground=mod('ground');
const arrival=(m,card)=>seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed'&&x.stack.at(-1).event.card===card);
const respond=m=>priority(seek(m,x=>x.stack.at(-2)?.action?.handler==='transport:deploy'&&!x.stack.at(-2).awaitingResponses),'light');
for(const bp of ['1_305','1_310','1_300'])test('Cargo react deploys '+bp+' into capacity, paying normal cost and contributing no power while carried',()=>{
 const f=fixture({bp}),before=f.m.players.dark.force.length;assert.ok(ids(f.m).includes(choice(f)));let m=arrival(step(f.m,choice(f)),f.cargo);assert.equal(m.cards[f.cargo].attachedTo,f.carrier);assert.equal(before-m.players.dark.force.length,bp==='1_300'?1:2);assert.ok(ground.usage(m).reacted.includes(f.cargo));m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.ok(mod('participation').battleMembers(m,'dark').includes(f.cargo));assert.equal(mod('occupancy').operational(m,f.cargo),false);rules.validate(m);
});
for(const bp of ['1_305','1_310'])test('Sense cancels cargo react '+bp+' and keeps the paid cost',()=>{
 const f=fixture({bp}),before=f.m.players.dark.force.length;let m=respond(step(f.m,choice(f)));m=step(m,'cancel:play:'+f.sense+':'+f.cargo+':'+f.enemy);m=seek(clone(m),x=>x.cards[f.sense].zone==='used');assert.equal(m.cards[f.cargo].zone,'hand');assert.equal(before-m.players.dark.force.length,bp==='1_300'?1:2);assert.ok(ground.usage(m).reacted.includes(f.cargo));assert.ok(ground.usage(m).cancelledReactTitles.includes(mod('board').name(m,f.cargo)));assert.equal(m.cards[f.carrier].zone,'table');
});
for(const change of ['leave','return','move'])test('Begun cargo deployment survives grant '+change,()=>{
 const f=fixture();let m=step(f.m,choice(f));state.moveCard(m,f.grant,'hand');if(change==='return'){state.moveCard(m,f.grant,'table');Object.assign(m.cards[f.grant],{location:f.planet,attachedTo:f.pilot});}if(change==='move'){state.moveCard(m,f.grant,'table');Object.assign(m.cards[f.grant],{location:f.planet,attachedTo:f.carrier});}m=arrival(clone(m),f.cargo);assert.equal(m.cards[f.cargo].attachedTo,f.carrier);
});
test('Cargo react cannot target another system or bypass printed world restrictions',()=>{
 const f=fixture();state.moveCard(f.m,f.second,'table');f.m.cards[f.second].location=f.away;assert.ok(!ids(f.m).includes(choice(f,f.cargo,f.second)));assert.ok(!ids(f.m).some(id=>id.startsWith('transport:deploy:'+f.crawler+':')));assert.ok(!ids(f.m).some(id=>id.startsWith('pair-deploy:')&&id.includes(f.carrier+':react')));
});
for(const change of ['move','return'])test('Cargo fails if its destination carrier '+change+'s before arrival',()=>{
 const f=fixture();let m=step(f.m,choice(f));if(change==='move')mod('board').moveWithAttachments(m,f.carrier,f.away);else{mod('table').returnToHand(m,[f.carrier]);state.moveCard(m,f.carrier,'table');m.cards[f.carrier].location=f.planet;}m=seek(clone(m),x=>x.cards[f.cargo].zone==='lost');assert.equal(m.cards[f.cargo].attachedTo,undefined);
});
test('Saved cargo reactions bind grant, card instance and original location',()=>{
 const f=fixture(),m=step(f.m,choice(f));for(const edit of [p=>p.grant.version=999,p=>p.card.version--,p=>delete p.react,p=>p.react=false,p=>p.grant.id=f.enemy]){const bad=clone(m);edit(bad.stack.find(x=>x.action?.handler==='transport:deploy').action.payload);assert.throws(()=>rules.validate(bad));}
});
function fillVehicleSlots(f,m=f.m){for(const id of [f.crawler,f.extraCrawler]){state.moveCard(m,id,'table');Object.assign(m.cards[id],{location:f.planet,attachedTo:f.carrier,aboardRole:'vehicle'});}}
test('Full cargo capacity excludes new reacts and invalidates a pending arrival without refund',()=>{
 const f=fixture({bp:'1_310'});fillVehicleSlots(f);assert.ok(!ids(f.m).includes(choice(f)));const g=fixture({bp:'1_310'}),before=g.m.players.dark.force.length;let m=step(g.m,choice(g));fillVehicleSlots(g,m);m=seek(m,x=>x.cards[g.cargo].zone==='lost');assert.equal(before-m.players.dark.force.length,2);
});
test('Cargo deployment obeys Force affordability and per-turn physical/title restrictions',()=>{
 for(const mode of ['cost','physical','title']){const f=fixture();if(mode==='cost')while(f.m.players.dark.force.length>1)state.moveCard(f.m,f.m.players.dark.force[0],'used');else if(mode==='physical')ground.registerReact(f.m,f.cargo);else ground.record(f.m).cancelledReactTitles=[mod('board').name(f.m,f.cargo)];assert.ok(!ids(f.m).includes(choice(f)));}
});
test('Successful Sense forbids another non-unique vehicle copy reacting this turn',()=>{
 const f=fixture({bp:'1_310'}),copy=pull(f.m,'dark','1_310','hand');let m=respond(step(f.m,choice(f)));m=step(m,'cancel:play:'+f.sense+':'+f.cargo+':'+f.enemy);m=seek(m,x=>x.cards[f.sense].zone==='used');assert.equal(ground.canDeployAsReact(m,copy),false);
});
test('Cargo grant text and source participation are required at initiation',()=>{
 const f=fixture();f.m.data.canceledGameText=[mod('identity').referenceCard(f.m,f.grant)];assert.ok(!rules.actions(f.m,f.m.stack.at(-1),'dark').some(a=>a.handler==='transport:deploy'));
});
test('Cargo cannot be launched or shuttled by a deployment-only reaction grant',()=>{
 const f=fixture();let m=arrival(step(f.m,choice(f)),f.cargo);m=priority(seek(m,x=>x.stack.at(-2)?.action?.handler==='battle:begin'&&!x.stack.at(-2).awaitingResponses),'dark');assert.ok(!ids(m).some(id=>/^transport:(embark|disembark|shuttle|bridge):/.test(id)));
});
const oracle=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/cargo-react-results.json',import.meta.url)));
for(const expected of oracle)test('Executed GEMP cargo react comparison: '+expected.mode,()=>{
 const {mode}=expected,f=fixture({bp:mode.includes('vehicle')?'1_310':mode==='unpiloted'?'1_300':'1_305'}),before=f.m.players.dark.force.length;let m=step(f.m,choice(f));
 if(mode.startsWith('source-')){state.moveCard(m,f.grant,'hand');if(mode==='source-return'){state.moveCard(m,f.grant,'table');Object.assign(m.cards[f.grant],{location:f.planet,attachedTo:f.pilot});}}
 if(mode.startsWith('cancel-')){m=step(respond(m),'cancel:play:'+f.sense+':'+f.cargo+':'+f.enemy);m=seek(m,x=>x.cards[f.sense].zone==='used');}else m=arrival(m,f.cargo);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');const members=mod('participation').battleMembers(m,'dark');assert.deepEqual({mode,cost:before-m.players.dark.force.length,cargoAboard:m.cards[f.cargo].attachedTo===f.carrier,cargoInHand:m.cards[f.cargo].zone==='hand',cargoBattles:members.includes(f.cargo),carrierBattles:members.includes(f.carrier)},expected);rules.validate(m);
});
test('A unique cargo play consumes its turn allowance, including after returning to hand',()=>{
 const f=fixture({bp:'1_300'});let m=arrival(step(f.m,choice(f)),f.cargo);const persona=mod('persona');assert.equal(persona.canPlayThisTurn(m,f.cargo),false);mod('table').returnToHand(m,[f.cargo]);assert.equal(persona.canPlayCard(m,f.cargo),false);
});
test('Light CZ-3 grants a vehicle deployment into a Corvette cargo slot',async()=>{
 const {fixture:shuttle}=await import('./shuttle-fixture.mjs'),f=shuttle({light:['1_129','1_6','1_149'],dark:['1_284']});
 for(const id of [f.carrier,f.corvette]){state.moveCard(f.m,id,'table');f.m.cards[id].location=f.planet;}
 const grant=pull(f.m,'light','1_6','table',f.planet),cargo=pull(f.m,'light','1_149','hand');Object.assign(f.m.cards[grant],{attachedTo:f.corvette,aboardRole:'passenger'});
 let m=priority(seek(f.m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1),'dark');m=priority(step(m,'battle:'+f.planet),'light');const before=m.players.light.force.length;m=arrival(step(m,'transport:deploy:'+cargo+':'+f.corvette+':vehicle:react:via:'+grant),cargo);assert.equal(m.cards[cargo].attachedTo,f.corvette);assert.equal(before-m.players.light.force.length,2);rules.validate(m);
});
