import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const runtime = load(new URL('../../lib/native-engine/runtime.ts', import.meta.url));
const state = load(new URL('../../lib/native-engine/state.ts', import.meta.url));
const random = load(new URL('../../lib/native-engine/random.ts', import.meta.url));
const {createMatch, startTurns, prompt, applyCommand, project} = runtime;
const {moveCard, moveTop, useForce, recirculate, shufflePile, assertState, lifeForce} = state;
const clone = x => JSON.parse(JSON.stringify(x));
const decks = (size=40) => ['dark','light'].map(side => ({side, cards:Array.from({length:size},(_,i)=>`${side}:${i}`)}));
// Synthetic rule handlers test the interpreter, not SWCCG card conformance.
const rules = (extra={}) => ({
 id:'kernel-test-1', definition:id=>{if(!/^(dark|light):\d+$/.test(id))throw Error('Unknown blueprint');return {side:id.split(':')[0],name:id}},
 supports:id=>/^(dark|light):\d+$/.test(id), setupComplete:m=>m.data.setupReady===true,
 generation:()=>3, automatic:()=>[], actions:()=>[], initiate:()=>{},
 resolve:()=>{throw Error('Unknown handler')}, decisions:()=>[], choose:()=>{throw Error('Unknown decision')}, validate:()=>{}, ...extra,
});
function fresh(r=rules(),size=40) {return createMatch('match-1',size,decks(size),r)}
function ready(r=rules(),size=40) {const m=fresh(r,size);m.data.setupReady=true;return startTurns(m,r)}
function act(m,r,choice,seat) {const p=prompt(m,r,'dark');return applyCommand(m,r,seat??p.side,{revision:m.revision,choice})}
function pass(m,r,n=1) {for(let i=0;i<n;i++)m=act(m,r,'pass');return m}
function until(m,r,predicate) {for(let i=0;i<1000;i++){if(predicate(m))return m;m=pass(m,r)}throw Error('Unreachable boundary')}
function addForce(m,side,count=1) {for(let i=0;i<count;i++)moveTop(m,side,'reserve','force')}

for (const size of [40,60]) test(`${size}-card decks conserve every physical copy and reject wrong formats`,()=>{
 const r=rules(),m=fresh(r,size);assert.equal(Object.keys(m.cards).length,size*2);assertState(m);
 assert.throws(()=>createMatch('m',size,decks(size===40?60:40),r),/size/);
 assert.throws(()=>createMatch('m',size,[decks(size)[0],decks(size)[0]],r),/one deck/);
 assert.throws(()=>createMatch('m',size,decks(size),rules({supports:()=>false})),/Unimplemented/);
 const wrong=decks(size);wrong[0].cards[0]='light:1';assert.throws(()=>createMatch('m',size,wrong,r),/opposing/);
});

test('full match cannot start before the rules package validates setup',()=>{
 const r=rules();assert.throws(()=>startTurns(fresh(r),r),/incomplete/);
 assert.throws(()=>startTurns(ready(r),r),/incomplete/);
 assert.throws(()=>prompt(ready(r),rules({id:'other-version'}),'dark'),/original rules/);
});

test('Force payments validate both sides before moving any card and preserve top order',()=>{
 const m=fresh();addForce(m,'dark',3);addForce(m,'light',1);const before=clone(m);
 assert.throws(()=>useForce(m,{dark:2,light:2}),/Insufficient/);assert.deepEqual(m,before);
 const top=m.players.dark.force.slice(0,2);useForce(m,{dark:2,light:1});
 assert.deepEqual(m.players.dark.used,top.reverse());assert.equal(lifeForce(m,'dark'),40);assertState(m);
 for(const payment of [{dark:-1},{dark:0.5},{neutral:1},{light:NaN}])assert.throws(()=>useForce(m,payment));
});

test('both Used piles recirculate beneath Reserve without reversing; Force stays',()=>{
 const m=fresh();for(const side of ['dark','light']){addForce(m,side,5);useForce(m,{[side]:3})}
 const before=clone(m);recirculate(m);
 for(const side of ['dark','light']){assert.deepEqual(m.players[side].reserve,[...before.players[side].reserve,...before.players[side].used]);assert.deepEqual(m.players[side].force,before.players[side].force);assert.deepEqual(m.players[side].used,[])}assertState(m);
});

