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
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
function fixture(value=1,{count=2,gear=true,vehicle=false,battle=false,lightTurn=false}={}){
 let m=fresh({light:['1_148','1_152','1_40','1_105','1_90'],dark:['1_275','1_275','1_196','1_196','1_196','1_194','1_285']});const site=location(m,'light','1_129');const tuskens=[];for(let i=0;i<count;i++)tuskens.push(pull(m,'dark','1_196','table',site));
 const card=pull(m,'dark','1_275','hand'),second=pull(m,'dark','1_275','hand');const nonGear=[pull(m,'light','1_28','used')],targets=[];if(gear)targets.push(pull(m,'light','1_152','used'));nonGear.push(pull(m,'light','1_105','used'));if(gear)targets.push(pull(m,'light','1_40','used'));if(vehicle)targets.push(pull(m,'light','1_148','used'));
 force(m,'dark',6);force(m,'light',3);if(battle)pull(m,'light','1_28','table',site);m=phase(m,battle?'battle':'control');if(lightTurn){const usedBeforeTurn=[...m.players.light.used];m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);for(const id of usedBeforeTurn.reverse())state.moveCard(m,id,'used');}m=priority(m,'dark');
 if(value===null)for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');else topDestiny(m,'dark',({0:'1_285',1:'1_194',2:'1_182',3:'1_238'})[value]);
 if(battle){m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'dark');}
 return {m,site,tuskens,card,second,targets,nonGear};
}
const play=f=>step(f.m,'scavenge:play:'+f.card);
const offer=m=>seek(m,x=>x.stack.at(-1)?.handler==='scavenge:offer');
const reveal=m=>seek(m,x=>event(x)?.kind==='pile-revealed');
const resolved=(m,card)=>seek(m,x=>x.cards[card].zone==='lost'&&x.stack.at(-1)?.kind==='window');
const view=(m,side)=>runtime.project(m,rules,side);
for(const value of [0,1,2,3,null])test('Tusken Scavengers destiny '+value+' compares strictly with current Raider count',()=>{
 const f=fixture(value),before=clone(f.m.players.light),force=f.m.players.dark.force.length;let m=play(f);assert.equal(m.players.dark.force.length,force-1);if(value!==null&&value<2){m=offer(m);assert.equal(view(m,'dark').rules.scavenge,null);m=step(m,'scavenge:decline');}m=resolved(m,f.card);assert.deepEqual(m.players.light,before);assert.equal(m.players.dark.lost[0],f.card);
});
test('successful search reveals current Used to both seats and offers every eligible equipment type',()=>{
 const f=fixture(1,{vehicle:true});let m=step(offer(play(f)),'scavenge:search');assert.equal(view(m,'dark').rules.scavenge,null);assert.equal(event(m).kind,'before-looking-at-pile');m=reveal(m);for(const side of ['light','dark'])assert.deepEqual(view(m,side).rules.scavenge.cards.map(c=>c.id),m.players.light.used);m=seek(m,x=>x.stack.at(-1)?.handler==='scavenge:order');assert.equal(prompt(m).side,'dark');assert.deepEqual(new Set(ids(m)),new Set(f.targets.map(id=>'scavenge:lose:'+id)));assert.ok(!ids(m).includes('pass'));
});
for(const reverse of [false,true])test('all searched equipment is lost in chosen order '+reverse+' while remaining Used order is preserved',()=>{
 const f=fixture(1,{vehicle:true}),used=[...f.m.players.light.used];pull(f.m,'light','1_90','hand');const life=state.lifeForce(f.m,'light');let m=reveal(step(offer(play(f)),'scavenge:search'));const order=reverse?[...f.targets].reverse():f.targets;
 for(const id of order){m=seek(m,x=>x.stack.at(-1)?.handler==='scavenge:order'||event(x)?.kind==='about-to-lose-from-pile');if(m.stack.at(-1)?.handler==='scavenge:order')m=step(m,'scavenge:lose:'+id);assert.equal(event(m).card,id);m=seek(m,x=>event(x)?.kind==='card-placed-lost');assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[f.card].zone,'playing');assert.ok(!ids(m).some(id=>id.startsWith('reduce:')||id.startsWith('revival:')));}
 m=resolved(m,f.card);assert.deepEqual(m.players.light.lost,[...order].reverse());assert.deepEqual(m.players.light.used,used.filter(id=>!f.targets.includes(id)));assert.equal(state.lifeForce(m,'light'),life-f.targets.length);for(const side of ['light','dark'])assert.equal(view(m,side).rules.scavenge,null);
});
test('the turn player orders placements during Light turn, following AR p11',()=>{
 const f=fixture(1,{lightTurn:true});let m=step(offer(play(f)),'scavenge:search');m=seek(m,x=>x.stack.at(-1)?.handler==='scavenge:order');assert.equal(prompt(m).side,'light');assert.deepEqual(runtime.prompt(m,rules,'dark').choices,[]);m=step(m,'scavenge:lose:'+f.targets[1]);m=resolved(m,f.card);assert.deepEqual(m.players.light.lost,[f.targets[0],f.targets[1]]);
});
test('no targets found preserves order and prevents another copy searching the same pile that turn',()=>{
 const f=fixture(0,{gear:false});let m=step(offer(play(f)),'scavenge:search');m=reveal(m);assert.equal(m.data.scavengeFailedTurn,m.turn.number);assert.deepEqual(view(m,'light').rules.scavenge.cards.map(c=>c.id),m.players.light.used);m=resolved(m,f.card);m=priority(m,'dark');const gun=pull(m,'light','1_152','used');topDestiny(m,'dark','1_194');m=resolved(step(m,'scavenge:play:'+f.second),f.second);assert.equal(m.cards[gun].zone,'used');
 // Failed-search restriction expires with the turn, not with a new copy.
 state.moveCard(m,f.card,'hand');m=seek(m,x=>x.turn.number===2&&x.stack.length===1&&x.turn.phase==='control');m=priority(m,'dark');state.moveCard(m,gun,'used');topDestiny(m,'dark','1_194');m=offer(step(m,'scavenge:play:'+f.card));assert.ok(ids(m).includes('scavenge:search'));
});
test('Raider count is rechecked after drawing and includes Raiders at other sites',()=>{
 let f=fixture(1,{count:1}),m=play(f);m=seek(m,x=>event(x)?.kind==='destiny-drawn');const site=location(m,'light','1_130');pull(m,'dark','1_196','table',site);m=offer(m);assert.equal(m.stack.at(-1).payload.count,2);
 f=fixture(1);m=seek(play(f),x=>event(x)?.kind==='destiny-drawn');state.moveCard(m,f.tuskens[0],'lost');m=resolved(m,f.card);assert.deepEqual(m.players.light.used,f.m.players.light.used);
});
test('canceling play or the destiny exposes no Used cards and refunds no paid Force',()=>{
 for(const destiny of [false,true]){const f=fixture(0);let m=play(f);if(destiny)m=seek(m,x=>event(x)?.kind==='destiny-drawn');m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(view(m,'dark').rules.scavenge,null);assert.deepEqual(m.players.light.used,f.m.players.light.used);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);}
});
test('preventing inspection does not mark a failed search or expose the pile',()=>{
 const f=fixture();let m=step(offer(play(f)),'scavenge:search');m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.data.scavengeFailedTurn,undefined);assert.equal(view(m,'dark').rules.scavenge,null);assert.deepEqual(m.players.light.used,f.m.players.light.used);
});
test('preventing one equipment loss continues with the remaining found targets',()=>{
 const f=fixture();let m=step(offer(play(f)),'scavenge:search');m=seek(m,x=>x.stack.at(-1)?.handler==='scavenge:order');m=step(m,'scavenge:lose:'+f.targets[0]);m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.cards[f.targets[0]].zone,'used');assert.equal(m.cards[f.targets[1]].zone,'lost');
});
test('departing searched cards and later arrivals do not replace original targets',()=>{
 const f=fixture();let m=reveal(step(offer(play(f)),'scavenge:search'));const vehicle=pull(m,'light','1_148','used');state.moveCard(m,f.targets[0],'hand');m=resolved(m,f.card);assert.equal(m.cards[f.targets[0]].zone,'hand');assert.equal(m.cards[f.targets[1]].zone,'lost');assert.equal(m.cards[vehicle].zone,'used');
});
test('empty Used or no on-table Raiders blocks initiation; an emptying pile still finishes safely',()=>{
 let f=fixture(1,{count:0});assert.ok(!ids(f.m).some(id=>id.startsWith('scavenge:')));f=fixture();for(const id of [...f.m.players.light.used])state.moveCard(f.m,id,'hand');assert.ok(!ids(f.m).some(id=>id.startsWith('scavenge:')));f=fixture();let m=play(f);for(const id of [...m.players.light.used])state.moveCard(m,id,'hand');m=resolved(m,f.card);assert.equal(view(m,'dark').rules.scavenge,null);
});
test('Tusken Scavengers is an ordinary weapons-segment action without changing battle participation',()=>{
 const f=fixture(1,{battle:true});let m=step(offer(play(f)),'scavenge:search');m=resolved(m,f.card);assert.equal(combat.battle(m).stage,'weapons');assert.deepEqual(combat.members(m,'dark'),f.tuskens);assert.equal(m.players.light.lost.length,f.targets.length);
});
test('final Life Force equipment loss wins immediately and concession revokes the revealed pile',()=>{
 let f=fixture(),m=step(offer(play(f)),'scavenge:search');m=reveal(m);for(const id of [...m.players.light.reserve,...m.players.light.force,...m.players.light.used.filter(id=>!f.targets.includes(id))])state.moveCard(m,id,'hand');m=seek(m,x=>x.status==='finished');assert.equal(m.result.winner,'dark');assert.equal(m.result.reason,'life-force');assert.equal(view(m,'dark').rules.scavenge,null);
 f=fixture();m=reveal(step(offer(play(f)),'scavenge:search'));m=runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'concede'});assert.equal(view(m,'dark').rules.scavenge,null);
});
test('foreign, stale and forged choices and corrupted targets are rejected atomically',()=>{
 const f=fixture();let m=seek(step(offer(play(f)),'scavenge:search'),x=>x.stack.at(-1)?.handler==='scavenge:order'),before=clone(m);for(const [side,revision,id] of [['light',m.revision,f.targets[0]],['dark',m.revision-1,f.targets[0]],['dark',m.revision,f.nonGear[0]]]){assert.throws(()=>runtime.applyCommand(m,rules,side,{revision,choice:'scavenge:lose:'+id}));assert.deepEqual(m,before);}let bad=clone(m);bad.stack.at(-1).payload.remaining.push(f.nonGear[0]);assert.throws(()=>runtime.prompt(bad,rules,'dark'),/scavenging targets/);bad=clone(m);bad.stack.at(-1).side='light';assert.throws(()=>runtime.prompt(bad,rules,'light'),/Scavengers continuation/);bad=clone(m);bad.data.scavengeFailedTurn=m.turn.number+1;assert.throws(()=>runtime.prompt(bad,rules,'dark'),/failed scavenging/);
});

