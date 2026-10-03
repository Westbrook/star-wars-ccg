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
let now=1_000_000;
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0,now);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s,now),runtime.project(clone(r),rules,s,now));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';

function fixture({rebels=2,battle=false,hand=true}={}){
 now=1_000_000;let m=fresh({light:['101_2','1_30','1_18','1_105','1_28','1_28'],dark:['1_266','1_266']});const site=location(m,'light','1_129');
 const card=pull(m,'dark','1_266','hand'),second=pull(m,'dark','1_266','hand');const viewed=[];for(let i=0;i<rebels;i++)viewed.push(pull(m,'light',i?'101_2':'1_28','hand'));
 if(hand)for(const bp of ['1_30','1_18','1_105'])viewed.push(pull(m,'light',bp,'hand'));force(m,'dark',5);force(m,'light',3);
 if(battle){pull(m,'light','1_28','table',site);pull(m,'dark','1_194','table',site);}
 m=phase(m,battle?'battle':'control');if(battle){m=step(m,'battle:'+site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'dark');}
 return{m,site,card,second,viewed,rebels:viewed.slice(0,rebels)};
}
const play=f=>step(f.m,'scan:play:'+f.card);
const peek=(m)=>seek(m,x=>x.stack.at(-1)?.handler==='scan:peek');
const resolved=(m,card)=>seek(m,x=>x.cards[card].zone==='used'&&x.stack.at(-1)?.kind==='window');
const view=(m,side,time=now)=>runtime.project(m,rules,side,time);