test('shuffle rejection sampling, conservation, invalid entropy and bounded failure',()=>{
 const original=['a','b','c'];let values=[0xffffffff,2,0];assert.deepEqual(random.shuffled(original,()=>values.shift()),['b','a','c']);assert.deepEqual(original,['a','b','c']);
 for(const value of [-1,1.5,NaN,Infinity,0x100000000])assert.throws(()=>random.shuffled(original,()=>value),/entropy/);
 assert.throws(()=>random.shuffled(original,()=>0xffffffff),/converge/);
 const m=fresh();const before=clone(m);assert.throws(()=>shufflePile(m,'dark','reserve',()=>-1));assert.deepEqual(m,before);
 shufflePile(m,'dark','reserve',()=>42);assert.deepEqual([...m.players.dark.reserve].sort(),[...before.players.dark.reserve].sort());assertState(m);
});

test('generation counts after mandatory/optional start actions and is frozen for the turn',()=>{
 const r=rules({generation:m=>m.data.generation??3,automatic:(m,w)=>w.timing==='start'?[{id:'increase',label:'Increase generation',actor:'dark',handler:'increase',payload:null}]:[],resolve:m=>{m.data.generation=5}});
 let m=ready(r);assert.deepEqual(prompt(m,r,'dark').choices.map(c=>c.id),['increase']);assert.throws(()=>act(m,r,'pass'),/Illegal/);
 m=act(m,r,'increase');m=pass(m,r,2);assert.equal(m.data.generation,5);m=pass(m,r,2);assert.equal(m.turn.generation,5);
 m.data.generation=9;m=act(m,r,'core:activate','dark');m=pass(m,r,2);assert.equal(m.turn.generation,5);assert.equal(m.turn.activated,1);
});

test('activation is optional, one card at a time, with alternating action opportunities',()=>{
 const r=rules();let m=pass(ready(r),r,2);const first=m.players.dark.reserve[0];
 m=act(m,r,'core:activate');assert.equal(m.players.dark.force.length,0);m=pass(m,r,2);
 assert.deepEqual(m.players.dark.force,[first]);assert.equal(prompt(m,r,'light').side,'light');assert.equal(prompt(m,r,'light').choices.some(c=>c.id==='core:activate'),false);
 m=pass(m,r);for(let i=0;i<2;i++){m=act(m,r,'core:activate');m=pass(m,r,3)}
 assert.equal(m.turn.activated,3);assert.equal(prompt(m,r,'dark').choices.some(c=>c.id==='core:activate'),false);
 m=pass(m,r,2);assert.equal(m.turn.phase,'control');
});

test('continuous lifecycle has no authored turn limit and survives every serialized boundary',()=>{
 const r=rules();let a=ready(r),b=clone(a);let commands=0;
 while(a.turn.number<30){const pa=prompt(a,r,'dark'),pb=prompt(b,r,'dark');assert.deepEqual(pa,pb);a=act(a,r,'pass');b=clone(act(b,r,'pass'));assert.deepEqual(a,b);assertState(b);commands++}
 assert.equal(a.status,'playing');assert.equal(a.turn.side,'light');assert.equal(commands,29*16);
});

test('drawing final Life Force ends immediately and freezes pending continuations',()=>{
 const r=rules();let m=ready(r);for(const id of [...m.players.dark.reserve].slice(1))moveCard(m,id,'lost');moveTop(m,'dark','reserve','force');
 m=until(m,r,x=>x.turn.phase==='draw');m=act(m,r,'core:draw');m=pass(m,r,2);
 assert.equal(m.status,'finished');assert.deepEqual(m.result,{winner:'light',loser:'dark',reason:'life-force'});assert.equal(prompt(m,r,'dark'),null);
 assert.throws(()=>act(m,r,'pass','light'),/cannot act/);assert.equal(lifeForce(m,'dark'),0);
});

test('both players recirculate once before mandatory end events; later Used waits',()=>{
 const r=rules({automatic:(m,w)=>w.timing==='end'?[{id:'end-cost',label:'End effect',actor:'dark',handler:'end',payload:null,payment:{dark:1}}]:[],resolve:()=>{}});
 let m=ready(r);addForce(m,'dark',3);useForce(m,{dark:1});const used=m.players.dark.used[0];m=until(m,r,x=>x.stack.at(-1)?.timing==='end');
 assert.equal(m.players.dark.reserve.at(-1),used);assert.equal(m.players.dark.used.length,0);
 m=act(m,r,'end-cost');const paid=m.players.dark.used[0];m=pass(m,r,4);
 assert.equal(m.turn.number,2);assert.deepEqual(m.players.dark.used,[paid]);assert.equal(m.turn.side,'light');
});

