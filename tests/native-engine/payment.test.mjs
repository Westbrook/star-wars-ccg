import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
const event=m=>m.stack.at(-1)?.event;
function rules(payment={light:3},extra={}){return {
 id:'payment-test',definition:id=>({side:id.split(':')[0],name:id}),supports:()=>true,setupComplete:()=>true,generation:()=>0,
 actions:(m,w,side)=>w.timing==='phase'&&side==='light'&&!m.data.started?[{id:'play',label:'Play paid action',handler:'play',source:m.players.light.hand[0],payload:{card:m.players.light.hand[0]},payment}]:[],
 automatic:(m,w)=>['before-force-use','force-used'].includes(w.event?.kind)?[{id:'observe:'+w.serial,label:'Observe payment',handler:'observe',payload:w.event,actor:'light'}]:[],
 initiate:(m,r)=>{if(r.action.handler==='play'){m.data.started=true;state.moveCard(m,r.action.payload.card,'playing')}},
 resolve:(m,r)=>{if(r.action.handler==='observe'){const e=r.action.payload;(m.data.trace??=[]).push({stage:e.kind==='force-used'?'used':'before',side:e.side,amount:e.amount,lightForce:m.players.light.force.length,darkForce:m.players.dark.force.length})}else if(r.action.handler==='play'){m.data.result=!r.cancelled;state.moveCard(m,r.action.payload.card,'lost')}else throw Error('Unknown test handler')},
 decisions:()=>[],choose:()=>{},validate:()=>{},...extra,
}}
function fixture(r=rules()){
 let m=runtime.createMatch('payment',40,['dark','light'].map(side=>({side,cards:Array.from({length:40},(_,i)=>side+':'+i)})),r);
 for(const side of ['dark','light'])for(let i=0;i<4;i++)state.moveTop(m,side,'reserve','force');state.moveTop(m,'light','reserve','hand');m=runtime.startTurns(m,r);
 for(let i=0;i<2;i++)m=step(m,r,'pass');m=step(m,r,'pass');return m;
}
function prompt(m,r){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
function step(m,r,id,side=prompt(m,r).side){const before=clone(m),n=runtime.applyCommand(clone(m),r,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const s of ['dark','light'])assert.deepEqual(runtime.project(n,r,s),runtime.project(clone(n),r,s));return n}
function finish(m,r,choose){for(let i=0;i<300&&!('result'in m.data);i++){const p=prompt(m,r);m=step(m,r,choose?.(m,p)??(p.mandatory?p.choices[0].id:'pass'))}assert.ok('result'in m.data);return m}
function seek(m,r,predicate){for(let i=0;i<300;i++){if(predicate(m))return m;const p=prompt(m,r);m=step(m,r,p.mandatory?p.choices[0].id:'pass')}throw Error('Missing boundary')}

for(const [name,payment]of [['zero',{}],['one',{light:1}],['three',{light:3}],['dual',{light:1,dark:1}]])test('serialized '+name+' payment before parent response',()=>{
 const r=rules(payment),f=fixture(r),before={light:[...f.players.light.force],dark:[...f.players.dark.force]};let m=step(f,r,'play');
 if(name!=='zero'){assert.equal(event(m).kind,'before-force-use');assert.deepEqual(m.players.light.force,before.light);assert.equal(m.cards[f.players.light.hand[0]].zone,'playing')}
 m=finish(m,r);assert.equal(m.data.result,true);
 for(const side of ['light','dark'])assert.deepEqual(m.players[side].used,before[side].slice(0,payment[side]??0).reverse());
 const ref=JSON.parse(fs.readFileSync(new URL('./gemp/payment-results.json',import.meta.url))).find(x=>x.name===name);assert.deepEqual(m.data.trace??[],ref.events);
});

test('unaffordable joint payment is rejected before either player pays or source leaves hand',()=>{
 const r=rules({light:1,dark:5}),m=fixture(r),before=clone(m);assert.ok(!prompt(m,r).choices.some(x=>x.id==='play'));assert.throws(()=>step(m,r,'play'));assert.deepEqual(m,before);
});

test('nested paid response finishes before the remaining parent units are used',()=>{
 const base=rules({light:3});const r={...base,actions:(m,w,side)=>[...base.actions(m,w,side),...(w.event?.kind==='force-used'&&w.event.side==='light'&&w.event.remaining===2&&side==='dark'&&!m.data.counter?[{id:'counter',label:'Paid response',handler:'counter',payload:null,payment:{dark:1}}]:[])],initiate:(m,r)=>{base.initiate(m,r);if(r.action.handler==='counter')m.data.counter=true},resolve:(m,r)=>{if(r.action.handler==='counter')m.data.counterResolved=true;else base.resolve(m,r)}};
 let m=step(fixture(r),r,'play');m=finish(m,r,(m,p)=>p.choices.some(c=>c.id==='counter')?'counter':undefined);assert.equal(m.data.counterResolved,true);assert.deepEqual(m.data.trace.map(e=>e.stage+':'+e.side),['before:light','used:light','before:dark','used:dark','used:light','used:light']);assert.equal(m.players.light.force.length,1);
});

test('canceling parent after costs does not refund them',()=>{
 const base=rules({light:2}),r={...base,actions:(m,w,side)=>[...base.actions(m,w,side),...(!w.event&&side==='dark'&&m.stack.at(-2)?.action?.handler==='play'&&!m.stack.at(-2).cancelled?[{id:'cancel',label:'Cancel',handler:'cancel',payload:null}]:[])],resolve:(m,r)=>{if(r.action.handler==='cancel')m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='play').cancelled=true;else base.resolve(m,r)}};
 let m=step(fixture(r),r,'play');m=finish(m,r,(m,p)=>p.choices.some(c=>c.id==='cancel')?'cancel':undefined);assert.equal(m.data.result,false);assert.equal(m.players.light.used.length,2);
});

