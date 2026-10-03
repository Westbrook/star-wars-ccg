import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
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
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';
const use=load(new URL('../../lib/native-engine/weapon-state.ts',import.meta.url));
function attach(m,side,bp,host){const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;return id;}
function fixture({initiator='dark',siteBP='1_129',armed=true,deployed=true}={}){
 let m=fresh({light:['1_129','1_130','1_132','1_152','1_152','1_153','1_28','1_28','1_28','1_40','1_153','1_153'],dark:['1_315','1_315','1_196','1_196','1_196','1_194','1_317','1_285','1_262','1_252','1_196','1_317']});const site=location(m,'light',siteBP),remote=location(m,'light','1_130');
 const host=pull(m,'dark','1_196','table',site),otherRaider=pull(m,'dark','1_196','table',remote),backup=pull(m,'dark','1_194','table',site),target=pull(m,'light','1_28','table',site),otherTarget=pull(m,'light','1_28','table',site);
 const stick=deployed?attach(m,'dark','1_315',host):pull(m,'dark','1_315','hand'),second=pull(m,'dark','1_315','hand'),gun=armed?attach(m,'light','1_152',target):pull(m,'light','1_152','hand'),otherGun=attach(m,'light','1_152',otherTarget);force(m,'dark',6);force(m,'light',6);m=phase(m,'deploy');
 if(initiator==='light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);
 return {m,site,remote,host,otherRaider,backup,target,otherTarget,stick,second,gun,otherGun};
}
const pending=m=>m.stack.at(-2);
const kind=m=>event(m)?.kind;
const start=f=>{let m=phase(f.m,'battle');return step(m,'battle:'+f.site);};
function draws(m,values){const bp={0:'1_285',1:'1_194',2:'1_196',3:'1_317',4:'1_315',5:'1_262',6:'1_252'};const picked=[];for(const v of values)if(v!==null)picked.push(pull(m,'dark',bp[v],'hand'));for(const id of [...picked].reverse())state.moveCard(m,id,'reserve');if(values.includes(null))for(const id of [...m.players.dark.reserve])if(!picked.includes(id))state.moveCard(m,id,'hand');return picked;}
function fire(f,values=[3,3]){let m=start(f);const drawn=draws(m,values);m=priority(m,'dark');return {m:step(m,'gaffi:fire:'+f.stick+':'+f.target),drawn};}
const weapons=m=>seek(m,x=>kind(x)==='battle-weapons');
const shot=m=>combat.battle(m).gaffiShots.at(-1);
const finish=m=>seek(m,x=>combat.battle(x)?.stage==='complete'&&x.stack.length===1);
for(const initiator of ['dark','light'])for(const values of [[2,2],[2,3],[3,3],[0,6],[6,null]])test('Gaderffii '+values+' after '+initiator+' initiation',()=>{
 const f=fixture({initiator});const before=f.m.players.dark.force.length;const fired=fire(f,values);let m=weapons(fired.m);assert.equal(m.players.dark.force.length,before-(initiator==='dark'?1:0));assert.equal(shot(m).total,values.reduce((n,v)=>n+(v??0),0));assert.equal(shot(m).outcome,shot(m).total>5?'knocked':'miss');assert.deepEqual(shot(m).draws.map(d=>d.value),values);assert.deepEqual(m.players.dark.used.slice(0,fired.drawn.length),[...fired.drawn].reverse());m=priority(m,'light');assert.equal(ids(m).some(x=>x.startsWith('fire:'+f.gun+':')),shot(m).total<=5);assert.ok(ids(m).some(x=>x.startsWith('fire:'+f.otherGun+':')));assert.ok(!combat.battle(m).hits.includes(f.target));assert.equal(m.cards[f.gun].zone,'table');
});
test('deployment costs two Force, accepts a non-warrior Raider, and rejects other hosts',()=>{
 const f=fixture({deployed:false});assert.equal(board.isWarrior(f.m,f.host),false);assert.ok(ids(f.m).includes('gaffi:equip:'+f.stick+':'+f.host));assert.ok(!ids(f.m).includes('gaffi:equip:'+f.stick+':'+f.backup));const before=f.m.players.dark.force.length;let m=step(f.m,'gaffi:equip:'+f.stick+':'+f.host);assert.equal(m.players.dark.force.length,before-2);assert.equal(m.cards[f.stick].zone,'playing');m=seek(m,x=>kind(x)==='deployed');assert.equal(m.cards[f.stick].attachedTo,f.host);assert.equal(m.cards[f.stick].location,f.site);
});
test('transfer costs two, requires own present Raider, and preserves physical weapon',()=>{
 const f=fixture();assert.ok(!ids(f.m).includes('gaffi:equip:'+f.stick+':'+f.otherRaider));board.moveWithAttachments(f.m,f.otherRaider,f.site);let m=step(f.m,'gaffi:equip:'+f.stick+':'+f.otherRaider);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);m=seek(m,x=>kind(x)==='weapon-transferred');assert.equal(m.cards[f.stick].attachedTo,f.otherRaider);
});
test('unaffordable deployment and wrong phase/seat cannot equip',()=>{
 const f=fixture({deployed:false});for(const id of [...f.m.players.dark.force].slice(1))state.moveCard(f.m,id,'used');assert.ok(!ids(f.m).some(x=>x.startsWith('gaffi:equip:')));let m=phase(f.m,'battle');assert.ok(!ids(m).some(x=>x.startsWith('gaffi:equip:')));
});
test('canceled deployment keeps payment spent; canceled transfer leaves attachment intact',()=>{
 let f=fixture({deployed:false}),m=step(f.m,'gaffi:equip:'+f.stick+':'+f.host);pending(m).cancelled=true;m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.stick].zone,'lost');assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);
 f=fixture();board.moveWithAttachments(f.m,f.otherRaider,f.site);m=step(f.m,'gaffi:equip:'+f.stick+':'+f.otherRaider);pending(m).cancelled=true;m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.stick].attachedTo,f.host);
});
test('unarmed, own, remote and excluded characters are not legal targets',()=>{
 const f=fixture({armed:false});let m=priority(start(f),'dark');assert.ok(!ids(m).includes('gaffi:fire:'+f.stick+':'+f.target));assert.ok(!ids(m).includes('gaffi:fire:'+f.stick+':'+f.host));combat.battle(m).departed=[f.otherTarget];assert.ok(!ids(m).some(x=>x.startsWith('gaffi:fire:')));delete combat.battle(m).departed;board.moveWithAttachments(m,f.otherTarget,f.remote);assert.ok(!ids(m).some(x=>x.startsWith('gaffi:fire:')));
});
test('empty Reserve permits initiation but ordinary weapons timing cannot fire the stick',()=>{
 const f=fixture();let m=priority(start(f),'dark');for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');assert.ok(ids(m).some(x=>x.startsWith('gaffi:fire:')));m=weapons(m);m=priority(m,'dark');assert.ok(!ids(m).some(x=>x.startsWith('gaffi:fire:')));
});
test('weapon may be attempted once per battle and character cannot switch weapons',()=>{
 const f=fixture();state.moveCard(f.m,f.second,'table');f.m.cards[f.second].attachedTo=f.host;f.m.cards[f.second].location=f.site;let m=fire(f,[2,2]).m;assert.equal(combat.battle(m).fired.includes(f.stick),true);assert.equal(use.canUseWeapon(m,f.second),false);m=seek(m,x=>pending(x)?.action?.handler==='battle:begin');m=priority(m,'dark');assert.ok(!ids(m).some(x=>x.startsWith('gaffi:fire:')));
});
test('canceled firing consumes attempt and weapon choice, draws nothing and cannot knock away',()=>{
 const f=fixture();let m=fire(f).m;pending(m).cancelled=true;m=weapons(m);assert.equal(shot(m).outcome,'canceled');assert.equal(shot(m).draws.length,0);assert.deepEqual(combat.battle(m).knockedWeapons??[],[]);assert.equal(m.data.weaponUse.users[f.host][0],f.stick);assert.ok(combat.battle(m).fired.includes(f.stick));
});
for(const siteBP of ['1_129','1_132'])test('location bonus modifies both weapon destiny draws at '+siteBP,()=>{
 const f=fixture({siteBP});const m=weapons(fire(f,[2,2]).m);assert.deepEqual(shot(m).draws.map(d=>d.value),siteBP==='1_132'?[3,3]:[2,2]);assert.equal(shot(m).outcome,siteBP==='1_132'?'knocked':'miss');
});
test('serial draw completion and Used placement precede one combined total and restriction',()=>{
 const f=fixture(),fired=fire(f);let m=seek(fired.m,x=>kind(x)==='destiny-draw-complete');assert.equal(m.cards[fired.drawn[0]].zone,'destiny');assert.equal(shot(m).draws.length,0);m=step(m,'pass');m=seek(m,x=>kind(x)==='destiny-drawn');assert.equal(m.cards[fired.drawn[0]].zone,'used');assert.equal(m.cards[fired.drawn[1]].zone,'destiny');assert.equal(shot(m).draws.length,1);m=seek(m,x=>kind(x)==='destiny-total');assert.deepEqual(event(m).draws.map(d=>d.value),[3,3]);assert.equal(event(m).total,6);assert.ok(fired.drawn.every(id=>m.cards[id].zone==='used'));assert.deepEqual(combat.battle(m).knockedWeapons??[],[]);m=seek(m,x=>kind(x)==='weapons-knocked-away');assert.deepEqual(shot(m).weapons,[f.gun]);m=seek(m,x=>kind(x)==='weapon-fired');assert.equal(event(m).weapon,f.stick);
});
test('canceled destiny does not contribute zero; the remaining successful draw supplies total',()=>{
 const f=fixture();let m=seek(fire(f,[3,3]).m,x=>kind(x)==='destiny-drawn');pending(m).cancelled=true;m=weapons(m);assert.deepEqual(shot(m).draws.map(d=>d.value),[null,3]);assert.equal(shot(m).total,3);assert.equal(shot(m).outcome,'miss');
});
test('all failed draws yield no total after Reserve emptied in firing response',()=>{
 const f=fixture();let m=fire(f).m;for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');m=weapons(m);assert.deepEqual(shot(m).draws.map(d=>d.value),[null,null]);assert.equal(shot(m).total,null);assert.equal(shot(m).outcome,'miss');
});
test('all target weapons are suppressed while devices and other characters remain usable',()=>{
 const f=fixture(),rifle=attach(f.m,'light','1_153',f.target),belt=attach(f.m,'light','1_40',f.target);let m=weapons(fire(f).m);assert.deepEqual(new Set(shot(m).weapons),new Set([f.gun,rifle]));assert.ok(!combat.battle(m).knockedWeapons.includes(belt));assert.equal(board.power(m,f.target),3);assert.equal(use.canUseWeapon(m,rifle),false);assert.equal(use.canUseWeapon(m,f.otherGun),true);
});
test('loss of source after result does not restore knocked-away weapons',()=>{
 const f=fixture();let m=seek(fire(f).m,x=>kind(x)==='weapons-knocked-away');state.moveCard(m,f.stick,'lost');m=weapons(m);assert.equal(use.canUseWeapon(m,f.gun),false);
});
test('new weapons after resolution are not in the captured restriction group',()=>{
 const f=fixture();let m=weapons(fire(f).m);const rifle=attach(m,'light','1_153',f.target);assert.equal(use.canUseWeapon(m,rifle),true);assert.equal(use.canUseWeapon(m,f.gun),false);
});
test('target departure before results cancels the target effect without moving its weapon Lost',()=>{
 const f=fixture();let m=fire(f).m;board.moveWithAttachments(m,f.target,f.remote);m=weapons(m);assert.equal(shot(m).outcome,'miss');assert.equal(shot(m).draws.length,2);assert.equal(m.cards[f.gun].zone,'table');
});
test('target weapons leaving during destiny are not knocked away at result',()=>{
 const f=fixture();let m=seek(fire(f).m,x=>kind(x)==='destiny-drawn');state.moveCard(m,f.gun,'hand');m=weapons(m);assert.equal(shot(m).total,6);assert.equal(shot(m).outcome,'miss');assert.equal(use.canUseWeapon(m,f.otherGun),true);
});
test('restriction expires at end of battle and history stays public',()=>{
 const f=fixture();let m=finish(fire(f).m);assert.equal(use.canUseWeapon(m,f.gun),true);assert.equal(combat.battle(m).gaffiShots[0].outcome,'knocked');const view=runtime.project(m,rules,'light').rules.battle;assert.deepEqual(view.knockedWeapons,[f.gun]);
});
test('turn-level weapon choice is shared with blasters and resets next turn',()=>{
 const f=fixture();const rifle=attach(f.m,'light','1_153',f.target);use.useWeapon(f.m,f.gun);assert.equal(use.canUseWeapon(f.m,rifle),false);assert.equal(use.canUseWeapon(f.m,f.gun),true);let m=weapons(start(f));m=priority(m,'light');assert.ok(ids(m).some(x=>x.startsWith('fire:'+f.gun+':')));assert.ok(!ids(m).some(x=>x.startsWith('fire:'+rifle+':')));m=finish(m);m=seek(m,x=>x.turn.number===2);assert.equal(use.canUseWeapon(m,rifle),true);
});
test('stale, foreign and fabricated targets fail atomically; corrupt saves rejected',()=>{
 const f=fixture();let m=priority(start(f),'dark'),before=clone(m);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'gaffi:fire:'+f.stick+':'+f.target}));assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision-1,choice:'gaffi:fire:'+f.stick+':'+f.target}));assert.throws(()=>step(m,'gaffi:fire:'+f.stick+':'+f.host));assert.deepEqual(m,before);
 m=fire(f).m;for(const corrupt of [x=>pending(x).action.payload.index=99,x=>x.data.weaponUse.users[f.host].push('bogus'),x=>combat.battle(x).gaffiShots[0].total=-1,x=>combat.battle(x).knockedWeapons=[f.target]]){const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.prompt(bad,rules,'dark'));}
});
test('terminal concession freezes unfinished firing and revokes all actions',()=>{const f=fixture(),m=step(fire(f).m,'concede','light');assert.equal(m.status,'finished');assert.equal(runtime.prompt(m,rules,'dark'),null);assert.equal(shot(m).draws.length,0);});

