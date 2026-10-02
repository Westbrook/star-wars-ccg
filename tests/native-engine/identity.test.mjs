import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const module=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
const runtime=module('runtime'),state=module('state'),identity=module('identity'),board=module('board'),ground=module('ground'),combat=module('battle'),equipment=module('equipment-state'),weapons=module('weapon-state'),table=module('table');
const {premiereRules}=module('premiere-rules');
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards; the production rules still admit no full-match deck.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(){return runtime.createMatch('identity',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='dark'?['1_292','1_317','1_315','1_201','1_249','1_268','1_196','1_196']:['1_35']),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
const settle=m=>seek(m,x=>x.stack.length===1);
function fixture(hostBlueprint='1_194'){let m=fresh();const site=location(m,'light','1_129'),other=location(m,'dark','1_292'),host=pull(m,'dark',hostBlueprint,'table',site),host2=pull(m,'dark',hostBlueprint,'table',site),target=pull(m,'light','1_28','table',site);force(m,'dark',8);force(m,'light',4);return {m,site,other,host,host2,target}}
function reenter(m,id,site,host){state.moveCard(m,id,'hand');state.moveCard(m,id,'table');m.cards[id].location=site;if(host)m.cards[id].attachedTo=host;}

test('zone visits invalidate old references, while relocation and pile reordering preserve identity',()=>{
 const f=fixture(),ref=identity.referenceCard(f.m,f.host);board.moveWithAttachments(f.m,f.host,f.other);assert.equal(identity.sameCard(f.m,ref),true);reenter(f.m,f.host,f.site);assert.equal(identity.sameCard(f.m,ref),false);assert.equal(f.m.cards[f.host].id,ref.id);
 state.moveCard(f.m,f.host,'lost');const lost=identity.referenceCard(f.m,f.host);state.moveCard(f.m,f.host,'lost','bottom');assert.equal(identity.sameCard(f.m,lost),true);state.moveCard(f.m,f.host,'hand');state.moveCard(f.m,f.host,'lost');assert.equal(identity.sameCard(f.m,lost),false);state.assertState(clone(f.m));
});

test('legacy zero-instance cards gain tracked visits; identity metadata stays private',()=>{
 let m=fresh(),id=m.players.dark.reserve[0],ref=identity.referenceCard(m,id);assert.equal(ref.version,0);state.moveCard(m,id,'hand');assert.equal(identity.sameCard(m,ref),false);assert.ok(!JSON.stringify(state.publicState(m,'light')).includes('cardVersions'));assert.ok(!JSON.stringify(state.publicState(m,'dark')).includes('cardVersions'));
 for(const value of [-1,0,1.5,Number.MAX_SAFE_INTEGER+1,'2']){const bad=clone(m);bad.data.cardVersions[id]=value;assert.throws(()=>state.assertState(bad),/instance history/);}
 const bad=clone(m);bad.data.cardVersions.unknown=1;assert.throws(()=>state.assertState(bad),/instance history/);
});

for(const kind of ['blaster','device','stick'])for(const transfer of [false,true])for(const removed of ['source','host'])test(`${kind} ${transfer?'transfer':'deploy'} does not follow returned ${removed}`,()=>{
 const f=fixture(kind==='stick'?'1_196':'1_194'),bp={blaster:'1_317',device:'1_201',stick:'1_315'}[kind],card=pull(f.m,'dark',bp,transfer?'table':'hand',transfer?f.site:undefined);if(transfer)f.m.cards[card].attachedTo=f.host;
 let m=phase(f.m);const id=kind==='stick'?`gaffi:equip:${card}:${f.host2}`:kind==='device'?`${transfer?'device-transfer':'attach'}:${card}:${f.host2}`:`${transfer?'transfer':'equip'}:${card}:${f.host2}`;
 const before=m.players.dark.force.length;m=step(m,id);const attempt=m.stack.at(-2).action.payload.attachment;assert.ok(attempt);
 if(removed==='host')reenter(m,f.host2,f.site);else reenter(m,card,f.site,f.host);
 m=settle(m);assert.ok(m.players.dark.force.length<before);assert.notEqual(m.cards[card].attachedTo,f.host2);assert.equal(m.cards[card].zone,removed==='host'&&!transfer?'lost':'table');if(removed==='source')assert.equal(m.cards[card].attachedTo,f.host);
});

test('a pending attachment follows the same moving host but cannot transfer across sites',()=>{
 for(const transfer of [false,true]){const f=fixture(),card=pull(f.m,'dark','1_201',transfer?'table':'hand',transfer?f.site:undefined);if(transfer)f.m.cards[card].attachedTo=f.host;let m=phase(f.m);m=step(m,`${transfer?'device-transfer':'attach'}:${card}:${f.host2}`);board.moveWithAttachments(m,f.host2,f.other);m=settle(m);assert.equal(m.cards[card].attachedTo,transfer?f.host:f.host2);assert.equal(m.cards[card].location,transfer?f.site:f.other);}
});

test('pending regular movement cannot move a returned card and retains its paid cost',()=>{
 const f=fixture();let m=phase(f.m,'move'),before=m.players.dark.force.length;m=step(m,`move:${f.host}:${f.other}`);reenter(m,f.host,f.site);m=settle(m);assert.equal(m.cards[f.host].location,f.site);assert.equal(m.players.dark.force.length,before-1);assert.equal(ground.canMove(m,f.host),true);
});

for(const returned of [false,true])test('Barrier '+(returned?'does not retarget returned deployment':'expires when affected instance departs'),()=>{
 const f=fixture(),card=pull(f.m,'dark','1_249','hand');let m=phase(f.m);runtime.openWindow(m,'response','dark',{kind:'deployed',card:f.target});m=step(m,`barrier:${card}:${f.target}`);
 if(returned)reenter(m,f.target,f.site);m=settle(m);assert.equal(ground.barred(m,f.target),!returned);assert.equal(m.cards[card].zone,'used');if(!returned){reenter(m,f.target,f.site);assert.equal(ground.barred(m,f.target),false);}
});

test('pending identity references reject corruption and survive refresh without leaking',()=>{
 const f=fixture(),card=pull(f.m,'dark','1_201','hand');let m=step(phase(f.m),`attach:${card}:${f.host2}`);
 for(const change of [a=>a.hostRef.version++,a=>a.hostRef.id=f.host,a=>a.cardRef.zone='lost',a=>delete a.hostRef]){const bad=clone(m);change(bad.stack.at(-2).action.payload.attachment);assert.throws(()=>runtime.prompt(bad,rules,'dark'));}
 for(const side of ['dark','light']){const view=JSON.stringify(runtime.project(m,rules,side));assert.ok(!view.includes('hostRef'));assert.ok(!view.includes('cardVersions'));}
 m=settle(clone(m));assert.equal(m.cards[card].attachedTo,f.host2);
});

function lifecycle(){const f=fixture(),host=f.target,gun=pull(f.m,'light','1_152','table',f.site),device=pull(f.m,'light','1_35','table',f.site);for(const id of [gun,device])f.m.cards[id].attachedTo=host;const m=f.m,ref=identity.referenceCard(m,host);ground.record(m).moved.push(host);ground.record(m).barriers[host]=m.turn.number;m.data.battles={turn:m.turn.number,sites:['Mos Eisley'],participants:[host]};weapons.useWeapon(m,gun);equipment.useDevice(m,device);return {...f,host,gun,device,ref};}
function observe(f,name){const m=f.m;return {name,targetMatches:identity.sameCard(m,f.ref),physicalMatches:m.cards[f.host].id===f.ref.id,moved:ground.usage(m).moved.includes(f.host),battled:combat.battleHistory(m).participants.includes(f.host),barred:ground.barred(m,f.host),differentWeapon:!weapons.canUseWeapon(m,f.gun),differentDevice:!equipment.canUseDevice(m,f.device)}}
test('native lifecycle matches fresh GEMP target, movement, battle, Barrier and equipment-use observations',()=>{
 const f=lifecycle(),rows=[observe(f,'before')];for(const id of [f.gun,f.device])reenter(f.m,id,f.site,f.host);rows.push(observe(f,'equipment-return'));table.returnToHand(f.m,[f.host]);state.moveCard(f.m,f.host,'table');f.m.cards[f.host].location=f.site;for(const id of [f.gun,f.device]){state.moveCard(f.m,id,'table');f.m.cards[id].location=f.site;f.m.cards[id].attachedTo=f.host;}rows.push(observe(f,'host-return'));assert.deepEqual(rows,JSON.parse(fs.readFileSync(new URL('./gemp/identity-results.json',import.meta.url))).filter(r=>r.name!=='old-ben-return'));state.assertState(clone(f.m));premiereRules.validate(f.m);
});

test('host departure clears instance restrictions without erasing title bans or paid losses',()=>{
 const f=lifecycle(),m=f.m;ground.record(m).cancelledReactTitles=['Rebel Trooper'];ground.registerReact(m,f.host);m.data.scheduledMarker={amount:3};table.returnToHand(m,[f.host]);state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;assert.equal(ground.canMove(m,f.host),true);assert.equal(ground.canDeployAsReact(m,f.host),false);assert.deepEqual(ground.usage(m).cancelledReactTitles,['Rebel Trooper']);assert.deepEqual(m.data.scheduledMarker,{amount:3});assert.equal(equipment.equipmentState(m).devices[f.host],undefined);assert.equal(m.data.weaponUse.users[f.host],undefined);assert.equal(combat.battleHistory(m).sites[0],'Mos Eisley');
});

for(const stage of ['begin','weapons','power','damage'])test('returning instance joins only before power: '+stage,()=>{
 const f=fixture();let m=step(phase(f.m,'battle'),'battle:'+f.site);
 m=seek(m,x=>combat.battle(x).stage===stage);const b=combat.battle(m);
 b.hits.push(f.target);reenter(m,f.target,f.site);
 assert.ok(b.departed.includes(f.target));assert.ok(!b.hits.includes(f.target));
 combat.syncBattle(m);const joins=['begin','weapons'].includes(stage);
 assert.equal(combat.members(m,'light').includes(f.target),joins);
 assert.equal(combat.battleHistory(m).participants.includes(f.target),joins);
 assert.ok(!b.hits.includes(f.target),'old hit never restored');
 state.assertState(clone(m));premiereRules.validate(m);
});
test('ordinary movement away and back cannot reset battle participation history',()=>{
 const f=fixture();let m=step(phase(f.m,'battle'),'battle:'+f.site);
 board.moveWithAttachments(m,f.target,f.other);combat.syncBattle(m);
 board.moveWithAttachments(m,f.target,f.site);combat.syncBattle(m);
 assert.ok(!combat.members(m,'light').includes(f.target));
 assert.ok(combat.battleHistory(m).participants.includes(f.target));
});

test('Gaderffii weapon suppression follows the weapon instance, not its bearer or source',()=>{
 const f=lifecycle(),m=f.m;m.data.battle={stage:'weapons',participants:{dark:[],light:[f.host]},hits:[],fired:[f.gun],knockedWeapons:[f.gun],users:{},shots:[]};assert.equal(weapons.canUseWeapon(m,f.gun),false);reenter(m,f.gun,f.site,f.host);assert.deepEqual(m.data.battle.knockedWeapons,[]);assert.deepEqual(m.data.battle.fired,[]);assert.equal(weapons.canUseWeapon(m,f.gun),false,'previous different weapon still consumes bearer allowance');
});