test('Scanning Crew pays before responses and inspects only the hand at resolution',()=>{
 const f=fixture(),force=f.m.players.dark.force.length;let m=play(f);assert.equal(m.players.dark.force.length,force-1);assert.equal(m.cards[f.card].zone,'playing');assert.equal(view(m,'dark').rules.scan,null);
 const arrival=pull(m,'light','1_28','hand');state.moveCard(m,f.viewed[0],'used');m=peek(m);assert.deepEqual(new Set(view(m,'dark').rules.scan.cards.map(c=>c.id)),new Set([...f.viewed.slice(1),arrival]));assert.equal(view(m,'light').rules.scan,null);assert.equal(m.cards[f.card].zone,'playing');
});
test('inspection remains available beyond the obsolete printed ten seconds and across refresh',()=>{
 const f=fixture();let m=peek(play(f));const before=clone(m);assert.equal(m.stack.at(-1).payload.expiresAt,undefined);
 for(const t of [now,now+9999,now+10000,now+60000,now+3600000]){
  assert.equal(view(clone(m),'dark',t).rules.scan.cards.length,f.viewed.length);
  assert.equal(view(m,'dark',t).rules.scan.expiresAt,undefined);
  assert.deepEqual(runtime.advanceTime(clone(m),rules,t),before);
 }
 assert.deepEqual(m,before);
});
test('only acknowledgment advances inspection, with revision protection and no surviving full-hand access',()=>{
 const f=fixture();let m=peek(play(f)),before=clone(m);now+=60000;
 m=step(m,'scan:continue');assert.equal(m.revision,before.revision+1);assert.equal(m.stack.at(-1).handler,'scan:select');
 assert.deepEqual(runtime.advanceTime(m,rules,now+60000),m);
 assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:before.revision,choice:'scan:continue'},()=>0,now),/Stale/);
 assert.deepEqual(new Set(view(m,'dark').rules.scan.cards.map(c=>c.id)),new Set(f.rebels));assert.ok(!JSON.stringify(view(m,'dark')).includes(f.viewed.at(-1)));
});
test('legacy saved inspection deadlines are ignored rather than enforcing superseded card text',()=>{
 const f=fixture();const m=peek(play(f));m.stack.at(-1).payload.expiresAt=now-1;
 const saved=clone(m);assert.equal(view(saved,'dark',now+60000).rules.scan.cards.length,f.viewed.length);
 assert.deepEqual(runtime.advanceTime(saved,rules,now+60000),m);
 assert.equal(step(saved,'scan:continue').stack.at(-1).handler,'scan:select');
});
test('finishing inspection offers only Rebel characters, not aliens, Droids or names containing Rebel',()=>{
 const f=fixture();let m=peek(play(f));m=step(m,'scan:continue');assert.deepEqual(new Set(ids(m)),new Set(['scan:decline',...f.rebels.map(id=>'scan:select:'+id)]));assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);assert.equal(view(m,'light').rules.scan,null);
});
for(const index of [0,1])test('choosing Rebel '+index+' puts exactly it on top of Used and preserves all other pile order',()=>{
 const f=fixture();let m=step(peek(play(f)),'scan:continue');const before=clone(m),target=f.rebels[index],life=state.lifeForce(m,'light');m=step(m,'scan:select:'+target);assert.equal(event(m).kind,'about-to-place-hand-card-used');assert.equal(m.cards[target].zone,'hand');for(const seat of ['light','dark'])assert.deepEqual(view(m,seat).rules.scan.cards.map(c=>c.id),[target]);m=seek(m,x=>event(x)?.kind==='card-placed-used');assert.equal(m.players.light.used[0],target);assert.equal(state.lifeForce(m,'light'),life+1);assert.equal(m.cards[f.card].zone,'playing');assert.deepEqual(m.players.light.hand,before.players.light.hand.filter(id=>id!==target));assert.deepEqual(m.players.light.used,[target,...before.players.light.used]);assert.deepEqual(m.players.light.reserve,before.players.light.reserve);assert.deepEqual(m.players.light.lost,before.players.light.lost);m=resolved(m,f.card);assert.equal(m.players.dark.used[0],f.card);assert.equal(view(m,'dark').rules.scan,null);assert.ok(!JSON.stringify(view(m,'dark')).includes(f.viewed.at(-1)));
});
test('declining leaves the opponent hand and Life Force unchanged',()=>{
 const f=fixture();let m=step(peek(play(f)),'scan:continue'),before=clone(m.players.light);m=step(m,'scan:decline');assert.deepEqual(m.players.light,before);assert.equal(m.cards[f.card].zone,'used');assert.equal(view(m,'dark').rules.scan,null);
});
test('no Rebels still allows untimed inspection and acknowledgment finishes without hand mutation',()=>{
 const f=fixture({rebels:0});let m=peek(play(f)),before=clone(m.players.light);now+=60000;
 assert.deepEqual(runtime.advanceTime(m,rules,now),m);m=step(m,'scan:continue');assert.deepEqual(m.players.light,before);assert.equal(m.cards[f.card].zone,'used');assert.equal(m.stack.length,1);assert.equal(view(m,'dark').rules.scan,null);
});
test('canceling Scanning Crew sends it Lost without granting hand access or refunding Force',()=>{
 const f=fixture();let m=play(f);m.stack.at(-2).cancelled=true;m=seek(m,x=>x.cards[f.card].zone==='lost');assert.equal(view(m,'dark').rules.scan,null);assert.deepEqual(m.players.light.hand,f.m.players.light.hand);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-1);
});
test('inspection prevention and an emptying hand close safely and dispose of the Interrupt as Used',()=>{
 for(const prevent of [true,false]){const f=fixture();let m=seek(play(f),x=>event(x)?.kind==='before-looking-at-hand');if(prevent)m.stack.at(-2).cancelled=true;else for(const id of [...m.players.light.hand])state.moveCard(m,id,'used');m=resolved(m,f.card);assert.equal(view(m,'dark').rules.scan,null);assert.equal(m.stack.length,1);}
});
test('a prevented hand removal leaves the chosen Rebel in hand and finishes the Used Interrupt',()=>{
 const f=fixture();let m=step(peek(play(f)),'scan:continue');m=step(m,'scan:select:'+f.rebels[0]);m.stack.at(-2).cancelled=true;m=resolved(m,f.card);assert.equal(m.cards[f.rebels[0]].zone,'hand');assert.equal(m.players.light.used.length,0);
});
test('a departing selected Rebel is not replaced by a different card',()=>{
 const f=fixture();let m=step(peek(play(f)),'scan:continue');m=step(m,'scan:select:'+f.rebels[0]);state.moveCard(m,f.rebels[0],'lost');m=resolved(m,f.card);assert.equal(m.cards[f.rebels[0]].zone,'lost');assert.equal(m.cards[f.rebels[1]].zone,'hand');assert.equal(m.players.light.used.length,0);
});
test('a later-arriving hand card is not among the cards found in that inspection',()=>{
 const f=fixture({rebels:1});let m=peek(play(f));const id=pull(m,'light','101_2','hand');m=step(m,'scan:continue');assert.ok(!ids(m).includes('scan:select:'+id));assert.deepEqual(view(m,'dark').rules.scan.cards.map(c=>c.id),f.rebels);
});
test('a second Scanning Crew opens a new acknowledged inspection',()=>{
 const f=fixture();let m=step(step(peek(play(f)),'scan:continue'),'scan:decline');m=priority(m,'dark');now+=20000;m=peek(step(m,'scan:play:'+f.second));assert.equal(m.stack.at(-1).payload.expiresAt,undefined);assert.equal(view(m,'dark').rules.scan.cards.length,f.viewed.length);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-2);
});
test('Scanning Crew requires a nonempty hand, one Force, and ordinary or weapons timing',()=>{
 let f=fixture({rebels:0,hand:false});assert.ok(!ids(f.m).some(id=>id.startsWith('scan:')));f=fixture();for(const id of [...f.m.players.dark.force])state.moveCard(f.m,id,'hand');assert.ok(!ids(f.m).some(id=>id.startsWith('scan:')));f=fixture();let m=play(f);assert.ok(!ids(m).some(id=>id.startsWith('scan:play')));f=fixture({battle:true});assert.ok(ids(f.m).includes('scan:play:'+f.card));m=step(step(peek(play(f)),'scan:continue'),'scan:decline');assert.equal(combat.battle(m).stage,'weapons');assert.equal(m.cards[f.card].zone,'used');
});
test('Scanning Crew works on the opposing turn without granting that seat private choices',()=>{
 const f=fixture();let m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');m=peek(step(m,'scan:play:'+f.card));assert.equal(prompt(m).side,'dark');assert.equal(view(m,'light').rules.scan,null);assert.deepEqual(runtime.prompt(m,rules,'light').choices,[]);
});
test('concession immediately revokes all inspection and selection views',()=>{
 for(const select of [false,true]){const f=fixture();let m=peek(play(f));if(select)m=step(m,'scan:continue');m=runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'concede'},()=>0,now);for(const seat of ['dark','light'])assert.equal(view(m,seat).rules.scan,null);assert.deepEqual(runtime.advanceTime(m,rules,now+100000),m);}
});
test('wrong seats, stale choices, non-Rebels and corrupted saves are rejected without mutation',()=>{
 const f=fixture();let m=step(peek(play(f)),'scan:continue'),before=clone(m);for(const [side,revision,choice] of [['light',m.revision,'scan:decline'],['dark',m.revision-1,'scan:decline'],['dark',m.revision,'scan:select:'+f.viewed.at(-1)]]){assert.throws(()=>runtime.applyCommand(m,rules,side,{revision,choice},()=>0,now));assert.deepEqual(m,before);}let bad=clone(m);bad.stack.at(-1).payload.cards.push(f.viewed.at(-1));assert.throws(()=>runtime.prompt(bad,rules,'dark'),/Invalid Scanning Crew selection/);bad=peek(play(f));bad.stack.at(-1).payload.cards.push(f.viewed[0]);assert.throws(()=>view(bad,'dark'),/inspection/);for(const time of [-1,NaN,Infinity,1.5]){assert.throws(()=>runtime.advanceTime(m,rules,time),/server time/);assert.throws(()=>view(m,'dark',time),/server time/);}
});

