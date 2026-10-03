import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const module=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=module('runtime'),state=module('state'),cancel=module('cancellation'),ground=module('ground');
const {premiereRules}=module('premiere-rules');
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// All extra cards use explicit test-only admission; production remains closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>runtime.createMatch('cancellation-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_71','1_109','1_109']:['1_234','1_267','1_267']),...d.main].slice(0,60)})),rules);
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<700;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='control'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
const settled=m=>seek(m,x=>x.stack.length===1);
const choose=(m,card,target,character)=>'cancel:play:'+card+':'+target+':'+(character??'direct');
function fixture(side='light',roll=0){let m=fresh();const site=location(m,'light','1_129'),character=pull(m,side,side==='light'?'101_2':'101_5','table',site),opponent=side==='light'?'dark':'light',target=pull(m,opponent,side==='light'?'1_262':'1_115','hand'),sense=pull(m,side,side==='light'?'1_109':'1_267','hand');force(m,'light',8);force(m,'dark',8);m=phase(m);const bp=side==='light'?(roll===0?'1_124':roll===4?'1_105':'101_3'):(roll===0?'101_4':roll===4?'1_207':'101_6'),destiny=pull(m,side,bp,'hand');state.moveCard(m,destiny,'reserve');if(prompt(m).side!==opponent)m=step(m,'pass');m=step(m,'shuffle:'+target+':'+opponent+':reserve');return {m,site,side,opponent,target,sense,character,destiny}}

for(const side of ['light','dark'])for(const value of [0,4,6])test(side+' Sense draws '+value+' against current highest ability and uses strict less-than',()=>{
 const f=fixture(side,value);let m=step(f.m,choose(f.m,f.sense,f.target,f.character));const before=m.players[side].force.length;m=settled(m);assert.equal(m.cards[f.sense].zone,'used');assert.equal(m.cards[f.destiny].zone,'used');assert.equal(m.cards[f.target].zone,value<(side==='light'?4:6)?'lost':'used');assert.equal(m.players[side].force.length,before);assert.equal(m.data.cardPlays.cards.filter(p=>p.card===f.sense).length,1);
});

test('Sense has no destiny mode with only droids, and ties expose each highest character',()=>{
 const f=fixture();let m=f.m;state.moveCard(m,f.character,'hand');const droid=pull(m,'light','1_6','table',f.site);assert.deepEqual(cancel.highestAbilityCharacters(m,'light'),[]);assert.ok(!ids(m).some(id=>id.startsWith('cancel:')));const a=pull(m,'light','1_28','table',f.site),b=pull(m,'light','1_28','table',f.site);assert.deepEqual(new Set(cancel.highestAbilityCharacters(m,'light')),new Set([a,b]));assert.ok(ids(m).includes(choose(m,f.sense,f.target,a)));assert.ok(ids(m).includes(choose(m,f.sense,f.target,b)));assert.ok(!ids(m).includes(choose(m,f.sense,f.target,droid)));
});

for(const side of ['light','dark'])test(side+' Alter cancels Sense without a character or destiny, restoring original Interrupt',()=>{
 const f=fixture(side);let m=f.m;const alter=pull(m,f.opponent,side==='light'?'1_234':'1_71','hand');m=step(m,choose(m,f.sense,f.target,f.character));assert.ok(ids(m).includes(choose(m,alter,f.sense)));m=step(m,choose(m,alter,f.sense));m=settled(m);assert.equal(m.cards[f.target].zone,'used');assert.equal(m.cards[f.sense].zone,'lost');assert.equal(m.cards[alter].zone,'used');assert.equal(m.cards[f.destiny].zone,'reserve');
});

test('Sense countering Alter restores the suspended Sense and cancels only its selected target',()=>{
 const f=fixture();let m=f.m;const alter=pull(m,'dark','1_234','hand'),second=pull(m,'light','1_109','hand');m=step(m,choose(m,f.sense,f.target,f.character));m=step(m,choose(m,alter,f.sense));m=step(m,choose(m,second,alter));m=settled(m);assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[alter].zone,'lost');assert.equal(m.cards[second].zone,'used');assert.equal(m.cards[f.sense].zone,'used');assert.equal(m.cards[f.destiny].zone,'used');assert.ok(m.players.light.used.indexOf(second)>m.players.light.used.indexOf(f.sense));
});

