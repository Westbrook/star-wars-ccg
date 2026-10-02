import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
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
const opposite=s=>s==='light'?'dark':'light';
function fixture(side='light',values=[3,3],own=false,zero=false){
 const enemy=opposite(side),drainer=own?side:enemy;
 let m=fresh({light:['1_113','1_113','1_113','1_124','1_124','1_90'],dark:['1_238','1_238','1_238','1_285','1_285']});
 const site=zero?location(m,'dark','1_284'):location(m,'light','1_129'),units=[pull(m,drainer,drainer==='light'?'1_28':'1_194','table',site),pull(m,drainer,drainer==='light'?'1_28':'1_194','table',site)];
 const card=pull(m,side,side==='light'?'1_113':'1_238','hand');force(m,'dark',6);force(m,'light',6);m=runtime.startTurns(m,rules);m=seek(m,x=>x.turn.side===drainer&&x.turn.phase==='control'&&x.stack.length===1);m=priority(m,drainer);
 const bp=value=>side==='light'?({0:'1_124',1:'1_28',3:'1_113'})[value]:({0:'1_285',1:'1_194',3:'1_238'})[value];
 const drawn=values.map(v=>pull(m,side,bp(v),'hand'));for(const id of [...drawn].reverse())state.moveCard(m,id,'reserve');
 if(values.length<2){for(const id of [...m.players[side].reserve])if(!drawn.includes(id))state.moveCard(m,id,'hand');}
 m=step(m,'drain:'+site);m=priority(m,side);return{m,side,enemy,drainer,card,site,units,drawn};
}
function play(f){return step(f.m,'assault:play:'+f.card)}
function result(m){return seek(m,x=>event(x)?.kind==='assault-result')}
function finished(m,card){return seek(m,x=>x.cards[card].zone==='lost'&&x.stack.length===1)}

for(const side of ['light','dark'])for(const values of [[3,3],[1,1],[0,0],[],[3]])test(side+' Assault resolves '+JSON.stringify(values)+' and cancels the original drain',()=>{
 const f=fixture(side,values),beforeForce=f.m.players[side].force.length;let m=play(f);assert.equal(m.players[side].force.length,beforeForce-1);assert.equal(m.cards[f.card].zone,'playing');m=result(m);const e=event(m);assert.equal(e.count,2);assert.equal(e.power,2);assert.equal(e.destiny,values.length?values.reduce((a,b)=>a+b):null);assert.equal(e.amount,Math.abs((e.destiny??0)-2));assert.equal(e.loser,e.amount?(e.destiny>2?f.enemy:side):null);assert.equal(m.data.battle,undefined);assert.deepEqual(m.players[side].used.slice(0,values.length),[...f.drawn].reverse());assert.ok(m.stack.some(r=>r.kind==='resolution'&&r.action.handler==='ground:drain'&&r.cancelled));
 const losses={dark:m.players.dark.lost.length,light:m.players.light.lost.length};m=finished(m,f.card);for(const s of ['dark','light'])assert.equal(m.players[s].lost.length-losses[s],(s===side?1:0)+(s===e.loser?e.amount:0));assert.ok(!ids(m).includes('drain:'+f.site));assert.equal(m.turn.phase,'control');
});

test('Assault is only a paid response to an uncanceled drain, including its own and zero drains',()=>{
 for(const side of ['light','dark']){const f=fixture(side,[],true);let m=play(f);m=result(m);assert.equal(event(m).count,0);assert.equal(event(m).power,0);assert.equal(event(m).amount,0);m=finished(m,f.card);assert.equal(m.players[side].lost.length,1);}
 const f=fixture();let m=clone(f.m);for(const id of [...m.players.light.force])state.moveCard(m,id,'used');assert.ok(!ids(m).includes('assault:play:'+f.card));m=clone(f.m);m.stack.at(-2).cancelled=true;assert.ok(!ids(m).includes('assault:play:'+f.card));m=play(f);m=priority(m,'light');assert.ok(!ids(m).some(x=>x.startsWith('assault:')));
});

test('canceling Assault preserves its paid cost and lets the original drain resolve',()=>{
 const f=fixture();let m=play(f);m.stack.at(-2).cancelled=true;const original=board.drainAmount(m,'dark',f.site);m=finished(m,f.card);assert.equal(m.players.light.lost.length,original+1);assert.equal(m.players.dark.lost.length,0);assert.equal(m.players.light.force.length,f.m.players.light.force.length-1);assert.ok(f.drawn.every(id=>m.cards[id].zone==='reserve'||m.cards[id].zone==='lost'));
});

for(const side of ['light','dark'])test(side+' Assault freezes power and count before cancellation and destiny responses',()=>{
 const f=fixture(side),removed=f.units[0];let m=play(f);m=seek(m,x=>event(x)?.kind==='force-drain-cancelled');state.moveCard(m,removed,'lost');const arrival=pull(m,f.enemy,f.enemy==='dark'?'1_194':'1_28','table',f.site);m=result(m);assert.equal(event(m).count,2);assert.equal(event(m).power,2);assert.equal(event(m).destiny,6);assert.ok(m.cards[arrival]);
 const g=fixture(side);m=play(g);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');for(const id of g.units)state.moveCard(m,id,'lost');m=result(m);assert.equal(event(m).count,2);assert.equal(event(m).power,2);assert.equal(event(m).amount,4);
});

