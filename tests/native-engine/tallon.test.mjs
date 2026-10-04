import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,start,finish,slip,mod,boundary,pull,state,rules,step,seek,phase,priority,ids,clone,settled} from './tallon-fixture.mjs';
for(const [dark,light,loser] of [[1,5,null],[3,1,'light'],[null,1,'dark'],[1,null,'light'],[null,null,null],[1,0,'light']])test('Tallon Roll destiny result '+JSON.stringify([dark,light]),()=>{
 const f=fixture(dark,light),m=finish(start(f),f.roll),d=m.data.tallonRoll;assert.equal(d.loser,loser);assert.equal(m.cards[f.roll].zone,'used');assert.equal(d.stage,'complete');assert.equal(d.destiny.dark,dark);assert.equal(d.destiny.light,light);if(loser)assert.equal(m.cards[d.ships[loser]].zone,'lost');assert.ok(!m.data.battle);
});
test('Corellian Slip adds the current maneuver and permanent pilot ability',()=>{
 const f=fixture();let m=finish(slip(start(f),f),f.roll);const d=m.data.tallonRoll;assert.equal(d.slip,true);assert.equal(d.totals.light,11);assert.equal(d.totals.dark,7);assert.equal(d.loser,'dark');assert.equal(m.cards[f.pilot].zone,'lost');assert.equal(m.cards[f.slip].zone,'used');
});
test('Without Slip only the initiating draw targets TIE maneuver',()=>{
 const f=fixture();let m=boundary(start(f),'destiny-drawn');assert.ok(ids(priority(m,'dark')).includes('maneuver:'+f.maneuver+':'+f.tie));assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('maneuver:')));m=seek(step(m,'pass'),x=>x.stack.at(-1)?.event?.kind==='destiny-drawn'&&x.stack.at(-1).event.side==='light');for(const side of ['dark','light'])assert.ok(!ids(priority(m,side)).some(id=>id.startsWith('maneuver:')));
});
test('Slip makes both ships targets of the initiating draw, never the defending draw',()=>{
 const f=fixture();let m=boundary(slip(start(f),f),'destiny-drawn');assert.ok(ids(priority(m,'light')).includes('maneuver:'+f.few+':'+f.ywing));m=step(priority(m,'light'),'maneuver:'+f.few+':'+f.ywing);m=finish(m,f.roll);assert.equal(m.data.tallonRoll.values.light.maneuver,5);assert.equal(m.data.tallonRoll.totals.light,13);
});
test('Dark Maneuvers played after its own draw changes all relevant totals',()=>{
 const f=fixture();let m=boundary(start(f),'destiny-drawn');m=step(priority(m,'dark'),'maneuver:'+f.maneuver+':'+f.tie);m=finish(m,f.roll);assert.equal(m.data.tallonRoll.totals.dark,10);assert.equal(m.data.tallonRoll.loser,'light');
});
test('Slip reduction is noncumulative, expires, and uses no invented hyperdrive',()=>{
 const f=fixture();let m=step(priority(f.m,'light'),'tallon:reduce:'+f.slip+':'+f.tie);m=priority(settled(m),'light');m=finish(step(m,'tallon:reduce:'+f.slip2+':'+f.tie),f.slip2);assert.equal(mod('piloting').vesselManeuver(m,f.tie),2);m.turn.number++;assert.equal(mod('piloting').vesselManeuver(m,f.tie),3);
});
test('No TIE/ln pilot, remote ships, landed ships and cargo cannot initiate Tallon Roll',()=>{
 for(const mode of ['pilot','remote','landed','cargo']){const f=fixture();if(mode==='pilot')mod('table').returnToHand(f.m,[f.pilot]);if(mode==='remote'){const death=pull(f.m,'dark','2_143','table');f.m.locations.push(death);f.m.cards[f.ywing].location=death;}if(mode==='landed'){f.m.cards[f.tie].location=f.site;f.m.cards[f.pilot].location=f.site;}if(mode==='cargo'){const carrier=pull(f.m,'dark','1_302','table',f.planet);f.m.cards[f.tie].attachedTo=carrier;f.m.cards[f.tie].aboardRole='starship';}assert.ok(!ids(f.m).some(x=>x.startsWith('tallon:play:')));}
});
test('An unpiloted Rebel fighter remains a valid target with zero power',()=>{
 const f=fixture(),xwing=pull(f.m,'light','1_144','table',f.planet);let m=step(f.m,'tallon:play:'+f.roll+':'+f.tie+':'+xwing);m=finish(m,f.roll);assert.equal(m.data.tallonRoll.values.light.power,0);assert.equal(m.cards[xwing].zone,'lost');
});
test('Corellian Slip cannot change Tallon Roll after the initiation responses',()=>{
 const f=fixture();let m=boundary(start(f),'destiny-drawn');assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('tallon:slip:')));
});
test('Refresh between draws, after results, and during Lost ordering preserves the same result',()=>{
 const f=fixture();let m=boundary(slip(start(f),f),'destiny-drawn');m=boundary(clone(m),'tallon-result');assert.equal(m.data.tallonRoll.loser,'dark');m=seek(clone(m),x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[f.tie].zone,'leaving');assert.equal(m.cards[f.pilot].zone,'leaving');m=finish(clone(m),f.roll);assert.equal(m.cards[f.tie].zone,'lost');assert.equal(m.cards[f.pilot].zone,'lost');
});
test('Sense cancels Tallon Roll before either destiny; no comparison record is fabricated',()=>{
 const f=fixture(),sense=pull(f.m,'light','1_109','hand');state.moveCard(f.m,f.luke,'table');f.m.cards[f.luke].location=f.site;const zero=pull(f.m,'light','1_124','hand');state.moveCard(f.m,zero,'reserve');let m=start(f);m=step(priority(m,'light'),'cancel:play:'+sense+':'+f.roll+':'+f.luke);m=finish(m,f.roll);assert.equal(m.cards[f.roll].zone,'lost');assert.equal(m.data.tallonRoll,undefined);
});
test('Source cleanup and a second Tallon Roll use distinct persistent comparisons',()=>{
 const f=fixture();let m=priority(settled(finish(start(f),f.roll)),'dark');const first=m.data.tallonRoll.serial;m=step(m,'tallon:play:'+f.roll2+':'+f.tie+':'+f.ywing);m=boundary(m,'destiny-drawn');assert.ok(m.data.tallonRoll.serial>first);rules.validate(m);
});

