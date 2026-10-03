import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}


const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const revive=load(new URL('../../lib/native-engine/revival.ts',import.meta.url));
function fixture({attachments=false,talz=false}={}){
 let m=fresh({light:['1_100','1_100','1_152','1_40','1_31'],dark:['1_284',...Array(10).fill('1_194'),'1_254','1_254','1_317','1_186']});
 const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site),rebel=pull(m,'light','1_28','table',site);
 const rescuer=talz?pull(m,'light','1_31','table',site):null;
 for(let i=0;i<10;i++)pull(m,'dark','1_194','table',site);
 const ben=pull(m,'light','1_100','hand'),ben2=pull(m,'light','1_100','hand'),kintan=pull(m,'dark','1_254','hand'),kintan2=pull(m,'dark','1_254','hand');
 const deep=pull(m,'dark','1_194','lost'),nearest=pull(m,'dark','1_186','lost'),noncharacter=pull(m,'dark','1_317','lost');
 let weapon, belt;if(attachments){weapon=pull(m,'light','1_152','table',site);m.cards[weapon].attachedTo=luke;belt=pull(m,'light','1_40','table',site);m.cards[belt].attachedTo=luke;}
 force(m,'dark',5);force(m,'light',5);m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');
 return {m,site,luke,rebel,rescuer,ben,ben2,kintan,kintan2,deep,nearest,noncharacter,weapon,belt};
}
function forfeit(m,card){m=priority(m,'light');m=step(m,'forfeit:'+card);return seek(m,x=>x.stack.at(-1)?.event?.kind==='forfeited');}
function respond(m,side,id){m=priority(m,side);return step(m,id);}
function finishInterrupt(m,card){return seek(m,x=>x.cards[card].zone==='lost'&&x.stack.at(-1)?.event?.kind==='forfeited');}
const benAction=f=>'revival:old-ben:'+f.ben+':'+f.luke;
const kintanAction=f=>'revival:kintan:'+f.kintan;

test('Old Ben returns the exact forfeited character without restoring battle participation or losses',()=>{
 const f=fixture();let m=forfeit(f.m,f.luke);const paid=clone(combat.battle(m));assert.ok(paid.damage.light>0);m=respond(m,'light',benAction(f));assert.equal(m.players.light.force.length,4);assert.equal(m.cards[f.ben].zone,'playing');
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-remove-just-lost');assert.equal(m.cards[f.luke].zone,'lost');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='placed-in-play');assert.equal(m.cards[f.luke].location,f.site);assert.equal(m.cards[f.ben].zone,'playing');assert.ok(!combat.members(m,'light').includes(f.luke));
 m=finishInterrupt(m,f.ben);assert.deepEqual(combat.battle(m).damage,paid.damage);assert.deepEqual(combat.battle(m).attrition,paid.attrition);assert.ok(!revive.revivalActions(m,m.stack.at(-1),'light').length);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');m=priority(m,'light');assert.ok(!ids(m).includes('forfeit:'+f.luke));assert.ok(ids(m).includes('forfeit:'+f.rebel));
});

test('Old Ben preserves paid forfeit bonuses, loses attachments and clears the former hit',()=>{
 const f=fixture({attachments:true});let m=priority(f.m,'light');combat.battle(m).hits.push(f.luke);const before=clone(combat.battle(m));m=step(m,'forfeit:'+f.luke);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.ok([f.luke,f.weapon,f.belt].every(id=>m.cards[id].zone==='leaving'));
 m=step(m,'place-lost:'+f.luke);m=step(m,'place-lost:'+f.weapon);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='forfeited');assert.equal(m.players.light.lost[0],f.belt);assert.equal(combat.battle(m).damage.light,Math.max(0,before.damage.light-7));
 m=respond(m,'light',benAction(f));m=finishInterrupt(m,f.ben);assert.equal(m.cards[f.luke].zone,'table');assert.equal(m.cards[f.weapon].zone,'lost');assert.equal(m.cards[f.belt].zone,'lost');assert.equal(m.cards[f.luke].attachedTo,undefined);assert.ok(!combat.battle(m).hits.includes(f.luke));assert.ok(!combat.members(m,'light').includes(f.luke));
});

