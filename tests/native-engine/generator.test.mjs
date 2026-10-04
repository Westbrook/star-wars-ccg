import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ready,fire,normal,controlling,pull,step,seek,load,rules,runtime,board,state,ids,prompt,clone} from './generator-fixture.mjs';
const hoth=load(new URL('../../lib/native-engine/hoth.ts',import.meta.url)),text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url)),icon=load(new URL('../../lib/native-engine/location-icons.ts',import.meta.url));
test('Target The Main Generator loses site cards before eight Force, then blanks the site and removes the shield',()=>{
 const f=ready(fixture()),before=state.lifeForce(f.m,'light');let m=fire(f);m=seek(clone(m),x=>x.stack.at(-1)?.handler==='table:lost-order');assert.ok(hoth.shielded(m,f.trench));assert.equal(m.cards[f.victim].zone,'leaving');assert.equal(m.cards[f.rifle].zone,'leaving');assert.equal(state.lifeForce(m,'light'),before);
 m=seek(clone(m),x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(m.data.generatorShots.at(-1).total,10);assert.ok(hoth.shielded(m,f.trench));m=normal(clone(m));assert.equal(before-state.lifeForce(m,'light'),8);assert.equal(m.cards[f.gen].zone,'table');assert.equal(m.cards[f.gen].blownAway,true);assert.equal(icon.forceIcons(m,f.gen,'light'),0);assert.equal(text.gameTextActive(m,f.gen),false);assert.equal(hoth.shielded(m,f.trench),false);assert.equal(m.cards[f.epic].zone,'lost');assert.equal(m.cards[f.victim].zone,'lost');assert.equal(m.cards[f.rifle].zone,'lost');assert.ok(m.locations.includes(f.gen));
});
test('a failed shot uses the Epic Event, costs no Force, and retains the site and its cards',()=>{
 const f=ready(fixture(),'1_194'),before=f.m.players.dark.force.length;const m=normal(fire(f));assert.equal(m.data.generatorShots.at(-1).total,6);assert.equal(m.cards[f.epic].zone,'used');assert.equal(m.cards[f.gen].blownAway,undefined);assert.equal(m.cards[f.victim].zone,'table');assert.equal(m.players.dark.force.length,before);assert.ok(hoth.shielded(m,f.gen));
});
test('range, piloting and control phase determine the available Epic Event action',()=>{
 const f=ready(fixture());assert.ok(ids(f.m).some(x=>x.startsWith('generator:fire:')));board.moveWithAttachments(f.m,f.walker,f.ridge);assert.ok(!ids(f.m).some(x=>x.startsWith('generator:fire:')));board.moveWithAttachments(f.m,f.walker,f.trench);text.suppressGameText(f.m,f.perimeter,f.gun);assert.ok(!ids(f.m).some(x=>x.startsWith('generator:fire:')));
});
test('Cannon deploys for two Force and survives refresh during deployment',()=>{
 const f=fixture();state.moveCard(f.m,f.gun,'hand');const before=f.m.players.dark.force.length;const m=normal(clone(step(f.m,'generator:equip:'+f.gun+':'+f.walker+':')));assert.equal(m.cards[f.gun].attachedTo,f.walker);assert.equal(before-m.players.dark.force.length,2);
});
test('canceling generator text removes the eight-Force loss without preventing site destruction',()=>{
 const f=ready(fixture()),before=state.lifeForce(f.m,'light');text.suppressGameText(f.m,f.perimeter,f.gen);const m=normal(fire(f));assert.equal(m.cards[f.gen].blownAway,true);assert.equal(state.lifeForce(m,'light'),before);
});
test('blown site remains a legal movement destination but supplies no deployment presence',()=>{
 const f=ready(fixture()),m=normal(fire(f));assert.ok(board.adjacent(m,f.trench,f.gen));const trooper=pull(m,'light','1_28','hand');assert.equal(board.deploymentPayment(m,trooper,f.gen),null);assert.equal(board.drainAmount(m,'dark',f.gen),0);
});
test('forged shot identity is rejected during recovery',()=>{
 const f=ready(fixture()),m=fire(f);m.data.generatorShots[0].weapon.id=f.walker;assert.throws(()=>runtime.prompt(m,rules,'dark'),/Invalid generator/);
});
test('exactly eight fails; a selected ability-three pilot instead yields nine',()=>{
 for(const chosen of [false,true]){const f=ready(fixture(),'3_158'),pilot=pull(f.m,'dark','1_179','table',f.trench);f.m.cards[pilot].attachedTo=f.walker;f.m.cards[pilot].aboardRole='pilot';assert.ok(ids(f.m).includes('generator:fire:'+f.epic+':'+f.gun+':'+pilot));const m=normal(step(f.m,'generator:fire:'+f.epic+':'+f.gun+':'+(chosen?pilot:f.walker)));assert.equal(m.data.generatorShots.at(-1).total,chosen?9:8);assert.equal(m.cards[f.epic].zone,chosen?'lost':'used');}
});
test('a failed shot permits a second Epic Event using the same cannon this control phase',()=>{
 const f=ready(fixture(),'1_194');let m=normal(fire(f));const epic=pull(m,'dark','3_115','hand');m=controlling(m);assert.ok(ids(m).includes('generator:fire:'+epic+':'+f.gun+':'+f.walker));
});
test('cancelled destiny still uses the selected pilot and controlled-site contributions',()=>{
 const f=ready(fixture());let m=seek(fire(f),x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');const pending=m.stack.at(-2);assert.equal(pending.action.handler,'destiny:finish');load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url)).cancelPendingDestiny(m,pending);m=normal(clone(m));assert.equal(m.data.generatorShots[0].draw.value,null);assert.equal(m.data.generatorShots[0].total,5);assert.equal(m.cards[f.epic].zone,'used');
});
test('canceled Epic Event is lost and retains a distinct recovered outcome',()=>{
 const f=ready(fixture()),m=fire(f);m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='generator:fire').cancelled=true;const done=normal(clone(m));assert.equal(done.data.generatorShots[0].stage,'cancelled');assert.equal(done.cards[f.epic].zone,'lost');assert.equal(done.cards[f.gen].blownAway,undefined);
});
test('site destruction includes buried cards and carrier occupants in the simultaneous loss',()=>{
 const f=ready(fixture()),table=load(new URL('../../lib/native-engine/table.ts',import.meta.url));board.moveWithAttachments(f.m,f.walker,f.gen);const passenger=pull(f.m,'dark','1_179','table',f.gen);f.m.cards[passenger].attachedTo=f.walker;f.m.cards[passenger].aboardRole='passenger';const buried=pull(f.m,'light','1_28','buried',f.gen);const casualties=table.siteLossCards(f.m,f.gen,f.epic);for(const id of [f.walker,f.gun,passenger,buried,f.victim,f.rifle])assert.ok(casualties.includes(id));const m=normal(fire(f));for(const id of casualties)assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[f.gen].blownAway,true);
});
test('blown generator cannot be converted or deployed again, and permits character deployment with presence',()=>{
 const f=ready(fixture()),m=normal(fire(f));const trooper=pull(m,'dark','1_194','hand');assert.equal(board.deploymentPayment(m,trooper,f.gen),null);board.moveWithAttachments(m,f.walker,f.gen);assert.ok(board.deploymentPayment(m,trooper,f.gen));const existing=Object.values(m.cards).find(c=>c.blueprint==='3_61'&&c.id!==f.gen);assert.ok(existing);assert.deepEqual(board.sitePlacements(m,existing.id),[]);assert.equal(board.generation(m,'light'),1+m.locations.reduce((sum,id)=>sum+icon.forceIcons(m,id,'light'),0));
});
test('forged shot stages, actor and binding are rejected after refresh',()=>{
 const f=ready(fixture()),m=fire(f);for(const mutate of [x=>x.data.generatorShots[0].stage='complete',x=>x.data.generatorShots[0].y=2.5,x=>x.stack.find(r=>r.kind==='resolution'&&r.action.handler==='generator:fire').actor='light',x=>x.stack.find(r=>r.kind==='resolution'&&r.action.handler==='generator:fire').action.handler='generator:finish']){const bad=clone(m);mutate(bad);assert.throws(()=>runtime.prompt(bad,rules,'dark'),/Invalid generator/);}
});
const observed=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/generator-results.json',import.meta.url),'utf8'));
for(const row of observed)test('executed GEMP generator observation '+row.case,()=>{
 const f=ready(fixture(),row.case==='success'?'1_262':row.case==='failure'?'1_194':'3_158');let pilot=f.walker;if(row.case==='chosen-pilot'){pilot=pull(f.m,'dark','1_179','table',f.trench);f.m.cards[pilot].attachedTo=f.walker;f.m.cards[pilot].aboardRole='pilot';}
 const force=f.m.players.dark.force.length,lost=f.m.players.light.lost.length;let m=step(f.m,'generator:fire:'+f.epic+':'+f.gun+':'+pilot),cardsBeforeForce,lossBeforeFlip;
 if(['success','chosen-pilot'].includes(row.case)){m=seek(clone(m),x=>x.stack.at(-1)?.handler==='ground:force-loss');cardsBeforeForce=m.cards[f.victim].zone==='lost'&&m.cards[f.rifle].zone==='lost';lossBeforeFlip=!m.cards[f.gen].blownAway;}
 m=normal(clone(m));assert.deepEqual({case:row.case,blownAway:!!m.cards[f.gen].blownAway,eventZone:m.cards[f.epic].zone,lightCardsLost:m.players.light.lost.length-lost,forceSpent:force-m.players.dark.force.length,shieldActive:hoth.shielded(m,f.trench),...(cardsBeforeForce!==undefined?{cardsBeforeForce,lossBeforeFlip}:{})},row);
});
