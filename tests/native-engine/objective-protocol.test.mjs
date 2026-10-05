import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url)),state=load(new URL('../../lib/native-engine/state.ts',import.meta.url)),setup=load(new URL('../../lib/native-engine/setup.ts',import.meta.url));
const sides=['dark','light'],clone=m=>JSON.parse(JSON.stringify(m));
// Foundation protocol adapter, intentionally not an admitted card provider.
// A two-stage Objective exercises rollback after a provisional deployment.
function fixture({objectives=['dark'],first='dark',fail=false,interrupt=false}={}){
 const decks=sides.map(side=>({side,cards:[...(objectives.includes(side)?[side+'-objective']:[]),side+'-site',side+'-required',...(interrupt?[side+'-interrupt']:[]),...Array(60).fill(side+'-filler')].slice(0,60)}));
 const journal=m=>m.data.objectiveProtocol??={};
 const objectiveRules={isObjective:(m,id)=>m.cards[id]?.blueprint.endsWith('-objective'),begin:(m,id)=>{state.moveCard(m,id,'table');journal(m)[id]={complete:false,step:0,cards:[],boardBefore:[...m.locations]};},complete:(m,id)=>!!journal(m)[id]?.complete,
 choices:(m,id)=>[{id:'objective-step:'+id,label:'Resolve required Objective deployment'}],apply:(m,id)=>{const j=journal(m)[id],side=m.cards[id].owner;if(j.step===0){const card=m.players[side].reserve.find(x=>m.cards[x].blueprint===side+'-required');state.moveCard(m,card,'table');m.locations.push(card);j.cards.push(card);j.step++;}else {if(fail===true||fail===side){for(const card of j.cards){m.locations=m.locations.filter(x=>x!==card);state.moveCard(m,card,'reserve');}state.moveCard(m,id,'out');j.failed=true;}j.complete=true;}},
 validate:m=>{for(const [id,j]of Object.entries(journal(m))){assert.ok(objectiveRules.isObjective(m,id));assert.equal(m.cards[id].zone,j.failed?'out':'table');assert.ok([0,1].includes(j.step));assert.equal(j.cards.length,j.step);for(const card of j.cards)assert.equal(m.cards[card].zone,j.failed?'reserve':'table');}}};
 const interruptRules=interrupt?{candidates:(m,side)=>m.players[side].reserve.filter(id=>m.cards[id].blueprint.endsWith('-interrupt')),choices:(m,id)=>[{id:'resolve-interrupt',label:'Resolve'}],apply:(m,id)=>{state.moveCard(m,id,'lost');return true;},validate:()=>{}}:undefined;
 const starting={ordinarySetup:()=>true,objectives:objectiveRules,firstPlayer:()=>first,interrupts:interruptRules,location:(m,id)=>m.cards[id]?.blueprint.endsWith('-site')?{identity:m.cards[id].blueprint,group:'test',icons:{dark:1,light:1},convertible:true}:null,placements:(m,ids)=>({side:'dark',choices:[{id:'test',label:'Place',order:ids}]}),name:(m,id)=>m.cards[id].blueprint};
 const rules={id:'objective-protocol',starting,definition:bp=>({side:bp.startsWith('dark')?'dark':'light',name:bp}),supports:()=>true,setupComplete:m=>m.setup.stage==='complete',generation:()=>1,automatic:()=>[],actions:()=>[],initiate:()=>{},resolve:()=>{},decisions:()=>[],choose:()=>{},validate:()=>{}};
 let m=runtime.createMatch('objective-protocol',60,decks,rules);return {m,rules,starting,decks,objectiveRules};
}
const prompt=(m,rules)=>{const p=runtime.prompt(m,rules,'dark');return runtime.prompt(m,rules,p.side);};
const step=(m,rules,id,side=prompt(m,rules).side)=>{const before=clone(m);const out=runtime.applyCommand(m,rules,side,{revision:m.revision,choice:id},()=>19);assert.deepEqual(m,before);for(const seat of sides)assert.deepEqual(runtime.project(out,rules,seat),runtime.project(clone(out),rules,seat));return out;};
function select(f){let m=f.m;for(const side of sides)m=step(m,f.rules,runtime.prompt(m,f.rules,side).choices[0].id,side);return step(m,f.rules,'reveal');}
function objective(f){let m=select(f);while(m.setup.stage!=='objective-resolve')m=step(m,f.rules,prompt(m,f.rules).choices[0].id);return m;}
function finish(m,rules){for(let i=0;i<30&&m.status==='setup';i++)m=step(m,rules,prompt(m,rules).choices[0].id);assert.equal(m.status,'playing');return m;}