for(const expected of JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/tallon-results.json',import.meta.url))))test('Executed GEMP Tallon Roll outcome: '+expected.mode,()=>{
 const mode=expected.mode,dark=['failed-dark','both-fail','leave-failed-dark'].includes(mode)?null:['dark-win','battle'].includes(mode)?3:1,light=['failed-light','both-fail'].includes(mode)?null:mode==='leave-after-high'?6:['dark-win','battle','failed-dark'].includes(mode)?1:5;
 const f=fixture(dark,light);let m=f.m,target=f.ywing;
 if(mode==='light-win'){state.moveCard(m,f.lightPilot,'table');Object.assign(m.cards[f.lightPilot],{location:f.planet,attachedTo:f.ywing,aboardRole:'pilot'});}
 if(mode==='unpiloted')target=pull(m,'light','1_144','table',f.planet);
 if(mode==='reduce')m=priority(settled(step(priority(m,'light'),'tallon:reduce:'+f.slip+':'+f.tie)),'dark');
 if(mode==='battle')m=priority(boundary(step(priority(phase(m,'battle'),'dark'),'battle:'+f.planet),'battle-weapons'),'dark');
 m=step(m,'tallon:play:'+f.roll+':'+f.tie+':'+target);
 if(mode.startsWith('slip'))m=slip(m,f);
 if(['leave-before','leave-failed-dark'].includes(mode))mod('table').returnToHand(m,[f.ywing]);
 if(mode==='dark-maneuvers'){m=boundary(m,'destiny-drawn');m=step(priority(m,'dark'),'maneuver:'+f.maneuver+':'+f.tie);}
 if(mode==='slip-few'){m=boundary(m,'destiny-drawn');m=step(priority(m,'light'),'maneuver:'+f.few+':'+f.ywing);}
 if(mode.startsWith('leave-after')){m=boundary(m,'destiny-drawn');mod('table').returnToHand(m,[f.ywing]);}
 m=finish(m,f.roll);
 assert.deepEqual({mode,darkLost:m.cards[f.tie].zone==='lost',lightLost:m.cards[target].zone==='lost',pilotLost:m.cards[f.pilot].zone==='lost',darkDrew:!!f.drawIds.dark&&m.cards[f.drawIds.dark].zone==='used',lightDrew:!!f.drawIds.light&&m.cards[f.drawIds.light].zone==='used',slipUsed:m.cards[f.slip].zone==='used',maneuverUsed:m.cards[f.maneuver].zone==='used',fewUsed:m.cards[f.few].zone==='used',rollUsed:m.cards[f.roll].zone==='used'},expected);
});

