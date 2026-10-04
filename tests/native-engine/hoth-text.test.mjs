import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,pull,location,phase,priority,step,seek,load,rules,runtime,board,state,ids,prompt,clone} from './hoth-text-fixture.mjs';
const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/combat-modifiers.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/vessel-travel.ts',import.meta.url));
function emptyForce(m,side='dark'){for(const id of [...m.players[side].force])state.moveCard(m,id,'used','bottom');}
const normal=m=>seek(m,x=>x.stack.length===1);
const moving=m=>priority(phase(m,'move'),'dark');
function darkPerimeter(f){f.m.locations=f.m.locations.map(id=>id===f.lightPerimeter?f.perimeter:id);delete f.m.cards[f.perimeter].coveredBy;f.m.cards[f.lightPerimeter].coveredBy=f.perimeter;return f.perimeter;}
test('both Defensive Perimeter sides and Mountains increase controlled drains; text cancellation removes the bonus',()=>{
 for(const side of ['dark','light']){const f=fixture();pull(f.m,side,side==='dark'?'1_194':'1_28','table',f.lightPerimeter);assert.equal(board.drainAmount(f.m,side,f.lightPerimeter),2);text.suppressGameText(f.m,f.site,f.lightPerimeter);assert.equal(board.drainAmount(f.m,side,f.lightPerimeter),1);}
 const f=fixture();pull(f.m,'light','1_28','table',f.mountains);assert.equal(board.drainAmount(f.m,'light',f.mountains),2);
});
test('Ice Plains Light drain reduction requires control and a generator on table, even with generator text canceled',()=>{
 const f=fixture();pull(f.m,'light','1_28','table',f.ice);assert.equal(board.drainAmount(f.m,'light',f.ice),1);text.suppressGameText(f.m,f.site,f.gen);assert.equal(board.drainAmount(f.m,'light',f.ice),1);f.m.locations=f.m.locations.filter(id=>id!==f.gen);state.moveCard(f.m,f.gen,'out');assert.equal(board.drainAmount(f.m,'light',f.ice),2);
});
test('Snow Trench generates one more Dark Force only with uncontested presence and active text',()=>{
 const f=fixture(),before=board.generation(f.m,'dark');pull(f.m,'dark','1_194','table',f.trench);assert.equal(board.generation(f.m,'dark'),before+1);const rebel=pull(f.m,'light','1_28','table',f.trench);assert.equal(board.generation(f.m,'dark'),before);state.moveCard(f.m,rebel,'hand');text.suppressGameText(f.m,f.site,f.trench);assert.equal(board.generation(f.m,'dark'),before);
});
test('Dark Perimeter lowers Light trooper forfeit and adds Dark weapon destiny; Snow Trench adds Light weapon destiny',()=>{
 const f=fixture(),perimeter=darkPerimeter(f),trooper=pull(f.m,'light','1_28','table',perimeter),dark=pull(f.m,'dark','1_194','table',perimeter),gun=pull(f.m,'dark','1_312','table',perimeter);f.m.cards[gun].attachedTo=dark;assert.equal(board.forfeit(f.m,trooper),board.printed(f.m,trooper,'forfeit')-1);assert.equal(board.weaponDrawBonus(f.m,gun),1);text.suppressGameText(f.m,f.site,perimeter);assert.equal(board.forfeit(f.m,trooper),board.printed(f.m,trooper,'forfeit'));assert.equal(board.weaponDrawBonus(f.m,gun),0);const rifle=pull(f.m,'light','1_153','table',f.trench);f.m.cards[rifle].attachedTo=trooper;board.moveWithAttachments(f.m,trooper,f.trench);assert.equal(board.weaponDrawBonus(f.m,rifle),1);
});
test('Echo Base Trooper deploys for one at Light Perimeter, cannot deploy elsewhere off Hoth, and loses power when moved away',()=>{
 const f=fixture(),trooper=pull(f.m,'light','3_6','hand');assert.deepEqual(board.deploymentPayment(f.m,trooper,f.lightPerimeter),{light:1});assert.equal(board.deploymentPayment(f.m,trooper,f.site),null);let m=priority(seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1),'light');const before=m.players.light.force.length;m=normal(step(m,'deploy:'+trooper+':'+f.lightPerimeter));assert.equal(before-m.players.light.force.length,1);assert.equal(board.power(m,trooper),2);board.moveWithAttachments(m,trooper,f.site);assert.equal(board.power(m,trooper),1);text.suppressGameText(m,f.lightPerimeter,trooper);assert.equal(board.power(m,trooper),2);
});
test('Mountains discounts Imperial and combat vehicle deployment, including actual Blizzard 2 payment',()=>{
 const f=fixture(),trooper=pull(f.m,'dark','1_194','hand'),walker=pull(f.m,'dark','3_155','hand');assert.deepEqual(board.deploymentPayment(f.m,trooper,f.mountains),{dark:0});let m=priority(f.m,'dark'),before=m.players.dark.force.length;assert.ok(ids(m).includes('vessel:deploy:'+walker+':'+f.mountains));m=normal(step(m,'vessel:deploy:'+walker+':'+f.mountains));assert.equal(before-m.players.dark.force.length,5);assert.equal(board.power(m,walker),6);assert.equal(combat.immuneToAttrition(m,walker,3),true);assert.equal(combat.immuneToAttrition(m,walker,4),false);text.suppressGameText(m,f.site,walker);assert.equal(combat.immuneToAttrition(m,walker,3),false);
});
test('AT-AT moves to Dark North Ridge free with zero Force, without gaining a second regular move',()=>{
 const f=fixture(),walker=pull(f.m,'dark','3_155','table',f.ice);emptyForce(f.m);let m=moving(f.m);const route=travel.vesselRoutes(m,walker).find(r=>r.path.at(-1)===f.ridge);assert.equal(route.cost,0);m=step(m,'voyage:landspeed:'+walker+':'+f.ridge);m=normal(clone(m));assert.equal(m.cards[walker].location,f.ridge);assert.ok(!ids(priority(m,'dark')).some(id=>id.startsWith('voyage:')&&id.includes(walker)));
});
for(const kind of ['character','vehicle','creature'])test('Ice Plains free regular movement and refresh: '+kind,()=>{
 const f=fixture(),id=pull(f.m,'dark',kind==='character'?'1_194':kind==='vehicle'?'3_155':'3_93','table',f.ice);emptyForce(f.m);let m=moving(f.m),before=m.players.dark.used.length;assert.ok(ids(m).includes('hoth-move:'+id+':'+f.mountains));m=step(m,'hoth-move:'+id+':'+f.mountains);m=seek(clone(m),x=>x.stack.at(-1)?.event?.kind==='moving-using-location-text');assert.equal(m.cards[id].location,f.ice);m=normal(clone(m));assert.equal(m.cards[id].location,f.mountains);assert.equal(m.players.dark.used.length,before);assert.ok(!ids(priority(m,'dark')).includes('hoth-move:'+id+':'+f.ice));
});
test('Ice Plains permission is latched, but a barred mover cannot complete its pending movement',()=>{
 for(const block of [false,true]){const f=fixture(),id=pull(f.m,'dark','1_194','table',f.ice);let m=moving(f.m);m=step(m,'hoth-move:'+id+':'+f.mountains);text.suppressGameText(m,f.site,f.ice);if(block){const {record}=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));record(m).barriers[id]=m.turn.number;}m=normal(m);assert.equal(m.cards[id].location,block?f.ice:f.mountains);}
});
test('forged Ice Plains endpoint and wrong actor are rejected from saved states',()=>{
 const f=fixture(),id=pull(f.m,'dark','1_194','table',f.ice);const m=step(moving(f.m),'hoth-move:'+id+':'+f.mountains),r=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='hoth-move:begin');r.actor='light';assert.throws(()=>runtime.prompt(m,rules,'dark'),/Invalid Hoth/);
});
test('Ice Plains carries passengers with their vehicle, but cannot move passengers independently or move a landed ship',()=>{
 const f=fixture(),walker=pull(f.m,'dark','3_155','table',f.ice),passenger=pull(f.m,'dark','1_194','table',f.ice),ship=pull(f.m,'dark','1_305','table',f.ice);f.m.cards[passenger].attachedTo=walker;f.m.cards[passenger].aboardRole='passenger';let m=moving(f.m);assert.ok(!ids(m).includes('hoth-move:'+passenger+':'+f.mountains));assert.ok(!ids(m).includes('hoth-move:'+ship+':'+f.mountains));m=normal(step(m,'hoth-move:'+walker+':'+f.mountains));assert.equal(m.cards[passenger].location,f.mountains);assert.equal(m.cards[passenger].attachedTo,walker);
});
test('Ice Plains also moves from Mountains, but not after cancellation or a prior regular move',()=>{
 for(const cancel of [false,true]){const f=fixture(),id=pull(f.m,'dark','1_194','table',f.mountains);if(cancel)text.suppressGameText(f.m,f.site,f.ice);let m=moving(f.m);assert.equal(ids(m).includes('hoth-move:'+id+':'+f.ice),!cancel);if(!cancel){m=normal(step(m,'hoth-move:'+id+':'+f.ice));assert.equal(m.cards[id].location,f.ice);assert.ok(!ids(priority(m,'dark')).some(c=>c.startsWith('move:'+id+':')));}}
});
test('North Ridge free movement belongs only to active Dark text and never grants additional landspeed',()=>{
 const f=fixture(),walker=pull(f.m,'dark','3_155','table',f.ice);assert.equal(travel.vesselRoutes(f.m,walker).find(r=>r.path.at(-1)===f.ridge).cost,0);text.suppressGameText(f.m,f.site,f.ridge);assert.equal(travel.vesselRoutes(f.m,walker).find(r=>r.path.at(-1)===f.ridge).cost,1);board.moveWithAttachments(f.m,walker,f.mountains);assert.ok(!travel.vesselRoutes(f.m,walker).some(r=>r.path.at(-1)===f.ridge));
});
test('pending location-text movement retains its selected mover after relocation and consumes the move even when stopped',()=>{
 for(const blocked of [false,true]){const f=fixture(),id=pull(f.m,'dark','1_194','table',f.ice);let m=step(moving(f.m),'hoth-move:'+id+':'+f.mountains);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='moving-using-location-text');board.moveWithAttachments(m,id,f.ridge);if(blocked)load(new URL('../../lib/native-engine/ground.ts',import.meta.url)).record(m).barriers[id]=m.turn.number;m=normal(clone(m));assert.equal(m.cards[id].location,blocked?f.ridge:f.mountains);assert.ok(load(new URL('../../lib/native-engine/ground.ts',import.meta.url)).usage(m).moved.includes(id));}
});
test('Ice Plains rejects forged endpoint and unrecorded completion stages',()=>{
 const f=fixture(),id=pull(f.m,'dark','1_194','table',f.ice),initial=step(moving(f.m),'hoth-move:'+id+':'+f.mountains);for(const mutation of [r=>{r.action.payload.to=r.action.payload.from;},r=>{r.action.handler='hoth-move:finish';}]){const m=clone(initial),r=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='hoth-move:begin');mutation(r);assert.throws(()=>runtime.prompt(m,rules,'dark'),/Invalid Hoth/);}
});
test('AT-AT shuttles from orbit to Dark North Ridge for free with zero Force',()=>{
 const f=fixture(),orbit=location(f.m,'dark','3_143'),carrier=pull(f.m,'dark','1_302','table',orbit),walker=pull(f.m,'dark','3_155','table',orbit);f.m.cards[walker].attachedTo=carrier;f.m.cards[walker].aboardRole='vehicle';emptyForce(f.m);let m=moving(f.m);const choice=prompt(m).choices.find(c=>c.label.startsWith('Shuttle Blizzard 2 to Hoth: North Ridge'));assert.ok(choice);assert.match(choice.label,/free/);m=normal(step(m,choice.id));assert.equal(m.cards[walker].location,f.ridge);assert.equal(m.cards[walker].attachedTo,undefined);assert.equal(m.players.dark.force.length,0);
});
const observed=JSON.parse((await import('node:fs')).readFileSync(new URL('./gemp/hoth-text-results.json',import.meta.url),'utf8'));
for(const row of observed)test('executed GEMP Hoth text observation '+row.case,()=>{
 const f=fixture();let actual;
 if(row.case==='modifiers'){
  const values={},trooper=pull(f.m,'light','1_28','table',f.lightPerimeter),echo=pull(f.m,'light','3_6','hand'),imperial=pull(f.m,'dark','1_194','hand'),walker=pull(f.m,'dark','3_155','hand');values.lightPerimeterDrain=board.drainAmount(f.m,'light',f.lightPerimeter);values.echoDeploy=board.deploymentPayment(f.m,echo,f.lightPerimeter).light;board.moveWithAttachments(f.m,trooper,f.mountains);values.mountainsLightDrain=board.drainAmount(f.m,'light',f.mountains);values.imperialDeploy=board.deploymentPayment(f.m,imperial,f.mountains).dark;const action=rules.actions(f.m,f.m.stack.at(-1),'dark').find(a=>a.id==='vessel:deploy:'+walker+':'+f.mountains);values.walkerDeploy=action.payment.dark;
  board.moveWithAttachments(f.m,trooper,f.ice);values.iceWithGenerator=board.drainAmount(f.m,'light',f.ice);f.m.locations=f.m.locations.filter(id=>id!==f.gen);state.moveCard(f.m,f.gen,'out');values.iceWithoutGenerator=board.drainAmount(f.m,'light',f.ice);const before=board.generation(f.m,'dark');state.moveCard(f.m,imperial,'table');f.m.cards[imperial].location=f.trench;values.trenchGenerationBonus=board.generation(f.m,'dark')-before;state.moveCard(f.m,echo,'table');f.m.cards[echo].location=f.lightPerimeter;values.echoHothPower=board.power(f.m,echo);board.moveWithAttachments(f.m,echo,f.site);values.echoAwayPower=board.power(f.m,echo);actual={case:row.case,values};
 }else if(row.case==='weapon-forfeit'){
  const perimeter=darkPerimeter(f),rebel=pull(f.m,'light','1_28','table',perimeter),imperial=pull(f.m,'dark','1_194','table',perimeter),gun=pull(f.m,'dark','1_312','table',perimeter);f.m.cards[gun].attachedTo=imperial;const rebelForfeit=board.forfeit(f.m,rebel),darkWeaponBonus=board.weaponDrawBonus(f.m,gun);board.moveWithAttachments(f.m,rebel,f.trench);const rifle=pull(f.m,'light','1_153','table',f.trench);f.m.cards[rifle].attachedTo=rebel;actual={case:row.case,rebelForfeit,darkWeaponBonus,lightWeaponBonus:board.weaponDrawBonus(f.m,rifle)};
 }else if(row.case.startsWith('move-')){
  const id=pull(f.m,'dark',{'move-trooper':'1_194','move-walker':'3_155','move-wampa':'3_93'}[row.case],'table',f.ice);let m=moving(f.m),before=m.players.dark.force.length;m=normal(step(m,'hoth-move:'+id+':'+f.mountains));actual={case:row.case,destination:m.cards[m.cards[id].location].blueprint,forceSpent:before-m.players.dark.force.length,regularMoveUsed:load(new URL('../../lib/native-engine/ground.ts',import.meta.url)).usage(m).moved.includes(id)};
 }else if(row.case==='north-ridge'){
  const walker=pull(f.m,'dark','3_155','table',f.ice),cost=travel.vesselRoutes(f.m,walker).find(r=>r.path.at(-1)===f.ridge).cost,orbit=location(f.m,'dark','3_143'),carrier=pull(f.m,'dark','1_302','table',orbit);board.moveWithAttachments(f.m,walker,orbit);f.m.cards[walker].attachedTo=carrier;f.m.cards[walker].aboardRole='vehicle';const m=moving(f.m),action=rules.actions(m,m.stack.at(-1),'dark').find(a=>a.label.startsWith('Shuttle Blizzard 2 to Hoth: North Ridge'));actual={case:row.case,cost,shuttleCost:action.payment.dark};
 }else if(row.case==='landed-TIE'){
  const ship=pull(f.m,'dark','1_305','table',f.ice);const m=moving(f.m);actual={case:row.case,legal:ids(m).includes('hoth-move:'+ship+':'+f.mountains)};
 }else if(row.case==='passenger'){
  const walker=pull(f.m,'dark','3_155','table',f.ice),passenger=pull(f.m,'dark','1_194','table',f.ice);f.m.cards[passenger].attachedTo=walker;f.m.cards[passenger].aboardRole='passenger';let m=moving(f.m);const independentMove=ids(m).includes('hoth-move:'+passenger+':'+f.mountains);m=normal(step(m,'hoth-move:'+walker+':'+f.mountains));actual={case:row.case,independentMove,carriedWithVehicle:m.cards[passenger].location===f.mountains&&m.cards[passenger].attachedTo===walker};
 }else throw Error('Uncompared oracle observation '+row.case);
 assert.deepEqual(actual,row);
});
