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
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const equipment=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));

function attach(m,bp,host,side='dark'){const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;return id;}
function fixture(){
 let m=fresh({dark:['1_315','1_315','1_201','1_201','1_196','1_196','1_196','1_194','1_194','1_317','1_317','1_207','1_207','1_322','1_322','1_186'],light:['1_28','1_28','1_152','1_152','1_30','1_30']});
 const site=location(m,'light','1_129'),adjacent=location(m,'light','1_130'),remote=location(m,'light','1_132'),host=pull(m,'dark','1_196','table',site),otherHost=pull(m,'dark','1_196','table',adjacent),trooper=pull(m,'dark','1_194','table',site),target=pull(m,'light','1_28','table',site),otherTarget=pull(m,'light','1_28','table',site),com=attach(m,'1_201',host),gun=attach(m,'1_152',target,'light'),stick=pull(m,'dark','1_315','hand'),second=pull(m,'dark','1_315','hand');
 force(m,'dark',10);force(m,'light',6);m=phase(m);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);m=step(m,'battle:'+site);return {m,site,adjacent,remote,host,otherHost,trooper,target,otherTarget,com,gun,stick,second};
}
const parent=m=>m.stack.at(-2);
const back=m=>seek(m,x=>x.stack.length===3&&parent(x)?.action?.handler==='battle:begin');
const reactId=(f,id=f.stick,host=f.host)=>'gaffi:equip:'+id+':'+host+':react:via:'+f.com;
function canceled(m,id){m=step(m,id);parent(m).cancelled=true;return back(m);}

