import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const travel=load(new URL('../../lib/native-engine/travel.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only admission; not evidence that either complete deck is supported.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('travel-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}

const oracle=JSON.parse(fs.readFileSync(new URL('../native-proof/gemp/location-oracle-result.json',import.meta.url)));
function transit(m,from,to,party){m=step(m,'transit:'+from+':'+to);for(const id of party)m=step(m,'toggle:'+id);return step(m,'confirm')}
function search(m,room,card,placement){m=priority(m,'dark');m=settle(step(m,'search:'+room));m=step(m,'take:'+card);m=step(m,'place:'+placement);return settle(m)}
function repeatable(m,room){return ids(priority(m,'dark')).includes('search:'+room)}

test('docking transit selects a party before payment, can cancel, and ignores opposing hand choices',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),to=location(m,'dark','1_291'),a=pull(m,'dark','1_194','table',bay),b=pull(m,'dark','1_186','table',bay),guard=pull(m,'dark','1_181','table',bay),blocked=pull(m,'dark','1_194','table',bay);force(m,'dark',2);m=phase(m,'move');ground.record(m).barriers[blocked]=m.turn.number;const before=clone(m.players.dark);m=step(m,'transit:'+bay+':'+to);assert.ok(!ids(m).includes('confirm'));assert.ok(!ids(m).includes('toggle:'+guard));assert.ok(!ids(m).includes('toggle:'+blocked));assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);m=step(m,'toggle:'+a);m=step(m,'toggle:'+b);m=step(m,'cancel');assert.deepEqual(m.players.dark,before);assert.equal(m.cards[a].location,bay);assert.deepEqual(ground.usage(m).moved,[]);assert.equal(prompt(m).side,'dark');
});

test('paid and free docking groups match recorded GEMP outcomes and consume each regular move',()=>{
 for(const free of [false,true]){let m=fresh();const bay=location(m,free?'dark':'light',free?'1_285':'1_124'),to=location(m,'dark','1_291'),a=pull(m,'dark','1_194','table',bay),b=pull(m,'dark','1_194','table',bay),guard=pull(m,'dark','1_181','table',bay),gun=pull(m,'dark','1_317','table',bay);m.cards[gun].attachedTo=a;force(m,'dark',2);m=phase(m,'move');const initial=m.players.dark.force.length;m=transit(m,bay,to,[a,b]);assert.equal(m.players.dark.force.length,initial-(free?0:1));assert.equal(m.cards[a].location,bay,'responses precede arrival');m=settle(m);assert.equal(m.cards[a].location,to);assert.equal(m.cards[b].location,to);assert.equal(m.cards[gun].location,to);assert.deepEqual(ground.usage(m).moved,[a,b]);assert.ok(!ids(priority(m,'dark')).includes('transit:'+to+':'+bay));assert.deepEqual({name:free?'free-group':'paid-group',moved:2,cost:initial-m.players.dark.force.length,guardsStayed:m.cards[guard].location===bay},oracle.find(r=>r.name===(free?'free-group':'paid-group')))}
});

test('all docking-bay departure costs apply to both sides, including free travel without Force',()=>{
 for(const [bp,costs] of Object.entries(travel.bayCosts))for(const side of ['dark','light']){const owner=['1_124','1_129','3_59'].includes(bp)?'light':'dark';let m=fresh({[owner]:[bp]});const bay=location(m,owner,bp),target=location(m,'dark',bp.includes('285')||bp.includes('124')?'1_291':'1_285'),trooper=pull(m,side,side==='dark'?'1_194':'1_28','table',bay);force(m,side,costs[side]);m=phase(m,'move',side);const before=m.players[side].force.length;m=settle(transit(m,bay,target,[trooper]));assert.equal(m.players[side].force.length,before-costs[side]);assert.equal(m.cards[trooper].location,target)}
});

