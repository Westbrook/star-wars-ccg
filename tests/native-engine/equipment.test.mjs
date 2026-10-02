import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const equipment=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only admission; not evidence that either complete deck is supported.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('equipment-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id});assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function deploy(m,id,host){m=priority(m,m.cards[id].owner);return settle(step(m,'attach:'+id+':'+host))}
function top(m,side,bp){const id=m.players[side].reserve.find(id=>m.cards[id].blueprint===bp);assert.ok(id,'destiny '+bp);state.moveCard(m,id,'reserve');return id}
function mine(m,side,bp,site){const id=pull(m,side,bp,'table',site);equipment.recordEquipment(m).mines[id]=1;return id}

test('utility belts are noncumulative, follow the bearer and do not consume device use',()=>{
 for(const side of ['dark','light']){let m=fresh();const bay=location(m,'light','1_124'),farm=location(m,'light','1_132'),host=pull(m,side,side==='dark'?'1_194':'1_28','table',bay),bp=side==='dark'?'1_207':'1_40',a=pull(m,side,bp,'hand'),b=pull(m,side,bp,'hand');force(m,side,3);m=phase(m,'deploy',side);const power=board.power(m,host),forfeit=board.forfeit(m,host);m=deploy(m,a,host);m=deploy(m,b,host);const bonus=side==='dark'?2:0;assert.equal(board.power(m,host),power+bonus);assert.equal(board.forfeit(m,host),forfeit+bonus);assert.deepEqual(equipment.equipmentState(m).devices,{});board.moveWithAttachments(m,host,farm);assert.equal(m.cards[a].location,farm);assert.equal(board.power(m,host),power+(side==='dark'?1:2));assert.equal(board.forfeit(m,host),forfeit+(side==='dark'?1:2));premiereRules.validate(m)}
});

test('training selects a persistent mode, grants warrior eligibility, and cannot train a droid',()=>{
 let m=fresh({light:['1_64']});const bay=location(m,'light','1_124'),jawa=pull(m,'light','1_12','table',bay),droid=pull(m,'light','1_18','table',bay),first=pull(m,'light','1_64','hand'),second=pull(m,'light','1_64','hand'),gun=pull(m,'light','1_152','hand');force(m,'light',3);m=phase(m,'deploy','light');assert.equal(board.isWarrior(m,jawa),false);assert.ok(!ids(m).includes('attach:'+first+':'+droid));assert.ok(!ids(m).includes('equip:'+gun+':'+jawa));const base=board.power(m,jawa);m=deploy(m,first,jawa);assert.equal(board.isWarrior(m,jawa),true);assert.equal(board.power(m,jawa),base);m=priority(m,'light');assert.ok(ids(m).includes('equip:'+gun+':'+jawa));m=deploy(m,second,jawa);assert.equal(board.power(m,jawa),base+1);assert.equal(equipment.equipmentState(m).training[first],'warrior');assert.equal(equipment.equipmentState(m).training[second],'power');assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('device-transfer:'+first)));
});

test('device transfer uses full cost, same-site hosts and deployment restrictions',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284'),a=pull(m,'dark','1_194','table',bay),b=pull(m,'dark','1_194','table',bay),far=pull(m,'dark','1_194','table',corridor),droid=pull(m,'dark','1_186','table',bay),belt=pull(m,'dark','1_207','hand');force(m,'dark',3);m=phase(m);m=deploy(m,belt,a);m=priority(m,'dark');assert.ok(!ids(m).includes('device-transfer:'+belt+':'+far));assert.ok(!ids(m).includes('device-transfer:'+belt+':'+droid));const before=m.players.dark.force.length;m=settle(step(m,'device-transfer:'+belt+':'+b));assert.equal(m.players.dark.force.length,before-1);assert.equal(m.cards[belt].attachedTo,b);assert.equal(board.power(m,a),board.printed(m,a,'power'));
});