test('Comlink deploys a stick during opponent battle initiation, then permits firing',()=>{
 const f=fixture(),before=f.m.players.dark.force.length;let m=step(f.m,reactId(f));assert.equal(m.players.dark.force.length,before-2);assert.equal(m.cards[f.stick].zone,'playing');assert.ok(ground.usage(m).reacted.includes(f.stick));m=back(m);assert.equal(m.cards[f.stick].attachedTo,f.host);m=priority(m,'dark');assert.ok(ids(m).includes('gaffi:fire:'+f.stick+':'+f.target));m=step(m,'gaffi:fire:'+f.stick+':'+f.target);m=seek(m,x=>event(x)?.kind==='battle-weapons');assert.equal(combat.battle(m).gaffiShots.length,1);assert.deepEqual(equipment.equipmentState(m).devices,{});
});
test('react stick requires own Raider at battle site and legal source range',()=>{
 const f=fixture();assert.ok(!ids(f.m).includes(reactId(f,f.stick,f.otherHost)));assert.ok(!ids(f.m).includes(reactId(f,f.stick,f.trooper)));assert.ok(!ids(f.m).includes(reactId(f,f.stick,f.target)));board.moveWithAttachments(f.m,f.host,f.remote);assert.ok(!ids(f.m).some(id=>id.startsWith('gaffi:equip:')));
});
test('a Comlink at an adjacent site grants deployment on the battling Raider',()=>{
 const f=fixture();f.m.cards[f.com].attachedTo=f.otherHost;f.m.cards[f.com].location=f.adjacent;assert.ok(ids(f.m).includes(reactId(f)));board.moveWithAttachments(f.m,f.otherHost,f.remote);assert.ok(!ids(f.m).some(id=>id.startsWith('gaffi:equip:')));
});
test('react cannot transfer a table stick or proceed without enough Force',()=>{
 const f=fixture();state.moveCard(f.m,f.stick,'table');f.m.cards[f.stick].attachedTo=f.otherHost;f.m.cards[f.stick].location=f.adjacent;assert.ok(!ids(f.m).some(id=>id.startsWith('gaffi:equip:'+f.stick+':')));for(const id of [...f.m.players.dark.force].slice(1))state.moveCard(f.m,id,'used');assert.ok(!ids(f.m).some(id=>id.startsWith('gaffi:equip:')));
});
test('canceled stick react returns to hand, retains costs and blocks every copy this turn',()=>{
 const f=fixture(),before=f.m.players.dark.force.length;let m=canceled(f.m,reactId(f));assert.equal(m.cards[f.stick].zone,'hand');assert.equal(m.players.dark.force.length,before-2);m=priority(m,'dark');assert.ok(!ids(m).some(id=>id.startsWith('gaffi:equip:')));assert.deepEqual(ground.usage(m).cancelledReactTitles,['Gaderffii Stick']);assert.equal(ground.canDeployAsReact(m,f.second),false);assert.deepEqual(equipment.equipmentState(m).devices,{});
 m=seek(m,x=>x.turn.number===3&&x.turn.phase==='deploy'&&x.stack.length===1);assert.equal(ground.canDeployAsReact(m,f.second),true);assert.ok(ids(m).includes('gaffi:equip:'+f.stick+':'+f.host));
});
for(const [bp,handler,cost] of [['1_194','ground:deploy',1],['1_317','battle:equip',1],['1_207','equipment:attach',1],['1_322','equipment:mine',0]])test('shared canceled react preserves hand and title limit for '+handler,()=>{
 const f=fixture();if(bp==='1_322')pull(f.m,'dark','1_186','table',f.site);const card=pull(f.m,'dark',bp,'hand'),copy=pull(f.m,'dark',bp,'hand'),actions=premiereRules.actions(f.m,f.m.stack.at(-1),'dark'),a=actions.find(a=>a.handler===handler&&a.payload.card===card&&a.payload.react);assert.ok(a);const before=f.m.players.dark.force.length;let m=canceled(f.m,a.id);assert.equal(m.cards[card].zone,'hand');assert.equal(m.players.dark.force.length,before-cost);assert.equal(ground.canDeployAsReact(m,copy),false);m=priority(m,'dark');assert.ok(!premiereRules.actions(m,m.stack.at(-1),'dark').some(a=>a.payload.card===copy&&a.payload.react));assert.ok(ids(m).includes(reactId(f)), 'other title remains available');
});
test('canceled movement react retains the source site but does not ban other copies',()=>{
 const f=fixture();let m=seek(f.m,x=>x.turn.side==='dark'&&x.turn.phase==='battle'&&x.stack.length===1);const a=pull(m,'light','1_30','table',f.adjacent),b=pull(m,'light','1_30','table',f.adjacent);m=step(m,'battle:'+f.site);const before=m.players.light.force.length;m=step(m,'react-move:'+a+':'+f.site);parent(m).cancelled=true;m=back(m);m=priority(m,'light');assert.equal(m.cards[a].location,f.adjacent);assert.equal(m.players.light.force.length,before-1);assert.ok(!ids(m).includes('react-move:'+a+':'+f.site));assert.ok(ids(m).includes('react-move:'+b+':'+f.site));assert.ok(!ground.usage(m).cancelledReactTitles?.includes('Shistavanen Wolfman'));assert.equal(ground.canMove(m,a),true);
});
test('unique canceled deploy-react blocks physical attempt without banning another copy',()=>{
 const f=fixture();const vader=pull(f.m,'dark','101_5','hand');const m=clone(f.m);state.moveCard(m,vader,'playing');const r={kind:'resolution',actor:'dark',cancelled:true,action:{handler:'ground:deploy',id:'fixture',label:'fixture',payload:{card:vader,site:f.site,react:true}}};assert.equal(ground.resolveCancelledReact(m,r),true);assert.equal(m.cards[vader].zone,'hand');assert.ok(!ground.usage(m).cancelledReactTitles?.includes('Vader'));assert.equal(ground.canDeployAsReact(m,vader),false);
});
test('deploy-react target leaving its site cannot receive the stick',()=>{const f=fixture();let m=step(f.m,reactId(f));board.moveWithAttachments(m,f.host,f.adjacent);m=back(m);assert.equal(m.cards[f.stick].zone,'lost');assert.equal(m.cards[f.stick].attachedTo,undefined);});
test('multiple successful stick reacts remain separate paid deployments',()=>{const f=fixture();let m=back(step(f.m,reactId(f)));m=priority(m,'dark');m=back(step(m,reactId(f,f.second)));assert.equal(m.cards[f.second].attachedTo,f.host);assert.deepEqual(ground.usage(m).reacted,[f.stick,f.second]);assert.equal(m.players.dark.force.length,f.m.players.dark.force.length-4);});
test('fabricated, stale and foreign reacts fail atomically, including corrupt title history',()=>{const f=fixture(),before=clone(f.m);assert.throws(()=>step(f.m,reactId(f,f.stick,f.target)));assert.throws(()=>runtime.applyCommand(f.m,rules,'dark',{revision:f.m.revision-1,choice:reactId(f)}));assert.throws(()=>step(f.m,reactId(f),'light'));assert.deepEqual(f.m,before);const m=canceled(f.m,reactId(f));ground.record(m).cancelledReactTitles=['unknown'];assert.throws(()=>prompt(m));});
test('concession stops a pending deploy-react without attaching its card',()=>{const f=fixture();const m=step(step(f.m,reactId(f)),'concede','dark');assert.equal(runtime.prompt(m,rules,'light'),null);assert.equal(m.cards[f.stick].zone,'playing');});
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/react-weapons-results.json',import.meta.url)));
for(const observed of reference)test('react outcome matches executed GEMP: '+observed.name,()=>{
 const f=fixture(),before=f.m.players.dark.force.length;
 if(observed.name==='react-then-fire'){
  let m=priority(back(step(f.m,reactId(f))),'dark');assert.equal(ids(m).includes('gaffi:fire:'+f.stick+':'+f.target),observed.fireAvailable);const first=pull(m,'dark','1_317','hand'),second=pull(m,'dark','1_317','hand');state.moveCard(m,second,'reserve');state.moveCard(m,first,'reserve');m=step(m,'gaffi:fire:'+f.stick+':'+f.target);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');assert.equal(ids(m).some(id=>id.startsWith('fire:'+f.gun+':')),observed.gunAvailable);assert.equal(before-m.players.dark.force.length,observed.forceSpent);return;
 }
 const key=observed.name.replace('cancel-react-',''),bp={stick:'1_315',trooper:'1_194',blaster:'1_317',belt:'1_207',mine:'1_322'}[key];if(key==='mine')pull(f.m,'dark','1_186','table',f.site);const card=key==='stick'?f.stick:pull(f.m,'dark',bp,'hand'),copy=key==='stick'?f.second:pull(f.m,'dark',bp,'hand');const a=premiereRules.actions(f.m,f.m.stack.at(-1),'dark').find(a=>a.payload.card===card&&a.payload.react);let m=canceled(f.m,a.id);m=priority(m,'dark');assert.equal(m.cards[card].zone==='hand',observed.returnedToHand);assert.equal(before-m.players.dark.force.length,observed.forceSpent);assert.equal(premiereRules.actions(m,m.stack.at(-1),'dark').some(a=>a.payload.card===copy&&a.payload.react),observed.copyOffered);
});