test('a group arrival trips a buried mine once after all party members arrive',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),to=location(m,'dark','1_291'),a=pull(m,'dark','1_194','table',bay),b=pull(m,'dark','1_194','table',bay),mine=pull(m,'light','1_162','buried',to);force(m,'dark',1);m=phase(m,'move');m=transit(m,bay,to,[a,b]);m=seek(m,x=>ids(x).includes('trip-mines:'+to));assert.equal(m.cards[a].location,to);assert.equal(m.cards[b].location,to);assert.deepEqual(ids(m),['trip-mines:'+to]);m=step(m,'trip-mines:'+to);m=seek(m,x=>x.stack.at(-1)?.handler==='equipment:trip-order');assert.equal(m.cards[mine].zone,'table');
});

test('Reserve searches privately select a legal bay, shuffle and permit another success',()=>{
 for(const conversion of [false,true]){let m=fresh();const room=location(m,'dark','101_4');pull(m,'dark','1_194','table',room);const bay=conversion?location(m,'light','1_124'):null,card=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_285');m=phase(m);const before=[...m.players.dark.reserve];m=settle(step(m,'search:'+room));assert.equal(m.stack.at(-1).handler,'travel:search');assert.ok(ids(m).includes('take:'+card));assert.deepEqual(runtime.project(m,rules,'light').rules.searchCards,[]);assert.deepEqual(runtime.project(m,rules,'dark').rules.searchCards.map(c=>c.id),[...before].sort());m=step(m,'take:'+card);const placement=conversion?'over:'+bay:board.sitePlacements(m,card)[0].id;m=step(m,'place:'+placement);assert.equal(m.cards[card].zone,'playing');assert.deepEqual(runtime.project(m,rules,'dark').rules.searchCards,[]);m=settle(m);assert.equal(m.cards[card].zone,'table');assert.equal(travel.travelState(m).shuffles,1);assert.notDeepEqual(m.players.dark.reserve,before.filter(id=>id!==card));assert.equal(m.players.dark.reserve.length,before.length-1);assert.deepEqual({name:conversion?'search-convert':'search-new',removedFromReserve:1,repeatAllowed:repeatable(m,room)},oracle.find(r=>r.name===(conversion?'search-convert':'search-new')));if(conversion)assert.equal(m.cards[bay].coveredBy,card)}
});

test('a failed search allows verification without deck order and disables that function for this turn',()=>{
 let m=fresh();const room=location(m,'dark','101_4');pull(m,'dark','1_194','table',room);for(const id of [...m.players.dark.reserve])if(travel.bayCosts[m.cards[id].blueprint])state.moveCard(m,id,'hand');m=phase(m);m=settle(step(m,'search:'+room));assert.deepEqual(ids(m),['not-found']);m=step(m,'not-found');assert.equal(prompt(m).side,'light');const ordered=[...m.players.dark.reserve].sort();for(const seat of ['light','dark'])assert.deepEqual(runtime.project(m,rules,seat).rules.searchCards.map(c=>c.id),ordered);m=settle(step(m,'verified'));assert.deepEqual({name:'search-failed',repeatAllowed:repeatable(m,room),verifiedByBoth:true},oracle.find(r=>r.name==='search-failed'));const card=m.players.dark.hand.find(id=>travel.bayCosts[m.cards[id].blueprint]);state.moveCard(m,card,'reserve');assert.equal(repeatable(m,room),false);m=seek(m,x=>x.turn.number===3&&x.turn.phase==='deploy'&&x.stack.length===1);assert.equal(repeatable(m,room),true);
});

test('search requires control, deploy timing and a nonempty Reserve, without leaking candidate existence',()=>{
 let m=fresh();const room=location(m,'dark','101_4'),dark=pull(m,'dark','1_194','table',room),light=pull(m,'light','1_28','table',room);m=phase(m);assert.ok(!ids(m).includes('search:'+room));state.moveCard(m,light,'lost');assert.ok(ids(m).includes('search:'+room));state.moveCard(m,dark,'lost');assert.ok(!ids(m).includes('search:'+room));
});

test('shuffle failure rolls back deployment, selection, counters and pending responses atomically',()=>{
 let m=fresh();const room=location(m,'dark','101_4');pull(m,'dark','1_194','table',room);m=phase(m);m=settle(step(m,'search:'+room));m=step(m,ids(m)[0]);m=step(m,ids(m)[0]);m=step(m,'pass');const before=clone(m);assert.throws(()=>runtime.applyCommand(m,rules,prompt(m).side,{revision:m.revision,choice:'pass'},()=>{throw Error('entropy unavailable')}),/entropy unavailable/);assert.deepEqual(m,before);m=step(m,'pass');assert.equal(travel.travelState(m).shuffles,1);
});

function battleBoard({lukeAtBattle=false,vader=false,forceCount=4,guard=false,center=false}={}){let m=fresh();const site=location(m,'light',center?'1_132':'1_129'),near=location(m,'light',center?'1_129':'1_132'),luke=pull(m,'light','101_2','table',lukeAtBattle?site:near),rebel=pull(m,'light','1_28','table',site);pull(m,'dark','1_194','table',site);const run=pull(m,'light','101_3','hand'),escape=pull(m,'light','1_98','hand'),extra=pull(m,'light','1_28','hand');const immobile=guard?pull(m,'light','1_26','table',site):null;const darkLord=vader?pull(m,'dark','101_5','table',near):null;force(m,'dark',3);force(m,'light',forceCount);return {m,site,near,luke,rebel,run,escape,extra,immobile,darkLord}}
function initiate(m,site,side='dark'){m=phase(m,'battle',side);return step(m,'battle:'+site)}
const weaponWindow=m=>m.stack.at(-1)?.event?.kind==='battle-weapons';

test('Run Luke enters either player’s battle for free, updates participants and grants a noncumulative bonus',()=>{
 for(const side of ['dark','light']){let {m,site,near,luke,run}=battleBoard({forceCount:0});if(side==='light')force(m,'light',1);const base=board.power(m,luke);m=initiate(m,site,side);m=priority(m,'light');assert.ok(ids(m).includes('run-luke:'+run+':'+luke));m=step(m,'run-luke:'+run+':'+luke);assert.equal(m.cards[run].zone,'playing');m=seek(m,weaponWindow);assert.equal(m.cards[luke].location,site);assert.ok(combat.members(m,'light').includes(luke));assert.equal(board.power(m,luke),base+2);assert.equal(m.players.light.force.length,0);assert.deepEqual(ground.usage(m).moved,[luke]);assert.equal(m.cards[run].zone,'lost');assert.equal(travel.travelState(m).runPlayed,true);m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(board.power(m,luke),base);assert.notEqual(site,near)}
});

test('Vader presence or adjacency suppresses Run Luke’s bonus dynamically',()=>{
 let {m,site,near,luke,run,darkLord}=battleBoard({vader:true});const base=board.power(m,luke);m=initiate(m,site);m=seek(step(m,'run-luke:'+run+':'+luke),weaponWindow);assert.equal(board.power(m,luke),base);state.moveCard(m,darkLord,'lost');assert.equal(board.power(m,luke),base+2);assert.equal(m.cards[luke].location,site);assert.notEqual(site,near);
});

test('Run Luke respects Barrier, previous regular movement, previous battle and initiation timing',()=>{
 for(const restriction of ['barrier','moved','battle']){let {m,site,luke,run}=battleBoard();m=phase(m,'battle');if(restriction==='barrier')ground.record(m).barriers[luke]=m.turn.number;else if(restriction==='moved')ground.record(m).moved.push(luke);else m.data.battles={turn:m.turn.number,sites:[],participants:[luke]};m=step(m,'battle:'+site);assert.ok(!ids(m).includes('run-luke:'+run+':'+luke));m=seek(m,weaponWindow);m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('run-luke:')))}
});