test('Electrobinoculars keeps its peek private and either preserves order or moves the card to Force',()=>{
 for(const choice of ['keep','to-force']){let m=fresh();const bay=location(m,'light','1_124'),host=pull(m,'light','1_28','table',bay),bin=pull(m,'light','1_35','hand');force(m,'light',7);m=phase(m,'deploy','light');m=deploy(m,bin,host);m=priority(m,'light');const order=[...m.players.light.reserve],forceBefore=m.players.light.force.length;m=settle(step(m,'peek:'+bin));assert.equal(m.stack.at(-1).handler,'equipment:peek');assert.deepEqual(runtime.project(m,rules,'light').rules.peek.map(c=>c.id),order.slice(0,1));assert.deepEqual(runtime.project(m,rules,'dark').rules.peek,[]);assert.equal(JSON.stringify(runtime.project(m,rules,'dark')).includes('"id":"'+order[0]+'"'),false);assert.equal(m.players.light.force.length,forceBefore-2);assert.throws(()=>step(m,choice,'dark'),/Illegal choice/);m=settle(step(m,choice));assert.deepEqual(m.players.light.reserve,choice==='keep'?order:order.slice(1));if(choice==='to-force')assert.equal(m.players.light.force[0],order[0]);m=priority(m,'light');assert.ok(ids(m).includes('peek:'+bin),'same device reusable')}
});

test('one different device per bearer per turn survives transfer and resets next turn',()=>{
 let m=fresh({light:['1_35']});const bay=location(m,'light','1_124'),host=pull(m,'light','1_28','table',bay),secondHost=pull(m,'light','1_28','table',bay),first=pull(m,'light','1_35','hand'),second=pull(m,'light','1_35','hand');force(m,'light',12);m=phase(m,'deploy','light');m=deploy(m,first,host);m=deploy(m,second,host);m=priority(m,'light');m=settle(step(m,'peek:'+first));m=settle(step(m,'keep'));m=priority(m,'light');assert.ok(!ids(m).includes('peek:'+second));m=settle(step(m,'device-transfer:'+second+':'+secondHost));m=priority(m,'light');assert.ok(ids(m).includes('peek:'+second));m=settle(step(m,'device-transfer:'+second+':'+host));m=priority(m,'light');assert.ok(!ids(m).includes('peek:'+second));m=seek(m,x=>x.turn.number===3&&x.stack.at(-1)?.timing==='phase');m=priority(m,'light');assert.ok(ids(m).includes('peek:'+second));
});

test('Macroscan looks at opponent Reserve without reordering and honors nighttime conditions',()=>{
 for(const night of [false,true]){let m=fresh();const bay=location(m,'light','1_124'),macro=pull(m,'dark','1_224','hand');force(m,'dark',4);if(night)m.data.nighttimeSites=[bay];m=phase(m);m=settle(step(m,'macroscan:'+macro));m=priority(m,'dark');const order=[...m.players.light.reserve];m=settle(step(m,'peek:'+macro));assert.deepEqual(runtime.project(m,rules,'dark').rules.peek.map(c=>c.id),order.slice(0,night?3:1));assert.deepEqual(runtime.project(m,rules,'light').rules.peek,[]);assert.deepEqual(ids(m),['keep']);m=settle(step(m,'keep'));assert.deepEqual(m.players.light.reserve,order);assert.equal(m.players.dark.force.length,1)}
});

test('face-up Timer Mines wait for the next owner turn and use ordinary destiny, with private victim choices',()=>{
 for(const side of ['dark','light']){const enemy=side==='dark'?'light':'dark';let m=fresh();const bay=location(m,'light','1_124');pull(m,side,side==='dark'?'1_186':'1_18','table',bay);const id=pull(m,side,side==='dark'?'1_322':'1_162','hand'),victims=Array.from({length:3},()=>pull(m,enemy,enemy==='dark'?'1_194':'1_28','table',bay));m=phase(m,'deploy',side);const placedTurn=m.turn.number;m=settle(step(m,'mine:'+id+':'+bay));assert.equal(m.cards[id].zone,'table');const destiny=top(m,side,side==='dark'?'1_194':'1_28');m=seek(m,x=>x.turn.number===placedTurn+2&&ids(x).includes('explode:'+id));assert.equal(m.stack.at(-1).timing,'start');m=step(m,'explode:'+id);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');assert.equal(m.stack.at(-1).event.category,'timer-mine');assert.equal(m.players[side].destiny[0],destiny);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:mine-victims');assert.equal(prompt(m).side,enemy);assert.deepEqual(runtime.prompt(m,rules,side).choices,[]);assert.equal(m.players[side].used[0],destiny);m=settle(step(m,'select:'+victims[1]));m=seek(m,x=>x.cards[id].zone==='lost');assert.equal(m.cards[victims[1]].zone,'lost');assert.equal(m.cards[victims[0]].zone,'table');assert.equal(m.cards[victims[2]].zone,'table')}
});