test('paid action, nested response, cancellation and cleanup remain serializable',()=>{
 const r=rules({
  actions:(m,w,side)=>w.timing==='phase'&&side==='dark'&&m.players.dark.hand.length?[{id:'play',label:'Play',handler:'play',payload:{card:m.players.dark.hand[0]},payment:{dark:1}}]:w.timing==='response'&&side==='light'&&m.stack.at(-2)?.action?.id==='play'&&!m.stack.at(-2).cancelled?[{id:'cancel',label:'Cancel',handler:'cancel',payload:null,payment:{light:1}}]:[],
  initiate:(m,f)=>{if(f.action.handler==='play')moveCard(m,f.action.payload.card,'playing')},
  resolve:(m,f)=>{if(f.action.handler==='cancel')m.stack.findLast(x=>x.kind==='resolution'&&x.action.id==='play').cancelled=true;else {moveCard(m,f.action.payload.card,'lost');m.data.resolved=!f.cancelled}},
 });
 let m=pass(ready(r),r,2);addForce(m,'dark',2);addForce(m,'light',1);moveTop(m,'dark','reserve','hand');
 const card=m.players.dark.hand[0];m=act(m,r,'play');assert.equal(m.cards[card].zone,'playing');assert.equal(m.players.dark.used.length,1);
 m=clone(act(m,r,'cancel'));m=pass(m,r,4);assert.equal(m.data.resolved,false);assert.equal(m.cards[card].zone,'lost');assertState(m);
});

test('effect decisions persist privately across reload, then resume the suspended turn',()=>{
 const r=rules({actions:(m,w,side)=>w.timing==='phase'&&side==='dark'&&!m.data.chosen?[{id:'pick',label:'Pick a card',handler:'pick',payload:null}]:[],resolve:(m)=>m.stack.push({kind:'decision',side:'dark',handler:'pick',payload:{secret:m.players.dark.reserve[0]}}),decisions:(m,f)=>[{id:f.payload.secret,label:'Select private card'}],choose:(m,f,id)=>{m.data.chosen=id;moveCard(m,id,'hand')}});
 let m=pass(ready(r),r,2);m=act(m,r,'pick');m=pass(m,r,2);m=clone(m);const p=prompt(m,r,'dark');
 assert.equal(p.timing,'decision');assert.deepEqual(prompt(m,r,'light').choices,[]);assert.equal(JSON.stringify(project(m,r,'light')).includes(m.stack.at(-1).payload.secret),false);
 m=act(m,r,p.choices[0].id,'dark');assert.equal(m.players.dark.hand.length,1);assert.equal(prompt(m,r,'light').side,'light');
});

test('stale commands, wrong seats and failing effects leave caller state unchanged',()=>{
 const r=rules({actions:(m,w)=>w.timing==='phase'?[{id:'bad',label:'Bad',handler:'bad',payload:null,payment:{dark:1}}]:[],resolve:m=>{m.data.corrupt=true;throw Error('Effect failed')}});
 let m=pass(ready(r),r,2);addForce(m,'dark',1);const before=clone(m);
 assert.throws(()=>applyCommand(m,r,'light',{revision:m.revision,choice:'core:activate'}),/Illegal/);
 assert.throws(()=>applyCommand(m,r,'dark',{revision:m.revision-1,choice:'pass'}),/Stale/);assert.deepEqual(m,before);
 m=act(m,r,'bad');m=pass(m,r);const pending=clone(m);assert.throws(()=>pass(m,r),/Effect failed/);assert.deepEqual(m,pending);
});

test('concession is available out of turn and never replays a pending effect',()=>{
 const r=rules();let m=pass(ready(r),r,2);m=act(m,r,'core:activate');const snapshot=clone(m);
 m=act(m,r,'concede','dark');assert.deepEqual(m.players,snapshot.players);assert.deepEqual(m.stack,snapshot.stack);assert.equal(m.result.winner,'light');
 assert.throws(()=>act(m,r,'concede','light'),/cannot act/);
});