test('remaining payment reads current Force order after a response',()=>{
 const base=rules({light:2}),r={...base,actions:(m,w,side)=>[...base.actions(m,w,side),...(w.event?.kind==='force-used'&&w.event.remaining===1&&side==='dark'&&!m.data.changed?[{id:'change',label:'Change Force order',handler:'change',payload:null}]:[])],resolve:(m,r)=>{if(r.action.handler==='change'){m.data.changed=true;m.data.newTop=m.players.light.reserve[0];state.moveTop(m,'light','reserve','force')}else base.resolve(m,r)}};
 let m=step(fixture(r),r,'play');m=finish(m,r,(m,p)=>p.choices.some(c=>c.id==='change')?'change':undefined);assert.equal(m.players.light.used[0],m.data.newTop);
});

test('payment windows expose no Force or Used card identities',()=>{
 const r=rules(),f=fixture(r),hidden=[...f.players.light.force,...f.players.dark.force];let m=step(f,r,'play');m=seek(m,r,x=>event(x)?.kind==='force-used');
 for(const side of ['dark','light']){const text=JSON.stringify(runtime.project(m,r,side));for(const id of hidden)assert.ok(!text.includes('"'+id+'"'))}
});

test('concession in the middle preserves paid units and never pays the rest',()=>{
 const r=rules(),f=fixture(r);let m=seek(step(f,r,'play'),r,x=>event(x)?.kind==='force-used');const before=clone(m);m=step(m,r,'concede','light');assert.deepEqual(m.players,before.players);assert.deepEqual(m.stack,before.stack);assert.equal(m.players.light.used.length,1);assert.equal(m.result.winner,'dark');
});

test('corrupt payment continuations fail validation before side effects',()=>{
 const r=rules(),m=step(fixture(r),r,'play');for(const mutate of [p=>p.remaining.light=-1,p=>p.remaining.dark=1,p=>p.amounts.light=4,p=>p.parentId='wrong',p=>p.parentIndex=99,p=>p.order=['dark'],p=>p.position=3,p=>p.opened='yes']){const bad=clone(m);mutate(bad.stack.at(-2).action.payload);assert.throws(()=>prompt(bad,r))}
});