test('An Objective is the mandatory starting choice, hidden until simultaneous reveal, without fictitious Force icons',()=>{
 const f=fixture(),p=runtime.prompt(f.m,f.rules,'dark');assert.equal(p.choices.length,1);assert.ok(p.choices[0].id.endsWith('dark-1'));assert.equal(p.choices[0].forceIcons,undefined);
 const m=step(f.m,f.rules,p.choices[0].id,'dark');assert.equal(runtime.project(m,f.rules,'light').setup.selected.dark,null);assert.equal(runtime.project(m,f.rules,'dark').setup.selected.dark.blueprint,'dark-objective');assert.equal(runtime.project(m,f.rules,'light').cards?.['dark-1'],undefined);
 const site=Object.values(m.cards).find(c=>c.blueprint==='dark-site').id;assert.throws(()=>step(f.m,f.rules,'select:'+site,'dark'));assert.throws(()=>runtime.createMatch('duplicate',60,f.decks.map(d=>d.side==='dark'?{...d,cards:['dark-objective',...d.cards.slice(0,59)]}:d),f.rules),/one Objective/);
});
for(const side of sides)test('Opponent ordinary starting location is deployed before the '+side+' Objective',()=>{
 const f=fixture({objectives:[side]}),m=objective(f),id=m.setup.selected[side],j=m.data.objectiveProtocol[id];assert.equal(j.step,0);assert.equal(j.boardBefore.length,1);assert.equal(m.cards[j.boardBefore[0]].owner,side==='dark'?'light':'dark');assert.equal(m.cards[id].zone,'table');assert.equal(m.setup.selected[side],id);assert.equal(m.locations.some(x=>m.cards[x].blueprint===side+'-site'),false);
});
for(const first of sides)test('Two Objectives resolve in the first-player order: '+first,()=>{
 const f=fixture({objectives:sides,first});let m=objective(f);assert.deepEqual(m.setup.objectives.order,[first,first==='dark'?'light':'dark']);assert.equal(prompt(m,f.rules).side,first);const source=m.setup.selected[first];assert.equal(m.cards[m.setup.selected[first==='dark'?'light':'dark']].zone,'reserve');
 m=step(m,f.rules,'objective-step:'+source);assert.equal(m.setup.objectives.resolved,0);m=step(clone(m),f.rules,'objective-step:'+source);assert.equal(m.setup.objectives.resolved,1);assert.equal(prompt(m,f.rules).side,first==='dark'?'light':'dark');m=finish(m,f.rules);assert.equal(m.turn.side,first);assert.equal(m.locations.length,2);assert.equal(m.players.dark.hand.length,8);assert.equal(m.players.light.hand.length,8);
});
test('Failure rolls back provisional deployment and removes the Objective with no ordinary starting fallback',()=>{
 const f=fixture({fail:true});let m=objective(f),id=m.setup.selected.dark;m=step(m,f.rules,'objective-step:'+id);const provisional=m.data.objectiveProtocol[id].cards[0];assert.equal(m.cards[provisional].zone,'table');m=step(clone(m),f.rules,'objective-step:'+id);assert.equal(m.setup.stage,'shuffle');assert.equal(m.cards[id].zone,'out');assert.equal(m.cards[provisional].zone,'reserve');assert.equal(m.locations.length,1);assert.equal(m.cards[m.locations[0]].owner,'light');m=finish(m,f.rules);assert.equal(m.players.dark.reserve.length,51);assert.equal(m.players.dark.hand.length,8);assert.equal(m.setup.selected.dark,id);
});
test('Starting Interrupts begin only after required Objective deployment, with correct opening accounting',()=>{
 const f=fixture({interrupt:true});let m=objective(f),id=m.setup.selected.dark;m=step(m,f.rules,'objective-step:'+id);assert.equal(m.setup.interrupts,undefined);m=step(m,f.rules,'objective-step:'+id);assert.equal(m.setup.stage,'starting-choice');m=finish(m,f.rules);for(const side of sides){assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].lost.length,1);}assert.equal(m.players.dark.reserve.length,49);assert.equal(m.players.light.reserve.length,50);
});
test('Saved Objective progress rejects skipped order, forged completion, wrong selection and early hand draws',()=>{
 const f=fixture({objectives:sides}),m=objective(f);
 for(const edit of [x=>x.setup.objectives.order.reverse(),x=>x.setup.objectives.resolved=1,x=>x.setup.stage='shuffle',x=>x.setup.objectives.opening={dark:{hand:0,reserve:59},light:{hand:0,reserve:60}},x=>delete x.setup.objectives,x=>x.setup.selected.dark=Object.values(x.cards).find(c=>c.blueprint==='dark-site').id,x=>state.moveCard(x,x.players.dark.reserve.at(-1),'hand')]){const bad=clone(m);edit(bad);assert.throws(()=>setup.assertSetup(bad,f.starting));}
});
test('Concession while a private Objective choice is committed does not reveal it',()=>{
 const f=fixture();let m=step(f.m,f.rules,runtime.prompt(f.m,f.rules,'dark').choices[0].id,'dark');m=step(m,f.rules,'concede','light');assert.equal(m.result.winner,'dark');assert.equal(runtime.project(m,f.rules,'light').setup.selected.dark,null);
});

test('Provider exceptions roll back required deployments atomically and stale commands cannot replay them',()=>{
 const f=fixture();let m=objective(f),id=m.setup.selected.dark,before=clone(m),apply=f.objectiveRules.apply;
 f.objectiveRules.apply=(m,id,choice,entropy)=>{apply(m,id,choice,entropy);throw Error('Injected provider failure');};assert.throws(()=>step(m,f.rules,'objective-step:'+id),/Injected/);assert.deepEqual(m,before);
 f.objectiveRules.apply=apply;const revision=m.revision;m=step(m,f.rules,'objective-step:'+id);assert.throws(()=>runtime.applyCommand(clone(m),f.rules,'dark',{revision,choice:'objective-step:'+id}),/Stale/);assert.equal(m.data.objectiveProtocol[id].cards.length,1);m=finish(clone(m),f.rules);assert.equal(m.players.dark.reserve.length,50);
});
test('A second Objective failure preserves the first Objective and all its completed deployments',()=>{
 const f=fixture({objectives:sides,fail:'light'});let m=finish(objective(f),f.rules);const dark=m.setup.selected.dark,light=m.setup.selected.light;
 assert.equal(m.cards[dark].zone,'table');assert.equal(m.cards[light].zone,'out');assert.equal(m.locations.length,1);assert.equal(m.cards[m.locations[0]].owner,'dark');assert.equal(m.setup.objectives.resolved,2);
});
test('A saved hidden selection cannot start an Objective on its back face',()=>{
 const f=fixture(),bad=clone(f.m);bad.cards['dark-1'].face='back';assert.throws(()=>setup.assertSetup(bad,f.starting),/front/);
});