test('native Scanning Crew matches six freshly executed GEMP outcomes',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/scan-timing-results.json',import.meta.url)));assert.equal(oracle.length,6);
 for(const o of oracle){const f=fixture({rebels:o.name==='no-rebel'?0:2,battle:o.name==='battle'});let m=f.m;if(o.name==='light-turn'){m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,'dark');}const force=m.players.dark.force.length,hand=m.players.light.hand.length;m=peek(step(m,'scan:play:'+f.card));const viewedCount=view(m,'dark').rules.scan.cards.length;m=step(m,'scan:continue');const offered=m.stack.at(-1)?.handler==='scan:select',target=o.name==='luke'?f.rebels[1]:f.rebels[0];if(offered)m=step(m,o.name==='decline'?'scan:decline':'scan:select:'+target);m=resolved(m,f.card);
  assert.deepEqual({name:o.name,inspected:true,viewedCount,selectionOffered:offered,handRemoved:hand-m.players.light.hand.length,trooperUsed:!!f.rebels[0]&&m.cards[f.rebels[0]].zone==='used',lukeUsed:!!f.rebels[1]&&m.cards[f.rebels[1]].zone==='used',selectedOnTop:!!target&&o.name!=='decline'&&m.players.light.used[0]===target,forceSpent:force-m.players.dark.force.length,interruptUsed:m.cards[f.card].zone==='used'},o);
 }
});