test('Narrow Escape attempts all movable cards, pays each move, leaves guards and droids, and may split destinations',()=>{
 let {m,site,near,luke,rebel,escape,immobile}=battleBoard({lukeAtBattle:true,guard:true,center:true});const farther=location(m,'light','1_130');m.locations=[near,site,farther];const droid=pull(m,'light','1_6','table',site);m=initiate(m,site);m=settle(step(m,'escape:'+escape));assert.equal(m.stack.at(-1).handler,'travel:escape');assert.ok(!ids(m).some(id=>id.includes(immobile)||id.includes(droid)));m=step(m,'away:'+rebel+':'+near);m=settle(m);assert.equal(m.cards[rebel].location,near);assert.equal(m.cards[luke].location,site);m=step(m,'away:'+luke+':'+farther);m=seek(m,weaponWindow);assert.equal(m.cards[luke].location,farther);assert.equal(m.cards[immobile].location,site);assert.equal(m.cards[droid].location,site);assert.equal(m.cards[escape].zone,'used');assert.equal(m.players.light.force.length,2);assert.deepEqual(ground.usage(m).moved,[rebel,luke]);assert.deepEqual(combat.members(m,'light').sort(),[immobile,droid].sort());
});

test('Narrow Escape is legal without enough Force and moves as many cards as can pay',()=>{
 for(const amount of [0,1,2]){let {m,site,luke,rebel,escape}=battleBoard({lukeAtBattle:true,forceCount:amount});m=initiate(m,site);assert.ok(ids(m).includes('escape:'+escape));m=step(m,'escape:'+escape);m=seek(m,x=>x.cards[escape].zone==='used');assert.equal([luke,rebel].filter(id=>m.cards[id].location!==site).length,amount);assert.equal(m.players.light.force.length,0);if(amount===2){m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(combat.battle(m).premature,true)}else {m=seek(m,weaponWindow);assert.equal(combat.battle(m).premature,false)}}
});