for(const leave of ['leave','return'])test('Sense does not substitute a lower or returning ability target after '+leave,()=>{
 const f=fixture();let m=step(f.m,choose(f.m,f.sense,f.target,f.character));pull(m,'light','1_28','table',f.site);state.moveCard(m,f.character,'hand');if(leave==='return'){state.moveCard(m,f.character,'table');m.cards[f.character].location=f.site}m=settled(m);assert.equal(m.cards[f.target].zone,'used');assert.equal(m.cards[f.sense].zone,'used');assert.equal(m.cards[f.destiny].zone,'used');
});

test('empty Reserve is a failed Sense draw, never a successful zero',()=>{
 const f=fixture();let m=f.m;for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=step(m,choose(m,f.sense,f.target,f.character));m=settled(m);assert.equal(m.cards[f.target].zone,'used');assert.equal(m.cards[f.sense].zone,'used');assert.equal(m.players.light.destiny.length,0);
});

for(const mode of ['table','deploy','immune-table','immune-deploy'])test('Alter '+mode+' honors Effect status and printed immunity',()=>{
 let m=fresh();const site=location(m,'light','1_129'),character=pull(m,'light','101_2','table',site),alter=pull(m,'light','1_71','hand'),immune=mode.startsWith('immune'),target=pull(m,'dark',immune?'1_221':'1_224',mode.endsWith('deploy')?'hand':'table');const host=pull(m,'dark','1_194','table',site);if(immune&&m.cards[target].zone==='table'){m.cards[target].attachedTo=host;m.cards[target].location=site;module('equipment-state').recordEquipment(m).training[target]='power'}force(m,'dark',4);m=phase(m,'deploy');const destiny=pull(m,'light','1_124','hand');state.moveCard(m,destiny,'reserve');
 if(mode.endsWith('deploy'))m=step(m,immune?'attach:'+target+':'+host:'macroscan:'+target);else m=step(m,'pass');
 const id=choose(m,alter,target,character);if(immune){assert.ok(!ids(m).includes(id));return}assert.ok(ids(m).includes(id));m=settled(step(m,id));assert.equal(m.cards[target].zone,'lost');assert.equal(m.cards[alter].zone,'used');assert.equal(m.cards[destiny].zone,'used');if(mode==='deploy')assert.equal(m.players.dark.force.length,2);
});

for(const mode of ['move','deploy'])test('Sense cancels a paid '+mode+' react and retains the physical/title restriction',()=>{
 let m=fresh();const site=location(m,'light','1_129'),adjacent=location(m,'dark','1_292'),vader=pull(m,'dark','101_5','table',site),sense=pull(m,'dark','1_267','hand'),wolf=pull(m,'light','1_30',mode==='move'?'table':'hand',mode==='move'?adjacent:undefined);if(mode==='deploy')pull(m,'light','1_6','table',adjacent);force(m,'dark',4);force(m,'light',4);m=phase(m);const destiny=pull(m,'dark','101_4','hand');state.moveCard(m,destiny,'reserve');m=step(m,'drain:'+site);m=step(m,mode==='move'?'react-move:'+wolf+':'+site:'react-deploy:'+wolf+':'+site);const paid=m.players.light.force.length;m=step(m,choose(m,sense,wolf,vader));m=seek(m,x=>x.cards[sense].zone==='used');assert.equal(m.cards[wolf].zone,mode==='move'?'table':'hand');if(mode==='move')assert.equal(m.cards[wolf].location,adjacent);assert.equal(m.players.light.force.length,paid);assert.equal(ground.canDeployAsReact(m,wolf),false);
});

test('a paid Interrupt stays paid when canceled; cancellation happens before its result',()=>{
 let m=fresh();const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site),stun=pull(m,'dark','1_268','hand'),sense=pull(m,'light','1_109','hand');force(m,'dark',4);m=phase(m);const destiny=pull(m,'light','1_124','hand');state.moveCard(m,destiny,'reserve');m=step(m,'stun:play:'+stun+':'+luke);m=step(m,choose(m,sense,stun,luke));m=settled(m);assert.equal(m.cards[luke].zone,'table');assert.equal(m.cards[stun].zone,'lost');assert.equal(m.players.dark.force.length,2);
});