test('deployment cannot attach a weapon relocated during responses',()=>{
 const f=fixture({deployed:false});let m=step(f.m,'gaffi:equip:'+f.stick+':'+f.host);state.moveCard(m,f.stick,'hand');m=seek(m,x=>x.stack.length===1);assert.equal(m.cards[f.stick].zone,'hand');assert.equal(m.cards[f.stick].attachedTo,undefined);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);
});
test('initiated firing survives source loss and bearer movement',()=>{
 for(const departure of ['source','host']){const f=fixture();let m=fire(f).m;if(departure==='source')state.moveCard(m,f.stick,'lost');else board.moveWithAttachments(m,f.host,f.remote);m=weapons(m);assert.equal(shot(m).outcome,'knocked');assert.equal(shot(m).draws.length,2);assert.deepEqual(combat.battle(m).knockedWeapons,[f.gun]);}
});
test('printed multiple warrior icons permit distinct weapons but prohibit repeats',()=>{
 // Metadata intervention tests the general capacity rule without admitting a new card.
 const f=fixture(),rifle=attach(f.m,'light','1_153',f.target),third=attach(f.m,'light','1_153',f.target),def=board.cardDefinition(f.m,f.target),before=[...def.icons];
 try{def.icons=['Warrior','Warrior'];use.useWeapon(f.m,f.gun);assert.equal(use.canUseWeapon(f.m,f.gun),false);assert.equal(use.canUseWeapon(f.m,rifle),true);use.useWeapon(f.m,rifle);assert.equal(use.canUseWeapon(f.m,third),false);assert.throws(()=>use.useWeapon(f.m,third));}finally{def.icons=before;}
});
test('training that adds warrior does not increase different-weapon capacity',()=>{
 const f=fixture(),training=pull(f.m,'dark','1_221','table',f.site);f.m.cards[training].attachedTo=f.host;const equipment=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));equipment.recordEquipment(f.m).training[training]='warrior';state.moveCard(f.m,f.second,'table');f.m.cards[f.second].attachedTo=f.host;f.m.cards[f.second].location=f.site;assert.equal(board.isWarrior(f.m,f.host),true);use.useWeapon(f.m,f.stick);assert.equal(use.canUseWeapon(f.m,f.second),false);assert.equal(use.canUseWeapon(f.m,f.stick),true);
});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/gaderffii-results.json',import.meta.url)));
for(const reference of oracle)test('Gaderffii matches executed GEMP: '+reference.name,()=>{
 if(reference.name==='deploy'||reference.name==='transfer'){
  const f=fixture({deployed:reference.name==='transfer'});if(reference.name==='transfer')board.moveWithAttachments(f.m,f.otherRaider,f.site);const target=reference.name==='transfer'?f.otherRaider:f.host,before=f.m.players.dark.force.length;const m=seek(step(f.m,'gaffi:equip:'+f.stick+':'+target),x=>kind(x)===(reference.name==='transfer'?'weapon-transferred':'deployed'));assert.equal(m.cards[f.stick].attachedTo,target);assert.equal(before-m.players.dark.force.length,reference.forceSpent);return;
 }
 const bonus=reference.name==='location-bonus',f=fixture({initiator:reference.initiator??'dark',siteBP:bonus?'1_132':'1_129'}),rifle=attach(f.m,'light','1_153',f.target);let m=weapons(fire(f,bonus?[2,2]:reference.draws.map(n=>n<0?null:n)).m);m=priority(m,'light');assert.equal(ids(m).some(id=>id.startsWith('fire:'+f.gun+':')),reference.gunAvailable);assert.equal(ids(m).some(id=>id.startsWith('fire:'+f.otherGun+':')),reference.otherAvailable);
 if(!bonus){assert.equal(ids(m).some(id=>id.startsWith('fire:'+rifle+':')),reference.rifleAvailable);assert.equal(f.m.players.dark.force.length-m.players.dark.force.length,reference.forceSpent);assert.equal(m.cards[f.gun].zone,'table');assert.equal(reference.weaponZone,'ATTACHED');assert.deepEqual(m.players.dark.used.slice(0,reference.usedBlueprints.length).map(id=>m.cards[id].blueprint),reference.usedBlueprints);}
});