test('Assault samples power/count on resolution, after responses to playing it',()=>{
 const f=fixture();let m=play(f);state.moveCard(m,f.units[0],'lost');m=result(m);assert.equal(event(m).count,1);assert.equal(event(m).power,1);assert.equal(event(m).destiny,3);
});

test('Assault Force loss uses ordinary reduction and hand/pile choices, never forfeiture',()=>{
 const f=fixture('light',[0,0]);const reduce=pull(f.m,'light','1_90','hand');let m=result(play(f));m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('forfeit:')));assert.ok(ids(m).includes('reduce:'+reduce+':2'));m=step(m,'reduce:'+reduce+':2');m=finished(m,f.card);assert.equal(m.players.light.lost.length,1);assert.equal(m.cards[reduce].zone,'used');
});

test('Assault rejects forged/stale/opposing choices and impossible saved snapshots',()=>{
 const f=fixture(),before=clone(f.m);for(const cmd of [{side:'dark',revision:f.m.revision,choice:'assault:play:'+f.card},{side:'light',revision:f.m.revision-1,choice:'assault:play:'+f.card},{side:'light',revision:f.m.revision,choice:'assault:play:bogus'}]){assert.throws(()=>runtime.applyCommand(f.m,rules,cmd.side,cmd));assert.deepEqual(f.m,before);}
 const m=seek(play(f),x=>event(x)?.kind==='force-drain-cancelled');for(const [key,value] of [['count',-1],['power',-1],['draws',[{card:'bogus',value:1}]]]){const bad=clone(m);bad.stack.at(-2).action.payload[key]=value;assert.throws(()=>runtime.prompt(bad,rules,'light'),/Invalid Assault snapshot/);}
});

test('a zero Force drain still permits an Assault with its full destiny comparison',()=>{
 const f=fixture('light',[3,3],false,true);assert.equal(board.drainAmount(f.m,'dark',f.site),0);const m=result(play(f));assert.equal(event(m).destiny,6);assert.equal(event(m).amount,4);
});

test('Assault includes opposing droids present without ability, and excludes attached equipment',()=>{
 const f=fixture('light',[3,3],true),droid=pull(f.m,'dark','1_186','table',f.site),belt=pull(f.m,'light','1_40','table',f.site);f.m.cards[belt].attachedTo=f.units[0];assert.ok(board.controls(f.m,'light',f.site));const m=result(play(f));assert.equal(event(m).count,1);assert.equal(event(m).power,0);assert.equal(event(m).destiny,3);assert.equal(event(m).loser,'dark');assert.equal(m.cards[droid].zone,'table');
});

test('Assault respects completed total modifiers without changing the frozen opponent power',()=>{
 const f=fixture('light',[3,3]);let m=play(f);m=seek(m,x=>event(x)?.kind==='destiny-total');m.stack.at(-2).action.payload.total=1;m=result(m);assert.equal(event(m).destiny,1);assert.equal(event(m).power,2);assert.equal(event(m).loser,'light');assert.equal(event(m).amount,1);
});

test('Assault can end the match during Force loss and preserves the frozen winning state',()=>{
 const f=fixture();for(const pile of ['reserve','force','used'])for(const id of [...f.m.players.dark[pile]])state.moveCard(f.m,id,'hand');for(let i=0;i<2;i++)state.moveCard(f.m,f.m.players.dark.hand.at(-1),'force');let m=play(f);m=seek(m,x=>x.status==='finished');assert.equal(m.result.winner,'light');assert.equal(m.result.reason,'life-force');assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision,choice:'pass'}));
});

test('Assault matches thirteen GEMP outcomes and preserves the official frozen-power exception',()=>{
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/assault-results.json',import.meta.url)));assert.equal(oracle.length,14);
 for(const o of oracle){const [side,mode,v,n]=o.name.split('-');const f=fixture(side,Array(Number(n)).fill(Number(v)),mode==='own');let m=play(f);if(mode==='remove'){m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');for(const id of f.units)state.moveCard(m,id,'lost');}m=result(m);const p=m.stack.at(-2).action.payload,draws=p.draws.filter(d=>d.value!==null).map(d=>d.value);const before={dark:m.players.dark.lost.length,light:m.players.light.lost.length},total=event(m).destiny;m=finished(m,f.card);
 const observed={name:o.name,draws,total,darkForceLost:m.players.dark.lost.length-before.dark-(side==='dark'?1:0),lightForceLost:m.players.light.lost.length-before.light-(side==='light'?1:0),interruptLost:m.cards[f.card].zone==='lost'};
 if(o.name==='dark-remove-3-2'){assert.equal(o.lightForceLost,6);assert.equal(observed.lightForceLost,4);assert.deepEqual({...observed,lightForceLost:6},o);}else assert.deepEqual(observed,o);
 }
});

test('failed draws against power zero fail the Assault, while zero required draws compare zero',()=>{
 const f=fixture('light',[],true);const droid=Object.values(f.m.cards).find(c=>c.owner==='dark'&&c.blueprint==='1_186'&&c.zone==='reserve').id;state.moveCard(f.m,droid,'table');f.m.cards[droid].location=f.site;const m=result(play(f));assert.equal(event(m).count,1);assert.equal(event(m).destiny,null);assert.equal(event(m).power,0);assert.equal(event(m).loser,'light');assert.equal(event(m).amount,0);
});