test('cancellation targets exact pending frames; malformed saved references are rejected',()=>{
 const f=fixture();let m=step(f.m,choose(f.m,f.sense,f.target,f.character));for(const mutate of [p=>p.targetIndex=99,p=>p.actionId='invented',p=>p.windowSerial=0,p=>p.characterRef.version=999,p=>p.mode='invented']){const bad=clone(m);mutate(bad.stack.find(r=>r.kind==='resolution'&&r.action.handler==='cancel:play').action.payload);assert.throws(()=>runtime.prompt(bad,rules,'dark'),/cancellation|reference/)}
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');assert.ok(!ids(m).some(id=>id.startsWith('cancel:')));for(const side of ['dark','light'])assert.ok(!JSON.stringify(runtime.project(m,rules,side)).includes('targetIndex'));
});

test('retired frames survive recovery without reopening canceled actions or shifting parents',()=>{
 const f=fixture();let m=step(f.m,choose(f.m,f.sense,f.target,f.character));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='card-canceled');
 assert.equal(m.cards[f.target].zone,'lost');const index=m.stack.findIndex(f=>f.kind==='resolution'&&f.action.handler==='core:canceled');assert.ok(index>=0);
 for(const mutate of [f=>f.cancelled=false,f=>f.awaitingResponses=true,f=>f.action.source='forged',f=>f.action.payload={}]){const bad=clone(m);mutate(bad.stack[index]);assert.throws(()=>runtime.prompt(bad,rules,'light'),/retired action/)}
 m=settled(m);assert.ok(!m.stack.some(f=>f.kind==='resolution'));assert.equal(m.cards[f.sense].zone,'used');
});

test('a second Sense may answer the still-pending Interrupt after the first fails',()=>{
 const f=fixture('light',4);let m=f.m;const second=pull(m,'light','1_109','hand'),zero=pull(m,'light','1_124','hand');m=step(m,choose(m,f.sense,f.target,f.character));m=seek(m,x=>x.cards[f.sense].zone==='used');state.moveCard(m,zero,'reserve');
 if(prompt(m).side!=='light')m=step(m,'pass');assert.ok(ids(m).includes(choose(m,second,f.target,f.character)));m=settled(step(m,choose(m,second,f.target,f.character)));assert.equal(m.cards[f.target].zone,'lost');assert.equal(m.cards[second].zone,'used');
});

test('Alter cannot follow a returned Effect into a new table instance',()=>{
 let m=fresh();const site=location(m,'light','1_129'),hero=pull(m,'light','101_2','table',site),alter=pull(m,'light','1_71','hand'),macro=pull(m,'dark','1_224','table');m=phase(m);m=step(m,'pass');m=step(m,choose(m,alter,macro,hero));state.moveCard(m,macro,'hand');state.moveCard(m,macro,'table');const reserve=m.players.light.reserve.length;m=settled(m);assert.equal(m.cards[macro].zone,'table');assert.equal(m.cards[alter].zone,'used');assert.equal(m.players.light.reserve.length,reserve);
});

test('Sai’torr Kal Fas is immune to either player’s Alter on table',()=>{
 let m=fresh();const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site);pull(m,'dark','101_5','table',site);const effect=pull(m,'light','1_64','table',site);m.cards[effect].attachedTo=luke;module('equipment-state').recordEquipment(m).training[effect]='power';pull(m,'light','1_71','hand');pull(m,'dark','1_234','hand');m=phase(m);for(let i=0;i<2;i++){assert.ok(!ids(m).some(id=>id.startsWith('cancel:')));m=step(m,'pass')}
});