test('Mos Eisley and Docking Bay 94 stay together when deploying or searching for sites',()=>{
 const m=fresh(),bay=location(m,'light','1_129'),mos=location(m,'dark','1_295'),desert=pull(m,'light','1_130','hand');assert.deepEqual(board.sitePlacements(m,desert).map(p=>p.id),['at:2']);state.moveCard(m,desert,'table');m.locations=[bay,desert,mos];assert.throws(()=>premiereRules.validate(m),/Mos Eisley/);m.locations=[bay,mos,desert];premiereRules.validate(m);
});

test('canceling an initiated transit preserves its paid cost but leaves party and regular moves unchanged',()=>{
 let m=fresh();const bay=location(m,'light','1_124'),to=location(m,'dark','1_291'),trooper=pull(m,'dark','1_194','table',bay);force(m,'dark',2);m=phase(m,'move');m=transit(m,bay,to,[trooper]);const pending=m.stack.at(-2);assert.equal(pending.action.handler,'travel:transit');pending.cancelled=true;m=settle(m);assert.equal(m.players.dark.force.length,1);assert.equal(m.cards[trooper].location,bay);assert.deepEqual(ground.usage(m).moved,[]);
});

test('canceling Run Luke discards the Interrupt without movement or bonus',()=>{
 let {m,site,near,luke,run}=battleBoard();const base=board.power(m,luke);m=initiate(m,site);m=step(m,'run-luke:'+run+':'+luke);const pending=m.stack.at(-2);assert.equal(pending.action.handler,'travel:run');pending.cancelled=true;m=seek(m,weaponWindow);assert.equal(m.cards[run].zone,'lost');assert.equal(m.cards[luke].location,near);assert.equal(board.power(m,luke),base);assert.deepEqual(ground.usage(m).moved,[]);assert.equal(travel.travelState(m).runPlayed,true);
});

test('Run Luke followed by Narrow Escape cannot give Luke a second regular move',()=>{
 let {m,site,near,luke,rebel,run,escape}=battleBoard();m=initiate(m,site);m=step(m,'run-luke:'+run+':'+luke);m=seek(m,x=>x.stack.length===3&&x.stack.at(-2)?.action?.handler==='battle:begin');m=priority(m,'light');m=settle(step(m,'escape:'+escape));assert.ok(!ids(m).some(id=>id.startsWith('away:'+luke+':')));assert.ok(ids(m).includes('away:'+rebel+':'+near));m=step(m,'away:'+rebel+':'+near);m=seek(m,weaponWindow);assert.equal(m.cards[luke].location,site);assert.equal(m.cards[rebel].location,near);assert.equal(combat.participatingAbility(m,'light'),board.printed(m,luke,'ability'));
});

