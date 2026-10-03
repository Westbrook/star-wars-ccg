import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks,seeded} from './match-runner.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
// Test-only admission. Components below use deliberate boards; complete games
// use ordinary shuffled setup with explicit test-deck extensions.
const rules={...auditRules,starting:undefined,supports:()=>true,setupComplete:()=>true,
 resolve:(m,r,c)=>r.action.handler==='probe:done'?m.data.observed=r.action.payload:auditRules.resolve(m,r,c)};
const extras={light:['1_37','1_37','1_41','1_41','2_14','1_2','1_22'],dark:['1_247','1_247']};
function decks(size=60){return starterDecks(size).map(d=>{
 const cards=[...d.cards];for(const bp of extras[d.side]){const index=cards.findIndex((id,i)=>cards.indexOf(id)!==i);assert.ok(index>=0);cards.splice(index,1);cards.push(bp)}return {...d,cards};
})}
function fresh(){return runtime.createMatch('cpu-cards',60,decks(),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.find(id=>m.cards[id].blueprint===(side==='light'?'1_28':'1_194')),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
function step(m,choice){return runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice},()=>0)}
function seek(m,fn){for(let i=0;i<900;i++){if(fn(m))return m;const p=prompt(m);assert.ok(p);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('Boundary not reached')}
function phase(m,side,name){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.side===side&&x.turn.phase===name&&x.stack.length===1&&x.stack[0].timing==='phase'&&prompt(x).side===side)}
function cpu(m,side){const v=runtime.project(m,rules,side),before=clone(v),id=chooseComputerAction(v,side);assert.deepEqual(v,before);assert.ok(v.prompt.choices.some(c=>c.id===id));assert.equal(chooseComputerAction(clone(v),side),id);return id}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function settle(m){return seek(m,x=>x.stack.length===1)}