test('zero and failed Timer Mine destiny still discard the mine without casualties',()=>{
 for(const failed of [false,true]){let m=fresh();const bay=location(m,'light','1_124'),id=mine(m,'dark','1_322',bay),host=pull(m,'light','1_28','table',bay);m=phase(m,'draw');if(failed){for(const c of [...m.players.dark.reserve])state.moveCard(m,c,'force')}else top(m,'dark','1_285');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+id));m=step(m,'explode:'+id);m=seek(m,x=>x.cards[id].zone==='lost');assert.equal(m.cards[host].zone,'table');assert.equal(m.players.dark.destiny.length,0)}
});

test('mining droids defuse friendly and enemy mines only on their own turn',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),droid=pull(m,'dark','1_186','table',bay),own=mine(m,'dark','1_322',bay),enemy=mine(m,'light','1_162',bay);force(m,'dark',2);m=phase(m,'control');assert.ok(ids(m).includes('defuse:'+droid+':'+own));assert.ok(ids(m).includes('defuse:'+droid+':'+enemy));m=settle(step(m,'defuse:'+droid+':'+enemy));assert.equal(m.cards[enemy].zone,'lost');assert.equal(m.players.dark.force.length,1);m=seek(m,x=>x.turn.number===2&&x.stack.at(-1)?.timing==='phase');m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('defuse:')));assert.equal(m.cards[own].zone,'table');
});

test('burying permits duds only at exterior planet sites and never exposes their identity to the opponent',()=>{
 let m=fresh();const desert=location(m,'light','1_130'),bay=location(m,'light','1_124'),droid=pull(m,'dark','1_186','table',desert),dud=pull(m,'dark','1_224','hand');m=phase(m);assert.ok(ids(m).includes('bury:'+dud+':'+desert));assert.ok(!ids(m).includes('bury:'+dud+':'+bay));m=settle(step(m,'bury:'+dud+':'+desert));assert.equal(m.cards[dud].zone,'buried');assert.deepEqual(runtime.project(m,rules,'dark').buried.map(c=>c.id),[dud]);assert.deepEqual(runtime.project(m,rules,'light').buried,[]);assert.equal(JSON.stringify(runtime.project(m,rules,'light')).includes('"id":"'+dud+'"'),false);assert.deepEqual(runtime.project(m,rules,'light').buriedCounts.find(c=>c.site===desert),{site:desert,count:1});assert.equal(m.cards[droid].zone,'table');
});

test('moving into a minefield reveals duds and mines; friendly tripping discards without destiny',()=>{
 for(const friendly of [false,true]){let m=fresh();const desert=location(m,'light','1_130'),farm=location(m,'light','1_132'),side=friendly?'dark':'light',walker=pull(m,side,friendly?'1_194':'1_28','table',farm),id=pull(m,'dark','1_322','buried',desert),dud=pull(m,'dark','1_224','buried',desert);force(m,side,2);top(m,'dark','1_182');m=phase(m,'move',side);m=step(m,'move:'+walker+':'+desert);m=seek(m,x=>ids(x).includes('trip-mines:'+desert));assert.equal(prompt(m).mandatory,true);m=step(m,'trip-mines:'+desert);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:trip-order');assert.equal(m.cards[dud].zone,'lost');const used=m.players.dark.used.length;m=step(m,'explode:'+id);m=seek(m,x=>x.cards[id].zone==='lost');assert.equal(m.cards[walker].zone,friendly?'table':'lost');assert.equal(m.players.dark.used.length,used+(friendly?0:1))}
});

test('a mining droid may defuse tripped mines before they explode on its own turn',()=>{
 let m=fresh();const desert=location(m,'light','1_130'),farm=location(m,'light','1_132'),droid=pull(m,'light','1_18','table',desert),walker=pull(m,'light','1_28','table',farm),id=pull(m,'dark','1_322','buried',desert);force(m,'light',2);m=phase(m,'move','light');m=step(m,'move:'+walker+':'+desert);m=seek(m,x=>ids(x).includes('trip-mines:'+desert));m=step(m,'trip-mines:'+desert);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='mines-before-explosion');assert.ok(ids(m).includes('defuse:'+droid+':'+id));m=settle(step(m,'defuse:'+droid+':'+id));assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[walker].zone,'table');assert.equal(m.players.light.force.length,0);assert.equal(m.players.dark.used.length,0);
});