const reference=JSON.parse(fs.readFileSync(new URL('./gemp/cancellation-results.json',import.meta.url)));
for(const row of reference.filter(r=>r.name.startsWith('light-')||r.name.startsWith('dark-')))test('actual GEMP cancellation comparison '+row.name,()=>{
 const [side,mode]=row.name.split('-'),f=fixture(side,mode==='equal'?(side==='light'?4:6):0);let m=f.m;
 const alter=pull(m,f.opponent,side==='light'?'1_234':'1_71','hand'),second=pull(m,side,side==='light'?'1_109':'1_267','hand');
 if(mode==='empty')for(const id of [...m.players[side].reserve])state.moveCard(m,id,'hand');const before=m.players[side].reserve.length;
 m=step(m,choose(m,f.sense,f.target,f.character));
 if(mode==='leave'||mode==='return'){state.moveCard(m,f.character,'hand');if(mode==='return'){state.moveCard(m,f.character,'table');m.cards[f.character].location=f.site}}
 if(mode==='counter'||mode==='nested'){m=step(m,choose(m,alter,f.sense));if(mode==='nested')m=step(m,choose(m,second,alter))}m=settled(m);
 const actual={name:row.name,targetLost:m.cards[f.target].zone==='lost',senseUsed:m.cards[f.sense].zone==='used',senseLost:m.cards[f.sense].zone==='lost',alterUsed:m.cards[alter].zone==='used',alterLost:m.cards[alter].zone==='lost',secondUsed:m.cards[second].zone==='used',cardsDrawn:before-m.players[side].reserve.length};
 if(mode==='leave'||mode==='return'){
  // Controlled GEMP removal leaves its mutable ability target usable. Native
  // retains the original table-instance requirement. Not claimed as parity.
  assert.equal(row.targetLost,true);assert.deepEqual(actual,{...row,targetLost:false});
 }else assert.deepEqual(actual,row);
});
for(const row of reference.filter(r=>['table','deploy','immune-table','immune-deploy'].includes(r.name)))test('actual GEMP Alter comparison '+row.name,()=>{
 let m=fresh();const site=location(m,'light','1_129'),character=pull(m,'light','101_2','table',site),alter=pull(m,'light','1_71','hand'),immune=row.name.startsWith('immune'),target=pull(m,'dark',immune?'1_221':'1_224','hand'),host=pull(m,'dark','1_194','table',site);force(m,'dark',4);m=phase(m,'deploy');const d=pull(m,'light','1_124','hand');state.moveCard(m,d,'reserve');const before=m.players.light.reserve.length;
 m=step(m,immune?'attach:'+target+':'+host:'macroscan:'+target);if(row.name.endsWith('table')){m=settled(m);if(prompt(m).side!=='light')m=step(m,'pass')}
 const id=choose(m,alter,target,character);if(immune){assert.deepEqual({name:row.name,offered:ids(m).includes(id)},row);return}
 m=settled(step(m,id));assert.deepEqual({name:row.name,targetLost:m.cards[target].zone==='lost',alterUsed:m.cards[alter].zone==='used',cardsDrawn:before-m.players.light.reserve.length,forceSpent:4-m.players.dark.force.length},row);
});
for(const row of reference.filter(r=>r.name.startsWith('react-')))test('actual GEMP '+row.name+' Sense comparison',()=>{
 const mode=row.name.slice(6);let m=fresh();const site=location(m,'light','1_129'),adjacent=location(m,'light','1_131'),vader=pull(m,'dark','101_5','table',site),sense=pull(m,'dark','1_267','hand'),wolf=pull(m,'light','1_30',mode==='move'?'table':'hand',mode==='move'?adjacent:undefined);if(mode==='deploy')pull(m,'light','1_6','table',adjacent);force(m,'dark',4);force(m,'light',4);m=phase(m);const d=pull(m,'dark','101_4','hand');state.moveCard(m,d,'reserve');m=step(m,'drain:'+site);m=step(m,mode==='move'?'react-move:'+wolf+':'+site:'react-deploy:'+wolf+':'+site);m=step(m,choose(m,sense,wolf,vader));m=seek(m,x=>x.cards[sense].zone==='used');assert.deepEqual({name:row.name,returnedToHand:m.cards[wolf].zone==='hand',stayedAtOrigin:m.cards[wolf].location===adjacent,forceSpent:4-m.players.light.force.length,senseUsed:true},row);
});