test('CPU deploys one Station and a supporting Vaporator through legal paid actions',()=>{
 let m=fresh();const site=location(m,'light','1_132');location(m,'dark','1_284');
 const station=pull(m,'light','1_37','hand'),vapor=pull(m,'light','1_41','hand');force(m,'light',4);m=phase(m,'light','deploy');
 const before=m.players.light.force.length;
 assert.equal(cpu(m,'light'),'farm-deploy:'+station+':'+site);m=settle(step(m,cpu(m,'light')));m=priority(m,'light');
 assert.equal(cpu(m,'light'),'farm-deploy:'+vapor+':'+site);m=settle(step(m,cpu(m,'light')));
 assert.equal(m.cards[station].attachedTo,site);assert.equal(m.cards[vapor].attachedTo,site);assert.equal(m.players.light.force.length,before-2);
 const duplicate=pull(m,'light','1_37','hand'),duplicateVapor=pull(m,'light','1_41','hand');m=priority(m,'light');
 assert.ok(prompt(m).choices.some(c=>c.id==='farm-deploy:'+duplicate+':'+site));assert.ok(prompt(m).choices.some(c=>c.id==='farm-deploy:'+duplicateVapor+':'+site));assert.equal(cpu(m,'light'),'pass');
});
test('CPU puts Vaporator protection beside its own troops instead of protecting only the opponent',()=>{
 let m=fresh();const site=location(m,'light','1_132'),middle=location(m,'light','1_130'),remote=location(m,'light','1_131');m.locations=[site,middle,remote];
 pull(m,'light','1_28','table',site);pull(m,'dark','1_194','table',remote);const vapor=pull(m,'light','1_41','hand');force(m,'light',2);m=phase(m,'light','deploy');
 assert.equal(cpu(m,'light'),'farm-deploy:'+vapor+':'+site);m=settle(step(m,cpu(m,'light')));assert.equal(m.cards[vapor].attachedTo,site);
});
function stationWindow(){let m=fresh();const site=location(m,'light','1_132');location(m,'dark','1_284');const station=pull(m,'light','1_37');m.cards[station].attachedTo=site;m=phase(m,'light','activate');m=step(m,'core:activate');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-activated');m=priority(m,'light');return {m,station};}
test('CPU accepts a real activation response, draws once, and cannot replay it after refresh',()=>{
 let {m,station}=stationWindow();const card=m.players.light.force[0];assert.equal(cpu(m,'light'),'hydroponics:'+station);m=settle(step(clone(m),cpu(m,'light')));assert.equal(m.cards[card].zone,'hand');assert.equal(m.players.light.hand.length,1);assert.ok(!prompt(m).choices.some(c=>c.id==='hydroponics:'+station));
});
test('CPU preserves scarce Force for its hand and takes a Station draw when resources permit',()=>{
 let {m,station}=stationWindow();pull(m,'light','101_2','hand');pull(m,'light','1_28','hand');pull(m,'light','1_37','hand');
 // Public estimate: one available Force and no remaining ordinary activation.
 m.turn.activated=m.turn.generation;assert.equal(cpu(m,'light'),'pass');
 const activated=m.players.light.force[0];force(m,'light',5);m.players.light.force=[activated,...m.players.light.force.filter(id=>id!==activated)];assert.equal(cpu(m,'light'),'hydroponics:'+station);
});
for(const branch of ['activate','draw'])test('CPU takes R2 '+branch+' from an actual opponent destiny window',()=>{
 let m=fresh();const site=location(m,'light','1_129');location(m,'dark','1_284');const r2=pull(m,'light','2_14','table',site),source=pull(m,'dark','1_251','playing');m=phase(m,'dark','deploy');
 const card=pull(m,'dark','1_194','hand');state.moveCard(m,card,'reserve');
 destiny.drawDestiny(m,'dark',source,'probe',{id:'done',label:'Done',handler:'probe:done',payload:{}},true,branch==='draw'?3:0);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');m=priority(m,'light');const top=m.players.light.reserve[0];
 assert.equal(cpu(m,'light'),'r2:'+r2+':'+branch);m=seek(step(m,cpu(m,'light')),x=>!!x.data.observed);assert.equal(m.cards[top].zone,branch==='draw'?'hand':'force');
});
test('CPU takes the lower-ability Gravel target using current values and resolves the loss',()=>{
 let m=fresh();const site=location(m,'light','1_132');location(m,'dark','1_284');const target=pull(m,'light','1_2','table',site),luke=pull(m,'light','101_2','table',site),card=pull(m,'dark','1_247','hand');m=phase(m,'dark','deploy');
 const draw=pull(m,'dark','1_247','hand');state.moveCard(m,draw,'reserve');assert.equal(cpu(m,'dark'),'gravel:play:'+card+':'+target);
 // Changing unobserved Reserve order never changes the policy's decision.
 const reordered=clone(m);reordered.players.dark.reserve.reverse();assert.equal(cpu(reordered,'dark'),cpu(m,'dark'));
 m=settle(step(m,cpu(m,'dark')));assert.equal(m.cards[target].zone,'lost');assert.equal(m.cards[luke].zone,'table');assert.equal(m.cards[card].zone,'lost');
});
test('CPU does not invent a Gravel action through Vaporator protection',()=>{
 let m=fresh();const site=location(m,'light','1_132');location(m,'dark','1_284');pull(m,'light','1_2','table',site);const vapor=pull(m,'light','1_41');m.cards[vapor].attachedTo=site;pull(m,'dark','1_247','hand');m=phase(m,'dark','deploy');assert.equal(cpu(m,'dark'),'pass');
});
test('draw safeguards apply to Hydroponics and R2 but allow free activation of final Life Force',()=>{
 const v={status:'playing',turn:{side:'light',phase:'activate',generation:3,activated:1},table:[],locations:[],players:{light:{hand:[],lost:[],destiny:[],lifeForce:1,counts:{force:1,reserve:0}}},prompt:{side:'light',timing:'response',choices:[]}};
 const choose=id=>{v.prompt.choices=[{id,label:id},{id:'pass',label:'Pass'}];return chooseComputerAction(v,'light')};
 assert.equal(choose('hydroponics:s'),'pass');assert.equal(choose('r2:r:draw'),'pass');assert.equal(choose('r2:r:activate'),'r2:r:activate');v.players.light.lifeForce=10;v.players.light.hand=Array.from({length:9},(_,i)=>({id:'h'+i,blueprint:'1_28'}));assert.equal(choose('r2:r:draw'),'pass');assert.equal(choose('hydroponics:s'),'pass');
});
test('Gravel passes on a high current ability or empty Reserve rather than spending the card',()=>{
 const v={status:'playing',turn:{side:'dark'},table:[{id:'t',blueprint:'1_2',owner:'light',zone:'table'}],players:{dark:{hand:[],lost:[],destiny:[],lifeForce:10,counts:{reserve:10}}},rules:{values:{characters:{t:{power:1,ability:4,forfeit:3}},sites:{}}},prompt:{side:'dark',timing:'phase',choices:[{id:'gravel:play:g:t',label:'Gravel'},{id:'pass',label:'Pass'}]}};
 assert.equal(chooseComputerAction(v,'dark'),'pass');v.rules.values.characters.t.ability=0;assert.equal(chooseComputerAction(v,'dark'),'gravel:play:g:t');v.players.dark.counts.reserve=0;assert.equal(chooseComputerAction(v,'dark'),'pass');
});
test('Station planning cannot spend future activation beyond the visible Reserve count',()=>{
 const v={status:'playing',turn:{side:'light',phase:'activate',generation:10,activated:1},table:[],players:{light:{hand:Array.from({length:3},(_,i)=>({id:'h'+i,blueprint:'1_28'})),lost:[],destiny:[],lifeForce:10,counts:{force:1,reserve:1}}},prompt:{side:'light',timing:'response',choices:[{id:'hydroponics:s',label:'Draw'},{id:'pass',label:'Pass'}]}};
 assert.equal(chooseComputerAction(v,'light'),'pass');v.players.light.counts.reserve=5;assert.equal(chooseComputerAction(v,'light'),'hydroponics:s');
});
for(const size of [40,60])test('CPU completes an extended '+size+'-card shuffled game and uses new card actions',t=>{
 const fullRules={...auditRules,supports:()=>true,starting:{...auditRules.starting,ordinarySetup:()=>true}},entropy=seeded(8),seen=new Set();
 let m=runtime.createMatch('cpu-extended-'+size,size,decks(size),fullRules),now=1_800_000_000_000;
 for(let i=0;i<18000&&m.status!=='finished';i++){
  now+=1000;m=runtime.advanceTime(clone(m),fullRules,now,entropy);if(m.status==='finished')break;
  let v=runtime.project(m,fullRules,'dark',now),side='dark';if(!v.prompt?.choices.length){side='light';v=runtime.project(m,fullRules,side,now)}
  const before=clone(v),choice=chooseComputerAction(v,side);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');assert.deepEqual(v,before);assert.equal(chooseComputerAction(clone(v),side),choice);seen.add(choice.split(':')[0]);m=runtime.applyCommand(clone(m),fullRules,side,{revision:m.revision,choice},entropy,now);
 }
 assert.equal(m.status,'finished');assert.equal(m.result.reason,'life-force');for(const kind of ['farm-deploy','hydroponics','gravel'])assert.ok(seen.has(kind),'Missing '+kind);t.diagnostic('New action families used: '+[...seen].filter(k=>['farm-deploy','hydroponics','r2','gravel'].includes(k)).join(', '));
 for(const bp of Object.values(extras).flat())assert.equal(premiereRules.supports(bp),false);
});