test('native battle movement agrees with all five fresh GEMP observations',()=>{
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/travel-results.json',import.meta.url)));
 for(const vader of [false,true]){let {m,site,luke,run}=battleBoard({vader});const base=board.power(m,luke),before=m.players.light.force.length;m=initiate(m,site);m=seek(step(m,'run-luke:'+run+':'+luke),weaponWindow);const name=vader?'run-vader':'run-clear';assert.deepEqual({name,bonus:board.power(m,luke)-base,cost:before-m.players.light.force.length,moved:m.cards[luke].location===site,interruptLost:m.cards[run].zone==='lost'},observed.find(r=>r.name===name))}
 for(const amount of [0,1,2]){let {m,site,luke,rebel,escape}=battleBoard({lukeAtBattle:true,forceCount:amount});m=initiate(m,site);m=step(m,'escape:'+escape);m=seek(m,x=>x.cards[escape].zone==='used');const name='escape-'+amount;assert.deepEqual({name,moved:[luke,rebel].filter(id=>m.cards[id].location!==site).length,remainingForce:m.players.light.force.length,interruptUsed:m.cards[escape].zone==='used'},observed.find(r=>r.name===name))}
});

for(const returns of [false,true])test('transit preserves paid group movement while excluding a departed original instance '+returns,()=>{
 let m=fresh();const from=location(m,'light','1_124'),to=location(m,'dark','1_291'),a=pull(m,'dark','1_194','table',from),b=pull(m,'dark','1_194','table',from);force(m,'dark',2);m=phase(m,'move');m=transit(m,from,to,[a,b]);state.moveCard(m,a,'hand');if(returns){state.moveCard(m,a,'table');m.cards[a].location=from;}m=settle(m);assert.equal(m.cards[b].location,to);assert.equal(m.cards[a].zone,returns?'table':'hand');if(returns)assert.equal(m.cards[a].location,from);assert.equal(m.players.dark.force.length,1);assert.deepEqual(ground.usage(m).moved,[b]);
});

for(const boundary of ['interrupt','move'])for(const returns of [false,true])test('Run Luke retains its original target through '+boundary+' responses, return='+returns,()=>{
 let {m,site,near,luke,run}=battleBoard();m=initiate(m,site);m=step(m,'run-luke:'+run+':'+luke);
 if(boundary==='move')m=seek(m,x=>x.stack.at(-2)?.action?.handler==='travel:run-move');
 state.moveCard(m,luke,'hand');if(returns){state.moveCard(m,luke,'table');m.cards[luke].location=near;}
 m=seek(m,weaponWindow);assert.equal(m.cards[run].zone,'lost');assert.equal(m.cards[luke].zone,returns?'table':'hand');if(returns)assert.equal(m.cards[luke].location,near);assert.ok(!ground.usage(m).moved.includes(luke));assert.ok(!combat.battle(m).runLuke);
});

for(const boundary of ['interrupt','move'])test('Narrow Escape never moves a returned replacement using its old permission: '+boundary,()=>{
 let {m,site,near,luke,rebel,escape}=battleBoard({lukeAtBattle:true});m=initiate(m,site);m=step(m,'escape:'+escape);
 if(boundary==='move'){m=settle(m);m=step(m,'away:'+luke+':'+near);assert.equal(m.stack.at(-2).action.handler,'travel:escape-move');}
 state.moveCard(m,luke,'hand');state.moveCard(m,luke,'table');m.cards[luke].location=site;m=seek(m,x=>x.cards[escape].zone==='used');
 assert.equal(m.cards[luke].location,site);assert.equal(m.cards[rebel].location,near);assert.equal(m.players.light.force.length,boundary==='move'?2:3);assert.deepEqual(ground.usage(m).moved,[rebel]);
});

test('Narrow Escape targets its move-away group at initiation, excluding later arrivals',()=>{
 let {m,site,luke,rebel,escape,extra}=battleBoard({lukeAtBattle:true});m=initiate(m,site);m=step(m,'escape:'+escape);state.moveCard(m,extra,'table');m.cards[extra].location=site;m=seek(m,x=>x.cards[escape].zone==='used');assert.equal(m.cards[extra].location,site);assert.notEqual(m.cards[luke].location,site);assert.notEqual(m.cards[rebel].location,site);assert.equal(m.players.light.force.length,2);
});