test('public state reveals neither Reserve order, own Force identity, opponent hand nor continuation data',()=>{
 const r=rules();const m=ready(r);moveTop(m,'dark','reserve','hand');moveTop(m,'light','reserve','hand');addForce(m,'dark');m.data.privateSecret='NEVER_SEND_THIS';
 const view=project(m,r,'dark'),text=JSON.stringify(view);assert.equal(view.players.dark.hand.length,1);assert.deepEqual(view.players.light.hand,[]);
 for(const id of [...m.players.dark.reserve,...m.players.dark.force,...m.players.light.hand])assert.equal(text.includes('"'+id+'"'),false);
 assert.equal(text.includes('NEVER_SEND_THIS'),false);assert.equal('stack' in view,false);assert.equal('cards' in view,false);
});

test('state validator rejects duplicates, wrong zones, cycles and non-JSON continuations',()=>{
 const m=fresh();let bad=clone(m);bad.players.dark.reserve.push(bad.players.dark.reserve[0]);assert.throws(()=>assertState(bad),/conservation/);
 bad=clone(m);bad.cards['dark-1'].zone='hand';assert.throws(()=>assertState(bad),/conservation/);
 bad=clone(m);moveCard(bad,'dark-1','table');moveCard(bad,'dark-2','table');bad.cards['dark-1'].attachedTo='dark-2';bad.cards['dark-2'].attachedTo='dark-1';assert.throws(()=>assertState(bad),/Cyclic/);
 for(const invalid of [()=>{},new Date(),NaN,undefined,new Map()]){bad=clone(m);bad.data.invalid=invalid;assert.throws(()=>assertState(bad),/serializable/)}
});

test('hosts cannot silently move leaving dependent cards behind',()=>{
 const m=fresh();moveCard(m,'dark-1','table');moveCard(m,'dark-2','table');m.cards['dark-2'].attachedTo='dark-1';const before=clone(m);
 assert.throws(()=>moveCard(m,'dark-1','lost'),/dependent/);assert.deepEqual(m,before);moveCard(m,'dark-2','lost');moveCard(m,'dark-1','lost');assertState(m);
});

test('a private cost decision finishes before action responses, and cancellation keeps that cost paid',()=>{
 const r=rules({
  actions:(m,w,side)=>w.timing==='phase'&&side==='dark'?[{id:'costly',label:'Costly effect',handler:'costly',payload:null}]:w.timing==='response'&&side==='light'&&m.stack.at(-2)?.action?.id==='costly'&&!m.stack.at(-2).awaitingResponses?[{id:'cancel-costly',label:'Cancel',handler:'cancel-costly',payload:null}]:[],
  initiate:(m,f)=>{if(f.action.handler==='costly')m.stack.push({kind:'decision',side:'dark',handler:'cost',payload:{cards:[...m.players.dark.hand]}})},
  decisions:(m,f)=>f.payload.cards.map(id=>({id,label:'Pay with '+id})),
  choose:(m,f,id)=>{moveCard(m,id,'lost');runtime.openWindow(m,'response','light',{kind:'cost-paid'})},
  resolve:(m,f)=>{if(f.action.handler==='cancel-costly')m.stack.findLast(f=>f.kind==='resolution'&&f.action.handler==='costly').cancelled=true;else m.data.effectResolved=!f.cancelled},
 });
 let m=pass(ready(r),r,2);moveTop(m,'dark','reserve','hand');const cost=m.players.dark.hand[0];m=act(m,r,'costly');assert.equal(m.stack.at(-1).handler,'cost');assert.deepEqual(prompt(m,r,'light').choices,[]);assert.equal(m.stack.at(-2).awaitingResponses,true);assert.ok(!JSON.stringify(project(m,r,'light')).includes('"'+cost+'"'));
 m=act(clone(m),r,cost,'dark');assert.equal(m.cards[cost].zone,'lost');assert.equal(m.stack.at(-1).event.kind,'cost-paid');assert.ok(!prompt(m,r,'light').choices.some(c=>c.id==='cancel-costly'));
 m=pass(clone(m),r,2);assert.ok(prompt(m,r,'light').choices.some(c=>c.id==='cancel-costly'));m=act(m,r,'cancel-costly');m=pass(m,r,4);assert.equal(m.data.effectResolved,false);assert.equal(m.cards[cost].zone,'lost');
});