test('depletion during a cost response is explicitly guarded without granting the unpaid result',()=>{
 const r=rules(),f=fixture(r);let m=seek(step(f,r,'play'),r,x=>event(x)?.kind==='force-used');for(const id of [...m.players.light.force])state.moveCard(m,id,'hand');m=seek(m,r,x=>event(x)?.kind==='force-used'&&x.stack.at(-1).completed.length===1);m=step(m,r,'pass');const before=clone(m);assert.throws(()=>step(m,r,'pass'),/cost cannot be completed/);assert.deepEqual(m,before);assert.ok(!('result'in m.data));
});

test('empty payment response opportunities settle without extra Continue actions',()=>{
 const r=rules({light:3},{automatic:()=>[]}),f=fixture(r);const m=step(f,r,'play');assert.equal(m.players.light.used.length,3);assert.equal(m.stack.at(-2).action.handler,'play');assert.equal(event(m),undefined);
});

test('actual native Jawa deployment matches GEMP opponent-first payment timing',()=>{
 const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
 const observer=rules().automatic;const r={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,automatic:(m,w)=>[...premiereRules.automatic(m,w),...observer(m,w)],resolve:(m,f,c)=>{if(f.action.handler==='observe')rules().resolve(m,f);else {premiereRules.resolve(m,f,c);if(f.action.handler==='ground:deploy')m.data.result=true}}};
 let m=runtime.createMatch('jawa-payment',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),r);
 const jawa=m.players.light.reserve.find(id=>m.cards[id].blueprint==='1_12'),site=m.players.light.reserve.find(id=>m.cards[id].blueprint==='1_129');assert.ok(jawa&&site);state.moveCard(m,jawa,'hand');state.moveCard(m,site,'table');m.locations.push(site);
 for(const side of ['dark','light'])for(let i=0;i<4;i++)state.moveTop(m,side,'reserve','force');m=runtime.startTurns(m,r);m=seek(m,r,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&prompt(x,r).side==='light');
 m=step(m,r,'deploy:'+jawa+':'+site);assert.equal(m.cards[jawa].zone,'playing');m=finish(m,r);assert.equal(m.cards[jawa].zone,'table');const ref=JSON.parse(fs.readFileSync(new URL('./gemp/payment-results.json',import.meta.url))).find(x=>x.name==='jawa');assert.deepEqual(m.data.trace,ref.events);
});

test('responses newly enabled by a later unit are discovered even if earlier windows were empty',()=>{
 const base=rules({light:3}),r={...base,automatic:()=>[],actions:(m,w,side)=>[...base.actions(m,w,side),...(w.event?.kind==='force-used'&&w.event.remaining===1&&side==='dark'&&!m.data.responded?[{id:'respond',label:'Respond to second unit',handler:'respond',payload:null}]:[])],resolve:(m,r)=>{if(r.action.handler==='respond')m.data.responded=true;else base.resolve(m,r)}};
 let m=step(fixture(r),r,'play');assert.equal(m.players.light.used.length,2);assert.equal(event(m).kind,'force-used');m=step(m,r,'respond');m=finish(m,r);assert.equal(m.data.responded,true);assert.equal(m.players.light.used.length,3);
});

test('before-use responses complete before even the first payment card is moved',()=>{
 const r=rules({light:2}),f=fixture(r);let m=step(f,r,'play');assert.equal(m.players.light.used.length,0);m=step(m,r,prompt(m,r).choices[0].id);assert.equal(m.players.light.used.length,0);m=step(m,r,'pass');assert.equal(m.players.light.used.length,0);m=step(m,r,'pass');assert.equal(m.players.light.used.length,0);assert.equal(event(m).kind,'before-force-use');m=step(m,r,'pass');m=step(m,r,'pass');assert.equal(m.players.light.used.length,1);
});

 test('duplicate payment frames cannot charge the same action twice after reload',()=>{
 const r=rules(),m=step(fixture(r),r,'play'),bad=clone(m);bad.stack.splice(-1,0,clone(bad.stack.at(-2)));assert.throws(()=>prompt(bad,r),/payment continuation/);
});
