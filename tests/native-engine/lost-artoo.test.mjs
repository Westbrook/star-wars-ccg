import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,start,drawn,finish,mod,pull,state,rules,step,seek,priority,ids,clone,runtime,deploy,prompt} from './lost-artoo-fixture.mjs';
for(const mode of ['nav','fail','empty','astro','both'])test('I’ve Lost Artoo '+mode,()=>{
 const f=fixture(mode),before=f.m.players.dark.force.length;let m=start(f,['astro','both'].includes(mode));m=finish(clone(m));
 assert.equal(m.players.dark.force.length,before-1);assert.equal(m.cards[f.card].zone,mode==='nav'?'table':'lost');assert.equal(m.cards[f.astro].zone,['astro','both'].includes(mode)?'lost':'hand');assert.equal(mod('navigation').hasNavComputer(m,f.ship),mode!=='nav');assert.equal(mod('occupancy').vesselRule(m,f.ship).astromechs??0,['nav','astro'].includes(mode)?1:0);rules.validate(m);
});
test('Required arrival draw follows paid deployment and cannot be passed',()=>{
 const f=fixture();let m=seek(start(f),x=>x.stack.at(-1)?.event?.kind==='deployed');assert.equal(m.cards[f.card].zone,'table');assert.ok(!ids(m).includes('pass'));assert.match(prompt(m).choices[0].label,/draw destiny/);m=drawn(m);assert.equal(m.data.navigationLosses[0].stage,'destiny');assert.equal(finish(m).data.navigationLosses[0].destiny,5);
});
test('Both targets are independently selectable before paying, at any starship without presence',()=>{
 const f=fixture('both');assert.ok(ids(f.m).includes('lost-artoo:deploy:'+f.card+':'+f.ship+':nav'));assert.ok(ids(f.m).includes('lost-artoo:deploy:'+f.card+':'+f.ship+':'+f.astro));for(const id of [...f.m.players.dark.force])state.moveCard(f.m,id,'hand');assert.ok(!ids(f.m).some(id=>id.startsWith('lost-artoo:deploy:')));
});
test('Navigation slot accepts an astromech and its identity restores navigation',()=>{
 const f=fixture();let m=finish(start(f));assert.equal(mod('piloting').hasNavigation(m,f.ship),false);m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');assert.equal(mod('piloting').hasNavigation(m,f.ship),true);assert.equal(mod('navigation').hasNavComputer(m,f.ship),false);assert.equal(m.cards[f.astro].aboardRole,'passenger');
});
test('Canceling the active Effect restores navigation and puts a displaced droid on top of Used',()=>{
 const f=fixture();let m=finish(start(f));m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;const die=pull(m,'light','1_28','hand');state.moveCard(m,die,'reserve');const choice=ids(m).find(id=>id.startsWith('cancel:play:'+f.alter+':'+f.card+':'));assert.ok(choice);m=step(m,choice);m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.astro].zone,'used');assert.equal(m.players.light.used.includes(f.astro),true);assert.equal(m.cards[f.astro].attachedTo,undefined);assert.equal(mod('navigation').hasNavComputer(m,f.ship),true);assert.equal(m.data.capacityReturns.at(-1).card.id,f.astro);
});
test('Ordinary passenger space retains the droid when the additional slot disappears',()=>{
 const f=fixture('passenger');let m=finish(start(f));m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');mod('game-text').suppressGameText(m,f.site,f.card);m=step(m,'pass');assert.equal(m.cards[f.astro].zone,'table');assert.equal(mod('occupancy').vesselRule(m,f.ship).astromechs??0,0);assert.equal(mod('navigation').hasNavComputer(m,f.ship),true);
});
test('Suppression displaces only the astromech, never the pilot',()=>{
 const f=fixture();let m=finish(start(f));m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');m=deploy(m,f.lightPilot,f.ship,'pilot');mod('game-text').suppressGameText(m,f.site,f.card);mod('capacity-loss').scheduleCapacityLoss(m);assert.equal(m.cards[f.astro].zone,'used');assert.equal(m.players.light.used[0],f.astro);assert.equal(m.cards[f.lightPilot].zone,'table');rules.validate(m);
});
test('Alter cancels paid deployment before any destiny or capacity grant',()=>{
 const f=fixture();state.moveCard(f.m,f.luke,'table');f.m.cards[f.luke].location=f.site;const die=pull(f.m,'light','1_28','hand');state.moveCard(f.m,die,'reserve');let m=start(f);m=seek(m,x=>x.stack.at(-2)?.action?.handler==='lost-artoo:deploy'&&!x.stack.at(-2).awaitingResponses);m=priority(m,'light');const c=ids(m).find(x=>x.startsWith('cancel:play:'+f.alter+':'+f.card+':'));assert.ok(c);m=finish(step(m,c));assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.die].zone,'reserve');assert.equal(m.data.navigationLosses,undefined);
});
test('Original astromech loss does not follow a returned card instance',()=>{
 const f=fixture('astro');let m=drawn(start(f,true));mod('table').returnToHand(m,[f.astro]);state.moveCard(m,f.astro,'table');m.cards[f.astro].location=f.site;m=finish(m);assert.equal(m.cards[f.astro].zone,'table');assert.equal(m.cards[f.card].zone,'lost');
});
test('Source departure after the required action begins does not undo the astromech destiny',()=>{
 const f=fixture('astro');let m=drawn(start(f,true));mod('table').loseFromTable(m,[f.card]);m=finish(m);assert.equal(m.cards[f.astro].zone,'lost');assert.equal(m.data.navigationLosses[0].destiny,5);
});
test('Saved destiny rejects altered source and target bindings',()=>{
 const f=fixture(),m=drawn(start(f));for(const edit of [p=>p.next.payload.card=f.second,p=>p.next.payload.ship.version++,p=>p.source=f.second,p=>p.next.payload.serial++]){const bad=clone(m);edit(bad.stack.find(x=>x.action?.handler==='destiny:finish').action.payload);assert.throws(()=>rules.validate(bad));}
});
test('Displaced astromech selection survives refresh and never exposes ordinary passengers',()=>{
 const f=fixture();f.m.cards[f.ship].blueprint='1_145';let m=finish(start(f));m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');m=deploy(m,f.otherAstro,f.ship,'passenger');mod('table').loseFromTable(m,[f.card]);assert.equal(mod('capacity-loss').scheduleCapacityLoss(m),true);rules.validate(m);assert.equal(m.stack.at(-1).handler,'capacity:used');assert.equal(ids(m).length,2);const original=clone(m);m=step(clone(m),'capacity:used:'+f.otherAstro);assert.equal(m.cards[f.otherAstro].zone,'used');assert.equal(m.cards[f.astro].zone,'table');assert.equal(m.players.light.used[0],f.otherAstro);const bad=clone(original);bad.stack.at(-1).payload.candidates[0].id=f.lightPilot;assert.throws(()=>rules.validate(bad));
});
test('A displaced droid loses its attachments without losing the droid or crediting damage',()=>{
 const f=fixture();let m=finish(start(f));m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');const a=pull(m,'light','1_35','table',f.planet),b=pull(m,'light','1_35','table',f.planet);m.cards[a].attachedTo=f.astro;m.cards[b].attachedTo=f.astro;mod('table').loseFromTable(m,[f.card]);mod('capacity-loss').scheduleCapacityLoss(m);assert.equal(m.stack.at(-1).handler,'table:lost-order');m=seek(clone(m),x=>x.stack.length===1);assert.equal(m.cards[f.astro].zone,'used');assert.ok([a,b].every(id=>m.cards[id].zone==='lost'));assert.equal(m.players.light.used[0],f.astro);
});
test('A canceled destiny fails the Effect and removes its physical draw to Used',()=>{
 const f=fixture();let m=drawn(start(f));const r=m.stack.find(x=>x.action?.handler==='destiny:finish');assert.equal(mod('destiny-response').cancelPendingDestiny(m,r),true);m=finish(m);assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.die].zone,'used');assert.equal(m.data.navigationLosses[0].destiny,null);
});
test('Target departure before deployment loses the paid Effect without drawing',()=>{
 const f=fixture();let m=start(f);mod('table').returnToHand(m,[f.ship]);m=finish(m);assert.equal(m.cards[f.card].zone,'lost');assert.equal(m.cards[f.die].zone,'reserve');assert.equal(m.data.navigationLosses,undefined);
});
test('A returning source cannot reactivate its former navigation cancellation',()=>{
 const f=fixture();let m=finish(start(f));mod('table').returnToHand(m,[f.card]);state.moveCard(m,f.card,'table');m.cards[f.card].attachedTo=f.ship;m.cards[f.card].location=f.planet;assert.equal(mod('navigation').hasNavComputer(m,f.ship),true);assert.equal(mod('occupancy').vesselRule(m,f.ship).astromechs??0,0);
});
for(const row of JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/lost-artoo-results.json',import.meta.url))))test('Executed GEMP navigation comparison '+row.mode,()=>{
 const f=fixture(row.mode),before=f.m.players.dark.force.length;let m=finish(start(f,['astro','both'].includes(row.mode)));const cost=before-m.players.dark.force.length;
 if(['capacity','passenger'].includes(row.mode)){
  m.turn.side='light';m.stack[0].priority='light';m=deploy(m,f.astro,f.ship,'passenger');state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.site;const die=pull(m,'light','1_28','hand');state.moveCard(m,die,'reserve');m=step(m,ids(m).find(id=>id.startsWith('cancel:play:'+f.alter+':'+f.card+':')));m=seek(m,x=>x.stack.length===1);
 }
 const actual={mode:row.mode,destiny:m.data.navigationLosses[0].destiny,cost,effectLost:m.cards[f.card].zone==='lost',astroLost:m.cards[f.astro].zone==='lost',astroUsed:m.cards[f.astro].zone==='used',astroAboard:m.cards[f.astro].attachedTo===f.ship,navigation:mod('navigation').hasNavComputer(m,f.ship),astromechs:mod('occupancy').vesselRule(m,f.ship).astromechs??0};
 if(row.mode==='capacity'){
  // Executed pinned GEMP leaves the droid in excess capacity. AR p89 explicitly
  // sends it to top Used. Preserve the observation; do not normalize the oracle.
  assert.equal(row.astroAboard,true);assert.equal(row.astroUsed,false);assert.deepEqual(actual,{...row,astroAboard:false,astroUsed:true});
 }else assert.deepEqual(actual,row);
});