test('canceling Old Ben retains its cost and forfeiture; another copy may respond',()=>{
 const f=fixture();let m=respond(forfeit(f.m,f.luke),'light',benAction(f));m.stack.at(-2).cancelled=true;m=finishInterrupt(m,f.ben);assert.equal(m.cards[f.luke].zone,'lost');assert.equal(m.players.light.force.length,4);m=priority(m,'light');assert.ok(ids(m).includes('revival:old-ben:'+f.ben2+':'+f.luke));
});

test('Old Ben cannot substitute another lost copy and placement can be prevented',()=>{
 for(const mode of ['removed','prevented']){const f=fixture();let m=respond(forfeit(f.m,f.luke),'light',benAction(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-remove-just-lost');if(mode==='removed')state.moveCard(m,f.luke,'hand');else m.stack.at(-2).cancelled=true;m=finishInterrupt(m,f.ben);assert.equal(m.cards[f.luke].zone,mode==='removed'?'hand':'lost');assert.equal(m.players.light.force.length,4);}
});

test('Old Ben is restricted to your forfeited character at Tatooine and affordable immediate responses',()=>{
 const f=fixture();let m=forfeit(f.m,f.luke),w=m.stack.at(-1);for(const e of [{kind:'character-lost',card:f.luke,site:f.site},{kind:'force-lost',card:f.luke,site:f.site},{kind:'forfeited',card:f.nearest,site:f.site}])assert.equal(revive.revivalActions(m,{...w,event:e},'light').length,0);
 const deathStar=location(m,'dark','1_284');assert.equal(revive.revivalActions(m,{...w,event:{kind:'forfeited',card:f.luke,site:deathStar}},'light').length,0);assert.equal(revive.revivalActions(m,{...w,timing:'phase'},'light').length,0);
 for(const id of [...m.players.light.force])state.moveCard(m,id,'used');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('revival:old-ben')));
});

test('Kintan retrieves only the nearest-to-top character into hand and preserves remaining Lost order',()=>{
 const f=fixture();let m=respond(forfeit(f.m,f.luke),'dark',kintanAction(f));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-retrieve');assert.equal(m.stack.at(-1).event.card,f.nearest);assert.equal(m.cards[f.kintan].zone,'playing');assert.equal(m.players.dark.force.length,3);m=finishInterrupt(m,f.kintan);assert.equal(m.cards[f.nearest].zone,'hand');assert.deepEqual(m.players.dark.lost,[f.kintan,f.noncharacter,f.deep]);assert.equal(m.cards[f.luke].zone,'lost');
});

test('Kintan ignores units of Force and friendly losses, but accepts simultaneous table losses',()=>{
 const f=fixture();const m=forfeit(f.m,f.luke),w=m.stack.at(-1);for(const e of [{kind:'force-lost',card:f.luke},{kind:'character-lost',card:f.nearest},{kind:'deployed',card:f.luke}])assert.equal(revive.revivalActions(m,{...w,event:e},'dark').length,0);
 for(const e of [{kind:'character-lost',card:f.luke},{kind:'cards-lost',cards:[f.luke,f.noncharacter]}])assert.equal(revive.revivalActions(m,{...w,event:e},'dark').length,2);
});

test('Kintan can search a nonempty Lost pile with no character but cannot search an empty pile',()=>{
 const f=fixture();let m=forfeit(f.m,f.luke);state.moveCard(m,f.deep,'hand');state.moveCard(m,f.nearest,'hand');assert.ok(ids(m).includes(kintanAction(f)));m=step(m,kintanAction(f));m=finishInterrupt(m,f.kintan);assert.deepEqual(m.players.dark.lost,[f.kintan,f.noncharacter]);
 const g=fixture();m=forfeit(g.m,g.luke);for(const id of [...m.players.dark.lost])state.moveCard(m,id,'hand');assert.ok(!ids(m).includes(kintanAction(g)));
});

test('Kintan chooses its topmost character on resolution and cancellation does not retrieve',()=>{
 for(const cancel of [false,true]){const f=fixture();let m=respond(forfeit(f.m,f.luke),'dark',kintanAction(f));if(cancel)m.stack.at(-2).cancelled=true;else state.moveCard(m,f.deep,'lost');m=finishInterrupt(m,f.kintan);assert.equal(m.cards[f.deep].zone,cancel?'lost':'hand');assert.equal(m.cards[f.nearest].zone,'lost');assert.equal(m.players.dark.force.length,3);}
});

test('Old Ben removing the just-lost opponent closes Kintan eligibility',()=>{
 const f=fixture();let m=respond(forfeit(f.m,f.luke),'light',benAction(f));m=finishInterrupt(m,f.ben);assert.ok(!revive.revivalActions(m,m.stack.at(-1),'dark').length);
});

test('revival commands reject stale, opposing and forged targets without mutation',()=>{
 const f=fixture();let m=priority(forfeit(f.m,f.luke),'light'),before=clone(m);assert.throws(()=>step(m,benAction(f),'dark'),/Illegal/);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:benAction(f)}),/Stale/);assert.deepEqual(m,before);
 m=step(m,benAction(f));for(const change of [p=>p.target=f.nearest,p=>p.site=f.nearest,p=>p.card=f.kintan]){const bad=clone(m);change(bad.stack.at(-2).action.payload);assert.throws(()=>prompt(bad),/Invalid revival/);}
});