test('Comlink allows repeated battle reinforcements, weapons and devices, but not Effects',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284'),bearer=pull(m,'dark','1_194','table',corridor),defender=pull(m,'dark','1_194','table',bay),attacker=pull(m,'light','1_28','table',bay),com=pull(m,'dark','1_201','hand'),a=pull(m,'dark','1_194','hand'),b=pull(m,'dark','1_194','hand'),gun=pull(m,'dark','1_317','hand'),belt=pull(m,'dark','1_207','hand'),effect=pull(m,'dark','1_221','hand'),macro=pull(m,'dark','1_224','hand');force(m,'dark',8);force(m,'light',2);m=phase(m);m=deploy(m,com,bearer);m=phase(m,'battle','light');m=step(m,'battle:'+bay);
 assert.ok(ids(m).includes('react-deploy:'+a+':'+bay+':via:'+com));assert.ok(ids(m).includes('equip:'+gun+':'+defender+':react:via:'+com));assert.ok(ids(m).includes('attach:'+belt+':'+defender+':react:via:'+com));assert.ok(!ids(m).some(id=>id.includes(effect)||id.includes(macro)));
 for(const c of [a,b]){m=priority(m,'dark');m=step(m,'react-deploy:'+c+':'+bay+':via:'+com);m=seek(m,x=>x.stack.length===3&&x.stack.at(-2)?.action?.handler==='battle:begin');assert.equal(m.cards[c].location,bay)}
 m=priority(m,'dark');m=step(m,'equip:'+gun+':'+a+':react:via:'+com);m=seek(m,x=>x.stack.length===3&&x.stack.at(-2)?.action?.handler==='battle:begin');m=priority(m,'dark');m=step(m,'attach:'+belt+':'+a+':react:via:'+com);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.deepEqual(ground.usage(m).reacted,[a,b,gun,belt]);assert.deepEqual(equipment.equipmentState(m).devices,{});assert.equal(m.cards[gun].attachedTo,a);assert.equal(m.cards[belt].attachedTo,a);assert.equal(m.cards[attacker].zone,'table');assert.equal(m.players.dark.force.length,3);
});

test('a Comlink drain react stops as soon as a reinforcing character supplies presence',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),corridor=location(m,'dark','1_284'),bearer=pull(m,'dark','1_186','table',corridor),com=pull(m,'dark','1_201','hand'),trooper=pull(m,'dark','1_194','hand');pull(m,'light','1_28','table',bay);force(m,'dark',3);m=phase(m);m=deploy(m,com,bearer);m=phase(m,'control','light');const life=state.lifeForce(m,'dark');m=step(m,'drain:'+bay);m=settle(step(m,'react-deploy:'+trooper+':'+bay+':via:'+com));assert.equal(m.cards[trooper].location,bay);assert.equal(state.lifeForce(m,'dark'),life);assert.ok(!ids(m).some(id=>id.startsWith('react-')));
});

test('CZ-3 react still obeys attachment host restrictions and forbids Effects',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),droid=pull(m,'light','1_6','table',bay),bin=pull(m,'light','1_35','hand'),belt=pull(m,'light','1_40','hand'),training=pull(m,'light','1_64','hand'),trooper=pull(m,'light','1_28','hand');pull(m,'dark','1_194','table',bay);force(m,'light',3);m=phase(m,'control');m=step(m,'drain:'+bay);assert.ok(!ids(m).some(id=>id.includes(training)||id.includes(bin)||id.includes(belt)),'no legal warrior/belt host');m=settle(step(m,'react-deploy:'+trooper+':'+bay));assert.equal(m.cards[trooper].zone,'table');assert.equal(m.cards[droid].zone,'table');
});