test('Lift Tube has sourced off-table metadata without enabling native vehicle play or full decks',()=>{
 const extra=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/additional-cards.json',import.meta.url))),catalog=JSON.parse(fs.readFileSync(new URL('../../public/catalog/cards.json',import.meta.url))),card=extra.find(c=>c.gempId==='1_148'),source=catalog.find(c=>c.gempId==='1_148');for(const key of ['gempId','name','side','type','subType','image','text','stats','icons'])assert.deepEqual(card[key],source[key]);assert.equal(card.type,'Vehicle');assert.equal(premiereRules.supports('1_148'),false);const f=fixture();const vehicle=pull(f.m,'light','1_148','hand');let m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);assert.ok(!ids(m).some(id=>id.startsWith('deploy:'+vehicle)));
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/scavenge-results.json',import.meta.url)));
for(const expected of oracle)test('pinned GEMP equipment and pile outcome: '+expected.name,()=>{
 const parts=expected.name.match(/^(-?\d+)-(gear|empty)-(dark|light|battle)-(forward|reverse)$/);assert.ok(parts);
 const value=Number(parts[1]),f=fixture(value<0?null:value,{gear:parts[2]==='gear',vehicle:parts[2]==='gear',lightTurn:parts[3]==='light',battle:parts[3]==='battle'});
 let m=play(f),revealedBoth=false,optionalSearch=false;const order=parts[4]==='reverse'?[...f.targets].reverse():f.targets;
 for(let n=0;n<250&&m.cards[f.card].zone!=='lost';n++){
  const d=m.stack.at(-1),p=prompt(m);assert.ok(p);
  if(event(m)?.kind==='pile-revealed'){revealedBoth=['light','dark'].every(side=>view(m,side).rules.scavenge?.cards.length===m.players.light.used.length);}
  let choice='pass';
  if(d?.handler==='scavenge:offer'){optionalSearch=ids(m).includes('scavenge:decline');choice='scavenge:search';}
  else if(d?.handler==='scavenge:order')choice='scavenge:lose:'+order.find(id=>ids(m).includes('scavenge:lose:'+id));
  else if(!ids(m).includes('pass'))choice=p.choices[0].id;
  m=step(m,choice);
 }
 const bp=id=>m.cards[id].blueprint;
 assert.deepEqual({forceSpent:f.m.players.dark.force.length-m.players.dark.force.length,interruptLost:m.cards[f.card].zone==='lost',used:m.players.light.used.map(bp),lost:m.players.light.lost.map(bp),revealedBoth},{forceSpent:expected.forceSpent,interruptLost:expected.interruptLost,used:expected.used,lost:expected.lost,revealedBoth:expected.revealedBoth});
 // Deliberate rulebook/card-text differences; do not claim legal-choice parity.
 assert.equal(expected.optionalSearch,false);assert.equal(optionalSearch,value>=0&&value<2);
 if(parts[3]==='light')assert.ok(expected.orderingPlayers.every(p=>p==='Dark Side Player'));
});