test('each stick draw has its own before window and evaluates current location modifiers',()=>{
 const f=fixture({siteBP:'1_132'});let m=seek(fire(f,[2,2]).m,x=>kind(x)==='about-to-draw-destiny');
 board.moveWithAttachments(m,f.host,f.remote);m=seek(m,x=>kind(x)==='destiny-drawn');assert.equal(m.stack.at(-2).action.payload.draw.value,2);
 m=seek(step(m,'pass'),x=>kind(x)==='about-to-draw-destiny');assert.equal(shot(m).draws.length,1);board.moveWithAttachments(m,f.host,f.site);
 m=weapons(m);assert.deepEqual(shot(m).draws.map(d=>d.value),[2,3]);assert.equal(shot(m).total,5);
});

test('shared substitution composes with serial Gaderffii draws and one combined total',()=>{
 const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));const f=fixture();let m=seek(fire(f,[2,2]).m,x=>kind(x)==='about-to-draw-destiny');const before=m.players.dark.reserve.length;
 assert.equal(destiny.substituteDestiny(m,pending(m),f.stick,4),true);m=weapons(m);assert.deepEqual(shot(m).draws.map(d=>d.value),[4,2]);assert.equal(shot(m).draws[0].card,null);assert.equal(shot(m).total,6);assert.equal(shot(m).outcome,'knocked');assert.equal(m.players.dark.reserve.length,before-1);
});

test('empty Reserve allows Gaderffii initiation but neither failed draw disables a weapon',()=>{
 const f=fixture();for(const id of [...f.m.players.dark.reserve])state.moveCard(f.m,id,'hand');
 let m=priority(start(f),'dark');const id='gaffi:fire:'+f.stick+':'+f.target;
 assert.ok(ids(m).includes(id));m=weapons(step(m,id));
 assert.equal(shot(m).total,null);assert.deepEqual(shot(m).draws.map(d=>d.value),[null,null]);assert.equal(shot(m).outcome,'miss');
 assert.equal(use.canUseWeapon(m,f.gun),true);assert.ok(combat.battle(m).fired.includes(f.stick));
});