test('Actual Sense cancels Corellian Slip without canceling Tallon Roll',()=>{
 const f=fixture(),sense=pull(f.m,'dark','1_267','hand');let m=slip(start(f),f);const one=pull(m,'dark','1_194','hand');state.moveCard(m,one,'reserve');m=step(priority(m,'dark'),'cancel:play:'+sense+':'+f.slip+':'+f.pilot);m=finish(m,f.roll);assert.equal(m.cards[f.slip].zone,'lost');assert.equal(m.cards[f.roll].zone,'used');assert.equal(m.data.tallonRoll.slip,false);
});
test('Repeated Slip responses add maneuver and one pilot ability only once',()=>{
 const f=fixture();let m=finish(slip(start(f),f),f.slip);m=step(priority(m,'light'),'tallon:slip:'+f.slip2+':'+f.roll);m=finish(m,f.roll);assert.equal(m.data.tallonRoll.values.light.ability,1);assert.equal(m.data.tallonRoll.totals.light,11);
});
test('Slip uses the highest active pilot ability, with crew power still counted separately',()=>{
 const f=fixture();state.moveCard(f.m,f.lightPilot,'table');Object.assign(f.m.cards[f.lightPilot],{location:f.planet,attachedTo:f.ywing,aboardRole:'pilot'});const m=finish(slip(start(f),f),f.roll);assert.deepEqual(m.data.tallonRoll.values.light,{power:4,maneuver:3,ability:3});assert.equal(m.data.tallonRoll.totals.light,15);
});
test('Returning the losing ship cannot inherit an old pending loss',()=>{
 const f=fixture(3,1);let m=boundary(start(f),'about-to-lose');mod('table').returnToHand(m,[f.ywing]);state.moveCard(m,f.ywing,'table');m.cards[f.ywing].location=f.planet;m=finish(m,f.roll);assert.equal(m.cards[f.ywing].zone,'table');assert.equal(m.data.tallonRoll.lost,undefined);
});
test('Malformed persisted totals, loser, physical references and serials are rejected',()=>{
 const f=fixture(),m=boundary(slip(start(f),f),'tallon-result');for(const edit of [d=>d.totals.dark++,d=>d.loser='light',d=>d.refs.light.id=f.tie,d=>d.destiny.light=-1,d=>d.serial=999999]){const bad=clone(m);edit(bad.data.tallonRoll);assert.throws(()=>rules.validate(bad));}
});
test('A destroyed starfighter loses its mounted weapon and crew with chosen Lost ordering',()=>{
 const f=fixture(3,1),gun=pull(f.m,'light','1_158','table',f.planet);f.m.cards[gun].attachedTo=f.ywing;state.moveCard(f.m,f.lightPilot,'table');Object.assign(f.m.cards[f.lightPilot],{location:f.planet,attachedTo:f.ywing,aboardRole:'pilot'});const m=finish(start(f),f.roll);assert.equal(m.cards[f.ywing].zone,'lost');assert.equal(m.cards[gun].zone,'lost');assert.equal(m.cards[f.lightPilot].zone,'lost');assert.equal(m.players.dark.force.length,f.m.players.dark.force.length);
});
test('Tallon Roll during a battle can remove its last opposing ship without battle-loss credit',()=>{
 const f=fixture(3,1);let m=priority(phase(f.m,'battle'),'dark');m=boundary(step(m,'battle:'+f.planet),'battle-weapons');m=step(priority(m,'dark'),'tallon:play:'+f.roll+':'+f.tie+':'+f.ywing);m=finish(m,f.roll);assert.equal(m.cards[f.ywing].zone,'lost');assert.equal(m.data.tallonRoll.lost,'light');m=settled(m);assert.equal(m.data.battle.stage,'complete');assert.equal(m.data.battle.premature,true);assert.deepEqual(m.data.battle.damage,{dark:0,light:0});assert.deepEqual(m.data.battle.attrition,{dark:0,light:0});assert.equal(m.data.battle.damageLedger,undefined);rules.validate(m);
});