test('failed Kintan search disables other copies this turn and expires on the next turn',()=>{
 const f=fixture();let m=forfeit(f.m,f.luke);for(const id of [f.nearest,f.deep])state.moveCard(m,id,'hand');m=step(m,kintanAction(f));m=finishInterrupt(m,f.kintan);state.moveCard(m,f.deep,'lost');assert.equal(retrieval.canSearchLostCharacter(m,'dark'),false);assert.ok(!revive.revivalActions(m,m.stack.at(-1),'dark').length);
 const w=clone(m.stack.at(-1));m=seek(m,x=>x.turn.number===2);assert.ok(revive.revivalActions(m,w,'dark').some(a=>a.id==='revival:kintan:'+f.kintan2));
});

test('revival during Talz forfeiture cost does not interfere with rescuing the hit character',()=>{
 const f=fixture({talz:true});let m=priority(f.m,'light');combat.battle(m).hits.push(f.luke);m=step(m,'rescue:'+f.rescuer+':'+f.luke);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='forfeited');const paid=clone(combat.battle(m));assert.ok(combat.battle(m).hits.includes(f.luke));
 m=respond(m,'light','revival:old-ben:'+f.ben+':'+f.rescuer);m=finishInterrupt(m,f.ben);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-damage');assert.equal(m.cards[f.rescuer].zone,'table');assert.ok(!combat.members(m,'light').includes(f.rescuer));assert.ok(combat.members(m,'light').includes(f.luke));assert.ok(!combat.battle(m).hits.includes(f.luke));assert.deepEqual(combat.battle(m).damage,paid.damage);
});

test('revived character stays out of current battle but has no old-instance battle history',()=>{
 const f=fixture();let m=respond(forfeit(f.m,f.luke),'light',benAction(f));m=finishInterrupt(m,f.ben);m=seek(m,x=>x.turn.phase==='move'&&x.stack.length===1);assert.equal(m.cards[f.luke].zone,'table');assert.ok(!combat.battleHistory(m).participants.includes(f.luke));assert.equal(combat.battle(m).stage,'complete');
 assert.deepEqual({name:'old-ben-return',battled:combat.battleHistory(m).participants.includes(f.luke),participating:combat.members(m,'light').includes(f.luke)},JSON.parse(fs.readFileSync(new URL('./gemp/identity-results.json',import.meta.url))).find(r=>r.name==='old-ben-return'));
 m=seek(m,x=>x.turn.number===2&&x.turn.phase==='battle'&&x.stack.length===1);m=step(m,'battle:'+f.site);assert.ok(combat.members(m,'light').includes(f.luke));assert.ok(!combat.battle(m).hits.includes(f.luke));
});

test('hit losses on premature battle ending allow Kintan but never Old Ben',()=>{
 const f=fixture();let m=f.m,b=combat.battle(m);b.stage='power';b.hits.push(f.luke);for(const id of b.participants.dark)state.moveCard(m,id,'hand');
 m.stack=m.stack.slice(0,1);m.stack.push({kind:'resolution',actor:'dark',cancelled:false,action:{id:'damage',label:'Damage',handler:'battle:damage',payload:{}}});runtime.openWindow(m,'response','dark',{kind:'battle-result'});
 assert.ok(ids(m).includes('battle-premature-end'));m=step(m,'battle-premature-end');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='cards-lost');assert.equal(m.stack.at(-1).event.kind,'cards-lost');assert.equal(m.cards[f.luke].zone,'lost');assert.ok(!revive.revivalActions(m,m.stack.at(-1),'light').length);m=respond(m,'dark',kintanAction(f));m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.nearest].zone,'hand');assert.equal(combat.battle(m).stage,'complete');assert.deepEqual(combat.battle(m).damage,{dark:0,light:0});
});