test('multiple qualifying Rebels offer explicit Narrow Escape targets',()=>{
 let m=fresh({light:['1_11']});const site=location(m,'light','1_129'),near=location(m,'light','1_132'),luke=pull(m,'light','101_2','table',site),han=pull(m,'light','1_11','table',site),alien=pull(m,'light','1_30','table',site),escape=pull(m,'light','1_98','hand');pull(m,'dark','1_194','table',site);force(m,'dark',3);force(m,'light',4);m=initiate(m,site);const choices=prompt(m).choices.filter(c=>c.id.startsWith('escape:'));assert.equal(choices.length,2);assert.ok(choices.some(c=>c.id==='escape:'+escape+':'+luke));assert.ok(choices.some(c=>c.id==='escape:'+escape+':'+han));assert.ok(!choices.some(c=>c.id.endsWith(':'+alien)));m=step(m,'escape:'+escape+':'+han);assert.equal(m.stack.at(-2).action.payload.target,han);m=seek(m,x=>x.cards[escape].zone==='used');assert.ok([luke,han,alien].every(id=>m.cards[id].location===near));
});

test('pending movement instance references survive save and reject forged/missing identities',()=>{
 let m=fresh();const from=location(m,'light','1_124'),to=location(m,'dark','1_291'),a=pull(m,'dark','1_194','table',from);force(m,'dark',2);m=phase(m,'move');m=transit(m,from,to,[a]);for(const mutate of [p=>delete p.memberRefs,p=>p.memberRefs[a].version=999,p=>p.memberRefs[a].id=to]){const bad=clone(m);mutate(bad.stack.at(-2).action.payload);assert.throws(()=>premiereRules.validate(bad),/reference|target/);}const resumed=settle(clone(m));assert.equal(resumed.cards[a].location,to);
});

const identityObservations=JSON.parse(fs.readFileSync(new URL('./gemp/travel-identity-results.json',import.meta.url)));
for(const expected of identityObservations)test('movement identity reference: '+expected.name,()=>{
 const runMode=expected.name.startsWith('run');let {m,site,near,luke,rebel,run,escape,extra}=battleBoard({lukeAtBattle:!runMode});
 const card=runMode?run:escape,before=m.players.light.force.length;m=initiate(m,site);m=step(m,runMode?'run-luke:'+card+':'+luke:'escape:'+card);
 if(/-(leave|return)$/.test(expected.name)){state.moveCard(m,luke,'hand');if(expected.name.endsWith('return')){state.moveCard(m,luke,'table');m.cards[luke].location=runMode?near:site;}}
 if(expected.name.endsWith('arrival')){state.moveCard(m,extra,'table');m.cards[extra].location=site;}
 m=seek(m,x=>x.cards[card].zone===(runMode?'lost':'used'));
 const actual={name:expected.name,lukeMoved:m.cards[luke].location===(runMode?site:near),rebelMoved:m.cards[rebel].location===near,extraMoved:m.cards[extra].location===near,forceSpent:before-m.players.light.force.length,interruptZone:runMode?'TOP_OF_LOST_PILE':'TOP_OF_USED_PILE'};
 if(expected.name==='run-leave'){
  assert.equal(expected.referenceError,'NullPointerException');assert.match(expected.message,/action.*null/);
  assert.deepEqual(actual,{name:expected.name,lukeMoved:false,rebelMoved:false,extraMoved:false,forceSpent:0,interruptZone:'TOP_OF_LOST_PILE'});
 }else if(expected.name==='run-return'){
  assert.equal(expected.lukeMoved,true);assert.deepEqual(actual,{...expected,lukeMoved:false});
 }else if(expected.name==='escape-return'){
  assert.equal(expected.lukeMoved,true);assert.equal(expected.forceSpent,2);assert.deepEqual(actual,{...expected,lukeMoved:false,forceSpent:1});
 }else if(expected.name==='escape-arrival'){
  assert.equal(expected.extraMoved,true);assert.equal(expected.forceSpent,3);assert.deepEqual(actual,{...expected,extraMoved:false,forceSpent:2});
 }else assert.deepEqual(actual,expected);
});