test('two simultaneous mines and multiple casualties expose deterministic owner ordering',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),a=mine(m,'dark','1_322',bay),b=mine(m,'dark','1_322',bay),victims=Array.from({length:4},()=>pull(m,'light','1_28','table',bay)),belt=pull(m,'light','1_40','table',bay);m.cards[belt].attachedTo=victims[2];m=phase(m,'draw');top(m,'dark','1_182');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+a));assert.ok(ids(m).includes('explode:'+b));m=step(m,'explode:'+b);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:mine-victims');assert.equal(m.stack.at(-1).payload.count,3);
 for(const i of [2,0,3])m=step(m,'select:'+victims[i]);assert.equal(m.stack.at(-1).handler,'table:lost-order');assert.equal(m.cards[victims[1]].zone,'table');assert.equal(m.cards[victims[2]].zone,'leaving');assert.equal(m.cards[belt].zone,'leaving');assert.ok(!ids(m).includes('place-lost:'+b));m=step(m,'place-lost:'+belt);m=step(m,'place-lost:'+victims[0]);m=step(m,'place-lost:'+victims[3]);m=seek(m,x=>x.cards[b].zone==='lost');assert.deepEqual(m.players.light.lost.slice(0,4),[victims[2],victims[3],victims[0],belt]);assert.equal(m.cards[a].zone,'table');m=seek(m,x=>ids(x).includes('explode:'+a));assert.ok(!ids(m).includes('explode:'+b));
});

test('location conversion carries buried cards and nighttime conditions without revealing them',()=>{
 let m=fresh();const desert=location(m,'light','1_131'),replacement=pull(m,'dark','1_292','hand'),buried=pull(m,'light','1_162','buried',desert);m.data.nighttimeSites=[desert];m=phase(m);m=settle(step(m,'site:'+replacement+':over:'+desert));assert.equal(m.cards[buried].location,replacement);assert.deepEqual(equipment.nighttimeSites(m),[replacement]);assert.deepEqual(runtime.project(m,rules,'dark').buried,[]);
});

test('arbitrary device actions are unavailable inside start, end and destiny response windows',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),host=pull(m,'light','1_28','table',bay),bin=pull(m,'light','1_35','table',bay),id=mine(m,'dark','1_322',bay);m.cards[bin].attachedTo=host;force(m,'light',5);m=runtime.startTurns(m,rules);assert.ok(!ids(m).some(id=>id.startsWith('peek:')));m=phase(m,'draw');m=seek(m,x=>x.stack.at(-1)?.timing==='end');m=priority(m,'light');assert.ok(!ids(m).includes('peek:'+bin));m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+id));m=step(m,'explode:'+id);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');assert.ok(!ids(m).includes('peek:'+bin));
});

test('continuous equipment outcomes agree with fresh pinned-GEMP component observations',()=>{
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/equipment-results.json',import.meta.url)));
 let m=fresh();const bay=location(m,'light','1_124'),tatooine=location(m,'dark','1_291'),l=pull(m,'light','1_28','table',bay),d=pull(m,'dark','1_194','table',bay);
 for(const [side,bp,host] of [['light','1_40',l],['dark','1_207',d]])for(let i=0;i<2;i++){const belt=pull(m,side,bp,'table',bay);m.cards[belt].attachedTo=host}
 for(const [branch,site] of [['death-star-belts',bay],['tatooine-belts',tatooine]]){board.moveWithAttachments(m,l,site);board.moveWithAttachments(m,d,site);assert.deepEqual({branch,lightPower:board.power(m,l),lightForfeit:board.forfeit(m,l),darkPower:board.power(m,d),darkForfeit:board.forfeit(m,d)},observed.find(r=>r.branch===branch))}
 m=fresh();const site=location(m,'light','1_124'),id=mine(m,'dark','1_322',site),victim=pull(m,'light','1_28','table',site);m=phase(m,'draw');top(m,'dark','1_285');m=seek(m,x=>x.turn.number===3&&ids(x).includes('explode:'+id));m=step(m,'explode:'+id);m=seek(m,x=>x.cards[id].zone==='lost');assert.deepEqual({branch:'zero-mine',mineLost:m.cards[id].zone==='lost',victimLost:m.cards[victim].zone==='lost'},observed.find(r=>r.branch==='zero-mine'));
});