test('a Timer Mine casualty enables Kintan before the mine is discarded',()=>{
 const eq=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));let m=fresh({dark:['1_254','1_322','1_186','1_194'],light:['1_100']});
 const site=location(m,'light','1_129'),mine=pull(m,'dark','1_322','table',site),victim=pull(m,'light','1_28','table',site),card=pull(m,'dark','1_254','hand'),target=pull(m,'dark','1_186','lost');pull(m,'light','1_100','hand');eq.recordEquipment(m).mines[mine]=1;force(m,'dark',4);m=phase(m,'draw');topDestiny(m,'dark','1_194');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+mine));m=step(m,'explode:'+mine);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='cards-lost'&&x.cards[victim].zone==='lost');assert.equal(m.cards[mine].zone,'table');assert.ok(!revive.revivalActions(m,m.stack.at(-1),'light').length);m=respond(m,'dark','revival:kintan:'+card);m=seek(m,x=>x.cards[card].zone==='lost'&&x.cards[mine].zone==='lost');assert.equal(m.cards[target].zone,'hand');
});


test('native revival and nearest-character retrieval match all four executed GEMP outcomes',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/revival-results.json',import.meta.url)));assert.equal(oracle.length,4);
 for(const attachments of [false,true]){
  const f=fixture({attachments});let m=forfeit(f.m,f.luke),before=m.players.light.force.length;m=respond(m,'light',benAction(f));m=finishInterrupt(m,f.ben);
  assert.deepEqual({name:attachments?'old-ben-attachments':'old-ben',returned:m.cards[f.luke].zone==='table'&&m.cards[f.luke].location===f.site,participating:combat.members(m,'light').includes(f.luke),damage:combat.battle(m).damage.light,forceSpent:before-m.players.light.force.length,attachmentsLost:attachments&&m.cards[f.weapon].zone==='lost'&&m.cards[f.belt].zone==='lost',interruptLost:m.cards[f.ben].zone==='lost'},oracle.find(o=>o.name===(attachments?'old-ben-attachments':'old-ben')));
 }
 for(const found of [true,false]){
  const f=fixture();let m=forfeit(f.m,f.luke);if(!found)for(const id of [f.deep,f.nearest])state.moveCard(m,id,'hand');const before=m.players.dark.force.length;m=step(m,kintanAction(f));m=finishInterrupt(m,f.kintan);
  assert.deepEqual({name:found?'kintan-character':'kintan-no-character',retrieved:found&&m.cards[f.nearest].zone==='hand'?1:0,searchAllowed:retrieval.canSearchLostCharacter(m,'dark'),deepStillLost:m.cards[f.deep].zone==='lost',noncharacterLost:m.cards[f.noncharacter].zone==='lost',forceSpent:before-m.players.dark.force.length,interruptLost:m.cards[f.kintan].zone==='lost'},oracle.find(o=>o.name===(found?'kintan-character':'kintan-no-character')));
 }
});

for(const boundary of ['initiation','about-to-remove-just-lost'])test('Old Ben cannot use an expired Lost Pile visit at '+boundary,()=>{
 const f=fixture();let m=respond(forfeit(f.m,f.luke),'light',benAction(f));if(boundary!=='initiation')m=seek(m,x=>x.stack.at(-1)?.event?.kind===boundary);state.moveCard(m,f.luke,'hand');state.moveCard(m,f.luke,'lost');m=finishInterrupt(m,f.ben);assert.equal(m.cards[f.luke].zone,'lost');assert.ok(!combat.members(m,'light').includes(f.luke));
});

for(const side of ['light','dark'])test('projected computer plays the legal recovery response to a real forfeiture: '+side,()=>{
 const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
 const f=fixture();let m=priority(forfeit(f.m,f.luke),side);const view=runtime.project(m,rules,side),before=clone(view),choice=chooseComputerAction(view,side);
 assert.ok(ids(m).includes(choice));assert.ok(choice.startsWith(side==='light'?'revival:old-ben:':'revival:kintan:'));assert.deepEqual(view,before);
 const interrupt=choice.split(':')[2];m=step(m,choice);m=finishInterrupt(m,interrupt);
 if(side==='light'){assert.equal(m.cards[f.luke].zone,'table');assert.equal(m.cards[f.luke].location,f.site);}else assert.equal(m.cards[f.nearest].zone,'hand');
});
